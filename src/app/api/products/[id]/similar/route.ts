import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeProductName } from "@/lib/product-matcher";
import { getSession } from "@/lib/session";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/products/[id]/similar — Find similar products for merge suggestions
 * Uses normalized name + Levenshtein distance to identify potential duplicates.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true, normalizedName: true },
  });

  if (!product) {
    return NextResponse.json(
      { error: "商品が見つかりません" },
      { status: 404 },
    );
  }

  const normalized = product.normalizedName || normalizeProductName(product.name);

  // Fetch candidates: products with similar prefix or name
  const prefix = normalized.substring(0, Math.min(3, normalized.length));
  const candidates = await prisma.product.findMany({
    where: {
      id: { not: id },
      OR: [
        { normalizedName: { contains: prefix, mode: "insensitive" } },
        { name: { contains: product.name.substring(0, 3), mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      _count: { select: { priceRecords: true } },
    },
    take: 100,
  });

  // Calculate similarity using Levenshtein distance
  const similar = candidates
    .map((c) => {
      const cNormalized = c.normalizedName || normalizeProductName(c.name);
      const sim = Math.max(
        levenshteinSimilarity(normalized, cNormalized),
        levenshteinSimilarity(
          product.name.toLowerCase(),
          c.name.toLowerCase(),
        ),
      );
      return {
        id: c.id,
        name: c.name,
        recordCount: c._count.priceRecords,
        similarity: Math.round(sim * 100) / 100,
      };
    })
    .filter((c) => c.similarity > 0.4)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  return NextResponse.json({ similar });
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
