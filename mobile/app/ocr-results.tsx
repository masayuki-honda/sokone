import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  TextInput as RNTextInput,
} from "react-native";
import {
  Text,
  Button,
  Card,
  IconButton,
  Switch,
  useTheme,
  Divider,
  ActivityIndicator,
} from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../lib/api";

interface OcrItem {
  name: string;
  price: number;
  unit?: string;
  volume?: string;
  category_hint?: string;
  confidence?: number;
  is_tax_included?: boolean;
}

interface OcrResultData {
  imageId: string;
  items: OcrItem[];
}

interface RouteData {
  storeId: string;
  sourceType: string;
  imageIds: string[];
  ocrResults: OcrResultData[];
}

interface EditableItem extends OcrItem {
  id: string;
  enabled: boolean;
}

interface BulkPriceResponse {
  created: { id: string; productId: string; price: number }[];
  errors: { name: string; error: string }[];
  bottomPriceUpdates: number;
}

export default function OcrResultsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ data: string }>();
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [saving, setSaving] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!params.data) return;
    try {
      const parsed: RouteData = JSON.parse(decodeURIComponent(params.data));
      setRouteData(parsed);

      const allItems: EditableItem[] = [];
      for (const result of parsed.ocrResults) {
        for (let i = 0; i < result.items.length; i++) {
          const item = result.items[i];
          allItems.push({
            ...item,
            id: `${result.imageId}-${i}`,
            enabled: true,
          });
        }
      }
      setItems(allItems);
    } catch {
      Alert.alert("エラー", "OCR結果の読み込みに失敗しました");
    }
  }, [params.data]);

  const updateItem = useCallback(
    (id: string, updates: Partial<EditableItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  const toggleItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleSave = useCallback(async () => {
    if (!routeData) return;

    const enabledItems = items.filter((item) => item.enabled);
    if (enabledItems.length === 0) {
      Alert.alert("エラー", "登録する商品がありません");
      return;
    }

    setSaving(true);
    try {
      const body = {
        items: enabledItems.map((item) => ({
          name: item.name,
          price: item.price,
          unit: item.unit || null,
          volume: item.volume || null,
          category_hint: item.category_hint || null,
          is_tax_included: item.is_tax_included ?? true,
        })),
        storeId: routeData.storeId,
        sourceType: routeData.sourceType,
        sourceImageId: routeData.imageIds[0] || undefined,
      };

      const result = await api.post<BulkPriceResponse>("/api/prices", body);

      const msg =
        result.bottomPriceUpdates > 0
          ? `${result.created.length}件の価格を登録しました！\n底値更新: ${result.bottomPriceUpdates}件`
          : `${result.created.length}件の価格を登録しました`;

      Alert.alert("完了", msg, [
        { text: "OK", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (err) {
      console.error("Save error:", err);
      Alert.alert("エラー", "価格の登録に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [items, routeData, router]);

  if (!routeData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const enabledCount = items.filter((i) => i.enabled).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.headerTitle}>
          {items.length}件の商品を検出
        </Text>
        <Text variant="bodySmall" style={styles.headerSubtitle}>
          内容を確認・修正してから登録してください
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card
            style={[
              styles.card,
              !item.enabled && styles.cardDisabled,
            ]}
          >
            <Card.Content>
              <View style={styles.cardHeader}>
                <Switch
                  value={item.enabled}
                  onValueChange={() => toggleItem(item.id)}
                />
                <View style={styles.cardTitleArea}>
                  {item.confidence != null && (
                    <Text
                      variant="labelSmall"
                      style={[
                        styles.confidence,
                        item.confidence < 0.7 && styles.confidenceLow,
                      ]}
                    >
                      信頼度 {Math.round(item.confidence * 100)}%
                    </Text>
                  )}
                </View>
                <IconButton
                  icon="delete"
                  size={20}
                  iconColor="#ef4444"
                  onPress={() => removeItem(item.id)}
                />
              </View>

              <Divider style={styles.divider} />

              <View style={styles.field}>
                <Text variant="labelSmall" style={styles.fieldLabel}>
                  商品名
                </Text>
                <RNTextInput
                  style={[styles.input, !item.enabled && styles.inputDisabled]}
                  value={item.name}
                  onChangeText={(text) => updateItem(item.id, { name: text })}
                  editable={item.enabled}
                  placeholder="商品名"
                />
              </View>

              <View style={styles.priceRow}>
                <View style={styles.field}>
                  <Text variant="labelSmall" style={styles.fieldLabel}>
                    価格（円）
                  </Text>
                  <RNTextInput
                    style={[
                      styles.input,
                      styles.priceInput,
                      !item.enabled && styles.inputDisabled,
                    ]}
                    value={String(item.price)}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      if (!isNaN(num) && num >= 0) {
                        updateItem(item.id, { price: num });
                      } else if (text === "") {
                        updateItem(item.id, { price: 0 });
                      }
                    }}
                    keyboardType="numeric"
                    editable={item.enabled}
                    placeholder="0"
                  />
                </View>

                {item.category_hint && (
                  <View style={styles.field}>
                    <Text variant="labelSmall" style={styles.fieldLabel}>
                      カテゴリ
                    </Text>
                    <Text variant="bodySmall" style={styles.categoryText}>
                      {item.category_hint}
                    </Text>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              商品が検出されませんでした
            </Text>
            <Button
              mode="outlined"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              戻って再撮影
            </Button>
          </View>
        }
      />

      {items.length > 0 && (
        <View style={styles.footer}>
          <Button
            mode="contained"
            icon="check"
            onPress={handleSave}
            disabled={saving || enabledCount === 0}
            loading={saving}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
          >
            {enabledCount}件を登録
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#64748b",
    marginTop: 4,
  },
  list: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 120,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitleArea: {
    flex: 1,
    marginLeft: 8,
  },
  confidence: {
    color: "#16a34a",
    fontWeight: "bold",
  },
  confidenceLow: {
    color: "#f59e0b",
  },
  divider: {
    marginVertical: 8,
  },
  field: {
    marginBottom: 8,
    flex: 1,
  },
  fieldLabel: {
    color: "#64748b",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputDisabled: {
    color: "#94a3b8",
    backgroundColor: "#e2e8f0",
  },
  priceInput: {
    maxWidth: 120,
  },
  priceRow: {
    flexDirection: "row",
    gap: 12,
  },
  categoryText: {
    color: "#6366f1",
    paddingVertical: 10,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    color: "#94a3b8",
    marginBottom: 16,
  },
  backButton: {
    borderRadius: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  saveButton: {
    borderRadius: 12,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
});
