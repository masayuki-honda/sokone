declare module "expo-router" {
  import { ComponentType, ReactNode } from "react";

  export interface LinkProps {
    href: string;
    asChild?: boolean;
    replace?: boolean;
    children?: ReactNode;
  }

  export const Link: ComponentType<LinkProps>;

  export interface RedirectProps {
    href: string;
  }

  export const Redirect: ComponentType<RedirectProps>;

  export interface StackProps {
    children?: ReactNode;
    screenOptions?: Record<string, unknown>;
  }

  export const Stack: ComponentType<StackProps> & {
    Screen: ComponentType<{
      name?: string;
      options?: Record<string, unknown>;
    }>;
  };

  export interface TabBarIconProps {
    color: string;
    size: number;
    focused: boolean;
  }

  export interface TabsScreenOptions {
    title?: string;
    tabBarIcon?: (props: TabBarIconProps) => ReactNode;
    tabBarLabel?: string;
    headerShown?: boolean;
    [key: string]: unknown;
  }

  export interface TabsProps {
    children?: ReactNode;
    screenOptions?: Record<string, unknown>;
  }

  export const Tabs: ComponentType<TabsProps> & {
    Screen: ComponentType<{
      name?: string;
      options?: TabsScreenOptions;
    }>;
  };

  export function useRouter(): {
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
    canGoBack: () => boolean;
    navigate: (href: string) => void;
  };

  export function useLocalSearchParams<
    T extends Record<string, string> = Record<string, string>,
  >(): T;

  export function useGlobalSearchParams<
    T extends Record<string, string> = Record<string, string>,
  >(): T;

  export function useSegments(): string[];

  export function usePathname(): string;
}

declare module "react-native-gesture-handler" {
  import { ComponentType, ReactNode } from "react";
  import { ViewProps } from "react-native";

  export interface GestureHandlerRootViewProps extends ViewProps {
    children?: ReactNode;
  }

  export const GestureHandlerRootView: ComponentType<GestureHandlerRootViewProps>;
}

declare module "@expo/vector-icons" {
  import { ComponentType } from "react";

  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: unknown;
  }

  export const MaterialCommunityIcons: ComponentType<IconProps>;
  export const MaterialIcons: ComponentType<IconProps>;
  export const Ionicons: ComponentType<IconProps>;
  export const FontAwesome: ComponentType<IconProps>;
  export const Feather: ComponentType<IconProps>;
}

declare module "expo-secure-store" {
  export function getItemAsync(key: string): Promise<string | null>;
  export function setItemAsync(key: string, value: string): Promise<void>;
  export function deleteItemAsync(key: string): Promise<void>;
}

declare module "expo-auth-session" {
  export interface AuthRequestConfig {
    clientId: string;
    scopes?: string[];
    redirectUri?: string;
    extraParams?: Record<string, string>;
  }

  export interface AuthSessionResult {
    type: "success" | "error" | "dismiss" | "cancel" | "locked";
    authentication?: {
      accessToken: string;
      idToken?: string;
      refreshToken?: string;
      tokenType?: string;
      expiresIn?: number;
    };
    error?: Error;
    params?: Record<string, string>;
  }

  export interface AuthRequest {
    promptAsync: (
      options?: Record<string, unknown>,
    ) => Promise<AuthSessionResult>;
  }

  export interface DiscoveryDocument {
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    revocationEndpoint?: string;
    userInfoEndpoint?: string;
  }

  export function useAuthRequest(
    config: AuthRequestConfig,
    discovery: DiscoveryDocument | null,
  ): [AuthRequest | null, AuthSessionResult | null, (options?: Record<string, unknown>) => Promise<AuthSessionResult>];

  export function makeRedirectUri(options?: {
    scheme?: string;
    path?: string;
    native?: string;
  }): string;

  export function useAutoDiscovery(issuer: string): DiscoveryDocument | null;
}

declare module "expo-auth-session/providers/google" {
  import { AuthRequest, AuthSessionResult } from "expo-auth-session";

  export interface GoogleAuthRequestConfig {
    clientId?: string;
    androidClientId?: string;
    iosClientId?: string;
    webClientId?: string;
    scopes?: string[];
    redirectUri?: string;
    extraParams?: Record<string, string>;
  }

  export function useAuthRequest(
    config: GoogleAuthRequestConfig,
  ): [AuthRequest | null, AuthSessionResult | null, (options?: Record<string, unknown>) => Promise<AuthSessionResult>];
}

