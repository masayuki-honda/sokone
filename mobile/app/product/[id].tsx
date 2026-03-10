import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Card, IconButton, Chip, useTheme } from "react-native-paper";
import { useLocalSearchParams, Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface StoreRef {
  id: string;
  name: string;
}

interface PriceRecord {
  id: string;
  price: number;
  recordedAt: string;
  store: StoreRef;
}

interface ProductDetail {
  id: string;
  name: string;
  unit: string | null;
  category: { id: string; name: string } | null;
  priceRecords: PriceRecord[];
  stats: {
    bottomPrice: number;
    averagePrice: number;
    latestPrice: number;
    recordCount: number;
    bottomStore: StoreRef;
    bottomDate: string;
  } | null;
  isFavorite: boolean;
}

interface CompareStore {
  storeId: string;
  storeName: string;
  latestPrice: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  count: number;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<ProductDetail>(`/api/products/${id}`),
    enabled: !!id,
  });

  const { data: comparison } = useQuery({
    queryKey: ["product-compare", id],
    queryFn: () => api.get<{ stores: CompareStore[] }>(`/api/products/${id}/compare`),
    enabled: !!id,
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (product?.isFavorite) {
        await api.delete(`/api/favorites/${id}`);
      } else {
        await api.post("/api/favorites", { productId: id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
    },
  });

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "読み込み中..." }} />
        <View style={styles.loadingContainer}>
          <Text>読み込み中...</Text>
        </View>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Stack.Screen options={{ title: "商品詳細" }} />
        <View style={styles.loadingContainer}>
          <Text>商品が見つかりません</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: product.name,
          headerShown: true,
          headerRight: () => (
            <IconButton
              icon={product.isFavorite ? "heart" : "heart-outline"}
              iconColor={product.isFavorite ? "#ef4444" : "#94a3b8"}
              onPress={() => favoriteMutation.mutate()}
            />
          ),
        }}
      />
      <ScrollView style={styles.container}>
        {/* Product info header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.productName}>
              {product.name}
            </Text>
            <View style={styles.tagsRow}>
              {product.category && (
                <Chip compact style={styles.chip}>
                  {product.category.name}
                </Chip>
              )}
              {product.unit && (
                <Chip compact style={styles.chip}>
                  {product.unit}
                </Chip>
              )}
            </View>

            {product.stats && (
              <View style={styles.statsSection}>
                <View style={styles.statItem}>
                  <Text variant="bodySmall" style={styles.statLabel}>底値</Text>
                  <Text
                    variant="headlineMedium"
                    style={{ color: theme.colors.primary, fontWeight: "bold" }}
                  >
                    ¥{product.stats.bottomPrice.toLocaleString()}
                  </Text>
                  <Text variant="bodySmall" style={styles.statLabel}>
                    {product.stats.bottomStore.name}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text variant="bodySmall" style={styles.statLabel}>平均</Text>
                  <Text variant="titleLarge" style={{ fontWeight: "bold" }}>
                    ¥{product.stats.averagePrice.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text variant="bodySmall" style={styles.statLabel}>最新</Text>
                  <Text variant="titleLarge" style={{ fontWeight: "bold" }}>
                    ¥{product.stats.latestPrice.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Store comparison */}
        {comparison?.stores && comparison.stores.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              店舗別価格
            </Text>
            {comparison.stores.map((store: CompareStore) => (
              <Card key={store.storeId} style={styles.storeCard}>
                <Card.Content>
                  <View style={styles.storeRow}>
                    <Text variant="titleSmall" style={{ flex: 1 }}>
                      {store.storeName}
                    </Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
                        ¥{store.latestPrice.toLocaleString()}
                      </Text>
                      <Text variant="bodySmall" style={{ color: "#64748b" }}>
                        底値: ¥{store.minPrice.toLocaleString()} / 平均: ¥{store.avgPrice.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </>
        )}

        {/* Price history */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          価格履歴
        </Text>
        {product.priceRecords.length === 0 ? (
          <Text style={styles.emptyText}>価格履歴がありません</Text>
        ) : (
          product.priceRecords.slice(0, 20).map((record: PriceRecord) => (
            <Card key={record.id} style={styles.historyCard}>
              <Card.Content>
                <View style={styles.storeRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{record.store.name}</Text>
                    <Text variant="bodySmall" style={{ color: "#94a3b8" }}>
                      {new Date(record.recordedAt).toLocaleDateString("ja-JP")}
                    </Text>
                  </View>
                  <Text variant="titleSmall" style={{ fontWeight: "bold" }}>
                    ¥{record.price.toLocaleString()}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  productName: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    alignSelf: "flex-start",
  },
  statsSection: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    marginTop: 8,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    color: "#64748b",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e2e8f0",
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 8,
    marginTop: 16,
  },
  storeCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyCard: {
    marginBottom: 6,
    borderRadius: 10,
  },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 16,
  },
});
