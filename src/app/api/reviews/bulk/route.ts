import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOrCreateProduct } from "@/lib/product-matcher";

/**
 * POST /api/reviews/bulk
 * Body: { ids: string[], action: "approve" | "reject" }
 *
 * Approve: registers each item as a PriceRecord (using stored productName/price,
 *          not allowing per-item edits in bulk mode).
 * Reject:  marks each item as rejected.
 *
 * Returns: { approved: number, rejected: number, errors: number }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { ids, action } = body as { ids: string[]; action: "approve" | "reject" };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids は空でない配列を指定してください" }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action は approve または reject を指定してください" }, { status: 400 });
  }

  // Fetch only reviews that belong to this user and are still pending
  const reviews = await prisma.pendingReview.findMany({
    where: {
      id: { in: ids },
      userId: session.user.id,
      status: "pending",
    },
  });

  if (reviews.length === 0) {
    return NextResponse.json({ approved: 0, rejected: 0, errors: 0 });
  }

  if (action === "reject") {
    const { count } = await prisma.pendingReview.updateMany({
      where: { id: { in: reviews.map((r) => r.id) } },
      data: { status: "rejected", resolvedAt: new Date() },
    });
    return NextResponse.json({ approved: 0, rejected: count, errors: ids.length - count });
  }

  // Bulk approve: register price records one by one (product matching needs individual calls)
  let approved = 0;
  let errors = 0;
  const now = new Date();

  for (const review of reviews) {
    try {
      const finalPrice = review.isTaxIncluded
        ? Math.round(review.price)
        : Math.round(review.price * 1.1);

      const product = await findOrCreateProduct(review.productName, {
        categoryHint: review.categoryHint ?? undefined,
        unit: review.unit ?? undefined,
        volume: review.volume ?? undefined,
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
          recordedAt: now,
        },
      });

      await prisma.pendingReview.update({
        where: { id: review.id },
        data: { status: "approved", resolvedAt: now },
      });

      approved++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ approved, rejected: 0, errors });
}
