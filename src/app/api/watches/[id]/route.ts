import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH /api/watches/[id] — Update a watch (targetPrice, enabled)
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.priceWatch.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "ウォッチが見つかりません" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { targetPrice, enabled } = body;

  const watch = await prisma.priceWatch.update({
    where: { id },
    data: {
      ...(targetPrice !== undefined && {
        targetPrice: targetPrice != null ? Number(targetPrice) : null,
      }),
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
    },
  });

  return NextResponse.json(watch);
}

// DELETE /api/watches/[id] — Remove a watch
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.priceWatch.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "ウォッチが見つかりません" },
      { status: 404 }
    );
  }

  await prisma.priceWatch.delete({ where: { id } });

  return NextResponse.json({ message: "ウォッチを解除しました" });
}
