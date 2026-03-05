import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/prices/[id] — Delete a single price record
 * Only the record owner can delete it.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const record = await prisma.priceRecord.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, productId: true },
  });

  if (!record) {
    return NextResponse.json(
      { error: "価格記録が見つかりません" },
      { status: 404 },
    );
  }

  await prisma.priceRecord.delete({ where: { id } });

  return NextResponse.json({
    message: "価格記録を削除しました",
    productId: record.productId,
  });
}
