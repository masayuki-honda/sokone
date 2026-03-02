import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDashboardStats,
  getRecentPrices,
} from "@/lib/bottom-price";

/**
 * GET /api/dashboard — Dashboard overview data
 * Returns summary stats and recent price registrations
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const recentLimit = parseInt(searchParams.get("recentLimit") || "10");

  const [stats, recentPrices] = await Promise.all([
    getDashboardStats(session.user.id),
    getRecentPrices(session.user.id, Math.min(recentLimit, 50)),
  ]);

  return NextResponse.json({
    stats,
    recentPrices,
  });
}
