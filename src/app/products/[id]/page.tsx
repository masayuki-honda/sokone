"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  StarOff,
  Loader2,
  TrendingDown,
  Store,
  Calendar,
  BarChart3,
  Pencil,
  Check,
  X,
  Trash2,
  Save,
  Eye,
  EyeOff,
  GitMerge,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { PriceChart } from "@/components/price-chart";
import { MergeProductDialog } from "@/components/merge-product-dialog";
import { formatUnitPrice } from "@/lib/unit-price";

interface ProductDetail {
  id: string;
  name: string;
  normalizedName: string;
  unit: string | null;
  volume: string | null;
  category: { id: string; name: string } | null;
  aliases: Array<{ id: string; aliasName: string }>;
  priceRecords: Array<{
    id: string;
    price: number;
    taxIncluded: boolean;
    sourceType: string;
    sourceImageId: string | null;
    recordedAt: string;
    createdAt: string;
    store: { id: string; name: string };
  }>;
  stats: {
    bottomPrice: number;
    averagePrice: number;
    latestPrice: number;
    recordCount: number;
    bottomDate: string;
    bottomStore: { id: string; name: string } | null;
  } | null;
  isFavorite: boolean;
}

interface PriceHistoryData {
  product: { id: string; name: string; unit: string | null };
  stats: {
    bottomPrice: number;
    averagePrice: number;
    latestPrice: number;
    highestPrice: number;
    recordCount: number;
  } | null;
  series: Array<{
    storeId: string;
    storeName: string;
    records: Array<{
      id: string;
      price: number;
      recordedAt: string;
      store: { id: string; name: string };
    }>;
  }>;
  records: Array<{
    id: string;
    price: number;
    recordedAt: string;
    sourceType: string;
    store: { id: string; name: string };
  }>;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [history, setHistory] = useState<PriceHistoryData | null>(null);
  const [period, setPeriod] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [editingCategory, setEditingCategory] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string>("");
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStoreId, setEditStoreId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState<{ id: string; name: string; recordCount: number } | null>(null);
  const { addProduct } = useRecentlyViewed();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [prodRes, histRes] = await Promise.all([
          fetch(`/api/products/${id}`),
          fetch(`/api/products/${id}/price-history?period=${period}`),
        ]);

        if (prodRes.ok) {
          const data = await prodRes.json();
          setProduct(data);
          setIsFavorite(data.isFavorite);
          addProduct(data.id, data.name);
        }

