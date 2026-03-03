import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBottomPrices } from "@/lib/bottom-price";

/**
 * GET /api/dashboard/products — Product bottom prices list
 * Query params:
 *   categoryId - filter by category
 *   q          - search query
 *   limit      - items per page (default: 20)
 *   cursor     - pagination cursor
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") || undefined;
  const query = searchParams.get("q") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20");
  const cursor = searchParams.get("cursor") || undefined;

  const result = await getBottomPrices(session.user.id, {
    categoryId,
    query,
    limit: Math.min(limit, 50),
    cursor,
  });

  return NextResponse.json(result);
}
