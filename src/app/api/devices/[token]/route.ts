import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * DELETE /api/devices/[token] — Unregister a device push token
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;
  const decodedToken = decodeURIComponent(token);

  // Only allow deleting own tokens
  const existing = await prisma.deviceToken.findUnique({
    where: { token: decodedToken },
  });

  if (!existing) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.deviceToken.delete({
    where: { token: decodedToken },
  });

  return new NextResponse(null, { status: 204 });
}
