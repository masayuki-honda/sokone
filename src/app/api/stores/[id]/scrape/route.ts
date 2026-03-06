import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeShopLeaflets, downloadAndSaveImage } from "@/lib/tokubai-scraper";

interface Params {
  params: Promise<{ id: string }>;
}

// Scraping can take a while: allow up to 60s on Vercel Hobby
export const maxDuration = 60;

/**
 * POST /api/stores/[id]/scrape
 *
 * Scrapes the tokubai shop page linked to this store and creates UploadedImage
 * records for every new (unprocessed) leaflet page found.
 *
 * Returns:
 *   { scraped: number, alreadyExists: number, imageIds: string[], errors: string[] }
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
    include: { scrapedLeaflets: true },
  });

  if (!store) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
  }

  if (!store.tokubaiShopUrl) {
    return NextResponse.json(
      { error: "この店舗には tokubai URL が設定されていません。店舗編集から登録してください。" },
      { status: 400 },
    );
  }

  // IDs already scraped for this store
  const alreadyScrapedIds = new Set(store.scrapedLeaflets.map((l) => l.leafletId));

  // --- Scrape tokubai ---
  let leaflets;
  try {
    leaflets = await scrapeShopLeaflets(store.tokubaiShopUrl);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "スクレイピングに失敗しました" },
      { status: 502 },
    );
  }

  const newLeaflets = leaflets.filter((l) => !alreadyScrapedIds.has(l.leafletId));
  const alreadyExistsCount = leaflets.length - newLeaflets.length;

  if (newLeaflets.length === 0) {
    return NextResponse.json({
      message: "新しいチラシはありませんでした",
      scraped: 0,
      alreadyExists: alreadyExistsCount,
      imageIds: [],
      errors: [],
    });
  }

  const imageIds: string[] = [];
  const errors: string[] = [];

  for (const leaflet of newLeaflets) {
    let savedCount = 0;

    for (const imageUrl of leaflet.imageUrls) {
      try {
        const result = await downloadAndSaveImage(imageUrl, session.user.id, store.id);
        imageIds.push(result.uploadedImageId);
        savedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${leaflet.leafletId}] ${imageUrl}: ${msg}`);
      }
    }

    // Record the leaflet as scraped even if some pages failed (to avoid re-trying broken ones)
    await prisma.scrapedLeaflet.upsert({
      where: { storeId_leafletId: { storeId: store.id, leafletId: leaflet.leafletId } },
      create: {
        storeId: store.id,
        leafletId: leaflet.leafletId,
        title: leaflet.title || null,
        pageCount: savedCount,
      },
      update: {
        title: leaflet.title || undefined,
        pageCount: savedCount,
        scrapedAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    message: `${imageIds.length} 枚の画像を取り込みました`,
    scraped: imageIds.length,
    alreadyExists: alreadyExistsCount,
    imageIds,
    errors,
  });
}

/**
 * GET /api/stores/[id]/scrape
 *
 * Returns the list of already-scraped leaflets for this store.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
    include: {
      scrapedLeaflets: {
        orderBy: { scrapedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!store) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
  }

  return NextResponse.json({
    tokubaiShopUrl: store.tokubaiShopUrl,
    scrapedLeaflets: store.scrapedLeaflets,
  });
}
