import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

interface PushTicket {
  id?: string;
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Send push notifications to all registered devices for a user.
 * Uses the Expo Push API (no FCM key required for Expo-managed apps).
 */
export async function sendPushNotification(params: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<PushTicket[]> {
  const { userId, title, body, data } = params;

  const deviceTokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true },
  });

  if (deviceTokens.length === 0) {
    return [];
  }

  const messages: PushMessage[] = deviceTokens.map((dt) => ({
    to: dt.token,
    title,
    body,
    data,
    sound: "default" as const,
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error("Expo Push API error:", response.status, await response.text());
      return [];
    }

    const result = await response.json();
    const tickets: PushTicket[] = result.data ?? [];

    // Log errors for failed tickets
    tickets.forEach((ticket, i) => {
      if (ticket.status === "error") {
        console.error(
          `Push notification failed for token ${deviceTokens[i].token}:`,
          ticket.message,
          ticket.details
        );
      }
    });

    return tickets;
  } catch (err) {
    console.error("Failed to send push notifications:", err);
    return [];
  }
}
