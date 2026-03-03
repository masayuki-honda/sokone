import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/products/[id] — Product detail with price history
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      aliases: true,
      priceRecords: {
        where: { userId: session.user.id },
        orderBy: { recordedAt: "desc" },
        take: 50,
        include: {
          store: {
            select: { id: true, name: true },
          },
        },
      },
      _count: {
        select: { priceRecords: true, favoriteProducts: true },
      },
    },
  });

  if (!product) {
    return NextResponse.json(
      { error: "商品が見つかりません" },
      { status: 404 },
    );
  }

  // Calculate price statistics
  const userPriceRecords = product.priceRecords;
  const prices = userPriceRecords.map((r) => r.price);

  const stats =
    prices.length > 0
      ? {
          bottomPrice: Math.min(...prices),
          averagePrice: Math.round(
            prices.reduce((a, b) => a + b, 0) / prices.length,
          ),
          latestPrice: prices[0],
          recordCount: prices.length,
          bottomDate: userPriceRecords.find(
            (r) => r.price === Math.min(...prices),
          )?.recordedAt,
          bottomStore: userPriceRecords.find(
            (r) => r.price === Math.min(...prices),
          )?.store,
        }
      : null;

  // Check if user has favorited this product
  const isFavorite = await prisma.favoriteProduct.findUnique({
    where: {
      userId_productId: {
        userId: session.user.id,
        productId: id,
      },
    },
  });

  return NextResponse.json({
    ...product,
    stats,
    isFavorite: !!isFavorite,
  });
}
