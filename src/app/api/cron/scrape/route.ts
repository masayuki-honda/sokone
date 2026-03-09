import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runScrapingPipeline } from "@/lib/scraping-pipeline";

// Cron jobs can take several minutes
export const maxDuration = 300;

/**
 * GET /api/cron/scrape — Cron endpoint to auto-scrape all stores with tokubai URLs
 *
 * Protected by CRON_SECRET header (Vercel Cron injects this automatically).
 * Schedule: configured in vercel.json
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all stores with tokubai URLs
  const stores = await prisma.store.findMany({
    where: {
      tokubaiShopUrl: { not: null },
    },
    select: { id: true, userId: true, name: true },
  });

  if (stores.length === 0) {
    return NextResponse.json({ message: "対象店舗なし", results: [] });
  }

  const results = [];

  for (const store of stores) {
    try {
      const result = await runScrapingPipeline(store.id, store.userId);
      results.push({
        storeId: store.id,
        storeName: store.name,
        ...result,
      });
    } catch (err) {
      results.push({
        storeId: store.id,
        storeName: store.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    message: `${stores.length} 店舗を処理しました`,
    results,
  });
}
