import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";

// POST may trigger geocoding (Nominatim: up to ~5s with retries)
export const maxDuration = 30;

// GET /api/stores — List user's stores
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stores = await prisma.store.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      scrapingJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          imagesScraped: true,
          pricesRegistered: true,
          completedAt: true,
          createdAt: true,
        },
      },
    },
  });

  const result = stores.map((store) => ({
    ...store,
    lastJob: store.scrapingJobs?.[0] || null,
    scrapingJobs: undefined,
  }));

  return NextResponse.json(result);
}

// POST /api/stores — Create a new store
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, address, latitude, longitude, tokubaiShopUrl } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "店舗名は必須です" },
      { status: 400 }
    );
  }

  if (name.trim().length > 100) {
    return NextResponse.json(
      { error: "店舗名は100文字以内で入力してください" },
      { status: 400 }
    );
  }

  // Auto-geocode: derive lat/lon from address if not explicitly provided
  let resolvedLat: number | null = latitude != null ? Number(latitude) : null;
  let resolvedLng: number | null = longitude != null ? Number(longitude) : null;
  if (resolvedLat == null && resolvedLng == null && address?.trim()) {
    const coords = await geocodeAddress(address.trim());
    if (coords) {
      resolvedLat = coords.latitude;
      resolvedLng = coords.longitude;
    }
  }

  const store = await prisma.store.create({
    data: {
      name: name.trim(),
      address: address?.trim() || null,
      latitude: resolvedLat,
      longitude: resolvedLng,
      userId: session.user.id,
      tokubaiShopUrl: tokubaiShopUrl?.trim() || null,
    },
  });

  return NextResponse.json(store, { status: 201 });
}
