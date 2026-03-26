import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/watches — List user's price watches
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watches = await prisma.priceWatch.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        include: {
          priceRecords: {
            orderBy: { recordedAt: "desc" },
            take: 1,
            include: { store: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute bottom price for each watched product
  const result = await Promise.all(
    watches.map(async (watch) => {
      const bottomRecord = await prisma.priceRecord.findFirst({
        where: { productId: watch.productId },
        orderBy: { price: "asc" },
        select: { price: true },
      });

      const latest = watch.product.priceRecords[0] ?? null;

      return {
        id: watch.id,
        productId: watch.productId,
        productName: watch.product.name,
        targetPrice: watch.targetPrice,
        enabled: watch.enabled,
        createdAt: watch.createdAt,
        bottomPrice: bottomRecord?.price ?? null,
        latestPrice: latest?.price ?? null,
        latestStore: latest?.store?.name ?? null,
        latestDate: latest?.recordedAt ?? null,
      };
    })
  );

  return NextResponse.json(result);
}

// POST /api/watches — Add a price watch
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { productId, targetPrice } = body;

  if (!productId || typeof productId !== "string") {
    return NextResponse.json(
      { error: "商品IDは必須です" },
      { status: 400 }
    );
  }

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
  if (!product) {
    return NextResponse.json(
      { error: "商品が見つかりません" },
      { status: 404 }
    );
  }

  // Check for existing watch
  const existing = await prisma.priceWatch.findUnique({
    where: {
      userId_productId: {
        userId: session.user.id,
        productId,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "この商品は既にウォッチリストに登録されています" },
      { status: 409 }
    );
  }

  const watch = await prisma.priceWatch.create({
    data: {
      userId: session.user.id,
      productId,
      targetPrice: targetPrice != null ? Number(targetPrice) : null,
    },
  });

  return NextResponse.json(watch, { status: 201 });
}
