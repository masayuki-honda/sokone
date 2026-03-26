import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/products/[id]/compare — Store-by-store price comparison
 * Returns each store's min, max, avg, latest price and record count.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!product) {
    return NextResponse.json(
      { error: "商品が見つかりません" },
      { status: 404 },
    );
  }

  const records = await prisma.priceRecord.findMany({
    where: { productId: id, userId: session.user.id },
    orderBy: { recordedAt: "desc" },
    include: {
      store: { select: { id: true, name: true } },
    },
  });

  // Group by store and calculate stats
  const storeMap = new Map<
    string,
    {
      storeId: string;
      storeName: string;
      minPrice: number;
      maxPrice: number;
      totalPrice: number;
      latestPrice: number;
      latestDate: string;
      recordCount: number;
    }
  >();

  for (const r of records) {
    const existing = storeMap.get(r.storeId);
    if (!existing) {
      storeMap.set(r.storeId, {
        storeId: r.storeId,
        storeName: r.store.name,
        minPrice: r.price,
        maxPrice: r.price,
        totalPrice: r.price,
        latestPrice: r.price,
        latestDate: r.recordedAt.toISOString(),
        recordCount: 1,
      });
    } else {
      existing.minPrice = Math.min(existing.minPrice, r.price);
      existing.maxPrice = Math.max(existing.maxPrice, r.price);
      existing.totalPrice += r.price;
      existing.recordCount += 1;
    }
  }

  const stores = Array.from(storeMap.values())
    .map((s) => ({
      storeId: s.storeId,
      storeName: s.storeName,
      minPrice: s.minPrice,
      maxPrice: s.maxPrice,
      avgPrice: Math.round(s.totalPrice / s.recordCount),
      latestPrice: s.latestPrice,
      latestDate: s.latestDate,
      recordCount: s.recordCount,
    }))
    .sort((a, b) => a.minPrice - b.minPrice);

  const globalMin = stores.length > 0 ? stores[0].minPrice : null;

  return NextResponse.json({
    product,
    stores,
    cheapestStoreId: stores.length > 0 ? stores[0].storeId : null,
    globalMinPrice: globalMin,
  });
}
