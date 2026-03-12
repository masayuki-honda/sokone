import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaperProvider, MD3LightTheme, Banner } from "react-native-paper";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/lib/auth";
import { useOfflineSync } from "@/lib/offline-sync";
import { usePushNotifications } from "@/lib/push-notifications";
import { useNetwork } from "@/hooks/use-network";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#2563eb",
    secondary: "#64748b",
    surface: "#ffffff",
    background: "#f8fafc",
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  usePushNotifications();
  const { isSyncing, pendingCount } = useOfflineSync();
  const { isConnected } = useNetwork();

  return (
    <View style={styles.root}>
      {!isConnected && (
        <Banner visible icon="wifi-off" style={styles.offlineBanner}>
          オフラインです{pendingCount > 0 ? `（${pendingCount}件の未送信あり）` : ""}
        </Banner>
      )}
      {isSyncing && (
        <Banner visible icon="cloud-sync" style={styles.syncBanner}>
          オフラインデータを送信中...
        </Banner>
      )}
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="upload" options={{ headerShown: true, title: "アップロード" }} />
        <Stack.Screen name="ocr-results" options={{ headerShown: true, title: "解析結果" }} />
      </Stack>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  offlineBanner: {
    backgroundColor: "#fef3c7",
  },
  syncBanner: {
    backgroundColor: "#dbeafe",
  },
});
