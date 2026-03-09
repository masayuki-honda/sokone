import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationType, NotificationChannel } from "@prisma/client";

const VALID_TYPES = Object.values(NotificationType);
const VALID_CHANNELS = Object.values(NotificationChannel);

// GET /api/notifications/preferences — Get user's notification preferences
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json(preferences);
}

// PUT /api/notifications/preferences — Upsert a notification preference
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { notificationType, channel, enabled } = body;

  if (!VALID_TYPES.includes(notificationType)) {
    return NextResponse.json(
      { error: `無効な通知タイプ: ${notificationType}` },
      { status: 400 }
    );
  }

  if (!VALID_CHANNELS.includes(channel)) {
    return NextResponse.json(
      { error: `無効なチャネル: ${channel}` },
      { status: 400 }
    );
  }

  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled は真偽値で指定してください" },
      { status: 400 }
    );
  }

  const preference = await prisma.notificationPreference.upsert({
    where: {
      userId_notificationType_channel: {
        userId: session.user.id,
        notificationType,
        channel,
      },
    },
    update: { enabled },
    create: {
      userId: session.user.id,
      notificationType,
      channel,
      enabled,
    },
  });

  return NextResponse.json(preference);
}
