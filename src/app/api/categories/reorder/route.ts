import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PUT /api/categories/reorder
 * Body: { ids: string[] }  — ordered list of category IDs
 * Updates displayOrder for each category based on array index.
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { ids?: string[] };
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids は空でない配列で指定してください" }, { status: 400 });
  }

  // Update all displayOrders in a single transaction
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.productCategory.update({
        where: { id },
        data: { displayOrder: index },
      }),
    ),
  );

  return NextResponse.json({ success: true });
}
