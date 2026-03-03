import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";

interface Params {
  params: Promise<{ id: string }>;
}

// Geocoding may take up to ~5s (3 Nominatim retries × 1.1s delay)
export const maxDuration = 30;

/**
 * POST /api/stores/[id]/geocode — Re-geocode a store's address to GPS coordinates.
 * Useful when auto-geocoding at save time failed (Nominatim miss).
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
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

  if (!store.address) {
    return NextResponse.json(
      { error: "住所が登録されていません" },
      { status: 400 },
    );
  }

  const coords = await geocodeAddress(store.address);

  if (!coords) {
    return NextResponse.json(
      { error: "住所から座標を取得できませんでした。住所を確認してください。" },
      { status: 422 },
    );
  }

  const updated = await prisma.store.update({
    where: { id },
    data: {
      latitude: coords.latitude,
      longitude: coords.longitude,
    },
  });

  return NextResponse.json(updated);
}
