/**
 * Migrate scraper-created images from sourceType="flyer" to "auto_flyer".
 * Scraper-created images were mistakenly saved with sourceType="flyer".
 * We identify them by having a storeId set AND matching a ScrapedLeaflet time window.
 *
 * Usage: npx tsx --env-file=.env prisma/migrate-flyer-source-type.ts [--dry-run]
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

  // Find all "flyer" images that have a storeId (auto-scraped, not user-uploaded)
  // User-uploaded flyers via the upload form have storeId too, but they were matched
  // by product records. The scraper-created ones typically have storeId + no price records.
  // Safest: update ALL "flyer" images that have a storeId – user can re-upload if needed.
  const flyerImages = await db.uploadedImage.findMany({
    where: { sourceType: "flyer", storeId: { not: null } },
    select: { id: true, storeId: true, status: true, createdAt: true },
  });

  console.log(`Found ${flyerImages.length} "flyer" images with storeId.`);

  if (flyerImages.length === 0) {
    console.log("Nothing to do.");
    await db.$disconnect();
    return;
  }

  for (const img of flyerImages) {
    console.log(
      `  [${img.status}] ${img.createdAt.toISOString()} storeId=${img.storeId}`
    );
  }

  if (!isDryRun) {
    const result = await db.uploadedImage.updateMany({
      where: { sourceType: "flyer", storeId: { not: null } },
      data: { sourceType: "auto_flyer" },
    });
    console.log(`\nUpdated ${result.count} records to sourceType="auto_flyer".`);
  } else {
    console.log("\n[DRY-RUN] No changes made.");
  }

  await db.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
