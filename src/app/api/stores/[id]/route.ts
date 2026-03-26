import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";

interface Params {
  params: Promise<{ id: string }>;
}

// PUT may trigger geocoding (Nominatim: up to ~5s with retries)
export const maxDuration = 30;

// GET /api/stores/[id] — Get a single store
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!store) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
  }

  return NextResponse.json(store);
}

// PUT /api/stores/[id] — Update a store
export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
  }

  const body = await request.json();
  const { name, address, latitude, longitude, tokubaiShopUrl } = body;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
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
  }

  // Auto-geocode: if address changes and no explicit lat/lon, derive coordinates
  let resolvedLat: number | null | undefined =
    latitude !== undefined ? (latitude != null ? Number(latitude) : null) : undefined;
  let resolvedLng: number | null | undefined =
    longitude !== undefined ? (longitude != null ? Number(longitude) : null) : undefined;
  if (
    address !== undefined &&
    resolvedLat == null &&
    resolvedLng == null &&
    address?.trim()
  ) {
    const coords = await geocodeAddress(address.trim());
    if (coords) {
      resolvedLat = coords.latitude;
      resolvedLng = coords.longitude;
    }
  }

  const store = await prisma.store.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(address !== undefined && { address: address?.trim() || null }),
      ...(resolvedLat !== undefined && { latitude: resolvedLat }),
      ...(resolvedLng !== undefined && { longitude: resolvedLng }),
      ...(tokubaiShopUrl !== undefined && { tokubaiShopUrl: tokubaiShopUrl?.trim() || null }),
    },
  });

  return NextResponse.json(store);
}

// DELETE /api/stores/[id] — Delete a store
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
  }

  await prisma.store.delete({ where: { id } });

  return NextResponse.json({ message: "店舗を削除しました" });
}
