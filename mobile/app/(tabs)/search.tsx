import { useState, useCallback, useRef, useEffect } from "react";
import { View, FlatList, StyleSheet, ScrollView } from "react-native";
import {
  Searchbar,
  Text,
  Card,
  Chip,
  useTheme,
  IconButton,
  Modal,
  Portal,
  RadioButton,
  Button,
  Divider,
} from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "expo-router";

interface Category {
  id: string;
  name: string;
  productCount: number;
}

interface Store {
  id: string;
  name: string;
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

type SortBy = "name" | "price" | "recordCount";
type SortOrder = "asc" | "desc";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filterVisible, setFilterVisible] = useState(false);
  // Temp state for filter modal (applied on confirm)
  const [tempStore, setTempStore] = useState<string | null>(null);
  const [tempSortBy, setTempSortBy] = useState<SortBy>("name");
  const [tempSortOrder, setTempSortOrder] = useState<SortOrder>("asc");

  const theme = useTheme();
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/api/categories"),
  });

  // Fetch stores for filter
  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: () => api.get<Store[]>("/api/stores"),
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

  const openFilter = useCallback(() => {
    setTempStore(selectedStore);
    setTempSortBy(sortBy);
    setTempSortOrder(sortOrder);
    setFilterVisible(true);
  }, [selectedStore, sortBy, sortOrder]);

  const applyFilter = useCallback(() => {
    setSelectedStore(tempStore);
    setSortBy(tempSortBy);
    setSortOrder(tempSortOrder);
    setFilterVisible(false);
  }, [tempStore, tempSortBy, tempSortOrder]);

  const resetFilter = useCallback(() => {
    setTempStore(null);
    setTempSortBy("name");
    setTempSortOrder("asc");
  }, []);

  const hasActiveFilter = selectedStore !== null || sortBy !== "name" || sortOrder !== "asc";

  // Build query params
  const queryParams = new URLSearchParams();
  if (debouncedQuery) queryParams.set("q", debouncedQuery);
  if (selectedCategory) queryParams.set("categoryId", selectedCategory);
  if (selectedStore) queryParams.set("storeId", selectedStore);
  queryParams.set("sortBy", sortBy);
  queryParams.set("sortOrder", sortOrder);
  queryParams.set("limit", "30");

  const { data, isLoading } = useQuery({
    queryKey: ["products", debouncedQuery, selectedCategory, selectedStore, sortBy, sortOrder],
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

  const selectedStoreName = stores?.find((s: Store) => s.id === selectedStore)?.name;

  return (
    <View style={styles.container}>
      {/* Search bar + filter button */}
      <View style={styles.searchRow}>
        <Searchbar
          placeholder="商品名で検索..."
          onChangeText={handleSearch}
          value={query}
          style={styles.searchbar}
        />
        <IconButton
          icon={hasActiveFilter ? "filter" : "filter-outline"}
          mode={hasActiveFilter ? "contained" : "outlined"}
          size={24}
          onPress={openFilter}
          style={styles.filterButton}
        />
      </View>

      {/* Active filter chips */}
      {hasActiveFilter && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterChipRow}
          contentContainerStyle={styles.filterChipRowContent}
        >
          {selectedStore && selectedStoreName && (
            <Chip
              compact
              onClose={() => setSelectedStore(null)}
              style={styles.filterChip}
              icon="store"
            >
              {selectedStoreName}
            </Chip>
          )}
          {sortBy !== "name" && (
            <Chip compact style={styles.filterChip} icon="sort">
              {sortBy === "price" ? "価格順" : "記録数順"}
            </Chip>
          )}
          {sortOrder !== "asc" && (
            <Chip compact style={styles.filterChip} icon="sort-descending">
              降順
            </Chip>
          )}
        </ScrollView>
      )}

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

      {/* Filter bottom sheet modal */}
      <Portal>
        <Modal
          visible={filterVisible}
          onDismiss={() => setFilterVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            フィルタ・並び替え
          </Text>

          {/* Store filter */}
          <Text variant="labelLarge" style={styles.sectionLabel}>
            店舗
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.storeChipRow}
          >
            <Chip
              selected={tempStore === null}
              onPress={() => setTempStore(null)}
              compact
              style={styles.storeChip}
            >
              すべて
            </Chip>
            {stores?.map((store: Store) => (
              <Chip
                key={store.id}
                selected={tempStore === store.id}
                onPress={() =>
                  setTempStore(tempStore === store.id ? null : store.id)
                }
                compact
                style={styles.storeChip}
              >
                {store.name}
              </Chip>
            ))}
          </ScrollView>

          <Divider style={styles.divider} />

          {/* Sort by */}
          <Text variant="labelLarge" style={styles.sectionLabel}>
            並び替え
          </Text>
          <RadioButton.Group
            onValueChange={(value) => setTempSortBy(value as SortBy)}
            value={tempSortBy}
          >
            <RadioButton.Item label="商品名" value="name" />
            <RadioButton.Item label="底値" value="price" />
            <RadioButton.Item label="記録数" value="recordCount" />
          </RadioButton.Group>

          <Divider style={styles.divider} />

          {/* Sort order */}
          <Text variant="labelLarge" style={styles.sectionLabel}>
            順序
          </Text>
          <RadioButton.Group
            onValueChange={(value) => setTempSortOrder(value as SortOrder)}
            value={tempSortOrder}
          >
            <RadioButton.Item label="昇順（安い順・あいうえお順）" value="asc" />
            <RadioButton.Item label="降順（高い順）" value="desc" />
          </RadioButton.Group>

          {/* Action buttons */}
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={resetFilter} style={styles.modalButton}>
              リセット
            </Button>
            <Button mode="contained" onPress={applyFilter} style={styles.modalButton}>
              適用
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  searchbar: {
    flex: 1,
    margin: 16,
    marginBottom: 8,
    marginRight: 0,
    borderRadius: 12,
  },
  filterButton: {
    marginTop: 8,
  },
  filterChipRow: {
    maxHeight: 36,
    marginBottom: 4,
  },
  filterChipRowContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    borderRadius: 16,
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
  // Filter modal styles
  modalContent: {
    backgroundColor: "white",
    margin: 16,
    marginTop: "auto",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "bold",
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 8,
  },
  storeChipRow: {
    maxHeight: 40,
    marginBottom: 4,
  },
  storeChip: {
    marginRight: 8,
    borderRadius: 16,
  },
  divider: {
    marginVertical: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});
