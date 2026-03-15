import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/products — List/search products
 * Query params:
 * - q: search query (partial match)
 * - categoryId: filter by category ("uncategorized" for products without category)
 * - storeId: filter by store (products with price records at this store)
 * - sortBy: "name" | "price" | "recordCount" (default: "name")
 * - sortOrder: "asc" | "desc" (default: "asc")
 * - limit: max results (default 20)
 * - cursor: offset-based pagination (integer encoded as string)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const categoryId = searchParams.get("categoryId");
  const storeId = searchParams.get("storeId");
  const sortBy = searchParams.get("sortBy") || "name";
  const sortOrder = (searchParams.get("sortOrder") || "asc") as "asc" | "desc";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  // cursor is now an integer offset (not a record ID) so deleted records don't break pagination
  const cursorRaw = searchParams.get("cursor");
  const offset = cursorRaw ? parseInt(cursorRaw, 10) : 0;

  // Build where clause (search + optional category/store filter)
  const normalized = q ? q.trim().replace(/\s+/g, " ").toLowerCase() : null;
  const where: Prisma.ProductWhereInput = {
    // Category filter: "uncategorized" shows products without a category
    ...(categoryId === "uncategorized"
      ? { categoryId: null }
      : categoryId
        ? { categoryId }
        : {}),
    // Store filter: products that have price records at this store
    ...(storeId && {
      priceRecords: { some: { storeId } },
    }),
    ...(normalized && {
      OR: [
        { name: { contains: normalized, mode: "insensitive" as const } },
        { normalizedName: { contains: normalized, mode: "insensitive" as const } },
        {
          aliases: {
            some: {
              aliasName: { contains: normalized, mode: "insensitive" as const },
            },
          },
        },
      ],
    }),
  };

  // Determine Prisma orderBy (for name & recordCount)
  let orderBy: Prisma.ProductOrderByWithRelationInput;
  if (sortBy === "recordCount") {
    orderBy = { priceRecords: { _count: sortOrder } };
  } else {
    // Default: name sort (also used as base for post-sort scenarios)
    orderBy = { name: sortOrder };
  }

  // For price sort, we fetch all matching, sort in JS, then paginate manually
  const isPriceSort = sortBy === "price";
  const fetchLimit = isPriceSort ? 10000 : limit + 1;

  const products = await prisma.product.findMany({
    where,
    orderBy,
    take: fetchLimit,
    ...(!isPriceSort && offset > 0 ? { skip: offset } : {}),
    include: {
      category: {
        select: { id: true, name: true },
      },
      _count: {
        select: { priceRecords: true },
      },
      priceRecords: {
        select: { price: true, store: { select: { name: true } } },
        orderBy: { price: "asc" },
        take: 1,
      },
    },
  });

  let result;
  let nextCursorValue: string | null;

  if (isPriceSort) {
    // Sort by bottom price in JS then apply offset manually
    const sorted = products.sort((a, b) => {
      const priceA = a.priceRecords[0]?.price ?? Infinity;
      const priceB = b.priceRecords[0]?.price ?? Infinity;
      return sortOrder === "asc" ? priceA - priceB : priceB - priceA;
    });

    const paginated = sorted.slice(offset, offset + limit + 1);
    const hasMore = paginated.length > limit;
    result = hasMore ? paginated.slice(0, limit) : paginated;
    nextCursorValue = hasMore ? String(offset + result.length) : null;
  } else {
    const hasMore = products.length > limit;
    result = hasMore ? products.slice(0, limit) : products;
    nextCursorValue = hasMore ? String(offset + result.length) : null;
  }

  return NextResponse.json({
    products: result,
    nextCursor: nextCursorValue,
    hasMore: nextCursorValue !== null,
  });
}
