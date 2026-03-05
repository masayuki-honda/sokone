import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PUT /api/categories/{id} — Update a category
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.productCategory.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "カテゴリが見つかりません" },
      { status: 404 },
    );
  }

  const body = await request.json();
  const { name, parentId, displayOrder } = body;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
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

    // Check for duplicate name (excluding self)
    const duplicate = await prisma.productCategory.findFirst({
      where: {
        name: name.trim(),
        id: { not: id },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "同じ名前のカテゴリが既に存在します" },
        { status: 409 },
      );
    }
  }

  // Prevent circular parent reference
  if (parentId !== undefined) {
    if (parentId === id) {
      return NextResponse.json(
        { error: "自分自身を親カテゴリにはできません" },
        { status: 400 },
      );
    }
    if (parentId !== null) {
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
  }

  const category = await prisma.productCategory.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(parentId !== undefined && { parentId }),
      ...(displayOrder !== undefined && { displayOrder: Number(displayOrder) }),
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

  return NextResponse.json(category);
}

/**
 * DELETE /api/categories/{id} — Delete a category (only if no products)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.productCategory.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true, children: true } },
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "カテゴリが見つかりません" },
      { status: 404 },
    );
  }

  if (existing._count.products > 0) {
    return NextResponse.json(
      { error: `このカテゴリには${existing._count.products}件の商品が登録されています。先に商品のカテゴリを変更してください` },
      { status: 400 },
    );
  }

  if (existing._count.children > 0) {
    return NextResponse.json(
      { error: "子カテゴリが存在するため削除できません。先に子カテゴリを削除してください" },
      { status: 400 },
    );
  }

  await prisma.productCategory.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
