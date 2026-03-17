import { prisma } from "@/lib/prisma";
import { parseQuantity } from "@/lib/unit-price";

// === Synonym dictionary ===
// Groups of equivalent terms — any term in a group will be normalized to the first entry.
const SYNONYM_GROUPS: string[][] = [
  // Poultry
  ["鶏もも", "とりもも", "鶏モモ", "とりモモ", "チキンもも"],
  ["鶏むね", "とりむね", "鶏ムネ", "とりムネ", "チキンむね"],
  ["鶏手羽先", "とり手羽先", "手羽先"],
  ["鶏手羽元", "とり手羽元", "手羽元"],
  ["ささみ", "ささ身", "鶏ささみ", "とりささみ"],
  // Pork
  ["豚バラ", "ぶたバラ", "豚ばら", "ぶたばら"],
  ["豚ロース", "ぶたロース"],
  ["豚こま", "豚こま切れ", "豚小間", "豚小間切れ", "ぶたこま"],
  ["豚ひき肉", "ぶたひき肉", "豚挽き肉", "ぶた挽肉", "豚ミンチ"],
  // Beef
  ["牛バラ", "牛ばら"],
  ["牛ひき肉", "牛挽き肉", "牛挽肉", "牛ミンチ"],
  ["合びき肉", "合挽き肉", "合挽肉", "合いびき肉", "合ミンチ"],
  // Eggs / Dairy
  ["たまご", "卵", "タマゴ", "玉子"],
  ["牛乳", "ぎゅうにゅう", "ミルク"],
  // Vegetables
  ["じゃがいも", "ジャガイモ", "馬鈴薯", "ばれいしょ"],
  ["にんじん", "ニンジン", "人参"],
  ["たまねぎ", "タマネギ", "玉ねぎ", "玉葱", "玉ネギ"],
  ["きゅうり", "キュウリ", "胡瓜"],
  ["トマト", "とまと"],
  ["ピーマン", "ぴーまん"],
  ["キャベツ", "きゃべつ"],
  ["レタス", "れたす"],
  ["ほうれん草", "ほうれんそう", "ホウレンソウ", "ホウレン草"],
  ["ブロッコリー", "ぶろっこりー"],
  ["もやし", "モヤシ"],
  ["大根", "だいこん", "ダイコン"],
  ["白菜", "はくさい", "ハクサイ"],
  ["ねぎ", "ネギ", "葱", "長ねぎ", "長ネギ"],
  // Fruits
  ["りんご", "リンゴ", "林檎"],
  ["みかん", "ミカン", "蜜柑"],
  ["バナナ", "ばなな"],
  ["いちご", "イチゴ", "苺"],
  // Tofu / Soy
  ["豆腐", "とうふ", "トウフ"],
  ["納豆", "なっとう", "ナットウ"],
  // Rice
  ["米", "こめ", "お米"],
  // Fish
  ["さけ", "サケ", "鮭", "シャケ", "しゃけ"],
  ["さば", "サバ", "鯖"],
  ["いわし", "イワシ", "鰯"],
  ["まぐろ", "マグロ", "鮪"],
  ["えび", "エビ", "海老", "蝦"],
  // Common groceries
  ["食パン", "しょくパン"],
  ["ヨーグルト", "よーぐると"],
  ["マヨネーズ", "まよねーず", "マヨ"],
  ["ケチャップ", "けちゃっぷ"],
  ["しょうゆ", "醤油", "しょう油", "正油"],
  ["みそ", "ミソ", "味噌"],
  ["砂糖", "さとう", "シュガー"],
  ["食塩", "塩", "しお"],
];

// Units that represent the SELLING FORMAT for produce/vegetables/fruit/fish/meat
// (e.g., 1本 = 1 cucumber stick, 1袋 = 1 bag, 1パック = 1 pack).
// These are incorporated into normalizedName so different selling formats are separate products.
// Condition: only added when no metric volume (ml/g/L/kg) is present.
const PRODUCE_SELLING_UNITS = new Set([
  "本", "個", "玉", "球", "袋", "束", "房", "パック",
]);

// Build fast lookup: normalized synonym → canonical form
const synonymMap = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0].toLowerCase();
  for (const term of group) {
    synonymMap.set(term.toLowerCase(), canonical);
  }
}