declare module "expo-web-browser" {
  export function maybeCompleteAuthSession(): { type: string };
  export function openBrowserAsync(url: string): Promise<{ type: string }>;
  export function warmUpAsync(): Promise<void>;
  export function coolDownAsync(): Promise<void>;
}

declare module "expo-camera" {
  import { ComponentType, ReactNode, RefObject } from "react";
  import { ViewProps } from "react-native";

  export type CameraType = "front" | "back";
  export type FlashMode = "off" | "on" | "auto";

  export interface CameraCapturedPicture {
    uri: string;
    width: number;
    height: number;
    base64?: string;
  }

  export interface CameraViewProps extends ViewProps {
    facing?: CameraType;
    flash?: FlashMode;
    children?: ReactNode;
  }

  export interface CameraViewRef {
    takePictureAsync: (options?: {
      quality?: number;
      base64?: boolean;
      skipProcessing?: boolean;
    }) => Promise<CameraCapturedPicture>;
  }

  export const CameraView: ComponentType<CameraViewProps & { ref?: RefObject<CameraViewRef> }>;

  export function useCameraPermissions(): [
    { granted: boolean; canAskAgain: boolean } | null,
    () => Promise<{ granted: boolean; canAskAgain: boolean }>,
  ];
}

declare module "expo-image-picker" {
  export type MediaTypeOptions = "All" | "Images" | "Videos";

  export interface ImagePickerAsset {
    uri: string;
    width: number;
    height: number;
    type?: "image" | "video";
    fileName?: string;
    fileSize?: number;
    base64?: string;
    exif?: Record<string, unknown>;
  }

  export interface ImagePickerResult {
    canceled: boolean;
    assets: ImagePickerAsset[] | null;
  }

  export function launchImageLibraryAsync(options?: {
    mediaTypes?: MediaTypeOptions[];
    allowsMultipleSelection?: boolean;
    quality?: number;
    base64?: boolean;
    exif?: boolean;
  }): Promise<ImagePickerResult>;

  export function launchCameraAsync(options?: {
    mediaTypes?: MediaTypeOptions[];
    quality?: number;
    base64?: boolean;
    exif?: boolean;
  }): Promise<ImagePickerResult>;

  export function requestCameraPermissionsAsync(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
  }>;

  export function requestMediaLibraryPermissionsAsync(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
  }>;
}

declare module "expo-image-manipulator" {
  export interface ImageResult {
    uri: string;
    width: number;
    height: number;
    base64?: string;
  }

  export type FlipType = "vertical" | "horizontal";

  export interface Action {
    resize?: { width?: number; height?: number };
    rotate?: number;
    flip?: FlipType;
    crop?: { originX: number; originY: number; width: number; height: number };
  }

  export type SaveFormat = "jpeg" | "png" | "webp";

  export interface SaveOptions {
    compress?: number;
    format?: SaveFormat;
    base64?: boolean;
  }

  export function manipulateAsync(
    uri: string,
    actions: Action[],
    saveOptions?: SaveOptions,
  ): Promise<ImageResult>;
}

declare module "expo-file-system" {
  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;

  export interface FileInfo {
    exists: boolean;
    uri: string;
    size?: number;
    modificationTime?: number;
    isDirectory?: boolean;
    md5?: string;
  }

  export interface UploadResult {
    status: number;
    headers: Record<string, string>;
    body: string;
  }

  export function getInfoAsync(
    fileUri: string,
    options?: { md5?: boolean; size?: boolean },
  ): Promise<FileInfo>;

  export function readAsStringAsync(
    fileUri: string,
    options?: { encoding?: "utf8" | "base64" },
  ): Promise<string>;

  export function writeAsStringAsync(
    fileUri: string,
    contents: string,
    options?: { encoding?: "utf8" | "base64" },
  ): Promise<void>;

  export function deleteAsync(
    fileUri: string,
    options?: { idempotent?: boolean },
  ): Promise<void>;

  export function makeDirectoryAsync(
    fileUri: string,
    options?: { intermediates?: boolean },
  ): Promise<void>;

  export function copyAsync(options: {
    from: string;
    to: string;
  }): Promise<void>;

  export function moveAsync(options: {
    from: string;
    to: string;
  }): Promise<void>;

