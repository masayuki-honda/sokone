/**
 * prisma/cleanup-auto-flyer-products.ts
 *
 * One-time cleanup: delete products that were added solely by auto-flyer
 * scraping and have never been used by the user (no favorites, no price watches).
 *
 * Deletion criteria (ALL must be true):
 *   1. Every PriceRecord for the product has sourceType = auto_flyer
 *   2. No FavoriteProduct entry exists for the product
 *   3. No PriceWatch entry exists for the product
 *
 * Usage:
 *   # Dry run — see what would be deleted without touching the DB:
 *   npx tsx prisma/cleanup-auto-flyer-products.ts --dry-run
 *
 *   # Actually delete:
 *   npx tsx prisma/cleanup-auto-flyer-products.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(dryRun ? "=== DRY RUN ===" : "=== DELETING ===");

  // Fetch all products with their related records
  const products = await prisma.product.findMany({
    include: {
      priceRecords: { select: { id: true, sourceType: true } },
      favoriteProducts: { select: { id: true } },
      priceWatches: { select: { id: true } },
    },
  });

  // Filter to auto-flyer-only, unused products
  const targets = products.filter((p) => {
    if (p.priceRecords.length === 0) return false; // no records → skip (manually created product)
    const allAutoFlyer = p.priceRecords.every((r) => r.sourceType === "auto_flyer");
    const notFavorited = p.favoriteProducts.length === 0;
    const notWatched = p.priceWatches.length === 0;
    return allAutoFlyer && notFavorited && notWatched;
  });

  console.log(`\n対象商品: ${targets.length} 件 / 全 ${products.length} 件`);

  if (targets.length === 0) {
    console.log("削除対象はありません。");
    return;
  }

  // Show list
  console.log("\n--- 削除対象一覧 ---");
  for (const p of targets) {
    console.log(
      `  ${p.id}  ${p.name.padEnd(40)}  価格記録 ${p.priceRecords.length} 件`
    );
  }

  if (dryRun) {
    console.log(
      "\n--dry-run モードのため変更は行いません。実際に削除するには --dry-run を外して実行してください。"
    );
    return;
  }

  const targetIds = targets.map((p) => p.id);
  const priceRecordIds = targets.flatMap((p) => p.priceRecords.map((r) => r.id));

  // Delete in a transaction: PriceRecords first (no cascade), then Products
  await prisma.$transaction(async (tx) => {
    const deletedRecords = await tx.priceRecord.deleteMany({
      where: { id: { in: priceRecordIds } },
    });
    console.log(`\n価格記録を削除: ${deletedRecords.count} 件`);

    const deletedProducts = await tx.product.deleteMany({
      where: { id: { in: targetIds } },
    });
    console.log(`商品を削除: ${deletedProducts.count} 件`);
  });

  console.log("\n完了しました。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
