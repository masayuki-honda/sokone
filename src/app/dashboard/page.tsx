"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  Store,
  TrendingDown,
  Calendar,
  Star,
  Search,
  Camera,
  ArrowRight,
  Loader2,
  StarOff,
  Database,
  ArrowUpDown,
  Trash2,
} from "lucide-react";
import { Header } from "@/components/header";
import { WatchKeywordsManager } from "@/components/watch-keywords-manager";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DashboardStats {
  productCount: number;
  storeCount: number;
  totalRecords: number;
  monthRecords: number;
  favoriteCount: number;
}

interface RecentPrice {
  id: string;
  price: number;
  recordedAt: string;
  createdAt: string;
  product: { id: string; name: string; unit: string | null };
  store: { id: string; name: string };
}

interface FavoriteItem {
  id: string;
  productId: string;
  productName: string;
  categoryName: string | null;
  unit: string | null;
  stats: {
    bottomPrice: number;
    bottomStore: { id: string; name: string } | null;
    bottomDate: string;
    latestPrice: number;
    latestStore: { id: string; name: string } | null;
    averagePrice: number;
    recordCount: number;
  } | null;
}

interface BottomPriceItem {
  productId: string;
  productName: string;
  categoryName: string | null;
  unit: string | null;
  bottomPrice: number;
  bottomDate: string;
  bottomStoreName: string;
  averagePrice: number;
  latestPrice: number;
  latestStoreName: string;
  recordCount: number;
}

interface Category {
  id: string;
  name: string;
  _count: { products: number };
}

interface DbStorage {
  usedMB: number;
  limitMB: number;
  usagePercent: number;
  status: "ok" | "warning" | "critical";
}

interface StoreItem {
  id: string;
  name: string;
}

