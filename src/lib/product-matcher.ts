import { prisma } from "@/lib/prisma";

/**
 * Normalize a product name for matching:
 * - Full-width to half-width conversion
 * - Lowercase
 * - Normalize spaces and symbols
 * - Normalize volume notation
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

  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Lowercase
  normalized = normalized.toLowerCase();

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

  const candidates = recentProducts
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      similarity: Math.max(
        similarity(normalized, product.normalizedName),
        similarity(name.toLowerCase(), product.name.toLowerCase()),
      ),
    }))
    .filter((c) => c.similarity > 0.5)
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
export async function findOrCreateProduct(
  name: string,
  options?: {
    categoryHint?: string | null;
    unit?: string | null;
    volume?: string | null;
  },
): Promise<{ id: string; name: string; isNew: boolean }> {
  const normalized = normalizeProductName(name);

  // Try exact match first
  const existing = await prisma.product.findFirst({
    where: {
      OR: [
        { normalizedName: normalized },
        {
          aliases: {
            some: {
              aliasName: { equals: normalized, mode: "insensitive" },
            },
          },
        },
      ],
    },
  });

  if (existing) {
    return { id: existing.id, name: existing.name, isNew: false };
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

  // Create new product
  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      normalizedName: normalized,
      categoryId,
      unit: options?.unit || null,
      volume: options?.volume || null,
    },
  });

  return { id: product.id, name: product.name, isNew: true };
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
