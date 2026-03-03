import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchProducts } from "@/lib/product-matcher";

/**
 * GET /api/products — List/search products
 * Query params:
 * - q: search query (partial match)
 * - categoryId: filter by category
 * - limit: max results (default 20)
 * - cursor: cursor-based pagination
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const categoryId = searchParams.get("categoryId");
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const cursor = searchParams.get("cursor");

  // If search query provided, use product matcher
  if (q && q.trim().length > 0) {
    const products = await searchProducts(q.trim(), limit);
    return NextResponse.json({ products, nextCursor: null, hasMore: false });
  }

  // Default: list products with optional category filter
  const where = {
    ...(categoryId && { categoryId }),
  };

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    include: {
      category: {
        select: { id: true, name: true },
      },
      _count: {
        select: { priceRecords: true },
      },
    },
  });

  const hasMore = products.length > limit;
  const result = hasMore ? products.slice(0, limit) : products;
  const nextCursor = hasMore ? result[result.length - 1].id : null;

  return NextResponse.json({
    products: result,
    nextCursor,
    hasMore,
  });
}
