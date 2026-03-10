import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, List, Switch, Divider, Avatar, Button } from "react-native-paper";
import { useAuth } from "@/lib/auth";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

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
          title="底値更新通知"
          description="ウォッチ中の商品が底値を更新した時"
          left={(props) => <List.Icon {...props} icon="bell-ring" />}
          right={() => <Switch value={true} />}
        />
        <List.Item
          title="特売アラート"
          description="お買い得価格を検出した時"
          left={(props) => <List.Icon {...props} icon="tag" />}
          right={() => <Switch value={true} />}
        />
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
