"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  Package,
  ArrowLeft,
} from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  // Debounce
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
              登録済みの商品を検索・閲覧
            </p>
          </div>
        </div>

        {/* Search + Filter */}
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
                <span className="ml-1 text-xs text-muted-foreground">
                  ({cat._count.products})
                </span>
              </Button>
            ))}
          </div>
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
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="block"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="pt-6 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{product.name}</h3>
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
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {product._count.priceRecords}件の記録
                    </div>
                  </CardContent>
                </Card>
              </Link>
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
    </div>
  );
}
