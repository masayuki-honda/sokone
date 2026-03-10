import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { Text, Card, useTheme, Button } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";

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

interface BottomPriceProduct {
  productId: string;
  productName: string;
  categoryName: string | null;
  bottomPrice: number;
  storeName: string;
  recordedAt: string;
}

interface BottomPriceResult {
  items: BottomPriceProduct[];
  total: number;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/dashboard"),
  });

  const { data: bottomPrices, refetch: refetchBottom } = useQuery({
    queryKey: ["dashboard-products"],
    queryFn: () => api.get<BottomPriceResult>("/api/dashboard/products?limit=10"),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchBottom()]);
    setRefreshing(false);
  }, [refetch, refetchBottom]);

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

      {data?.recentPrices?.map((price: DashboardData["recentPrices"][0]) => (
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

      {/* Bottom price products */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        底値一覧
      </Text>

      {bottomPrices?.items?.map((item: BottomPriceProduct) => (
        <Card
          key={item.productId}
          style={styles.priceCard}
          onPress={() => router.push(`/product/${item.productId}`)}
        >
          <Card.Content>
            <View style={styles.priceRow}>
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall">{item.productName}</Text>
                <Text variant="bodySmall" style={{ color: "#64748b" }}>
                  {item.storeName}
                  {item.categoryName ? ` · ${item.categoryName}` : ""}
                </Text>
              </View>
              <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: "bold" }}>
                ¥{item.bottomPrice.toLocaleString()}
              </Text>
            </View>
          </Card.Content>
        </Card>
      ))}

      {bottomPrices && bottomPrices.total > 10 && (
        <Button
          mode="text"
          onPress={() => router.push("/search")}
          style={{ marginTop: 8 }}
        >
          すべての商品を見る →
        </Button>
      )}
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
