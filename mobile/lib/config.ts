/**
 * App configuration — environment variables and constants.
 *
 * In Expo, environment variables are loaded from .env via
 * process.env at build-time with the EXPO_PUBLIC_ prefix.
 */

export const config = {
  /** Base URL for the Next.js backend API */
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000",

  /** Google OAuth Client ID for Expo AuthSession */
  googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "",

  /** Google OAuth Client ID for Android standalone builds */
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",

  /** Google OAuth Client ID for iOS standalone builds */
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
} as const;
