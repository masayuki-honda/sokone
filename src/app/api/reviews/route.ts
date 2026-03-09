import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reviews — List pending review items for current user
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const reviews = await prisma.pendingReview.findMany({
    where: {
      userId: session.user.id,
      status: status as "pending" | "approved" | "rejected",
    },
    include: {
      store: { select: { id: true, name: true } },
      sourceImage: { select: { id: true, imageUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const pendingCount = await prisma.pendingReview.count({
    where: { userId: session.user.id, status: "pending" },
  });

  return NextResponse.json({ reviews, pendingCount });
}
