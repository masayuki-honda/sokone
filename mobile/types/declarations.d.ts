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
