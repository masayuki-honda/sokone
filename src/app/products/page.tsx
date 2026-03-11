"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  Package,
  ArrowLeft,
  Merge,
  Wand2,
  ArrowUpDown,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Header } from "@/components/header";
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
import { MergeProductDialog } from "@/components/merge-product-dialog";

interface ProductItem {
  id: string;
  name: string;
  unit: string | null;
  volume: string | null;
  category: { id: string; name: string } | null;
  _count: { priceRecords: number };
  priceRecords: Array<{ price: number; store: { name: string } | null }>;
}

interface Category {
  id: string;
  name: string;
  _count: { products: number };
}

interface StoreItem {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Merge dialog state
  const [mergeSource, setMergeSource] = useState<{ id: string; name: string; recordCount: number } | null>(null);

  // Auto-categorize state
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
  const [autoCategorizeResult, setAutoCategorizeResult] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<ProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Debounce main search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch categories
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

  // Fetch stores
  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((data) => setStores(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (selectedCategory) params.set("categoryId", selectedCategory);
    if (selectedStore) params.set("storeId", selectedStore);
    if (sortBy !== "name") params.set("sortBy", sortBy);
    if (sortOrder !== "asc") params.set("sortOrder", sortOrder);
    params.set("limit", "30");

    try {
      const res = await fetch(`/api/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setNextCursor(data.nextCursor || null);
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, selectedCategory, selectedStore, sortBy, sortOrder]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Load more
  async function loadMore() {
    if (!nextCursor) return;

    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (selectedCategory) params.set("categoryId", selectedCategory);
    if (selectedStore) params.set("storeId", selectedStore);
    if (sortBy !== "name") params.set("sortBy", sortBy);
    if (sortOrder !== "asc") params.set("sortOrder", sortOrder);
    params.set("cursor", nextCursor);
    params.set("limit", "30");

    try {
      const res = await fetch(`/api/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts((prev) => [...prev, ...(data.products || [])]);
        setNextCursor(data.nextCursor || null);
      }
    } catch (error) {
      console.error("Failed to load more:", error);
    }
  }

  /** Compute per-100g price if volume is in grams (e.g. "300g"). Returns null otherwise. */
  function computePer100gPrice(price: number, volume: string | null): number | null {
    if (!volume) return null;
    const match = volume.match(/^(\d+(?:\.\d+)?)\s*g$/i);
    if (!match) return null;
    const grams = parseFloat(match[1]);
    if (grams <= 0) return null;
    return Math.round((price * 100) / grams);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "削除に失敗しました");
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError("削除中にエラーが発生しました");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAutoCategorize() {
    setIsAutoCategorizing(true);
    setAutoCategorizeResult(null);
    try {
      const res = await fetch("/api/products/auto-categorize", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const errNote = data.errors?.length
          ? ` (エラー: ${data.errors[0]})`
          : "";
        setAutoCategorizeResult(data.message + errNote);
        // Refresh product list and category counts
        await fetchProducts();
        const catRes = await fetch("/api/categories");
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData.categories || []);
        }
      } else {
        setAutoCategorizeResult(`エラー: ${data.error || JSON.stringify(data)}`);
      }
    } catch (err) {
      setAutoCategorizeResult(`通信エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAutoCategorizing(false);
    }
  }

  async function handleCategoryChange(productId: string, categoryId: string | null) {
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, category: updated.category } : p,
          ),
        );
        // Refresh category counts
        const catRes = await fetch("/api/categories");
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData.categories || []);
        }
      }
    } catch {
      // silently fail
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">商品一覧</h1>
              <p className="text-sm text-muted-foreground">
                登録済みの商品を検索・閲覧・統合
              </p>
            </div>
          </div>
          <div className="sm:ml-auto flex flex-col items-start sm:items-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoCategorize}
              disabled={isAutoCategorizing}
            >
              {isAutoCategorizing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              カテゴリ自動設定
            </Button>
            {autoCategorizeResult && (
              <p className="text-xs text-muted-foreground">{autoCategorizeResult}</p>
            )}
          </div>
        </div>

        {/* Search + Sort + Filter toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="商品名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="icon"
            className="shrink-0"
            onClick={() => setShowFilters((v) => !v)}
            title="フィルタ・並び替え"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Expandable filters: Sort + Store */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                className="text-sm border rounded px-2 py-1.5 bg-background flex-1 sm:w-auto"
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
                {sortOrder === "asc" ? "↑ 昇順" : "↓ 降順"}
              </Button>
            </div>
            {stores.length > 0 && (
              <div className="flex items-center gap-2 sm:border-l sm:pl-3">
                <span className="text-sm text-muted-foreground shrink-0">店舗:</span>
                <select
                  className="text-sm border rounded px-2 py-1.5 bg-background flex-1 sm:w-auto"
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                >
                  <option value="">すべての店舗</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
          <Button
            variant={selectedCategory === "" ? "default" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => setSelectedCategory("")}
          >
            すべて
          </Button>
          <Button
            variant={selectedCategory === "uncategorized" ? "default" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => setSelectedCategory("uncategorized")}
          >
            未分類
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
              {cat._count.products > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({cat._count.products})
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Product list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="mx-auto h-10 w-10 mb-3" />
              <p>
                {debouncedQuery || selectedCategory
                  ? "該当する商品が見つかりません"
                  : "商品が登録されていません"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {products.map((product) => {
                const bottomRecord = product.priceRecords[0];
                const isMeat = product.category?.name === "肉類";
                const per100g = isMeat && bottomRecord
                  ? computePer100gPrice(bottomRecord.price, product.volume)
                  : null;

                return (
              <Card key={product.id} className="transition-shadow hover:shadow-md">
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <Link
                    href={`/products/${product.id}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="font-medium truncate">{product.name}</h3>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {product.unit && (
                        <span className="text-xs text-muted-foreground">
                          {product.unit}
                        </span>
                      )}
                      {product.volume && (
                        <span className="text-xs text-muted-foreground">
                          {product.volume}
                        </span>
                      )}
                      {bottomRecord && (
                        <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                          {per100g !== null
                            ? `¥${per100g.toLocaleString()}/100g`
                            : `¥${bottomRecord.price.toLocaleString()}`}
                        </span>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center gap-3 shrink-0">
                    <select
                      className="text-xs border rounded px-1.5 py-0.5 bg-background text-foreground max-w-[100px] hidden sm:block"
                      value={product.category?.id || ""}
                      onChange={(e) => handleCategoryChange(product.id, e.target.value || null)}
                    >
                      <option value="">未分類</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <span className="text-sm text-muted-foreground">
                      {product._count.priceRecords}件
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => setMergeSource({ id: product.id, name: product.name, recordCount: product._count.priceRecords })}
                    >
                      <Merge className="h-3 w-3" />
                      統合
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => { setDeleteTarget(product); setDeleteError(null); }}
                      title="削除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
                );
              })}

            {nextCursor && (
              <div className="text-center pt-4">
                <Button variant="outline" onClick={loadMore}>
                  もっと読み込む
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>商品を削除</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.name}」を削除します。この操作は取り消せません。
              <br />
              関連する{deleteTarget?._count.priceRecords}件の価格記録もすべて削除されます。
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
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

      {/* Merge dialog */}
      <MergeProductDialog
        source={mergeSource}
        onClose={() => setMergeSource(null)}
        onMerged={(sourceId) => {
          setProducts((prev) => prev.filter((p) => p.id !== sourceId));
        }}
      />    </div>
  );
}
