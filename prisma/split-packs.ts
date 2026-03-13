/**
 * prisma/split-packs.ts
 *
 * One-time migration: automatically separate price records that were
 * incorrectly grouped together under the same product when they actually
 * belong to different pack sizes (e.g., single can vs 6-pack).
 *
 * Detection logic:
 *   - For each product, if max(price) / min(price) > 3.5, mixing is suspected.
 *   - The "single-unit baseline" = median of prices in the lower half of the range.
 *   - Records whose price ≈ baseline × N (N ∈ {2,4,6,12,24}, ±25%) are treated
 *     as N-pack records and moved to a new / existing product with unit = "×N".
 *
 * Usage:
 *   # Dry run (no DB changes, just show what would be split):
 *   npx tsx prisma/split-packs.ts --dry-run
 *
 *   # Actually perform the split:
 *   npx tsx prisma/split-packs.ts
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

// Pack sizes to detect (ordered: largest first to avoid misclassification)
const PACK_SIZES = [24, 12, 6, 4, 2] as const;
// Tolerance for ratio matching (±25% of the expected factor)
const TOLERANCE = 0.25;
// Minimum ratio between max and min price to suspect mixing
const SUSPECT_RATIO = 3.5;

function guessPackFactor(
  price: number,
  baseline: number,
): (typeof PACK_SIZES)[number] | null {
  for (const n of PACK_SIZES) {
    const ratio = price / baseline;
    if (Math.abs(ratio - n) / n <= TOLERANCE) {
      return n;
    }
  }
  return null;
}

function median(vals: number[]): number {
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const productIdArg = process.argv.find((a) => a.startsWith("--product-id="));
  const filterProductId = productIdArg ? productIdArg.split("=")[1] : null;
  // --min-each-side N: require at least N records on both sides before splitting (default 1)
  const minEachSideArg = process.argv.find((a) => a.startsWith("--min-each-side="));
  const minEachSide = minEachSideArg ? parseInt(minEachSideArg.split("=")[1], 10) : 1;

  if (dryRun) {
    console.log("=== DRY RUN MODE — DBは変更されません ===\n");
  } else {
    console.log("=== 実行モード — DB を変更します ===\n");
  }
  if (filterProductId) {
    console.log(`対象商品ID: ${filterProductId}\n`);
  }
  if (minEachSide > 1) {
    console.log(`最低レコード数 (各サイド): ${minEachSide}件以上\n`);
  }

  const products = await prisma.product.findMany({
    include: {
      priceRecords: {
        select: {
          id: true,
          price: true,
          storeId: true,
          userId: true,
          sourceType: true,
          sourceImageId: true,
          recordedAt: true,
          taxIncluded: true,
          unitPrice: true,
        },
      },
    },
  });

  let totalDetected = 0;
  let totalMoved = 0;

  for (const product of products) {
    if (filterProductId && product.id !== filterProductId) continue;
    if (product.priceRecords.length < 2) continue;

    const prices = product.priceRecords.map((r) => r.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (maxPrice / minPrice < SUSPECT_RATIO) continue;

    // Baseline = median of prices in the lower half of the range
    const midpoint = (minPrice + maxPrice) / 2;
    const lowerPrices = prices.filter((p) => p <= midpoint);
    if (lowerPrices.length === 0) continue;
    const baseline = median(lowerPrices);

    // Classify each record
    const singles: typeof product.priceRecords = [];
    const packGroups = new Map<
      number,
      typeof product.priceRecords
    >();

    for (const record of product.priceRecords) {
      const factor = guessPackFactor(record.price, baseline);
      if (factor) {
        if (!packGroups.has(factor)) packGroups.set(factor, []);
        packGroups.get(factor)!.push(record);
      } else {
        singles.push(record);
      }
    }

    if (packGroups.size === 0) continue;
    // Only split when we have confirmed singles AND packs, with enough records on each side
    if (singles.length === 0) continue;
    if (singles.length < minEachSide) continue;
    const allPacksEnough = [...packGroups.values()].every(
      (recs) => recs.length >= minEachSide,
    );
    if (!allPacksEnough) continue;

    totalDetected++;
    console.log(
      `\n[${product.name}]  id=${product.id}  unit="${product.unit ?? "null"}"  volume="${product.volume ?? "null"}"`,
    );
    console.log(
      `  単品 ${singles.length}件: ${singles.map((r) => `¥${r.price}`).join(", ")}`,
    );
    for (const [factor, records] of packGroups) {
      console.log(
        `  ×${factor}パック ${records.length}件: ${records.map((r) => `¥${r.price}`).join(", ")}  → 1缶あたり ¥${Math.round(records[0].price / factor)}`,
      );
    }

    if (dryRun) continue;

    // --- Perform the split ---
    for (const [factor, records] of packGroups) {
      const packNormalizedName = `${product.normalizedName} ×${factor}`;
      const packName = product.name.includes(`×${factor}`)
        ? product.name
        : `${product.name} ×${factor}`;

      // Find or create the pack product
      let packProduct = await prisma.product.findFirst({
        where: { normalizedName: packNormalizedName },
      });

      if (!packProduct) {
        packProduct = await prisma.product.create({
          data: {
            name: packName,
            normalizedName: packNormalizedName,
            categoryId: product.categoryId,
            unit: `×${factor}`,
            volume: product.volume, // volume per single item (e.g. 330ml)
          },
        });
        console.log(`  → 新商品作成: "${packName}" (id=${packProduct.id})`);
      } else {
        console.log(
          `  → 既存商品を使用: "${packProduct.name}" (id=${packProduct.id})`,
        );
      }

      // Move price records and recalculate unitPrice (price / factor = per-item price)
      for (const record of records) {
        const newUnitPrice = record.price / factor;
        await prisma.priceRecord.update({
          where: { id: record.id },
          data: {
            productId: packProduct.id,
            unitPrice: newUnitPrice,
          },
        });
      }

      console.log(
        `  → ${records.length}件を "${packName}" に移動し unitPrice を再計算`,
      );
      totalMoved += records.length;
    }
  }

  if (dryRun) {
    console.log(
      `\n[DRY RUN 完了] ${totalDetected}商品でパック混在を検出しました。`,
    );
    console.log(
      "実際に分離するには: npx tsx prisma/split-packs.ts",
    );
  } else {
    console.log(
      `\n[完了] ${totalDetected}商品を検出、${totalMoved}件の価格レコードを分離しました。`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
