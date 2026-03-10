import { useState, useCallback, useRef, useEffect } from "react";
import { View, FlatList, StyleSheet, ScrollView } from "react-native";
import { Searchbar, Text, Card, Chip, useTheme } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "expo-router";

interface Category {
  id: string;
  name: string;
  productCount: number;
}

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const theme = useTheme();
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/api/categories"),
  });

  // Debounce search input
  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(text), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Build query params
  const queryParams = new URLSearchParams();
  if (debouncedQuery) queryParams.set("q", debouncedQuery);
  if (selectedCategory) queryParams.set("categoryId", selectedCategory);
  queryParams.set("limit", "30");

  const { data, isLoading } = useQuery({
    queryKey: ["products", debouncedQuery, selectedCategory],
    queryFn: () =>
      api.get<ProductSearchResult>(`/api/products?${queryParams.toString()}`),
    enabled: debouncedQuery.length > 0 || selectedCategory !== null,
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

      {/* Category tabs */}
      {categories && categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
          contentContainerStyle={styles.categoryRowContent}
        >
          <Chip
            selected={selectedCategory === null}
            onPress={() => setSelectedCategory(null)}
            style={styles.categoryTab}
            compact
          >
            すべて
          </Chip>
          {categories.map((cat: Category) => (
            <Chip
              key={cat.id}
              selected={selectedCategory === cat.id}
              onPress={() =>
                setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
              }
              style={styles.categoryTab}
              compact
            >
              {cat.name} ({cat.productCount})
            </Chip>
          ))}
        </ScrollView>
      )}

      {isLoading && (debouncedQuery.length > 0 || selectedCategory) && (
        <Text style={styles.emptyText}>検索中...</Text>
      )}

      {debouncedQuery.length === 0 && !selectedCategory && (
        <Text style={styles.emptyText}>
          商品名を入力するかカテゴリを選択してください
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
                一致する商品が見つかりません
              </Text>
            ) : null
          }
          ListFooterComponent={
            data.total > 30 ? (
              <Text style={styles.countText}>
                {data.total}件中 30件表示
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
    marginBottom: 8,
    borderRadius: 12,
  },
  categoryRow: {
    maxHeight: 44,
    marginBottom: 8,
  },
  categoryRowContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    borderRadius: 16,
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
  countText: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 8,
    fontSize: 12,
  },
});
