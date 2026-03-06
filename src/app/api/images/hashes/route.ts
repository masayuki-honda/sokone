import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/images/hashes — Return all known file hashes for the current user.
 * Used by the upload page to seed the duplicate-detection localStorage cache.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const images = await prisma.uploadedImage.findMany({
    where: {
      userId: session.user.id,
      fileHash: { not: null },
    },
    select: { fileHash: true },
  });

  const hashes = images
    .map((img) => img.fileHash)
    .filter((h): h is string => h !== null);

  return NextResponse.json({ hashes });
}
