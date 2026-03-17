import { View, StyleSheet } from "react-native";
import { Text, Button, useTheme } from "react-native-paper";
import { useAuth } from "@/lib/auth";
import { Redirect } from "expo-router";

export default function LoginScreen() {
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const theme = useTheme();

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="displaySmall" style={[styles.title, { color: theme.colors.primary }]}>
          底値
        </Text>
        <Text variant="headlineMedium" style={styles.appName}>
          Sokone
        </Text>
        <Text variant="bodyLarge" style={styles.description}>
          チラシ・店頭の価格をAIで読み取り{"\n"}
          底値を記録・比較するアプリ
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          icon="google"
          style={styles.googleButton}
          contentStyle={styles.googleButtonContent}
          labelStyle={styles.googleButtonLabel}
          onPress={signIn}
          loading={isLoading}
          disabled={isLoading}
        >
          Googleでログイン
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "space-between",
    padding: 32,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontWeight: "bold",
    fontSize: 48,
    marginBottom: 4,
  },
  appName: {
    fontWeight: "bold",
    marginBottom: 16,
    color: "#334155",
  },
  description: {
    textAlign: "center",
    color: "#64748b",
    lineHeight: 28,
  },
  buttonContainer: {
    paddingBottom: 32,
  },
  googleButton: {
    borderRadius: 12,
  },
  googleButtonContent: {
    paddingVertical: 8,
  },
  googleButtonLabel: {
    fontSize: 16,
  },
});
