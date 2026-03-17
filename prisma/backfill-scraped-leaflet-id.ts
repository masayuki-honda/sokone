/**
 * Back-fill scrapedLeafletId on existing auto_flyer/flyer images.
 *
 * For each image with scrapedLeafletId=NULL, find the ScrapedLeaflet record
 * for the same store that was scraped closest in time.
 *
 * Usage: npx tsx --env-file=.env prisma/backfill-scraped-leaflet-id.ts [--dry-run]
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never);

const isDryRun = process.argv.includes("--dry-run");
const WINDOW_MS = 30 * 60 * 1000; // ±30 min

async function run() {
  const db = prisma as any;

  // Find all auto_flyer/flyer images without a scrapedLeafletId
  const unlinked = await db.uploadedImage.findMany({
    where: {
      sourceType: { in: ["auto_flyer", "flyer"] },
      scrapedLeafletId: null,
      storeId: { not: null },
    },
    select: { id: true, storeId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${unlinked.length} unlinked auto_flyer images.`);
  if (unlinked.length === 0) {
    await db.$disconnect();
    return;
  }

  // Load all ScrapedLeaflets (small table)
  const leaflets = await db.scrapedLeaflet.findMany({
    select: { id: true, storeId: true, scrapedAt: true },
  });

  let linked = 0;
  let skipped = 0;

  for (const img of unlinked) {
    // Find leaflets for the same store within the time window
    const candidates = leaflets.filter(
      (l: any) =>
        l.storeId === img.storeId &&
        Math.abs(l.scrapedAt.getTime() - img.createdAt.getTime()) <= WINDOW_MS
    );

    if (candidates.length === 0) {
      console.log(`  [SKIP] Image ${img.id} — no leaflet within ±30min`);
      skipped++;
      continue;
    }

    // Pick the closest leaflet by time
    const closest = candidates.reduce((best: any, l: any) =>
      Math.abs(l.scrapedAt.getTime() - img.createdAt.getTime()) <
      Math.abs(best.scrapedAt.getTime() - img.createdAt.getTime())
        ? l
        : best
    );

    const diffSec = Math.round(
      (closest.scrapedAt.getTime() - img.createdAt.getTime()) / 1000
    );
    console.log(`  [LINK] Image ${img.id} → leaflet ${closest.id} (diff: ${diffSec}s)`);

    if (!isDryRun) {
      await db.uploadedImage.update({
        where: { id: img.id },
        data: { scrapedLeafletId: closest.id },
      });
    }
    linked++;
  }

  if (isDryRun) {
    console.log(`\n[DRY-RUN] Would link ${linked}, skip ${skipped}.`);
  } else {
    console.log(`\nDone. Linked ${linked} images, skipped ${skipped}.`);
  }

  await db.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
