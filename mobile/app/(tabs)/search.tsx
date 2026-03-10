import { useState, useCallback } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { Searchbar, Text, Card, Chip, useTheme } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "expo-router";

interface Product {
  id: string;
  name: string;
  categoryName: string | null;
  bottomPrice: number | null;
  bottomStore: string | null;
  unit: string | null;
}

interface ProductSearchResult {
  products: Product[];
  total: number;
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const theme = useTheme();
  const router = useRouter();

  // Debounce search input
  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    // Simple debounce using setTimeout
    const timer = setTimeout(() => setDebouncedQuery(text), 300);
    return () => clearTimeout(timer);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["products", debouncedQuery],
    queryFn: () =>
      api.get<ProductSearchResult>(
        `/api/products?search=${encodeURIComponent(debouncedQuery)}&limit=30`,
      ),
    enabled: debouncedQuery.length > 0,
  });

  const renderProduct = ({ item }: { item: Product }) => (
    <Card
      style={styles.productCard}
      onPress={() => router.push(`/product/${item.id}`)}
    >
      <Card.Content>
        <View style={styles.productRow}>
          <View style={{ flex: 1 }}>
            <Text variant="titleSmall">{item.name}</Text>
            {item.categoryName && (
              <Chip
                compact
                style={styles.categoryChip}
                textStyle={{ fontSize: 11 }}
              >
                {item.categoryName}
              </Chip>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {item.bottomPrice ? (
              <>
                <Text
                  variant="titleMedium"
                  style={{ color: theme.colors.primary, fontWeight: "bold" }}
                >
                  ¥{item.bottomPrice.toLocaleString()}
                </Text>
                {item.bottomStore && (
                  <Text variant="bodySmall" style={{ color: "#64748b" }}>
                    {item.bottomStore}
                  </Text>
                )}
              </>
            ) : (
              <Text variant="bodySmall" style={{ color: "#94a3b8" }}>
                価格未登録
              </Text>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="商品名で検索..."
        onChangeText={handleSearch}
        value={query}
        style={styles.searchbar}
      />

      {isLoading && debouncedQuery.length > 0 && (
        <Text style={styles.emptyText}>検索中...</Text>
      )}

      {debouncedQuery.length === 0 && (
        <Text style={styles.emptyText}>
          商品名を入力して検索してください
        </Text>
      )}

      {data?.products && (
        <FlatList
          data={data.products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !isLoading ? (
              <Text style={styles.emptyText}>
                「{debouncedQuery}」に一致する商品が見つかりません
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  searchbar: {
    margin: 16,
    borderRadius: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  productCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryChip: {
    alignSelf: "flex-start",
    marginTop: 4,
    height: 24,
  },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 32,
  },
});
