/**
 * prisma/fix-vegetable-units.ts
 *
 * One-time migration: update existing produce/vegetable products so that
 * their names and normalizedNames include the selling-unit format
 * (e.g., "きゅうり" + unit="1袋" → "きゅうり 1袋").
 *
 * This mirrors the new logic in resolveLookupKeys that was added so that
 * products sold in different formats (1本, 1袋, ×3, etc.) are stored as
 * distinct entries in the catalog.
 *
 * Criteria for update:
 *   1. Product.unit is a produce selling unit (本, 個, 玉, 球, 袋, 束, 房, パック)
 *      OR can resolve to a multi-pack count (e.g. volume="3本入" → ×3)
 *   2. Current normalizedName does NOT already contain the expected suffix
 *
 * Usage:
 *   # Dry run — see what would be renamed without touching the DB:
 *   npx tsx prisma/fix-vegetable-units.ts --dry-run
 *
 *   # Actually perform the rename:
 *   npx tsx prisma/fix-vegetable-units.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

const dryRun = process.argv.includes("--dry-run");

// ─── Inline copies of helpers from product-matcher.ts ───────────────────────

const PRODUCE_SELLING_UNITS = new Set([
  "本", "個", "玉", "球", "袋", "束", "房", "パック",
]);

function normalizeJa(name: string): string {
  let s = name;
  // Full-width alphanumeric → half-width
  s = s.replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  s = s.replace(/\u3000/g, " ");
  s = s.toLowerCase();
  return s.trim();
}

/**
 * Minimal parseQuantity — looks for "×N", "N缶/本/個/袋/枚/パック/食 (入|入り)?"
 * Returns the count when > 1, else null.
 * NOTE: negative lookbehind prevents matching fractions like "1/6個" (= 1/6 of a head).
 */
function parseQty(str: string | null | undefined): number | null {
  if (!str) return null;
  const s = str.trim();
  let m = s.match(/[×xX](\d+)/);
  if (m) { const v = parseInt(m[1], 10); return v > 1 ? v : null; }
  m = s.match(/(\d+)\s*(?:缶|本|個|枚|袋|パック|食|包|玉|切れ|丁|尾|匹|束|房)\s*入/);
  if (m) { const v = parseInt(m[1], 10); return v > 1 ? v : null; }
  // Negative lookbehind: skip if digit follows "/" (fraction like "1/6個")
  m = s.match(/(?<![\d/])(\d+)\s*(?:缶|本|個|枚|袋|パック|食)\s*$/);
  if (m) { const v = parseInt(m[1], 10); return v > 1 ? v : null; }
  return null;
}

/**
 * Compute the expected normalizedName for a product given its current data.
 */
function computeExpectedKey(
  currentNormalized: string,
  rawUnit: string | null,
  rawVolume: string | null,
): string {
  const packFromUnit = parseQty(rawUnit);
  const packFromVol  = parseQty(rawVolume);
  const packCount = packFromUnit ?? packFromVol;

  if (packCount !== null && packCount > 1) {
    // Multi-pack suffix: ×N
    const suffix = ` ×${packCount}`;
    if (!currentNormalized.includes(suffix.trim())) {
      return `${currentNormalized}${suffix}`.trim();
    }
    return currentNormalized;
  }

  // Check for produce selling unit
  const strippedUnit = rawUnit ? rawUnit.replace(/^1\s*/, "").trim() : null;
  const hasMetricVolume = rawVolume ? /\d+\s*(ml|g|l|kg)/i.test(rawVolume) : false;
  const alreadyHasMultipack = currentNormalized.includes("×");

  if (
    !hasMetricVolume &&
    !alreadyHasMultipack &&
    strippedUnit &&
    PRODUCE_SELLING_UNITS.has(strippedUnit) &&
    !currentNormalized.replace(/\s/g, "").includes(strippedUnit)
  ) {
    return `${currentNormalized} 1${strippedUnit}`.trim();
  }

  return currentNormalized; // no change needed
}

// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(dryRun ? "=== DRY RUN ===" : "=== UPDATING ===");

  // Fetch products where unit is a produce selling unit (or could have a pack count in volume)
  const allProducts = await prisma.product.findMany({
    where: {
      OR: [
        // unit matches a produce selling unit (possibly prefixed with "1")
        { unit: { in: Array.from(PRODUCE_SELLING_UNITS).flatMap((u) => [u, `1${u}`]) } },
        // unit or volume contains a count pattern
        { unit:   { contains: "入" } },
        { unit:   { contains: "パック" } },
        { volume: { contains: "入" } },
      ],
    },
  });

  console.log(`\n候補商品: ${allProducts.length} 件`);

  type Update = { id: string; oldName: string; oldKey: string; newName: string; newKey: string };
  const updates: Update[] = [];

  for (const p of allProducts) {
    const expectedKey = computeExpectedKey(p.normalizedName, p.unit, p.volume);
    if (expectedKey === p.normalizedName) continue; // already correct

    // Derive new display name by replacing the old normalizedName suffix with the new one
    // (simple heuristic: if name ends with normalizedName, append the new suffix instead)
    const suffix = expectedKey.slice(p.normalizedName.length); // e.g., " 1袋" or " ×3"
    const newName = p.name + suffix;

    updates.push({
      id: p.id,
      oldName: p.name,
      oldKey: p.normalizedName,
      newName,
      newKey: expectedKey,
    });
  }

  if (updates.length === 0) {
    console.log("\n更新が必要な商品はありません。");
    return;
  }

  console.log("\n--- 更新対象一覧 ---");
  for (const u of updates) {
    console.log(`  [${u.id.slice(0, 8)}]  ${u.oldName}  →  ${u.newName}`);
    console.log(`             key: "${u.oldKey}"  →  "${u.newKey}"`);
  }

  if (dryRun) {
    console.log(`\n--dry-run モードのため変更は行いません。実際に更新するには --dry-run を外してください。`);
    return;
  }

  // Apply updates
  let updated = 0;
  for (const u of updates) {
    try {
      await prisma.product.update({
        where: { id: u.id },
        data: { name: u.newName, normalizedName: u.newKey },
      });
      updated++;
    } catch (err) {
      // If normalizedName conflicts with an existing product, just update the key is not possible
      // Log and skip
      console.error(`  ⚠ 更新失敗 [${u.id.slice(0, 8)}] ${u.oldName}: ${(err as Error).message}`);
    }
  }

  console.log(`\n更新完了: ${updated} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
