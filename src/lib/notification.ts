import { prisma } from "@/lib/prisma";
import { NotificationType, Prisma } from "@prisma/client";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
}

/**
 * Create a notification if the user has not disabled it.
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, body, data } = params;

  // Check if the user has disabled this notification type (in_app channel)
  const pref = await prisma.notificationPreference.findUnique({
    where: {
      userId_notificationType_channel: {
        userId,
        notificationType: type,
        channel: "in_app",
      },
    },
  });

  // If preference exists and is disabled, skip
  if (pref && !pref.enabled) {
    return null;
  }

  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ?? undefined,
    },
  });
}
