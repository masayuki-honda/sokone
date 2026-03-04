"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  Package,
  ArrowLeft,
  Merge,
  X,
  Check,
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

interface ProductItem {
  id: string;
  name: string;
  unit: string | null;
  volume: string | null;
  category: { id: string; name: string } | null;
  _count: { priceRecords: number };
}

interface Category {
  id: string;
  name: string;
  _count: { products: number };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Merge dialog state
  const [mergeSource, setMergeSource] = useState<ProductItem | null>(null);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeSearchResults, setMergeSearchResults] = useState<ProductItem[]>([]);
  const [mergeTarget, setMergeTarget] = useState<ProductItem | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

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

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (selectedCategory) params.set("categoryId", selectedCategory);
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
  }, [debouncedQuery, selectedCategory]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Load more
  async function loadMore() {
    if (!nextCursor) return;

    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (selectedCategory) params.set("categoryId", selectedCategory);
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

  // Search for merge target
  useEffect(() => {
    if (!mergeSearch.trim() || mergeSearch.length < 1) {
      setMergeSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?q=${encodeURIComponent(mergeSearch)}&limit=10`,
        );
        if (res.ok) {
          const data = await res.json();
          // Exclude the source product from results
          setMergeSearchResults(
            (data.products || []).filter(
              (p: ProductItem) => p.id !== mergeSource?.id,
            ),
          );
        }
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mergeSearch, mergeSource]);

  // Execute merge
  async function handleMerge() {
    if (!mergeSource || !mergeTarget) return;
    setIsMerging(true);
    setMergeError(null);
    try {
      const res = await fetch(`/api/products/${mergeSource.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProductId: mergeTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMergeError(data.error || "統合に失敗しました");
        return;
      }
      // Remove source from list, close dialog
      setProducts((prev) => prev.filter((p) => p.id !== mergeSource.id));
      setMergeSource(null);
      setMergeTarget(null);
      setMergeSearch("");
      setMergeSearchResults([]);
    } catch {
      setMergeError("統合中にエラーが発生しました");
    } finally {
      setIsMerging(false);
    }
  }

  function openMergeDialog(product: ProductItem) {
    setMergeSource(product);
    setMergeTarget(null);
    setMergeSearch("");
    setMergeSearchResults([]);
    setMergeError(null);
  }

  function closeMergeDialog() {
    setMergeSource(null);
    setMergeTarget(null);
    setMergeSearch("");
    setMergeSearchResults([]);
    setMergeError(null);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">商品一覧</h1>
            <p className="text-sm text-muted-foreground">
              登録済みの商品を検索・閲覧・統合
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="商品名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === "" ? "default" : "outline"}
            size="sm"
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
            {products.map((product) => (
              <Card key={product.id} className="transition-shadow hover:shadow-md">
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <Link
                    href={`/products/${product.id}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="font-medium truncate">{product.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      {product.category && (
                        <Badge variant="outline" className="text-xs">
                          {product.category.name}
                        </Badge>
                      )}
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
                    </div>
                  </Link>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-muted-foreground">
                      {product._count.priceRecords}件
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => openMergeDialog(product)}
                    >
                      <Merge className="h-3 w-3" />
                      統合
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

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

      {/* Merge dialog */}
      <Dialog open={!!mergeSource} onOpenChange={(open) => !open && closeMergeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>商品を統合</DialogTitle>
            <DialogDescription>
              「{mergeSource?.name}」を別の商品に統合します。
              価格記録がすべて統合先に移動し、元の商品名は自動的にエイリアスとして保存されます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Source info */}
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="text-xs text-muted-foreground mb-1">統合元（削除される）</p>
              <p className="font-medium">{mergeSource?.name}</p>
              <p className="text-xs text-muted-foreground">
                {mergeSource?._count.priceRecords}件の価格記録
              </p>
            </div>

            {/* Target search */}
            <div>
              <p className="text-sm font-medium mb-2">統合先を検索</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="商品名で検索..."
                  value={mergeSearch}
                  onChange={(e) => {
                    setMergeSearch(e.target.value);
                    setMergeTarget(null);
                  }}
                  className="pl-10"
                />
              </div>
              {mergeSearchResults.length > 0 && !mergeTarget && (
                <div className="mt-1 rounded-md border bg-background shadow-sm max-h-48 overflow-y-auto">
                  {mergeSearchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between"
                      onClick={() => {
                        setMergeTarget(p);
                        setMergeSearch(p.name);
                        setMergeSearchResults([]);
                      }}
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {p._count.priceRecords}件
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected target */}
            {mergeTarget && (
              <div className="rounded-lg border border-green-400 bg-green-50 dark:bg-green-950 p-3 text-sm flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">統合先（残る）</p>
                  <p className="font-medium">{mergeTarget.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {mergeTarget._count.priceRecords}件の価格記録
                  </p>
                </div>
                <button
                  onClick={() => { setMergeTarget(null); setMergeSearch(""); }}
                  className="rounded-full p-1 hover:bg-green-100 dark:hover:bg-green-900"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {mergeError && (
              <p className="text-sm text-destructive">{mergeError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeMergeDialog} disabled={isMerging}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={!mergeTarget || isMerging}
              onClick={handleMerge}
            >
              {isMerging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  統合中...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  統合する
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>    </div>
  );
}
