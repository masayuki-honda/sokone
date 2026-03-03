import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2SignedUrl, deleteFromR2 } from "@/lib/r2";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/images/[id] — Get image detail (with OCR results)
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const image = await prisma.uploadedImage.findFirst({
    where: { id, userId: session.user.id },
    include: {
      store: {
        select: { id: true, name: true },
      },
    },
  });

  if (!image) {
    return NextResponse.json(
      { error: "画像が見つかりません" },
      { status: 404 },
    );
  }

  const signedUrl = await getR2SignedUrl(image.imageUrl);

  return NextResponse.json({
    ...image,
    signedUrl,
  });
}

/**
 * PATCH /api/images/[id] — Update image metadata (e.g., store assignment)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.uploadedImage.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "画像が見つかりません" },
      { status: 404 },
    );
  }

  const body = await request.json();
  const { storeId } = body;

  // Validate store if provided
  if (storeId) {
    const store = await prisma.store.findFirst({
      where: { id: storeId, userId: session.user.id },
    });
    if (!store) {
      return NextResponse.json(
        { error: "指定された店舗が見つかりません" },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.uploadedImage.update({
    where: { id },
    data: {
      ...(storeId !== undefined && { storeId: storeId || null }),
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/images/[id] — Delete an image (from DB + R2)
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const image = await prisma.uploadedImage.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!image) {
    return NextResponse.json(
      { error: "画像が見つかりません" },
      { status: 404 },
    );
  }

  // Delete from R2
  try {
    await deleteFromR2(image.imageUrl);
  } catch (error) {
    console.error("Failed to delete from R2:", error);
    // Continue with DB deletion even if R2 fails
  }

  // Delete from database
  await prisma.uploadedImage.delete({ where: { id } });

  return NextResponse.json({ message: "画像を削除しました" });
}
