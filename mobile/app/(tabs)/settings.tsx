import { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, List, Switch, Divider, Avatar, Button } from "react-native-paper";
import { useAuth } from "@/lib/auth";
import { useRouter } from "expo-router";
import {
  registerForPushNotifications,
  registerDeviceToken,
  unregisterDeviceToken,
} from "@/lib/push-notifications";
import { getPendingCount } from "@/lib/offline-queue";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState(0);

  useEffect(() => {
    getPendingCount().then(setPendingUploads);
  }, []);

  const handlePushToggle = useCallback(async (value: boolean) => {
    if (value) {
      const token = await registerForPushNotifications();
      if (token) {
        await registerDeviceToken(token);
        setPushToken(token);
        setPushEnabled(true);
      } else {
        Alert.alert("通知許可", "通知の許可が得られませんでした。端末の設定を確認してください。");
      }
    } else {
      if (pushToken) {
        await unregisterDeviceToken(pushToken);
      }
      setPushToken(null);
      setPushEnabled(false);
    }
  }, [pushToken]);

  const handleSignOut = () => {
    Alert.alert(
      "ログアウト",
      "ログアウトしますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "ログアウト",
          style: "destructive",
          onPress: signOut,
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* User profile */}
      <View style={styles.profileSection}>
        <Avatar.Text
          size={56}
          label={user?.name?.charAt(0) ?? "?"}
          style={styles.avatar}
        />
        <View style={{ marginLeft: 16 }}>
          <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
            {user?.name ?? "ユーザー"}
          </Text>
          <Text variant="bodySmall" style={{ color: "#64748b" }}>
            {user?.email}
          </Text>
        </View>
      </View>

      <Divider />

      {/* Settings sections */}
      <List.Section>
        <List.Subheader>通知設定</List.Subheader>
        <List.Item
          title="プッシュ通知"
          description="底値更新・特売アラートを受け取る"
          left={(props) => <List.Icon {...props} icon="bell-ring" />}
          right={() => <Switch value={pushEnabled} onValueChange={handlePushToggle} />}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>データ管理</List.Subheader>
        <List.Item
          title="店舗管理"
          description="店舗の追加・編集・削除"
          left={(props) => <List.Icon {...props} icon="store" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push("/stores")}
        />
        {pendingUploads > 0 && (
          <List.Item
            title="未送信のアップロード"
            description={`${pendingUploads}件のアップロードが待機中`}
            left={(props) => <List.Icon {...props} icon="cloud-off-outline" />}
          />
        )}
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>アプリについて</List.Subheader>
        <List.Item
          title="バージョン"
          description="1.0.0"
          left={(props) => <List.Icon {...props} icon="information" />}
        />
      </List.Section>

      <Divider />

      <View style={styles.signOutSection}>
        <Button
          mode="outlined"
          textColor="#ef4444"
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          ログアウト
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#ffffff",
  },
  avatar: {
    backgroundColor: "#2563eb",
  },
  signOutSection: {
    padding: 20,
  },
  signOutButton: {
    borderColor: "#ef4444",
    borderRadius: 12,
  },
});
