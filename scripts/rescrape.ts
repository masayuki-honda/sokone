/**
 * Rescrape existing flyer images with higher quality settings.
 *
 * Run: npx tsx --env-file .env scripts/rescrape.ts
 *
 * For each store that has a tokubai URL and has already been scraped:
 *   1. Delete auto_flyer price records (to avoid duplicates after rescrape)
 *   2. Delete flyer UploadedImage records (PendingReview cascades automatically)
 *   3. Delete ScrapedLeaflet records (so pipeline treats them as new)
 *   4. Run the full scraping pipeline (download → OCR → register prices)
 */

import { prisma } from "@/lib/prisma";
import { runScrapingPipeline } from "@/lib/scraping-pipeline";

async function main() {
  const stores = await prisma.store.findMany({
    where: { tokubaiShopUrl: { not: null } },
    include: {
      scrapedLeaflets: true,
      user: { select: { id: true, name: true } },
    },
  });

  const targets = stores.filter((s) => s.scrapedLeaflets.length > 0);

  if (targets.length === 0) {
    console.log("再スクレイプ対象の店舗が見つかりませんでした（既スクレイプ済みの店舗なし）");
    return;
  }

  console.log(`\n対象店舗: ${targets.length}件`);
  for (const s of targets) {
    console.log(`  - ${s.name} (チラシ ${s.scrapedLeaflets.length}件)`);
  }
  console.log();

  for (const store of targets) {
    console.log(`\n========== ${store.name} ==========`);

    // 1. Count existing flyer images for this store
    const images = await prisma.uploadedImage.findMany({
      where: { storeId: store.id, sourceType: "flyer" },
      select: { id: true },
    });
    const imageIds = images.map((i) => i.id);

    // 2. Delete auto_flyer price records
    const deletedPrices = await prisma.priceRecord.deleteMany({
      where: { storeId: store.id, sourceType: "auto_flyer" },
    });
    console.log(`  価格記録削除: ${deletedPrices.count}件`);

    // 3. Delete flyer images (PendingReview cascades via FK)
    if (imageIds.length > 0) {
      const deletedImages = await prisma.uploadedImage.deleteMany({
        where: { id: { in: imageIds } },
      });
      console.log(`  画像レコード削除: ${deletedImages.count}件`);
    }

    // 4. Delete scraped leaflet records so the pipeline treats them as new
    const deletedLeaflets = await prisma.scrapedLeaflet.deleteMany({
      where: { storeId: store.id },
    });
    console.log(`  チラシ履歴削除: ${deletedLeaflets.count}件`);

    // 5. Run the full pipeline
    console.log(`  パイプライン実行中...`);
    try {
      const result = await runScrapingPipeline(store.id, store.user.id);
      console.log(`  ✅ 完了:`);
      console.log(`     画像取得: ${result.imagesScraped}件`);
      console.log(`     OCR処理: ${result.imagesOcred}件`);
      console.log(`     価格登録: ${result.pricesRegistered}件`);
      console.log(`     確認待ち: ${result.pendingReviews}件`);
      if (result.errors.length > 0) {
        console.log(`  ⚠️ エラー (${result.errors.length}件):`);
        for (const e of result.errors) console.log(`     ${e}`);
      }
    } catch (err) {
      console.error(`  ❌ パイプライン失敗:`, err);
    }
  }

  console.log("\n\n全店舗の再スクレイプが完了しました。");
}

main()
  .catch((err) => {
    console.error("スクリプトエラー:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
