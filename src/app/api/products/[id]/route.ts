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

/**
 * PATCH /api/products/[id] — Update product category (or other fields)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { categoryId, name, unit, volume } = body as {
    categoryId?: string | null;
    name?: string;
    unit?: string | null;
    volume?: string | null;
  };

  // Validate product exists
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
  }

  // Validate category if provided
  if (categoryId) {
    const category = await prisma.productCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return NextResponse.json(
        { error: "指定されたカテゴリが見つかりません" },
        { status: 400 },
      );
    }
  }

  // Validate name if provided
  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: "商品名は必須です" }, { status: 400 });
    }
    if (trimmed.length > 200) {
      return NextResponse.json({ error: "商品名は200文字以内にしてください" }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (categoryId !== undefined) updateData.categoryId = categoryId ?? null;
  if (name !== undefined) {
    const { normalizeProductName } = await import("@/lib/product-matcher");
    updateData.name = name.trim();
    updateData.normalizedName = normalizeProductName(name.trim());
  }
  if (unit !== undefined) updateData.unit = unit?.trim() || null;
  if (volume !== undefined) updateData.volume = volume?.trim() || null;

  const updated = await prisma.product.update({
    where: { id },
    data: updateData,
    include: { category: true },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/products/[id] — Delete product and all its price records
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
  }

  // PriceRecord has no onDelete cascade, so delete explicitly
  await prisma.priceRecord.deleteMany({ where: { productId: id } });
  // ProductAlias and FavoriteProduct have onDelete: Cascade, auto-deleted
  await prisma.product.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
