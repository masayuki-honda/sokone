import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getR2SignedUrl } from "@/lib/r2";

/**
 * GET /api/leaflets
 *
 * Returns all scraped leaflets belonging to the current user's stores,
 * ordered by scrapedAt descending.
 *
 * Each leaflet includes:
 * - store info
 * - validity dates (validFrom / validTo)
 * - images with signed URLs (for display in the flyer viewer)
 * - pending review items extracted from those images (for product highlights)
 *
 * Query params:
 *   ?active=1   — filter to only currently valid leaflets
 *   ?storeId=   — filter by store ID
 *   ?limit=N    — max leaflets to return (default 10)
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("active") === "1";
  const storeIdFilter = url.searchParams.get("storeId") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10"), 50);

  // Resolve user's stores (optionally filtered)
  const userStores = await prisma.store.findMany({
    where: {
      userId: session.user.id,
      ...(storeIdFilter ? { id: storeIdFilter } : {}),
    },
    select: { id: true, name: true },
  });

  const storeIds = userStores.map((s) => s.id);
  const storeMap = Object.fromEntries(userStores.map((s) => [s.id, s.name]));

  const now = new Date();

  // Fetch leaflets
  const leaflets = await prisma.scrapedLeaflet.findMany({
    where: {
      storeId: { in: storeIds },
      ...(activeOnly
        ? {
            OR: [
              // Has explicit date range and today is within it
              {
                validFrom: { lte: now },
                validTo:   { gte: now },
              },
              // No date range and scraped recently (within 7 days)
              {
                validFrom: null,
                scrapedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              },
            ],
          }
        : {
            // Default: last 14 days
            scrapedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
          }),
    },
    orderBy: { scrapedAt: "desc" },
    take: limit,
    select: {
      id: true,
      storeId: true,
      leafletId: true,
      title: true,
      pageCount: true,
      validFrom: true,
      validTo: true,
      scrapedAt: true,
    },
  });

  if (leaflets.length === 0) {
    return NextResponse.json([]);
  }

  // For each leaflet, fetch its images and signing URLs
  // Images are directly linked via scrapedLeafletId (new scrapes),
  // or found by time window (legacy records before the schema migration).
  const leafletResults = await Promise.all(
    leaflets.map(async (leaflet) => {
      // Try direct relation first (accurate), fall back to time window (legacy)
      let imageRecords = await prisma.uploadedImage.findMany({
        where: {
          scrapedLeafletId: leaflet.id,
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          imageUrl: true,
          status: true,
          ocrResultJson: true,
        },
      });

      // Legacy fallback: images scraped before scrapedLeafletId existed
      if (imageRecords.length === 0) {
        const window = 30 * 60 * 1000;
        imageRecords = await prisma.uploadedImage.findMany({
          where: {
            storeId: leaflet.storeId,
            sourceType: { in: ["auto_flyer", "flyer"] },
            status: { in: ["processed", "no_products", "pending", "failed"] },
            scrapedLeafletId: null,
            createdAt: {
              gte: new Date(leaflet.scrapedAt.getTime() - window),
              lte: new Date(leaflet.scrapedAt.getTime() + window),
            },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            imageUrl: true,
            status: true,
            ocrResultJson: true,
          },
        });
      }

      const images = imageRecords;

      // Generate signed URLs
      const imagesWithUrls = await Promise.all(
        images.map(async (img) => {
          let signedUrl: string | null = null;
          try {
            signedUrl = await getR2SignedUrl(img.imageUrl, 3600);
          } catch {
            // ignore missing images
          }
          return { id: img.id, signedUrl, status: img.status, ocrResultJson: img.ocrResultJson };
        })
      );

      // Pending reviews linked to images of this leaflet (for product highlights)
      const imageIds = images.map((i) => i.id);
      const pendingItems = imageIds.length > 0
        ? await prisma.pendingReview.findMany({
            where: {
              sourceImageId: { in: imageIds },
              status: { in: ["pending", "approved"] },
            },
            orderBy: { saleDate: "asc" },
            select: {
              id: true,
              productName: true,
              price: true,
              unit: true,
              volume: true,
              confidence: true,
              saleDate: true,
              categoryHint: true,
              status: true,
            },
          })
        : [];

      return {
        id: leaflet.id,
        leafletId: leaflet.leafletId,
        title: leaflet.title,
        storeId: leaflet.storeId,
        storeName: storeMap[leaflet.storeId] ?? "",
        pageCount: leaflet.pageCount,
        validFrom: leaflet.validFrom,
        validTo: leaflet.validTo,
        scrapedAt: leaflet.scrapedAt,
        images: imagesWithUrls,
        pendingItems,
      };
    })
  );

  return NextResponse.json(leafletResults);
}
