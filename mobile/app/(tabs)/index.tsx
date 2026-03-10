import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { Text, Card, useTheme } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState, useCallback } from "react";

interface DashboardData {
  totalProducts: number;
  totalStores: number;
  recentPrices: {
    id: string;
    productName: string;
    storeName: string;
    price: number;
    recordedAt: string;
  }[];
  bottomPriceUpdates: number;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/dashboard/summary"),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text variant="headlineSmall" style={styles.greeting}>
        {user?.name ? `${user.name}さん` : "こんにちは"}
      </Text>

      <View style={styles.statsRow}>
        <Card style={[styles.statCard, { backgroundColor: theme.colors.primaryContainer }]}>
          <Card.Content>
            <Text variant="displaySmall" style={styles.statNumber}>
              {data?.totalProducts ?? "-"}
            </Text>
            <Text variant="bodySmall">登録商品</Text>
          </Card.Content>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Card.Content>
            <Text variant="displaySmall" style={styles.statNumber}>
              {data?.totalStores ?? "-"}
            </Text>
            <Text variant="bodySmall">登録店舗</Text>
          </Card.Content>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: "#fef3c7" }]}>
          <Card.Content>
            <Text variant="displaySmall" style={styles.statNumber}>
              {data?.bottomPriceUpdates ?? "-"}
            </Text>
            <Text variant="bodySmall">底値更新</Text>
          </Card.Content>
        </Card>
      </View>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        最近の価格登録
      </Text>

      {isLoading && (
        <Text style={styles.emptyText}>読み込み中...</Text>
      )}

      {data?.recentPrices?.length === 0 && !isLoading && (
        <Text style={styles.emptyText}>
          まだ価格が登録されていません。{"\n"}
          カメラで撮影して価格を登録しましょう！
        </Text>
      )}

      {data?.recentPrices?.map((price) => (
        <Card key={price.id} style={styles.priceCard}>
          <Card.Content>
            <View style={styles.priceRow}>
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall">{price.productName}</Text>
                <Text variant="bodySmall" style={{ color: "#64748b" }}>
                  {price.storeName}
                </Text>
              </View>
              <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: "bold" }}>
                ¥{price.price.toLocaleString()}
              </Text>
            </View>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
  },
  greeting: {
    marginBottom: 16,
    fontWeight: "bold",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
  },
  statNumber: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: "bold",
  },
  priceCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 32,
    lineHeight: 24,
  },
});