interface DealItem {
  priceRecordId: string;
  product: {
    id: string;
    name: string;
    unit: string | null;
    category: { id: string; name: string } | null;
  };
  store: { id: string; name: string };
  price: number;
  bottomPrice: number;
  isBottomPrice: boolean;
  discount: number;
  recordedAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPrices, setRecentPrices] = useState<RecentPrice[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [bottomPrices, setBottomPrices] = useState<BottomPriceItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [dbStorage, setDbStorage] = useState<DbStorage | null>(null);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ productId: string; productName: string; recordCount: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch initial data
  useEffect(() => {
    async function fetchAll() {
      setIsLoading(true);
      try {
        const [dashRes, favsRes, catsRes, storageRes, storesRes, dealsRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/favorites"),
          fetch("/api/categories"),
          fetch("/api/admin/db-storage"),
          fetch("/api/stores"),
          fetch("/api/deals"),
        ]);

        if (dashRes.ok) {
          const data = await dashRes.json();
          setStats(data.stats);
          setRecentPrices(data.recentPrices);
        }

        if (favsRes.ok) {
          const data = await favsRes.json();
          setFavorites(data.favorites);
        }

        if (catsRes.ok) {
          const data = await catsRes.json();
          setCategories(data.categories);
        }

        if (storageRes.ok) {
          const data = await storageRes.json();
          setDbStorage(data);
        }

        if (storesRes.ok) {
          const data = await storesRes.json();
          setStores(Array.isArray(data) ? data : []);
        }

        if (dealsRes.ok) {
          const data = await dealsRes.json();
          setDeals(data.deals || []);
        }
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Fetch bottom prices (with search/filter/sort)
  const fetchBottomPrices = useCallback(async () => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("categoryId", selectedCategory);
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (selectedStore) params.set("storeId", selectedStore);
      if (sortBy !== "name") params.set("sortBy", sortBy);
      if (sortOrder !== "asc") params.set("sortOrder", sortOrder);
      params.set("limit", "20");

      const res = await fetch(`/api/dashboard/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBottomPrices(data.items);
      }
    } catch (error) {
      console.error("Failed to load bottom prices:", error);
    } finally {
      setIsSearching(false);
    }
  }, [selectedCategory, debouncedQuery, selectedStore, sortBy, sortOrder]);

  useEffect(() => {
    fetchBottomPrices();
  }, [fetchBottomPrices]);

  async function handleDeleteProduct() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/products/${deleteTarget.productId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "削除に失敗しました");
        return;
      }
      setBottomPrices((prev) => prev.filter((p) => p.productId !== deleteTarget.productId));
      setFavorites((prev) => prev.filter((f) => f.productId !== deleteTarget.productId));
      setDeleteTarget(null);
    } catch {
      setDeleteError("削除中にエラーが発生しました");
    } finally {
      setIsDeleting(false);
    }
  }

  // Toggle favorite
  async function handleToggleFavorite(productId: string, isFavorite: boolean) {
    try {
      if (isFavorite) {
        await fetch(`/api/favorites/${productId}`, { method: "DELETE" });
        setFavorites((prev) =>
          prev.filter((f) => f.productId !== productId),
        );
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        // Refresh favorites
        const res = await fetch("/api/favorites");
        if (res.ok) {
          const data = await res.json();
          setFavorites(data.favorites);
        }
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Title + Action */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-bold">ダッシュボード</h1>
          <Link href="/upload">
            <Button size="sm" className="sm:size-default">
              <Camera className="mr-1.5 h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">画像をアップロード</span>
              <span className="sm:hidden">アップロード</span>
            </Button>
          </Link>
        </div>

        {/* DB Storage Banner */}
        {dbStorage && dbStorage.status !== "ok" && (
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              dbStorage.status === "critical"
                ? "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
                : "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200"
            }`}
          >
            <Database className="h-4 w-4 shrink-0" />
            <div className="flex-1">
              <span className="font-medium">
                {dbStorage.status === "critical"
                  ? "DBストレージの空きがほとんどありません"
                  : "DBストレージが残り少なくなっています"}
              </span>
              <span className="ml-2 opacity-80">
                {dbStorage.usedMB} MB / {dbStorage.limitMB} MB使用中（{dbStorage.usagePercent}%）
              </span>
            </div>
            <div className="shrink-0 w-24">
              <div className="h-2 rounded-full bg-current/20 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    dbStorage.status === "critical" ? "bg-red-500" : "bg-yellow-500"
                  }`}
                  style={{ width: `${Math.min(dbStorage.usagePercent, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Package className="h-5 w-5" />}
              label="登録商品数"
              value={stats.productCount}
            />
            <StatCard
              icon={<Store className="h-5 w-5" />}
              label="登録店舗数"
              value={stats.storeCount}
            />
            <StatCard
              icon={<Calendar className="h-5 w-5" />}
              label="今月の登録件数"
              value={stats.monthRecords}
            />
            <StatCard
              icon={<TrendingDown className="h-5 w-5" />}
              label="合計価格記録"
              value={stats.totalRecords}
            />
          </div>
        )}

        {/* Deals Section */}
        {deals.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold">今週のお買い得</h2>
              <Badge variant="secondary" className="text-xs">
                {deals.length}件
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {deals.slice(0, 6).map((deal) => (
                <Card key={deal.priceRecordId}>
                  <CardContent className="pt-6">
                    <Link
                      href={`/products/${deal.product.id}`}
                      className="block"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium truncate">
                            {deal.product.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {deal.store.name}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-green-600">
                            ¥{deal.price.toLocaleString()}
                          </p>
                          {deal.isBottomPrice ? (
                            <Badge className="bg-green-600 text-white text-xs">
                              🏆 底値
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              底値 ¥{deal.bottomPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <h2 className="text-lg font-semibold">お気に入り商品</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((fav) => (
                <Card key={fav.id} className="relative">
                  <button
                    className="absolute right-3 top-3 text-yellow-500 hover:text-yellow-600 transition-colors"
                    onClick={() =>
                      handleToggleFavorite(fav.productId, true)
                    }
                    title="お気に入り解除"
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </button>
                  <CardContent className="pt-6">
                    <Link
                      href={`/products/${fav.productId}`}
                      className="block"
                    >
                      <h3 className="font-medium pr-6 truncate">
                        {fav.productName}
                      </h3>
                      {fav.categoryName && (
                        <Badge
                          variant="secondary"
                          className="mt-1 text-xs"
                        >
                          {fav.categoryName}
                        </Badge>
                      )}
                      {fav.stats ? (
                        <div className="mt-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              底値
                            </span>
                            <span className="font-bold text-green-600">
                              ¥{fav.stats.bottomPrice.toLocaleString()}
                            </span>
                          </div>
                          {fav.stats.bottomStore && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                底値店舗
                              </span>
                              <span className="text-xs">
                                {fav.stats.bottomStore.name}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              最新価格
                            </span>
                            <span>
                              ¥{fav.stats.latestPrice.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          価格記録なし
                        </p>
                      )}
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Recently Viewed Products */}
        <RecentlyViewedSection />

        {/* Recent Prices */}
        {recentPrices.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">最近の価格登録</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {recentPrices.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${record.product.id}`}
                          className="font-medium hover:text-primary truncate block"
                        >
                          {record.product.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {record.store.name} ・{" "}
                          {new Date(record.recordedAt).toLocaleDateString(
                            "ja-JP",
                          )}
                        </p>
                      </div>
                      <span className="font-bold ml-4">
                        ¥{record.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Bottom Prices Table */}
        <section>
          <h2 className="text-lg font-semibold mb-4">底値一覧</h2>

          {/* Search + Category Filter + Sort + Store */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="商品名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  <select
                    className="text-sm border rounded px-2 py-1.5 bg-background"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="name">名前順</option>
                    <option value="price">底値順</option>
                    <option value="recordCount">記録数順</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 text-xs"
                    onClick={() => setSortOrder((v) => (v === "asc" ? "desc" : "asc"))}
                  >
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </Button>
                </div>
                {stores.length > 0 && (
                  <select
                    className="text-sm border rounded px-2 py-1.5 bg-background"
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                  >
                    <option value="">全店舗</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
              <Button
                variant={selectedCategory === "" ? "default" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => setSelectedCategory("")}
              >
                すべて
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={
                    selectedCategory === cat.id ? "default" : "outline"
                  }
                  size="sm"
                  className="shrink-0"
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Table */}
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bottomPrices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {debouncedQuery || selectedCategory ? (
                  <p>該当する商品が見つかりません</p>
                ) : (
                  <div className="space-y-2">
                    <p>まだ価格データがありません</p>
                    <Link href="/upload">
                      <Button variant="outline" size="sm">
                        <Camera className="mr-2 h-4 w-4" />
                        画像をアップロードして始める
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">商品名</th>
                      <th className="pb-3 pr-4 font-medium hidden sm:table-cell">
                        カテゴリ
                      </th>
                      <th className="pb-3 pr-4 font-medium text-right">
                        底値
                      </th>
                      <th className="pb-3 pr-4 font-medium hidden md:table-cell">
                        底値店舗
                      </th>
                      <th className="pb-3 pr-4 font-medium text-right hidden lg:table-cell">
                        平均
                      </th>
                      <th className="pb-3 pr-4 font-medium text-right hidden sm:table-cell">
                        最新
                      </th>
                      <th className="pb-3 font-medium text-center w-10">
                        ☆
                      </th>
                      <th className="pb-3 font-medium text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottomPrices.map((item) => {
                      const isFavd = favorites.some(
                        (f) => f.productId === item.productId,
                      );
                      return (
                        <tr
                          key={item.productId}
                          className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <Link
                              href={`/products/${item.productId}`}
                              className="font-medium hover:text-primary"
                            >
                              {item.productName}
                            </Link>
                            {item.unit && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({item.unit})
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 hidden sm:table-cell">
                            {item.categoryName && (
                              <Badge
                                variant="outline"
                                className="text-xs"
                              >
                                {item.categoryName}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right font-bold text-green-600">
                            ¥{item.bottomPrice.toLocaleString()}
                          </td>
                          <td className="py-3 pr-4 text-xs hidden md:table-cell">
                            {item.bottomStoreName}
                          </td>
                          <td className="py-3 pr-4 text-right text-muted-foreground hidden lg:table-cell">
                            ¥{item.averagePrice.toLocaleString()}
                          </td>
                          <td className="py-3 pr-4 text-right hidden sm:table-cell">
                            ¥{item.latestPrice.toLocaleString()}
                          </td>
                          <td className="py-3 text-center">
                            <button
                              onClick={() =>
                                handleToggleFavorite(
                                  item.productId,
                                  isFavd,
                                )
                              }
                              className="hover:scale-110 transition-transform"
                              title={
                                isFavd
                                  ? "お気に入り解除"
                                  : "お気に入り登録"
                              }
                            >
                              {isFavd ? (
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              ) : (
                                <StarOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 text-center">
                            <button
                              onClick={() => {
                                setDeleteTarget({ productId: item.productId, productName: item.productName, recordCount: item.recordCount });
                                setDeleteError(null);
                              }}
                              className="hover:text-destructive transition-colors text-muted-foreground"
                              title="削除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Watch Keywords Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🏷️</span>
            <h2 className="text-lg font-semibold">登録フィルタ（ウォッチキーワード）</h2>
          </div>
          <Card>
            <CardContent className="pt-6">
              <WatchKeywordsManager />
            </CardContent>
          </Card>
        </section>

        {/* Quick Links */}
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickLink
            href="/stores"
            icon="🏪"
            title="店舗管理"
            description="登録済み店舗の管理"
          />
          <QuickLink
            href="/upload"
            icon="📷"
            title="アップロード"
            description="画像から価格を読み取り"
          />
          <QuickLink
            href="/products"
            icon="📦"
            title="商品一覧"
            description="登録済み商品の検索"
          />
        </div>
      </main>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>商品を削除</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.productName}」を削除します。この操作は取り消せません。
              <br />
              関連する{deleteTarget?.recordCount}件の価格記録もすべて削除されます。
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  削除中...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  削除する
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            {icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentlyViewedSection() {
  const { recentlyViewed } = useRecentlyViewed();
  if (recentlyViewed.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🕐</span>
        <h2 className="text-lg font-semibold">最近見た商品</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {recentlyViewed.map((p) => (
          <Link key={p.id} href={`/products/${p.id}`}>
            <Card className="min-w-[140px] transition-shadow hover:shadow-md">
              <CardContent className="p-3">
                <p className="text-sm font-medium truncate">{p.name}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md h-full">
        <CardContent className="pt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
