import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PUT /api/favorites/order — Update display order of favorite products
 * Body: { items: [{ productId: string, displayOrder: number }] }
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { items } = body as {
      items: Array<{ productId: string; displayOrder: number }>;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "並び替えリストは必須です" },
        { status: 400 },
      );
    }

    // Validate all items have required fields
    for (const item of items) {
      if (!item.productId || typeof item.displayOrder !== "number") {
        return NextResponse.json(
          { error: "各項目に productId と displayOrder が必要です" },
          { status: 400 },
        );
      }
    }

    // Update display orders in a transaction
    await prisma.$transaction(
      items.map((item) =>
        prisma.favoriteProduct.update({
          where: {
            userId_productId: {
              userId: session.user.id,
              productId: item.productId,
            },
          },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating favorite order:", error);
    return NextResponse.json(
      { error: "表示順序の更新に失敗しました" },
      { status: 500 },
    );
  }
}
