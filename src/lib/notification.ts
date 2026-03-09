import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
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
 * Also sends an email if the user has email notifications enabled.
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, body, data } = params;

  // Fetch both in_app and email preferences in one query
  const prefs = await prisma.notificationPreference.findMany({
    where: {
      userId,
      notificationType: type,
      channel: { in: ["in_app", "email"] },
    },
  });

  const inAppPref = prefs.find((p) => p.channel === "in_app");
  const emailPref = prefs.find((p) => p.channel === "email");

  // Create in-app notification (enabled by default)
  let notification = null;
  if (!inAppPref || inAppPref.enabled) {
    notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: data ?? undefined,
      },
    });
  }

  // Send email notification if enabled (disabled by default — must opt in)
  if (emailPref?.enabled) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user?.email) {
      sendEmail({ to: user.email, subject: title, body }).catch((err) =>
        console.error("Email notification failed:", err)
      );
    }
  }

  return notification;
}
