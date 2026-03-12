/**
 * Push notification service for Sokone mobile app.
 *
 * Handles:
 * - Permission requests
 * - Expo push token registration with the backend
 * - Incoming notification handling
 * - Deep link navigation from notification taps
 */
import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { api } from "./api";

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldFlashScreen: false,
  }),
});

/**
 * Request push notification permissions and get the Expo push token.
 * Returns null if permissions are denied or device is a simulator.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Set up Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "デフォルト",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: "sokone-mobile",
  });

  return tokenData.data;
}

/**
 * Register the device's push token with the backend.
 */
export async function registerDeviceToken(token: string): Promise<void> {
  try {
    await api.post("/api/devices", {
      token,
      platform: Platform.OS,
    });
  } catch (err) {
    console.warn("Failed to register device token:", err);
  }
}

/**
 * Unregister the device's push token from the backend.
 */
export async function unregisterDeviceToken(token: string): Promise<void> {
  try {
    await api.delete(`/api/devices/${encodeURIComponent(token)}`);
  } catch (err) {
    console.warn("Failed to unregister device token:", err);
  }
}

/**
 * Hook to handle push notification setup and navigation on tap.
 *
 * Usage: Call this in the root layout component.
 */
export function usePushNotifications() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription>(undefined);
  const responseListener = useRef<Notifications.EventSubscription>(undefined);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as Record<
        string,
        string
      >;

      // Navigate based on notification type
      if (data?.productId) {
        router.push(`/product/${data.productId}`);
      } else if (data?.type === "deal_alert") {
        router.push("/(tabs)");
      }
    },
    [router],
  );

  useEffect(() => {
    // Listen for notifications received while app is open
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification.request.content.title);
      });

    // Listen for notification tap
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse,
      );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current,
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [handleNotificationResponse]);
}
