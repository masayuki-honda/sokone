import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * POST /api/devices — Register a device push token
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { token, platform } = body;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  if (!platform || !["android", "ios"].includes(platform)) {
    return NextResponse.json({ error: "Platform must be 'android' or 'ios'" }, { status: 400 });
  }

  // Upsert: if the token already exists, update the user association
  const deviceToken = await prisma.deviceToken.upsert({
    where: { token },
    update: {
      userId: session.user.id,
      platform,
    },
    create: {
      token,
      platform,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ id: deviceToken.id, token: deviceToken.token });
}

/**
 * GET /api/devices — List current user's registered device tokens
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await prisma.deviceToken.findMany({
    where: { userId: session.user.id },
    select: { id: true, token: true, platform: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tokens);
}
