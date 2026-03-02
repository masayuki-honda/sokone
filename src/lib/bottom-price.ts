import { prisma } from "@/lib/prisma";

export interface BottomPriceInfo {
  productId: string;
  productName: string;
  categoryName: string | null;
  unit: string | null;
  bottomPrice: number;
  bottomDate: Date;
  bottomStoreName: string;
  bottomStoreId: string;
  averagePrice: number;
  latestPrice: number;
  latestDate: Date;
  latestStoreName: string;
  recordCount: number;
}

/**
 * Get bottom (lowest) price info for each product the user has price records for
 */
export async function getBottomPrices(
  userId: string,
  options?: {
    categoryId?: string;
    query?: string;
    limit?: number;
    cursor?: string;
  },
): Promise<{ items: BottomPriceInfo[]; nextCursor: string | null }> {
  const limit = options?.limit || 20;

  // Build product filter
  const productWhere: Record<string, unknown> = {};
  if (options?.categoryId) {
    productWhere.categoryId = options.categoryId;
  }
  if (options?.query) {
    productWhere.OR = [
      { name: { contains: options.query, mode: "insensitive" } },
      { normalizedName: { contains: options.query, mode: "insensitive" } },
      {
        aliases: {
          some: {
            aliasName: { contains: options.query, mode: "insensitive" },
          },
        },
      },
    ];
  }

  // Get products with price records
  const products = await prisma.product.findMany({
    where: {
      ...productWhere,
      priceRecords: {
        some: { userId },
      },
      ...(options?.cursor ? { id: { gt: options.cursor } } : {}),
    },
    take: limit + 1,
    orderBy: { name: "asc" },
    include: {
      category: { select: { name: true } },
      priceRecords: {
        where: { userId },
        orderBy: { recordedAt: "desc" },
        include: {
          store: { select: { id: true, name: true } },
        },
      },
    },
  });

  const hasMore = products.length > limit;
  const sliced = hasMore ? products.slice(0, limit) : products;

  const items: BottomPriceInfo[] = sliced.map((product) => {
    const records = product.priceRecords;
    const prices = records.map((r) => r.price);
    const minPrice = Math.min(...prices);
    const bottomRecord = records.find((r) => r.price === minPrice)!;
    const latestRecord = records[0]; // already sorted desc
    const avgPrice = Math.round(
      prices.reduce((a, b) => a + b, 0) / prices.length,
    );

    return {
      productId: product.id,
      productName: product.name,
      categoryName: product.category?.name || null,
      unit: product.unit,
      bottomPrice: minPrice,
      bottomDate: bottomRecord.recordedAt,
      bottomStoreName: bottomRecord.store.name,
      bottomStoreId: bottomRecord.store.id,
      averagePrice: avgPrice,
      latestPrice: latestRecord.price,
      latestDate: latestRecord.recordedAt,
      latestStoreName: latestRecord.store.name,
      recordCount: records.length,
    };
  });

  return {
    items,
    nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
  };
}

/**
 * Get dashboard summary stats
 */
export async function getDashboardStats(userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [productCount, storeCount, totalRecords, monthRecords, favoriteCount] =
    await Promise.all([
      // Unique products the user has price records for
      prisma.priceRecord
        .findMany({
          where: { userId },
          select: { productId: true },
          distinct: ["productId"],
        })
        .then((r) => r.length),

      prisma.store.count({ where: { userId } }),

      prisma.priceRecord.count({ where: { userId } }),

      prisma.priceRecord.count({
        where: {
          userId,
          createdAt: { gte: monthStart },
        },
      }),

      prisma.favoriteProduct.count({ where: { userId } }),
    ]);

  return {
    productCount,
    storeCount,
    totalRecords,
    monthRecords,
    favoriteCount,
  };
}

/**
 * Get recent price registrations
 */
export async function getRecentPrices(userId: string, limit = 10) {
  return prisma.priceRecord.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      product: { select: { id: true, name: true, unit: true } },
      store: { select: { id: true, name: true } },
    },
  });
}
