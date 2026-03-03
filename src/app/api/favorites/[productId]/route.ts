import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ productId: string }>;
}

/**
 * DELETE /api/favorites/[productId] — Remove product from favorites
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId } = await params;

  try {
    const favorite = await prisma.favoriteProduct.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
    });

    if (!favorite) {
      return NextResponse.json(
        { error: "お気に入りが見つかりません" },
        { status: 404 },
      );
    }

    await prisma.favoriteProduct.delete({
      where: { id: favorite.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting favorite:", error);
    return NextResponse.json(
      { error: "お気に入り解除に失敗しました" },
      { status: 500 },
    );
  }
}
