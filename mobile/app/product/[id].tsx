import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Card, Button, Chip, useTheme } from "react-native-paper";
import { useLocalSearchParams, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ProductDetail {
  id: string;
  name: string;
  categoryName: string | null;
  unit: string | null;
  bottomPrice: number | null;
  bottomStore: string | null;
  priceHistory: {
    id: string;
    price: number;
    storeName: string;
    recordedAt: string;
  }[];
  storeComparison: {
    storeId: string;
    storeName: string;
    latestPrice: number;
    bottomPrice: number;
  }[];
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<ProductDetail>(`/api/products/${id}`),
    enabled: !!id,
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
              {product.categoryName && (
                <Chip compact style={styles.chip}>
                  {product.categoryName}
                </Chip>
              )}
              {product.unit && (
                <Chip compact style={styles.chip}>
                  {product.unit}
                </Chip>
              )}
            </View>

            {product.bottomPrice && (
              <View style={styles.bottomPriceSection}>
                <Text variant="bodySmall" style={{ color: "#64748b" }}>
                  底値
                </Text>
                <Text
                  variant="displaySmall"
                  style={{ color: theme.colors.primary, fontWeight: "bold" }}
                >
                  ¥{product.bottomPrice.toLocaleString()}
                </Text>
                {product.bottomStore && (
                  <Text variant="bodySmall" style={{ color: "#64748b" }}>
                    {product.bottomStore}
                  </Text>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Store comparison */}
        {product.storeComparison.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              店舗別価格
            </Text>
            {product.storeComparison.map((store) => (
              <Card key={store.storeId} style={styles.storeCard}>
                <Card.Content>
                  <View style={styles.storeRow}>
                    <Text variant="titleSmall" style={{ flex: 1 }}>
                      {store.storeName}
                    </Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        variant="titleMedium"
                        style={{ fontWeight: "bold" }}
                      >
                        ¥{store.latestPrice.toLocaleString()}
                      </Text>
                      <Text variant="bodySmall" style={{ color: "#64748b" }}>
                        底値: ¥{store.bottomPrice.toLocaleString()}
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
        {product.priceHistory.length === 0 ? (
          <Text style={styles.emptyText}>価格履歴がありません</Text>
        ) : (
          product.priceHistory.map((record) => (
            <Card key={record.id} style={styles.historyCard}>
              <Card.Content>
                <View style={styles.storeRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{record.storeName}</Text>
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
  bottomPriceSection: {
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    marginTop: 8,
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
