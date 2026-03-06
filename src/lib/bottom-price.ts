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
    storeId?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    limit?: number;
    cursor?: string;
  },
): Promise<{ items: BottomPriceInfo[]; nextCursor: string | null }> {
  const limit = options?.limit || 20;
  const sortBy = options?.sortBy || "name";
  const sortOrder = options?.sortOrder || "asc";

  // Build product filter
  const productWhere: Record<string, unknown> = {};
  if (options?.categoryId) {
    if (options.categoryId === "uncategorized") {
      productWhere.categoryId = null;
    } else {
      productWhere.categoryId = options.categoryId;
    }
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

  // Store filter: only show products with records at this store
  const priceRecordWhere: Record<string, unknown> = { userId };
  if (options?.storeId) {
    priceRecordWhere.storeId = options.storeId;
  }

  // For price sort we need all results to sort in JS
  const isPriceSort = sortBy === "price";
  const fetchLimit = isPriceSort ? 10000 : limit + 1;

  // Get products with price records
  const products = await prisma.product.findMany({
    where: {
      ...productWhere,
      priceRecords: {
        some: priceRecordWhere,
      },
      ...(!isPriceSort && options?.cursor ? { id: { gt: options.cursor } } : {}),
    },
    take: fetchLimit,
    orderBy: sortBy === "recordCount"
      ? { priceRecords: { _count: sortOrder } }
      : { name: sortOrder },
    include: {
      category: { select: { name: true } },
      priceRecords: {
        where: priceRecordWhere,
        orderBy: { recordedAt: "desc" },
        include: {
          store: { select: { id: true, name: true } },
        },
      },
    },
  });

  const allItems: BottomPriceInfo[] = products.map((product) => {
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

  if (isPriceSort) {
    // Sort by bottom price in JS
    allItems.sort((a, b) =>
      sortOrder === "asc"
        ? a.bottomPrice - b.bottomPrice
        : b.bottomPrice - a.bottomPrice,
    );

    // Manual cursor-based pagination
    let startIndex = 0;
    if (options?.cursor) {
      const cursorIdx = allItems.findIndex((item) => item.productId === options.cursor);
      if (cursorIdx >= 0) startIndex = cursorIdx + 1;
    }

    const paginated = allItems.slice(startIndex, startIndex + limit + 1);
    const hasMore = paginated.length > limit;
    const items = hasMore ? paginated.slice(0, limit) : paginated;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].productId : null,
    };
  }

  // Non-price sort: already paginated by Prisma
  const hasMore = allItems.length > limit;
  const items = hasMore ? allItems.slice(0, limit) : allItems;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].productId : null,
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
