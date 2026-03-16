/**
 * prisma/fix-volume-suffix.ts
 *
 * One-time migration: update existing products so that their normalizedName
 * includes the metric volume (e.g., "麦茶 600ml", "Bavaria 0.0% 330ml").
 *
 * This is the complement to fix-vegetable-units.ts:
 *   - fix-vegetable-units.ts   → selling-unit suffix (1袋/1本/etc.) for produce WITHOUT metric volume
 *   - fix-volume-suffix.ts     → metric volume suffix (ml/g/L/kg) for beverages, alcohol,
 *                                 condiments, household goods, etc.
 *
 * Update criteria (ALL must be true):
 *   1. product.volume matches a pure metric pattern: digits + ml/L/g/kg (no count multiplier)
 *   2. The normalizedName does NOT already contain that volume string
 *   3. The product is NOT a multi-pack (normalizedName does not contain "×", AND
 *      unit/volume does not resolve to a count > 1)
 *
 * Usage:
 *   # Dry run — preview changes without DB writes:
 *   npx tsx prisma/fix-volume-suffix.ts --dry-run
 *
 *   # Actually apply:
 *   npx tsx prisma/fix-volume-suffix.ts
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

// ─── helpers (inline copies of logic from product-matcher/unit-price) ────────

/** Parse a count from strings like "×6", "x6", "24缶", "6本入" */
function parseQtyCount(str: string | null | undefined): number | null {
  if (!str) return null;
  const s = str.trim();
  // ×N or xN or XN (immediate digit)
  let m = s.match(/[×xX](\d+)/);
  if (m) { const v = parseInt(m[1], 10); return v > 1 ? v : null; }
  // "N缶入", "N本入", etc.
  m = s.match(/(\d+)\s*(?:缶|本|個|枚|袋|パック|食|包|玉|切れ|丁|尾|匹|束|房)\s*入/);
  if (m) { const v = parseInt(m[1], 10); return v > 1 ? v : null; }
  // "N缶", "N本", etc. at end of string (no 入) — negative lookbehind to skip fractions
  m = s.match(/(?<![\d/])(\d+)\s*(?:缶|本|個|枚|袋|パック|食)\s*$/);
  if (m) { const v = parseInt(m[1], 10); return v > 1 ? v : null; }
  return null;
}

/**
 * Pure metric volume pattern: a number + metric unit, with no extra count multiplier.
 * Valid:   "330ml", "600ml", "1L", "1.5L", "500g", "2kg", "1000ml"
 * Invalid: "350ml x 6", "60g×3", "各種", "50" (no unit), "3本入"
 */
const PURE_METRIC_VOLUME_RE = /^\d+\.?\d*\s*(ml|mL|ML|L|l|g|G|kg|KG|キログラム|キロ|グラム|リットル|ミリリットル)$/;

function isPureMetric(vol: string | null): vol is string {
  if (!vol) return false;
  return PURE_METRIC_VOLUME_RE.test(vol.trim());
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(dryRun ? "=== DRY RUN ===" : "=== UPDATING ===");

  // Fetch all products that have a volume set
  const allProducts = await prisma.product.findMany({
    where: { volume: { not: null } },
    select: { id: true, name: true, normalizedName: true, unit: true, volume: true },
  });

  console.log(`\n全商品（volume あり）: ${allProducts.length} 件`);

  type Update = { id: string; oldName: string; oldKey: string; newName: string; newKey: string };
  const updates: Update[] = [];

  for (const p of allProducts) {
    const vol = p.volume!;

    // Condition 1: volume must be a pure metric value
    if (!isPureMetric(vol)) continue;

    // Condition 3: skip multi-packs — check unit, volume, and normalizedName
    const packFromUnit = parseQtyCount(p.unit);
    const packFromVol  = parseQtyCount(vol); // should be null for pure metric, but safety check
    const isMultiPack =
      (packFromUnit !== null && packFromUnit > 1) ||
      (packFromVol  !== null && packFromVol  > 1) ||
      p.normalizedName.includes("×");
    if (isMultiPack) continue;

    // Condition 2: volume must NOT already appear in normalizedName
    const volKey = vol.toLowerCase().replace(/\s+/g, "");
    const normKey = p.normalizedName.replace(/\s/g, "");
    if (normKey.includes(volKey)) continue;

    // Build new keys
    const newKey  = `${p.normalizedName} ${vol}`.trim();
    const newName = `${p.name} ${vol}`.trim();

    updates.push({ id: p.id, oldName: p.name, oldKey: p.normalizedName, newName, newKey });
  }

  console.log(`更新対象: ${updates.length} 件\n`);

  if (updates.length === 0) {
    console.log("更新が必要な商品はありません。");
    return;
  }

  console.log("--- 更新対象一覧 ---");
  for (const u of updates) {
    console.log(`  [${u.id.slice(0, 8)}]  ${u.oldName}  →  ${u.newName}`);
  }

  if (dryRun) {
    console.log(`\n--dry-run モードのため変更は行いません。実際に更新するには --dry-run を外してください。`);
    return;
  }

  let updated = 0;
  let skipped = 0;
  for (const u of updates) {
    try {
      await prisma.product.update({
        where: { id: u.id },
        data: { name: u.newName, normalizedName: u.newKey },
      });
      updated++;
    } catch (err) {
      // normalizedName uniqueness conflict → log and skip (two products may share the same name diff capacity)
      console.error(`  ⚠ 更新失敗 [${u.id.slice(0, 8)}] ${u.oldName}: ${(err as Error).message}`);
      skipped++;
    }
  }

  console.log(`\n更新完了: ${updated} 件${skipped ? `  (失敗: ${skipped} 件)` : ""}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
