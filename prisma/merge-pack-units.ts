/**
 * Data migration: merge pack-size variants into a single Product per base item.
 *
 * Before this migration, products like "アサヒ スーパードライ 350ml ×6" and
 * "アサヒ スーパードライ 350ml" were stored as separate Product rows.
 *
 * After the schema change (PriceRecord.packUnit), pack size is stored on each
 * price record instead. This script:
 *   1. Finds all products whose normalizedName contains "×N" (pack notation).
 *   2. Derives the base normalizedName (strips " ×N").
 *   3. If a base product already exists → moves PriceRecords & FavoriteProducts
 *      to the base product, sets packUnit on moved records, then deletes the ×N product.
 *   4. If no base product exists → renames the ×N product to the base name and
 *      sets packUnit on its existing PriceRecords.
 *
 * Run: npx tsx prisma/merge-pack-units.ts
 */

import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Scanning for products with pack notation in normalizedName...");

  // Find all products that have ×N in their normalizedName
  const packProducts = await prisma.product.findMany({
    where: {
      normalizedName: { contains: "×" },
    },
    include: {
      priceRecords: { select: { id: true, price: true } },
      favoriteProducts: { select: { id: true, userId: true } },
      priceWatches: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${packProducts.length} pack products to process.\n`);

  let merged = 0;
  let renamed = 0;
  let skipped = 0;

  for (const packProduct of packProducts) {
    // Extract pack suffix: " ×6", " ×24", etc.
    const packMatch = packProduct.normalizedName.match(/\s*(×\d+)\s*$/);
    if (!packMatch) {
      console.log(`⚠️  Skipping "${packProduct.name}" — could not parse pack suffix`);
      skipped++;
      continue;
    }

    const packUnit = packMatch[1]; // e.g. "×6"
    const baseNormalizedName = packProduct.normalizedName
      .replace(/\s*×\d+\s*$/, "")
      .trim();

    // Derive base display name by stripping ×N from the product name
    const baseDisplayName = packProduct.name
      .replace(/\s*[×xX]\s*\d+/g, "")
      .replace(/\s*\d+\s*(?:缶|本|個|袋|枚|パック|入り?)\s*(?:パック|セット|入り?)?/g, "")
      .trim();

    console.log(`Processing: "${packProduct.name}" (${packUnit})`);
    console.log(`  normalizedName: "${packProduct.normalizedName}" → base: "${baseNormalizedName}"`);

    // Look for an existing base product
    const baseProduct = await prisma.product.findFirst({
      where: {
        normalizedName: baseNormalizedName,
        id: { not: packProduct.id },
      },
    });

    if (baseProduct) {
      // --- Merge into existing base product ---
      console.log(`  → Merging into existing base product "${baseProduct.name}" (${baseProduct.id})`);

      // Move price records: set packUnit + reassign to base product
      if (packProduct.priceRecords.length > 0) {
        await prisma.priceRecord.updateMany({
          where: { productId: packProduct.id },
          data: { productId: baseProduct.id, packUnit },
        });
        console.log(`    Moved ${packProduct.priceRecords.length} price record(s) with packUnit="${packUnit}"`);
      }

      // Move favorite products (avoid duplicates)
      for (const fav of packProduct.favoriteProducts) {
        const existingFav = await prisma.favoriteProduct.findFirst({
          where: { userId: fav.userId, productId: baseProduct.id },
        });
        if (!existingFav) {
          await prisma.favoriteProduct.update({
            where: { id: fav.id },
            data: { productId: baseProduct.id },
          });
        } else {
          await prisma.favoriteProduct.delete({ where: { id: fav.id } });
        }
      }

      // Delete price watches (they reference the now-deleted ×N product)
      if (packProduct.priceWatches.length > 0) {
        await prisma.priceWatch.deleteMany({
          where: { productId: packProduct.id },
        });
        console.log(`    Deleted ${packProduct.priceWatches.length} price watch(es)`);
      }

      // Delete aliases pointing to the ×N product
      await prisma.productAlias.deleteMany({ where: { productId: packProduct.id } });

      // Delete the ×N product
      await prisma.product.delete({ where: { id: packProduct.id } });
      console.log(`    ✅ Deleted ×N product`);
      merged++;
    } else {
      // --- Rename ×N product to base product ---
      console.log(`  → No base product found. Renaming in place.`);

      await prisma.product.update({
        where: { id: packProduct.id },
        data: {
          name: baseDisplayName,
          normalizedName: baseNormalizedName,
          // Clear unit if it stored a pack size (×N); produce units remain untouched
          unit: packProduct.unit?.match(/^×\d+$/) ? null : packProduct.unit,
        },
      });

      // Set packUnit on all existing price records for this product
      if (packProduct.priceRecords.length > 0) {
        await prisma.priceRecord.updateMany({
          where: { productId: packProduct.id },
          data: { packUnit },
        });
        console.log(`    Set packUnit="${packUnit}" on ${packProduct.priceRecords.length} record(s)`);
      }

      console.log(`    ✅ Renamed to "${baseDisplayName}"`);
      renamed++;
    }
  }

  console.log("\n=== Migration complete ===");
  console.log(`  Merged into base product: ${merged}`);
  console.log(`  Renamed in place:         ${renamed}`);
  console.log(`  Skipped:                  ${skipped}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