/**
 * Normalize a product name for matching:
 * - Full-width to half-width conversion
 * - Lowercase
 * - Normalize spaces and symbols
 * - Normalize volume notation (e.g., "350ＭＬ" → "350ml")
 * - Normalize pack notation (e.g., "6缶パック" → "×6")
 * - Apply synonym dictionary
 */
export function normalizeProductName(name: string): string {
  let normalized = name;

  // Full-width alphanumeric to half-width
  normalized = normalized.replace(/[\uff01-\uff5e]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );

  // Full-width space to half-width
  normalized = normalized.replace(/\u3000/g, " ");

  // Normalize volume notations
  normalized = normalized.replace(/\uff4d\uff4c/g, "ml");
  normalized = normalized.replace(/\uff4c/g, "L");
  normalized = normalized.replace(/\uff47/g, "g");

  // Lowercase
  normalized = normalized.toLowerCase();

  // Strip bread slice-cut notation (e.g., "6枚切り", "8枚切") before multipack normalization.
  // Different slice counts of the same bread are identical products at the same price.
  // Must run before the multipack regex to prevent "6枚切り" → "×6切り" misparse.
  normalized = normalized.replace(/\d+\s*枚切り?/g, "");

  // Normalize pack/multipack notation: "6缶パック", "6本パック", "6個入" etc.
  // Only normalize when count >= 2 (count of 1 is a single item, not a multi-pack)
  normalized = normalized.replace(
    /(\d+)\s*(?:缶|本|個|袋|枚|パック|入り?|p)\s*(?:パック|セット|入り?)?/g,
    (_match, count) => (parseInt(count, 10) > 1 ? `×${count}` : _match),
  );

  // Normalize "×" variants
  normalized = normalized.replace(/\s*[xX]\s*/g, "×");

  // Apply synonym dictionary
  for (const [term, canonical] of synonymMap) {
    if (normalized.includes(term)) {
      normalized = normalized.replace(term, canonical);
    }
  }

  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0-1)
 */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

export interface MatchResult {
  type: "exact" | "similar" | "new";
  productId?: string;
  productName?: string;
  normalizedName?: string;
  similarity?: number;
  candidates?: Array<{
    productId: string;
    productName: string;
    similarity: number;
  }>;
}

/**
 * Match a product name against existing products
 * Returns match result with type and candidates
 */