  export function uploadAsync(
    url: string,
    fileUri: string,
    options?: {
      fieldName?: string;
      httpMethod?: "POST" | "PUT" | "PATCH";
      headers?: Record<string, string>;
      parameters?: Record<string, string>;
      uploadType?: number;
    },
  ): Promise<UploadResult>;

  export const FileSystemUploadType: {
    BINARY_CONTENT: number;
    MULTIPART: number;
  };
}

declare module "react-native-svg" {
  import { ComponentType, ReactNode } from "react";

  interface SvgProps {
    width?: number | string;
    height?: number | string;
    viewBox?: string;
    children?: ReactNode;
  }

  interface LineProps {
    x1: number | string;
    y1: number | string;
    x2: number | string;
    y2: number | string;
    stroke?: string;
    strokeWidth?: number | string;
    strokeDasharray?: string;
  }

  interface PolylineProps {
    points: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number | string;
    strokeLinejoin?: string;
    strokeLinecap?: string;
  }

  interface CircleProps {
    cx: number | string;
    cy: number | string;
    r: number | string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number | string;
  }

  interface SvgTextProps {
    x?: number | string;
    y?: number | string;
    fontSize?: number | string;
    fill?: string;
    textAnchor?: "start" | "middle" | "end";
    dominantBaseline?: string;
    children?: ReactNode;
  }

  interface RectProps {
    x?: number | string;
    y?: number | string;
    width: number | string;
    height: number | string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number | string;
    rx?: number | string;
    ry?: number | string;
  }

  interface GProps {
    children?: ReactNode;
    transform?: string;
  }

  const Svg: ComponentType<SvgProps>;
  export default Svg;
  export const Line: ComponentType<LineProps>;
  export const Polyline: ComponentType<PolylineProps>;
  export const Circle: ComponentType<CircleProps>;
  export const Text: ComponentType<SvgTextProps>;
  export const Rect: ComponentType<RectProps>;
  export const G: ComponentType<GProps>;
}

declare module "expo-network" {
  export interface NetworkState {
    type?: string;
    isConnected?: boolean;
    isInternetReachable?: boolean;
  }

  export function getNetworkStateAsync(): Promise<NetworkState>;
}

declare module "expo-device" {
  export const isDevice: boolean;
  export const brand: string | null;
  export const modelName: string | null;
  export const osName: string | null;
  export const osVersion: string | null;
}

declare module "expo-notifications" {
  export interface NotificationContent {
    title: string | null;
    subtitle: string | null;
    body: string | null;
    data: Record<string, unknown>;
    sound: string | boolean | null;
    badge: number | null;
  }

  export interface NotificationRequest {
    identifier: string;
    content: NotificationContent;
    trigger: unknown;
  }

  export interface Notification {
    date: number;
    request: NotificationRequest;
  }

  export interface NotificationResponse {
    notification: Notification;
    actionIdentifier: string;
    userText?: string;
  }

  export interface EventSubscription {
    remove: () => void;
  }

  export interface NotificationPermissionsStatus {
    status: "granted" | "denied" | "undetermined";
    canAskAgain: boolean;
    granted: boolean;
  }

  export interface ExpoPushToken {
    type: "expo";
    data: string;
  }

  export const AndroidImportance: {
    MIN: number;
    LOW: number;
    DEFAULT: number;
    HIGH: number;
    MAX: number;
  };

  export function setNotificationHandler(handler: {
    handleNotification: (
      notification: Notification,
    ) => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
      shouldShowBanner?: boolean;
      shouldFlashScreen?: boolean;
    }>;
  }): void;

  export function getPermissionsAsync(): Promise<NotificationPermissionsStatus>;
  export function requestPermissionsAsync(): Promise<NotificationPermissionsStatus>;

  export function getExpoPushTokenAsync(options?: {
    projectId?: string;
  }): Promise<ExpoPushToken>;

  export function setNotificationChannelAsync(
    channelId: string,
    channel: {
      name: string;
      importance: number;
      vibrationPattern?: number[];
      lightColor?: string;
    },
  ): Promise<unknown>;

  export function addNotificationReceivedListener(
    listener: (notification: Notification) => void,
  ): EventSubscription;

  export function addNotificationResponseReceivedListener(
    listener: (response: NotificationResponse) => void,
  ): EventSubscription;

  export function removeNotificationSubscription(
    subscription: EventSubscription,
  ): void;
}
