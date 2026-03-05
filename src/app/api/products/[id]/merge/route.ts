import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/products/[id]/merge
 * Merge source product into target product.
 * - All price records from source are moved to target
 * - Source's normalizedName and aliases are re-registered as aliases of target
 * - Source product is deleted
 * Body: { targetProductId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sourceId } = await params;
  const { targetProductId } = (await request.json()) as {
    targetProductId: string;
  };

  if (!targetProductId) {
    return NextResponse.json(
      { error: "targetProductId は必須です" },
      { status: 400 },
    );
  }

  if (sourceId === targetProductId) {
    return NextResponse.json(
      { error: "同じ商品には統合できません" },
      { status: 400 },
    );
  }

  // Fetch both products
  const [source, target] = await Promise.all([
    prisma.product.findUnique({
      where: { id: sourceId },
      include: { aliases: true },
    }),
    prisma.product.findUnique({ where: { id: targetProductId } }),
  ]);

  if (!source) {
    return NextResponse.json(
      { error: "統合元の商品が見つかりません" },
      { status: 404 },
    );
  }
  if (!target) {
    return NextResponse.json(
      { error: "統合先の商品が見つかりません" },
      { status: 404 },
    );
  }

  // Build the full list of alias names to register on target
  const aliasNames = [
    source.normalizedName,
    ...source.aliases.map((a: { aliasName: string }) => a.aliasName),
  ].filter((n) => n !== target.normalizedName);

  // 1. Move all price records to target
  await prisma.priceRecord.updateMany({
    where: { productId: sourceId },
    data: { productId: targetProductId },
  });

  // 2. Delete source's aliases (will be re-created on target)
  await prisma.productAlias.deleteMany({ where: { productId: sourceId } });

  // 3. Register source names as aliases of target (skip duplicates)
  for (const aliasName of aliasNames) {
    const existing = await prisma.productAlias.findFirst({ where: { aliasName } });
    if (!existing) {
      await prisma.productAlias.create({
        data: { productId: targetProductId, aliasName },
      });
    }
  }

  // 4. Delete source product
  await prisma.product.delete({ where: { id: sourceId } });

  return NextResponse.json({
    message: `「${source.name}」を「${target.name}」に統合しました`,
    targetProductId,
  });
}
