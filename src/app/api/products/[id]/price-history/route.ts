import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/products/[id]/price-history — Price history for a product
 * Query params:
 *   storeId - filter by store
 *   period  - "1m" | "3m" | "6m" | "1y" | "all" (default: "all")
 */
export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  const period = searchParams.get("period") || "all";

  // Calculate date filter based on period
  let dateFrom: Date | undefined;
  const now = new Date();
  switch (period) {
    case "1m":
      dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case "3m":
      dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case "6m":
      dateFrom = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case "1y":
      dateFrom = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      break;
    default:
      dateFrom = undefined;
  }

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true, unit: true },
  });

  if (!product) {
    return NextResponse.json(
      { error: "商品が見つかりません" },
      { status: 404 },
    );
  }

  // Build where clause
  const where: Record<string, unknown> = {
    productId: id,
    userId: session.user.id,
  };
  if (storeId) where.storeId = storeId;
  if (dateFrom) where.recordedAt = { gte: dateFrom };

  const priceRecords = await prisma.priceRecord.findMany({
    where,
    orderBy: { recordedAt: "asc" },
    include: {
      store: {
        select: { id: true, name: true },
      },
    },
  });

  // Calculate statistics
  const prices = priceRecords.map((r) => r.price);
  const stats =
    prices.length > 0
      ? {
          bottomPrice: Math.min(...prices),
          averagePrice: Math.round(
            prices.reduce((a, b) => a + b, 0) / prices.length,
          ),
          latestPrice: prices[prices.length - 1],
          highestPrice: Math.max(...prices),
          recordCount: prices.length,
        }
      : null;

  // Group by store for chart series
  const storeGroups: Record<
    string,
    { storeId: string; storeName: string; records: typeof priceRecords }
  > = {};
  for (const record of priceRecords) {
    const sid = record.storeId;
    if (!storeGroups[sid]) {
      storeGroups[sid] = {
        storeId: sid,
        storeName: record.store.name,
        records: [],
      };
    }
    storeGroups[sid].records.push(record);
  }

  return NextResponse.json({
    product,
    stats,
    series: Object.values(storeGroups),
    records: priceRecords,
  });
}
