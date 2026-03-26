import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/deals — Current deals (prices within 10% of bottom price, last 7 days)
 * Query params:
 *   days - lookback period in days (default: 7)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get recent price records with product info
  const recentRecords = await prisma.priceRecord.findMany({
    where: {
      userId: session.user.id,
      recordedAt: { gte: since },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          unit: true,
          volume: true,
          category: { select: { id: true, name: true } },
        },
      },
      store: { select: { id: true, name: true } },
    },
    orderBy: { recordedAt: "desc" },
  });

  if (recentRecords.length === 0) {
    return NextResponse.json({ deals: [], period: days });
  }

  // Get all-time bottom prices for the products in recent records
  const productIds = [...new Set(recentRecords.map((r) => r.productId))];

  const allRecords = await prisma.priceRecord.findMany({
    where: {
      userId: session.user.id,
      productId: { in: productIds },
    },
    select: {
      productId: true,
      price: true,
    },
  });

  // Calculate bottom price per product
  const bottomPrices = new Map<string, number>();
  for (const r of allRecords) {
    const current = bottomPrices.get(r.productId);
    if (current === undefined || r.price < current) {
      bottomPrices.set(r.productId, r.price);
    }
  }

  // Filter deals: price <= bottomPrice * 1.10
  const deals = recentRecords
    .filter((r) => {
      const bottom = bottomPrices.get(r.productId);
      if (!bottom) return false;
      return r.price <= bottom * 1.1;
    })
    .map((r) => {
      const bottom = bottomPrices.get(r.productId)!;
      return {
        priceRecordId: r.id,
        product: r.product,
        store: r.store,
        price: r.price,
        bottomPrice: bottom,
        isBottomPrice: r.price <= bottom,
        discount: bottom > 0 ? Math.round((1 - r.price / bottom) * -100) : 0,
        recordedAt: r.recordedAt,
        sourceType: r.sourceType,
      };
    });

  // Deduplicate: keep only the best deal per product
  const bestDeals = new Map<string, (typeof deals)[0]>();
  for (const deal of deals) {
    const existing = bestDeals.get(deal.product.id);
    if (!existing || deal.price < existing.price) {
      bestDeals.set(deal.product.id, deal);
    }
  }

  return NextResponse.json({
    deals: Array.from(bestDeals.values()),
    period: days,
  });
}
