import { useState, useMemo } from "react";
import { View, ScrollView, StyleSheet, Dimensions } from "react-native";
import { Text, Card, IconButton, Chip, useTheme, SegmentedButtons } from "react-native-paper";
import { useLocalSearchParams, Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Svg, { Line, Polyline, Text as SvgText, Circle } from "react-native-svg";

const CHART_COLORS = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

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

interface PriceHistorySeries {
  storeId: string;
  storeName: string;
  records: Array<{
    id: string;
    price: number;
    recordedAt: string;
    store: StoreRef;
  }>;
}

interface PriceHistoryResponse {
  product: { id: string; name: string; unit: string | null };
  stats: {
    bottomPrice: number;
    averagePrice: number;
    latestPrice: number;
    highestPrice: number;
    recordCount: number;
  } | null;
  series: PriceHistorySeries[];
  records: Array<{
    id: string;
    price: number;
    recordedAt: string;
    store: StoreRef;
  }>;
}

type Period = "1m" | "3m" | "6m" | "1y" | "all";

const PERIOD_BUTTONS = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "全期間" },
];

const CHART_WIDTH = Dimensions.get("window").width - 64;
const CHART_HEIGHT = 200;
const CHART_PADDING = { top: 16, right: 16, bottom: 32, left: 50 };

function PriceChart({ series }: { series: PriceHistorySeries[] }) {
  const chartData = useMemo(() => {
    // Collect all records with timestamps
    const allRecords = series.flatMap((s) =>
      s.records.map((r) => ({
        price: r.price,
        time: new Date(r.recordedAt).getTime(),
        storeId: s.storeId,
      }))
    );

    if (allRecords.length === 0) return null;

    const prices = allRecords.map((r) => r.price);
    const times = allRecords.map((r) => r.time);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    // Add padding to price range
    const priceRange = maxPrice - minPrice || 1;
    const paddedMin = Math.max(0, minPrice - priceRange * 0.1);
    const paddedMax = maxPrice + priceRange * 0.1;
    const timeRange = maxTime - minTime || 1;

    const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
    const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

    const toX = (t: number) =>
      CHART_PADDING.left + ((t - minTime) / timeRange) * plotWidth;
    const toY = (p: number) =>
      CHART_PADDING.top + (1 - (p - paddedMin) / (paddedMax - paddedMin)) * plotHeight;

    // Generate Y-axis labels (3-5 ticks)
    const yTicks: number[] = [];
    const step = Math.ceil(priceRange / 4 / 10) * 10 || 10;
    const yStart = Math.floor(paddedMin / step) * step;
    for (let v = yStart; v <= paddedMax; v += step) {
      yTicks.push(v);
    }

    // Generate X-axis labels (date ticks)
    const xTicks: { time: number; label: string }[] = [];
    const dateRange = maxTime - minTime;
    const tickCount = Math.min(4, Math.max(2, allRecords.length));
    for (let i = 0; i < tickCount; i++) {
      const t = minTime + (dateRange * i) / (tickCount - 1 || 1);
      const d = new Date(t);
      xTicks.push({
        time: t,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
      });
    }

    // Build polyline points per store
    const lines = series.map((s, idx) => {
      const sorted = [...s.records].sort(
        (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
      );
      const points = sorted
        .map((r) => `${toX(new Date(r.recordedAt).getTime())},${toY(r.price)}`)
        .join(" ");
      return {
        storeId: s.storeId,
        storeName: s.storeName,
        color: CHART_COLORS[idx % CHART_COLORS.length],
        points,
        dots: sorted.map((r) => ({
          x: toX(new Date(r.recordedAt).getTime()),
          y: toY(r.price),
        })),
      };
    });

    return { yTicks, xTicks, lines, toX, toY };
  }, [series]);

  if (!chartData) return null;

  return (
    <Card style={styles.chartCard}>
      <Card.Content>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Y-axis grid lines and labels */}
          {chartData.yTicks.map((tick) => {
            const y = chartData.toY(tick);
            if (y < CHART_PADDING.top || y > CHART_HEIGHT - CHART_PADDING.bottom) return null;
            return (
              <>
                <Line
                  key={`yline-${tick}`}
                  x1={CHART_PADDING.left}
                  y1={y}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <SvgText
                  key={`ylabel-${tick}`}
                  x={CHART_PADDING.left - 6}
                  y={y + 4}
                  fontSize={10}
                  fill="#94a3b8"
                  textAnchor="end"
                >
                  ¥{tick.toLocaleString()}
                </SvgText>
              </>
            );
          })}

          {/* X-axis labels */}
          {chartData.xTicks.map((tick, i) => (
            <SvgText
              key={`x-${i}`}
              x={chartData.toX(tick.time)}
              y={CHART_HEIGHT - 8}
              fontSize={10}
              fill="#94a3b8"
              textAnchor="middle"
            >
              {tick.label}
            </SvgText>
          ))}

          {/* Data lines */}
          {chartData.lines.map((line) => (
            <>
              <Polyline
                key={`line-${line.storeId}`}
                points={line.points}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
              />
              {line.dots.map((dot, i) => (
                <Circle
                  key={`dot-${line.storeId}-${i}`}
                  cx={dot.x}
                  cy={dot.y}
                  r={3}
                  fill={line.color}
                />
              ))}
            </>
          ))}
        </Svg>

        {/* Legend */}
        {chartData.lines.length > 1 && (
          <View style={styles.legendRow}>
            {chartData.lines.map((line) => (
              <View key={line.storeId} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: line.color }]}
                />
                <Text variant="bodySmall" numberOfLines={1}>
                  {line.storeName}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("all");

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

  const { data: priceHistory } = useQuery({
    queryKey: ["price-history", id, period],
    queryFn: () =>
      api.get<PriceHistoryResponse>(
        `/api/products/${id}/price-history?period=${period}`
      ),
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

        {/* Price history chart */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          価格推移
        </Text>
        <SegmentedButtons
          value={period}
          onValueChange={(value) => setPeriod(value as Period)}
          buttons={PERIOD_BUTTONS}
          style={styles.periodSelector}
        />

        {priceHistory?.series && priceHistory.series.length > 0 ? (
          <PriceChart series={priceHistory.series} />
        ) : (
          <Card style={styles.chartPlaceholder}>
            <Card.Content>
              <Text style={styles.emptyText}>
                {priceHistory ? "この期間のデータがありません" : "読み込み中..."}
              </Text>
            </Card.Content>
          </Card>
        )}

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
  periodSelector: {
    marginBottom: 12,
  },
  chartCard: {
    borderRadius: 12,
    marginBottom: 8,
  },
  chartPlaceholder: {
    borderRadius: 12,
    marginBottom: 8,
    height: 120,
    justifyContent: "center",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
