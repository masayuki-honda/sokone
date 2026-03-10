import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Maximum distance in km to consider a store "nearby"
const MAX_DISTANCE_KM = 1;

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /api/stores/nearby?lat=xxx&lng=xxx — Find the nearest store to GPS coordinates
 *
 * Used for auto-suggesting a store based on photo EXIF GPS data.
 * Only returns stores with registered coordinates within MAX_DISTANCE_KM.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");

  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json(
      { error: "lat と lng パラメータが必要です" },
      { status: 400 },
    );
  }

  // Get all user stores that have coordinates
  const stores = await prisma.store.findMany({
    where: {
      userId: session.user.id,
      latitude: { not: null },
      longitude: { not: null },
    },
  });

  // Find the nearest store within the threshold
  let nearest: (typeof stores)[0] | null = null;
  let minDistance = Infinity;

  for (const store of stores) {
    if (store.latitude == null || store.longitude == null) continue;

    const distance = haversineDistance(lat, lng, store.latitude, store.longitude);
    if (distance < minDistance && distance <= MAX_DISTANCE_KM) {
      minDistance = distance;
      nearest = store;
    }
  }

  if (!nearest) {
    return NextResponse.json({ store: null, message: "近くに登録済み店舗がありません" });
  }

  return NextResponse.json({
    store: {
      id: nearest.id,
      name: nearest.name,
      address: nearest.address,
      distance: Math.round(minDistance * 1000), // meters
    },
  });
}
