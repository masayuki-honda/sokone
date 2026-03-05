import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/categories — List product categories
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.productCategory.findMany({
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      name: true,
      displayOrder: true,
      parentId: true,
      _count: {
        select: { products: true },
      },
    },
  });

  return NextResponse.json({ categories });
}

/**
 * POST /api/categories — Create a new category
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, parentId } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "カテゴリ名は必須です" },
      { status: 400 },
    );
  }

  if (name.trim().length > 50) {
    return NextResponse.json(
      { error: "カテゴリ名は50文字以内で入力してください" },
      { status: 400 },
    );
  }

  // Check for duplicate name
  const existing = await prisma.productCategory.findFirst({
    where: { name: name.trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "同じ名前のカテゴリが既に存在します" },
      { status: 409 },
    );
  }

  // If parentId is provided, verify it exists
  if (parentId) {
    const parent = await prisma.productCategory.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      return NextResponse.json(
        { error: "親カテゴリが見つかりません" },
        { status: 404 },
      );
    }
  }

  // Get the next display order
  const maxOrder = await prisma.productCategory.aggregate({
    _max: { displayOrder: true },
  });
  const nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  const category = await prisma.productCategory.create({
    data: {
      name: name.trim(),
      parentId: parentId || null,
      displayOrder: nextOrder,
    },
    select: {
      id: true,
      name: true,
      displayOrder: true,
      parentId: true,
      _count: {
        select: { products: true },
      },
    },
  });

  return NextResponse.json(category, { status: 201 });
}