export async function matchProduct(
  name: string,
  _userId?: string,
): Promise<MatchResult> {
  const normalized = normalizeProductName(name);

  // 1. Exact match on normalized_name
  const exactMatch = await prisma.product.findFirst({
    where: { normalizedName: normalized },
  });

  if (exactMatch) {
    return {
      type: "exact",
      productId: exactMatch.id,
      productName: exactMatch.name,
      normalizedName: exactMatch.normalizedName,
      similarity: 1.0,
    };
  }

  // 2. Exact match on aliases
  const aliasMatch = await prisma.productAlias.findFirst({
    where: {
      aliasName: {
        equals: normalized,
        mode: "insensitive",
      },
    },
    include: { product: true },
  });

  if (aliasMatch) {
    return {
      type: "exact",
      productId: aliasMatch.product.id,
      productName: aliasMatch.product.name,
      normalizedName: aliasMatch.product.normalizedName,
      similarity: 1.0,
    };
  }

  // 3. Partial/similar match - fetch recent products and compare
  const recentProducts = await prisma.product.findMany({
    where: {
      OR: [
        { normalizedName: { contains: normalized.substring(0, 3) } },
        { name: { contains: name.substring(0, 3), mode: "insensitive" } },
      ],
    },
    take: 50,
  });

  // Extract pack quantity from the query name to avoid cross-pack matching
  const queryPackQty = parseQuantity(normalized);

  const candidates = recentProducts
    .map((product) => {
      // Also normalize the DB product name with synonyms for better matching
      const dbNormalized = normalizeProductName(product.name);

      // Prevent matching across different pack sizes:
      // e.g., single can vs 6-pack should never be auto-matched.
      const dbPackQty = parseQuantity(dbNormalized) ?? parseQuantity(product.unit);
      const queryPack = queryPackQty?.value ?? 1;
      const dbPack = dbPackQty?.value ?? 1;
      if (queryPack !== dbPack) return null;

      return {
        productId: product.id,
        productName: product.name,
        similarity: Math.max(
          similarity(normalized, product.normalizedName),
          similarity(normalized, dbNormalized),
          similarity(name.toLowerCase(), product.name.toLowerCase()),
        ),
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && c.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  if (candidates.length > 0 && candidates[0].similarity > 0.85) {
    return {
      type: "similar",
      productId: candidates[0].productId,
      productName: candidates[0].productName,
      similarity: candidates[0].similarity,
      candidates,
    };
  }

  if (candidates.length > 0) {
    return {
      type: "new",
      candidates,
    };
  }

  return { type: "new" };
}

/**
 * Find or create a product by name
 */
/**
 * Shared helper: resolve the lookup keys (normalizedName variants) for a product name + options.
 * Used by both findOrCreateProduct and findProductOnly.
 */
function resolveLookupKeys(
  name: string,
  options?: { unit?: string | null; volume?: string | null },
): { lookupNormalized: string; lookupLegacy: string; hasNewKey: boolean; unitSuffix: string } {
  const normalized = normalizeProductName(name);
  const rawUnit = options?.unit?.trim() ?? null;
  const packQty = parseQuantity(rawUnit) ?? parseQuantity(options?.volume);
  const packSuffix = packQty && packQty.value > 1 ? ` ×${packQty.value}` : "";
  const hasPackCount = !!(packQty && packQty.value > 1);
  const rawVolume = options?.volume?.trim() ?? null;
  const volKey = rawVolume ? rawVolume.toLowerCase().replace(/\s+/g, "") : null;
  const normNoSpaces = normalized.replace(/\s/g, "");
  const volumeSuffix =
    !hasPackCount && volKey && !normNoSpaces.includes(volKey) ? ` ${rawVolume}` : "";

  // Produce/selling unit suffix: "1袋", "1本", "1パック", "1個", ...
  // Strip leading "1" from "1袋" → "袋", "1パック" → "パック"
  const strippedUnit = rawUnit ? rawUnit.replace(/^1\s*/, "").trim() : null;
  // Metric volume (ml/g/L/kg) means it's a branded packaged good — skip unit suffix
  const hasMetricVolume = rawVolume ? /\d+\s*(ml|g|l|kg)/i.test(rawVolume) : false;
  const alreadyHasMultipackInName = normalized.includes("×");
  const isProduceUnit = strippedUnit !== null && PRODUCE_SELLING_UNITS.has(strippedUnit);
  // Check against name + volumeSuffix to avoid double-appending (e.g., volume="大入り・1パック")
  const normWithVolNoSpaces = `${normalized}${volumeSuffix}`.replace(/\s/g, "");
  const unitSuffix =
    !hasPackCount &&
    !alreadyHasMultipackInName &&
    !hasMetricVolume &&
    isProduceUnit &&
    !normNoSpaces.includes(strippedUnit!) &&
    !normWithVolNoSpaces.includes(strippedUnit!)
      ? ` 1${strippedUnit}`
      : "";

  const alreadyHasPack = !packSuffix || normalized.includes(packSuffix.trim());
  const packPart = alreadyHasPack ? "" : packSuffix;
  const lookupNormalized = `${normalized}${volumeSuffix}${packPart}${unitSuffix}`.trim();

  // Legacy key: existing products stored before this naming convention was adopted
  const baseWithoutUnitSuffix = `${normalized}${volumeSuffix}${packPart}`.trim();
  const lookupLegacy = unitSuffix
    ? baseWithoutUnitSuffix
    : normalized.includes(packSuffix.trim()) || !packSuffix
      ? normalized
      : `${normalized}${packSuffix}`;

  return { lookupNormalized, lookupLegacy, hasNewKey: lookupNormalized !== lookupLegacy, unitSuffix };
}

/**
 * Find an existing product by name without creating a new one.
 * Used by the auto-flyer pipeline so unknown products go to PendingReview
 * instead of polluting the catalog.
 *
 * Returns the product if found, or null if it does not exist in the catalog.
 */
export async function findProductOnly(
  name: string,
  options?: {
    unit?: string | null;
    volume?: string | null;
  },
): Promise<{ id: string; name: string; unit: string | null; volume: string | null } | null> {
  const { lookupNormalized, lookupLegacy, hasNewKey } = resolveLookupKeys(name, options);

  let existing = await prisma.product.findFirst({
    where: {
      OR: [
        { normalizedName: lookupNormalized },
        { aliases: { some: { aliasName: { equals: lookupNormalized, mode: "insensitive" } } } },
      ],
    },
  });

  if (!existing && hasNewKey) {
    existing = await prisma.product.findFirst({
      where: {
        OR: [
          { normalizedName: lookupLegacy },
          { aliases: { some: { aliasName: { equals: lookupLegacy, mode: "insensitive" } } } },
        ],
      },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { normalizedName: lookupNormalized },
      });
    }
  }

  if (!existing) return null;
  return { id: existing.id, name: existing.name, unit: existing.unit, volume: existing.volume };
}

export async function findOrCreateProduct(
  name: string,
  options?: {
    categoryHint?: string | null;
    unit?: string | null;
    volume?: string | null;
  },
): Promise<{ id: string; name: string; isNew: boolean; unit: string | null; volume: string | null }> {
  const normalized = normalizeProductName(name);
  const { lookupNormalized, lookupLegacy, hasNewKey, unitSuffix } = resolveLookupKeys(name, options);

  // Re-derive display-name helpers (needed only for new product creation)
  const packQty = parseQuantity(options?.unit) ?? parseQuantity(options?.volume);
  const packSuffix = packQty && packQty.value > 1 ? ` ×${packQty.value}` : "";
  const hasPackCount = !!(packQty && packQty.value > 1);
  const rawVolume = options?.volume?.trim() ?? null;
  const volKey = rawVolume ? rawVolume.toLowerCase().replace(/\s+/g, "") : null;
  const normNoSpaces = normalized.replace(/\s/g, "");
  const volumeSuffix =
    !hasPackCount && volKey && !normNoSpaces.includes(volKey) ? ` ${rawVolume}` : "";

  // Try exact match on full key first
  let existing = await prisma.product.findFirst({
    where: {
      OR: [
        { normalizedName: lookupNormalized },
        {
          aliases: {
            some: {
              aliasName: { equals: lookupNormalized, mode: "insensitive" },
            },
          },
        },
      ],
    },
  });

  // Lazy migration: fall back to legacy key and upgrade normalizedName on the fly
  if (!existing && hasNewKey) {
    existing = await prisma.product.findFirst({
      where: {
        OR: [
          { normalizedName: lookupLegacy },
          {
            aliases: {
              some: {
                aliasName: { equals: lookupLegacy, mode: "insensitive" },
              },
            },
          },
        ],
      },
    });
    if (existing) {
      // Upgrade this product to the new key format (idempotent)
      await prisma.product.update({
        where: { id: existing.id },
        data: { normalizedName: lookupNormalized },
      });
      existing = { ...existing, normalizedName: lookupNormalized };
    }
  }

  if (existing) {
    return { id: existing.id, name: existing.name, isNew: false, unit: existing.unit, volume: existing.volume };
  }

  // Resolve category
  let categoryId: string | null = null;
  if (options?.categoryHint) {
    const category = await prisma.productCategory.findFirst({
      where: { name: options.categoryHint },
    });
    if (category) {
      categoryId = category.id;
    }
  }

  // Build display name: append volume, pack count, and/or produce unit if not already in the OCR name
  let displayName = name.trim();
  if (volumeSuffix && volKey && !name.trim().toLowerCase().replace(/\s+/g, "").includes(volKey)) {
    displayName += volumeSuffix;
  }
  if (packSuffix && !name.trim().toLowerCase().includes(packSuffix.trim())) {
    displayName += packSuffix;
  }
  if (unitSuffix) {
    displayName += unitSuffix;
  }

  // Create new product
  const product = await prisma.product.create({
    data: {
      name: displayName,
      normalizedName: lookupNormalized,
      categoryId,
      unit: options?.unit || null,
      volume: options?.volume || null,
    },
  });

  return { id: product.id, name: product.name, isNew: true, unit: product.unit, volume: product.volume };
}

/**
 * Search products by query string
 */
export async function searchProducts(
  query: string,
  limit: number = 10,
): Promise<
  Array<{
    id: string;
    name: string;
    normalizedName: string;
    categoryId: string | null;
    unit: string | null;
    volume: string | null;
  }>
> {
  const normalized = normalizeProductName(query);

  return prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { normalizedName: { contains: normalized, mode: "insensitive" } },
        {
          aliases: {
            some: {
              aliasName: { contains: normalized, mode: "insensitive" },
            },
          },
        },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
  });
}
