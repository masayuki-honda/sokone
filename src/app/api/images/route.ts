import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2SignedUrl } from "@/lib/r2";

/**
 * GET /api/images — List uploaded images for the current user
 * Query params:
 * - sourceType: filter by source type
 * - status: filter by status
 * - storeId: filter by store
 * - limit: number of results (default 20, max 100)
 * - cursor: cursor-based pagination
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sourceType = searchParams.get("sourceType");
  const status = searchParams.get("status");
  const storeId = searchParams.get("storeId");
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const cursor = searchParams.get("cursor");

  const where = {
    userId: session.user.id,
    ...(sourceType && { sourceType: sourceType as "photo" | "flyer" | "instagram" | "receipt" }),
    // When an explicit status filter is given, use it.
    // Otherwise show only "active" statuses (exclude no_products).
    // Use `in` rather than `not` so the query works even before the
    // no_products migration has been applied to the database.
    ...(status
      ? { status: status as "pending" | "processed" | "failed" | "no_products" }
      : { status: { in: ["pending", "processed", "failed"] as ("pending" | "processed" | "failed")[] } }),
    ...(storeId && { storeId }),
  };

  const images = await prisma.uploadedImage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    include: {
      store: {
        select: { id: true, name: true },
      },
      _count: {
        select: { priceRecords: true },
      },
    },
  });

  const hasMore = images.length > limit;
  const result = hasMore ? images.slice(0, limit) : images;
  const nextCursor = hasMore ? result[result.length - 1].id : null;

  // Generate signed URLs for each image
  const imagesWithUrls = await Promise.all(
    result.map(async (image) => ({
      ...image,
      signedUrl: await getR2SignedUrl(image.imageUrl),
    })),
  );

  return NextResponse.json({
    images: imagesWithUrls,
    nextCursor,
    hasMore,
  });
}
