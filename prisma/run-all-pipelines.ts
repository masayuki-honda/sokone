/**
 * Directly run the scraping pipeline for all stores with tokubai URLs.
 * Usage: npx tsx --env-file=.env prisma/run-all-pipelines.ts
 */
import { prisma } from "@/lib/prisma";
import { runScrapingPipeline } from "@/lib/scraping-pipeline";

async function run() {
  const db = prisma as any;

  const stores = await db.store.findMany({
    where: { tokubaiShopUrl: { not: null } },
    select: { id: true, name: true, userId: true },
  });

  console.log(`Found ${stores.length} stores with tokubai URLs.`);
  if (stores.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  for (const store of stores) {
    console.log(`\n=== ${store.name} ===`);
    try {
      const result = await runScrapingPipeline(store.id, store.userId);
      console.log(
        `  ✓ Scraped: ${result.imagesScraped}, OCR'd: ${result.imagesOcred}, Prices: ${result.pricesRegistered}`
      );
      if (result.errors.length > 0) {
        console.log("  Errors:", result.errors.slice(0, 3));
      }
    } catch (err) {
      console.error(`  ✗ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\nDone.");
  await db.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
