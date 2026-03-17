/**
 * Reset ScrapedLeaflet records for stores with no auto_flyer images in DB.
 * Run this when images were deleted by cleanup scripts and need to be re-scraped.
 *
 * Usage:
 *   npx tsx --env-file=.env prisma/reset-scraped-leaflets.ts [--dry-run]
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never);

const isDryRun = process.argv.includes("--dry-run");

async function run() {
  const db = prisma as any;

  // Find all stores that have ScrapedLeaflet records but no auto_flyer images
  const storesWithLeaflets = await db.store.findMany({
    where: { scrapedLeaflets: { some: {} } },
    select: {
      id: true,
      name: true,
      _count: { select: { scrapedLeaflets: true } },
    },
  });

  let totalReset = 0;

  for (const store of storesWithLeaflets) {
    const imageCount = await db.uploadedImage.count({
      where: { storeId: store.id, sourceType: "auto_flyer" },
    });

    if (imageCount === 0) {
      console.log(
        `[RESET] ${store.name} — ${store._count.scrapedLeaflets} leaflets, 0 images`
      );
      if (!isDryRun) {
        await db.scrapedLeaflet.deleteMany({ where: { storeId: store.id } });
        console.log(`  → Deleted ${store._count.scrapedLeaflets} ScrapedLeaflet records`);
        totalReset += store._count.scrapedLeaflets;
      }
    } else {
      console.log(
        `[OK]    ${store.name} — ${store._count.scrapedLeaflets} leaflets, ${imageCount} images`
      );
    }
  }

  if (isDryRun) {
    console.log("\n[DRY-RUN] No changes made. Re-run without --dry-run to apply.");
  } else {
    console.log(`\nDone. Reset ${totalReset} ScrapedLeaflet records.`);
    console.log("Next pipeline run will re-scrape these stores.");
  }

  await db.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
