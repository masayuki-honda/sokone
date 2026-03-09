import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOrCreateProduct } from "@/lib/product-matcher";

/**
 * PUT /api/reviews/[id] — Approve or reject a pending review
 * Body: { action: "approve" | "reject", productName?: string, price?: number }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const review = await prisma.pendingReview.findFirst({
    where: { id, userId: session.user.id, status: "pending" },
  });

  if (!review) {
    return NextResponse.json({ error: "レビュー項目が見つかりません" }, { status: 404 });
  }

  const body = await request.json();
  const action = body.action as "approve" | "reject";

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action は approve または reject を指定してください" }, { status: 400 });
  }

  if (action === "reject") {
    await prisma.pendingReview.update({
      where: { id },
      data: { status: "rejected", resolvedAt: new Date() },
    });
    return NextResponse.json({ status: "rejected" });
  }

  // Approve: register as PriceRecord
  const productName = body.productName || review.productName;
  const price = body.price ?? review.price;

  let finalPrice = Math.round(price);
  if (!review.isTaxIncluded) {
    finalPrice = Math.round(price * 1.1);
  }

  const product = await findOrCreateProduct(productName, {
    categoryHint: review.categoryHint || undefined,
    unit: review.unit || undefined,
    volume: review.volume || undefined,
  });

  await prisma.priceRecord.create({
    data: {
      productId: product.id,
      storeId: review.storeId,
      userId: session.user.id,
      price: finalPrice,
      taxIncluded: true,
      sourceType: "auto_flyer",
      sourceImageId: review.sourceImageId,
      recordedAt: new Date(),
    },
  });

  await prisma.pendingReview.update({
    where: { id },
    data: { status: "approved", resolvedAt: new Date() },
  });

  return NextResponse.json({ status: "approved", productId: product.id, price: finalPrice });
}
