import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/compare?productIds=id1,id2,id3
 * Returns per-store aggregation: for each store, show the cheapest price for each product
 * and a total score (sum of cheapest prices).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const productIdsParam = request.nextUrl.searchParams.get("productIds");
  if (!productIdsParam) {
    return NextResponse.json(
      { error: "productIds is required" },
      { status: 400 }
    );
  }

  const productIds = productIdsParam.split(",").filter(Boolean);
  if (productIds.length === 0 || productIds.length > 20) {
    return NextResponse.json(
      { error: "1〜20個の商品IDを指定してください" },
      { status: 400 }
    );
  }

  // Fetch products
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });

  // Fetch all price records for these products
  const records = await prisma.priceRecord.findMany({
    where: {
      userId: session.user.id,
      productId: { in: productIds },
    },
    select: {
      productId: true,
      storeId: true,
      price: true,
      store: { select: { id: true, name: true } },
    },
  });

  // Group: store -> product -> min price
  const storeMap = new Map<
    string,
    {
      storeId: string;
      storeName: string;
      products: Map<string, number>;
    }
  >();

  for (const r of records) {
    let entry = storeMap.get(r.storeId);
    if (!entry) {
      entry = {
        storeId: r.storeId,
        storeName: r.store.name,
        products: new Map(),
      };
      storeMap.set(r.storeId, entry);
    }
    const current = entry.products.get(r.productId);
    if (current === undefined || r.price < current) {
      entry.products.set(r.productId, r.price);
    }
  }

  // Build result, sorted by total (only include stores that have all products)
  const storeResults = Array.from(storeMap.values())
    .map((entry) => {
      const productPrices = productIds.map((pid) => ({
        productId: pid,
        minPrice: entry.products.get(pid) ?? null,
      }));
      const coveredCount = productPrices.filter((p) => p.minPrice !== null).length;
      const total = productPrices.reduce(
        (sum, p) => sum + (p.minPrice ?? 0),
        0
      );

      return {
        storeId: entry.storeId,
        storeName: entry.storeName,
        productPrices,
        total,
        coveredCount,
        hasAll: coveredCount === productIds.length,
      };
    })
    .sort((a, b) => {
      // Stores with all products first, then by total ascending
      if (a.hasAll !== b.hasAll) return a.hasAll ? -1 : 1;
      return a.total - b.total;
    });

  return NextResponse.json({
    products: products.map((p) => ({ id: p.id, name: p.name })),
    stores: storeResults,
  });
}
