import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/favorites — List favorite products with bottom price info
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const favorites = await prisma.favoriteProduct.findMany({
    where: { userId: session.user.id },
    orderBy: { displayOrder: "asc" },
    include: {
      product: {
        include: {
          category: { select: { name: true } },
          priceRecords: {
            where: { userId: session.user.id },
            orderBy: { recordedAt: "desc" },
            include: {
              store: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const items = favorites.map((fav) => {
    const records = fav.product.priceRecords;
    const prices = records.map((r) => r.price);

    const stats =
      prices.length > 0
        ? {
            bottomPrice: Math.min(...prices),
            bottomStore: records.find((r) => r.price === Math.min(...prices))
              ?.store,
            bottomDate: records.find((r) => r.price === Math.min(...prices))
              ?.recordedAt,
            latestPrice: prices[0],
            latestStore: records[0]?.store,
            averagePrice: Math.round(
              prices.reduce((a, b) => a + b, 0) / prices.length,
            ),
            recordCount: prices.length,
          }
        : null;

    return {
      id: fav.id,
      productId: fav.productId,
      productName: fav.product.name,
      categoryName: fav.product.category?.name || null,
      unit: fav.product.unit,
      displayOrder: fav.displayOrder,
      stats,
      createdAt: fav.createdAt,
    };
  });

  return NextResponse.json({ favorites: items });
}

/**
 * POST /api/favorites — Add product to favorites
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "商品IDは必須です" },
        { status: 400 },
      );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return NextResponse.json(
        { error: "商品が見つかりません" },
        { status: 404 },
      );
    }

    // Check if already favorited
    const existing = await prisma.favoriteProduct.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "この商品はすでにお気に入りに登録されています" },
        { status: 409 },
      );
    }

    // Get max display order
    const maxOrder = await prisma.favoriteProduct.findFirst({
      where: { userId: session.user.id },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });

    const favorite = await prisma.favoriteProduct.create({
      data: {
        userId: session.user.id,
        productId,
        displayOrder: (maxOrder?.displayOrder || 0) + 1,
      },
    });

    return NextResponse.json(favorite, { status: 201 });
  } catch (error) {
    console.error("Error creating favorite:", error);
    return NextResponse.json(
      { error: "お気に入り登録に失敗しました" },
      { status: 500 },
    );
  }
}