        if (histRes.ok) {
          const data = await histRes.json();
          setHistory(data);
        }
      } catch (error) {
        console.error("Failed to load product:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, period]);

  // Fetch categories and stores for selectors
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => {});
    fetch("/api/stores")
      .then((r) => r.json())
      .then((data) => setStores(Array.isArray(data) ? data : (data.stores || [])))
      .catch(() => {});
    fetch(`/api/watches/check?productId=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setIsWatching(data.watching);
        setWatchId(data.watchId ?? null);
      })
      .catch(() => {});
  }, [id]);

  async function handleToggleFavorite() {
    try {
      if (isFavorite) {
        await fetch(`/api/favorites/${id}`, { method: "DELETE" });
        setIsFavorite(false);
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id }),
        });
        setIsFavorite(true);
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  }

  async function handleToggleWatch() {
    try {
      if (isWatching && watchId) {
        await fetch(`/api/watches/${watchId}`, { method: "DELETE" });
        setIsWatching(false);
        setWatchId(null);
      } else {
        const res = await fetch("/api/watches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id }),
        });
        if (res.ok) {
          const data = await res.json();
          setIsWatching(true);
          setWatchId(data.id);
        }
      }
    } catch (error) {
      console.error("Failed to toggle watch:", error);
    }
  }

  async function handleCategoryUpdate() {
    if (!product) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: pendingCategoryId || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProduct((prev) =>
          prev ? { ...prev, category: updated.category } : prev
        );
      }
    } catch (error) {
      console.error("Failed to update category:", error);
    } finally {
      setEditingCategory(false);
    }
  }

  function handleStartEditRecord(record: ProductDetail["priceRecords"][number]) {
    setEditingRecordId(record.id);
    setEditPrice(String(record.price));
    setEditStoreId(record.store.id);
    setEditDate(record.recordedAt.slice(0, 10));
  }

  function handleCancelEditRecord() {
    setEditingRecordId(null);
  }

  async function handleSaveRecord(recordId: string) {
    const price = parseInt(editPrice, 10);
    if (!price || price <= 0) return;
    setIsSavingRecord(true);
    try {
      const res = await fetch(`/api/prices/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price,
          storeId: editStoreId,
          recordedAt: new Date(editDate).toISOString(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProduct((prev) =>
          prev
            ? {
                ...prev,
                priceRecords: prev.priceRecords.map((r) =>
                  r.id === recordId
                    ? { ...r, price: updated.price, store: updated.store, recordedAt: updated.recordedAt }
                    : r,
                ),
              }
            : prev,
        );
        setEditingRecordId(null);
        // Refetch stats
        const [prodRes, histRes] = await Promise.all([
          fetch(`/api/products/${id}`),
          fetch(`/api/products/${id}/price-history?period=${period}`),
        ]);
        if (prodRes.ok) setProduct(await prodRes.json());
        if (histRes.ok) setHistory(await histRes.json());
      }
    } catch (error) {
      console.error("Failed to save record:", error);
    } finally {
      setIsSavingRecord(false);
    }
  }

  async function handleDeleteRecord(recordId: string) {
    setDeletingRecordId(recordId);
    try {
      const res = await fetch(`/api/prices/${recordId}`, { method: "DELETE" });
      if (res.ok) {
        setProduct((prev) =>
          prev
            ? { ...prev, priceRecords: prev.priceRecords.filter((r) => r.id !== recordId) }
            : prev,
        );
        // Refetch stats
        const [prodRes, histRes] = await Promise.all([
          fetch(`/api/products/${id}`),
          fetch(`/api/products/${id}/price-history?period=${period}`),
        ]);
        if (prodRes.ok) setProduct(await prodRes.json());
        if (histRes.ok) setHistory(await histRes.json());
      }
    } catch (error) {
      console.error("Failed to delete record:", error);
    } finally {
      setDeletingRecordId(null);
    }
  }

  function handleImageClick(imageId: string) {
    setLightboxLoading(true);
    fetch(`/api/images/${imageId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setLightboxUrl(data.signedUrl))
      .catch((error) => console.error("Failed to load image:", error))
      .finally(() => setLightboxLoading(false));
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-center text-muted-foreground py-20">
            商品が見つかりません
          </p>
        </main>
      </div>
    );
  }

  const sourceTypeLabels: Record<string, string> = {
    photo: "店頭写真",
    flyer: "チラシ",
    auto_flyer: "自動チラシ",
    instagram: "Instagram",
    receipt: "レシート",
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold break-words">{product.name}</h1>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {editingCategory ? (
                  <div className="flex items-center gap-1">
                    <select
                      autoFocus
                      className="text-sm border rounded px-2 py-0.5 bg-background"
                      value={pendingCategoryId}
                      onChange={(e) => setPendingCategoryId(e.target.value)}
                    >
                      <option value="">カテゴリなし</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCategoryUpdate}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setEditingCategory(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 group"
                    onClick={() => {
                      setPendingCategoryId(product.category?.id ?? "");
                      setEditingCategory(true);
                    }}
                    title="カテゴリを変更"
                  >
                    <Badge
                      variant="secondary"
                      className="group-hover:bg-secondary/70 cursor-pointer"
                    >
                      {product.category?.name ?? "カテゴリなし"}
                    </Badge>
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                {product.unit && (
                  <span className="text-sm text-muted-foreground">
                    {product.unit}
                  </span>
                )}
                {product.volume && (
                  <span className="text-sm text-muted-foreground">
                    {product.volume}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                product && setMergeSource({
                  id: product.id,
                  name: product.name,
                  recordCount: product.priceRecords.length,
                })
              }
              title="別の商品に統合"
            >
              <GitMerge className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleWatch}
              title={isWatching ? "ウォッチ解除" : "ウォッチに追加"}
            >
              {isWatching ? (
                <Eye className="h-5 w-5 text-blue-500" />
              ) : (
                <EyeOff className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleFavorite}
              title={isFavorite ? "お気に入り解除" : "お気に入り登録"}
            >
              {isFavorite ? (
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              ) : (
                <StarOff className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {product.stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">底値</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  ¥{product.stats.bottomPrice.toLocaleString()}
                </p>
                {formatUnitPrice(product.stats.bottomPrice, product.volume, product.unit) && (
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    {formatUnitPrice(product.stats.bottomPrice, product.volume, product.unit)}
                  </p>
                )}
                {product.stats.bottomStore && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {product.stats.bottomStore.name}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">
                    平均価格
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  ¥{product.stats.averagePrice.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">
                    最新価格
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  ¥{product.stats.latestPrice.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">
                    記録数
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {product.stats.recordCount}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Price History Chart */}
        {history && history.series.length > 0 && history.records.length >= 2 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-base">価格推移グラフ</CardTitle>
                <div className="flex gap-1 overflow-x-auto scrollbar-none">
                  {[
                    { value: "1m", label: "1ヶ月" },
                    { value: "3m", label: "3ヶ月" },
                    { value: "6m", label: "6ヶ月" },
                    { value: "1y", label: "1年" },
                    { value: "all", label: "全期間" },
                  ].map((p) => (
                    <Button
                      key={p.value}
                      variant={period === p.value ? "default" : "ghost"}
                      size="sm"
                      className="text-xs shrink-0"
                      onClick={() => setPeriod(p.value)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <PriceChart series={history.series} stats={history.stats} />
            </CardContent>
          </Card>
        )}

        {/* Store-based price comparison */}
        {history && history.series.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">店舗別価格比較</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history.series.map((s) => {
                  const prices = s.records.map((r) => r.price);
                  const min = Math.min(...prices);
                  const max = Math.max(...prices);
                  const avg = Math.round(
                    prices.reduce((a, b) => a + b, 0) / prices.length
                  );
                  const latest = s.records[s.records.length - 1]?.price;
                  const isBottom =
                    history.stats && min === history.stats.bottomPrice;

                  return (
                    <div
                      key={s.storeId}
                      className={`rounded-lg border p-4 ${isBottom ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{s.storeName}</h4>
                          <p className="text-xs text-muted-foreground">
                            {s.records.length}件の記録
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            最安値
                          </p>
                          <p
                            className={`text-lg font-bold ${isBottom ? "text-green-600" : ""}`}
                          >
                            ¥{min.toLocaleString()}
                          </p>
                          {formatUnitPrice(min, product.volume, product.unit) && (
                            <p className="text-xs text-muted-foreground">
                              {formatUnitPrice(min, product.volume, product.unit)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>最高: ¥{max.toLocaleString()}</span>
                        <span>平均: ¥{avg.toLocaleString()}</span>
                        {latest && (
                          <span>最新: ¥{latest.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Price History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">価格履歴</CardTitle>
          </CardHeader>
          <CardContent>
            {product.priceRecords.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                価格記録がありません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">日付</th>
                      <th className="pb-2 pr-4 font-medium">店舗</th>
                      <th className="pb-2 pr-4 font-medium text-right">価格</th>
                      <th className="pb-2 pr-4 font-medium text-right">単価</th>
                      <th className="pb-2 font-medium">ソース</th>
                      <th className="pb-2 font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.priceRecords.map((record) => {
                      const isBottomPrice =
                        product.stats &&
                        record.price === product.stats.bottomPrice;
                      const isEditing = editingRecordId === record.id;
                      const isDeleting = deletingRecordId === record.id;

                      if (isEditing) {
                        return (
                          <tr key={record.id} className="border-b last:border-0 bg-blue-50 dark:bg-blue-950/20">
                            <td className="py-2 pr-2">
                              <Input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="h-7 text-xs w-32"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <select
                                value={editStoreId}
                                onChange={(e) => setEditStoreId(e.target.value)}
                                className="h-7 text-xs border rounded px-1 bg-background w-full max-w-[140px]"
                              >
                                {stores.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 pr-2">
                              <Input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="h-7 text-xs text-right w-24"
                                min={1}
                              />
                            </td>
                            <td className="py-2 text-xs text-muted-foreground">
                              {sourceTypeLabels[record.sourceType] || record.sourceType}
                            </td>
                            <td className="py-2">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-blue-600 hover:text-blue-700"
                                  onClick={() => handleSaveRecord(record.id)}
                                  disabled={isSavingRecord}
                                  title="保存"
                                >
                                  {isSavingRecord ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={handleCancelEditRecord}
                                  title="キャンセル"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={record.id}
                          className={`border-b last:border-0 ${isBottomPrice ? "bg-green-50 dark:bg-green-950/20" : ""}`}
                        >
                          <td className="py-2 pr-4">
                            {new Date(record.recordedAt).toLocaleDateString("ja-JP")}
                          </td>
                          <td className="py-2 pr-4">{record.store.name}</td>
                          <td className={`py-2 pr-4 text-right font-medium ${isBottomPrice ? "text-green-600 font-bold" : ""}`}>
                            ¥{record.price.toLocaleString()}
                            {isBottomPrice && <span className="ml-1 text-xs">🏆</span>}
                          </td>
                          <td className="py-2 pr-4 text-right text-xs text-muted-foreground">
                            {formatUnitPrice(record.price, product.volume, product.unit) || "—"}
                          </td>
                          <td className="py-2">
                            {record.sourceImageId ? (
                              <button
                                onClick={() => handleImageClick(record.sourceImageId!)}
                                className="cursor-pointer"
                              >
                                <Badge variant="outline" className="text-xs underline decoration-dotted hover:bg-accent">
                                  {sourceTypeLabels[record.sourceType] || record.sourceType}
                                </Badge>
                              </button>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {sourceTypeLabels[record.sourceType] || record.sourceType}
                              </Badge>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleStartEditRecord(record)}
                                title="編集"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteRecord(record.id)}
                                disabled={isDeleting}
                                title="削除"
                              >
                                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aliases */}
        {product.aliases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">別名</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {product.aliases.map((alias) => (
                  <Badge key={alias.id} variant="outline">
                    {alias.aliasName}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Merge dialog */}
      <MergeProductDialog
        source={mergeSource}
        onClose={() => setMergeSource(null)}
        onMerged={(_sourceId) => {
          // Source product was merged and deleted, navigate away
          router.push("/products");
        }}
      />

      {/* Lightbox for source image */}
      {(lightboxUrl || lightboxLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => { setLightboxUrl(null); setLightboxLoading(false); }}
        >
          <div
            className="relative max-w-screen-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-8 right-0 text-white text-sm hover:text-gray-300"
              onClick={() => { setLightboxUrl(null); setLightboxLoading(false); }}
            >
              ✕ 閉じる
            </button>
            {lightboxLoading && !lightboxUrl ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={lightboxUrl!}
                alt="ソース画像"
                className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
