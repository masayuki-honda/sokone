import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";

/**
 * DELETE /api/images/cleanup — Delete uploaded images that have no registered prices
 * Removes images with 0 price records from both DB and R2.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find images with no associated price records
  const candidates = await prisma.uploadedImage.findMany({
    where: {
      userId: session.user.id,
      priceRecords: { none: {} },
    },
    select: { id: true, imageUrl: true },
  });

  if (candidates.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  // Delete from R2 (best-effort — don't fail if R2 deletion fails)
  await Promise.allSettled(candidates.map((img) => deleteFromR2(img.imageUrl)));

  // Delete from DB
  const { count } = await prisma.uploadedImage.deleteMany({
    where: {
      id: { in: candidates.map((img) => img.id) },
      userId: session.user.id,
    },
  });

  return NextResponse.json({ deleted: count });
}
