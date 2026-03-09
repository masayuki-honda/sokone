"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  X,
  Loader2,
  Store,
  Trophy,
  ShoppingCart,
} from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProductSuggestion {
  id: string;
  name: string;
}

interface StoreResult {
  storeId: string;
  storeName: string;
  productPrices: Array<{
    productId: string;
    minPrice: number | null;
  }>;
  total: number;
  coveredCount: number;
  hasAll: boolean;
}

interface CompareResult {
  products: Array<{ id: string; name: string }>;
  stores: StoreResult[];
}

export default function ComparePage() {
  const [selectedProducts, setSelectedProducts] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Search products as user types
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/products?q=${encodeURIComponent(query)}&limit=8`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(
            (data.products || []).filter(
              (p: ProductSuggestion) =>
                !selectedProducts.some((sp) => sp.id === p.id)
            )
          );
          setShowSuggestions(true);
        }
      } catch {
        // Ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedProducts]);

  function handleSelectProduct(product: ProductSuggestion) {
    setSelectedProducts((prev) => [...prev, product]);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function handleRemoveProduct(productId: string) {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
    setResult(null);
  }

  // Auto-compare when products change
  useEffect(() => {
    if (selectedProducts.length > 0) {
      const ids = selectedProducts.map((p) => p.id).join(",");
      const timer = setTimeout(() => {
        setIsLoading(true);
        fetch(`/api/compare?productIds=${ids}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) setResult(data);
          })
          .catch((error) => console.error("Failed to compare:", error))
          .finally(() => setIsLoading(false));
      }, 0);
      return () => clearTimeout(timer);
    } else {
      setResult(null);
    }
  }, [selectedProducts]);

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
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-500" />
            <h1 className="text-xl font-bold">どこが一番安い？</h1>
          </div>
        </div>

        {/* Product Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              比較する商品を選択
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="商品名で検索..."
                  className="flex-1"
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-md border bg-background shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                      onClick={() => handleSelectProduct(s)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected products */}
            {selectedProducts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedProducts.map((p) => (
                  <Badge
                    key={p.id}
                    variant="secondary"
                    className="flex items-center gap-1 text-sm"
                  >
                    {p.name}
                    <button
                      onClick={() => handleRemoveProduct(p.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {result && !isLoading && (
          <>
            {result.stores.length === 0 ? (
              <div className="text-center py-10">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  選択された商品の価格記録がありません
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.stores.map((store, index) => (
                  <Card
                    key={store.storeId}
                    className={
                      index === 0 && store.hasAll
                        ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                        : ""
                    }
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {index === 0 && store.hasAll && (
                              <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                            )}
                            <h3 className="font-medium">{store.storeName}</h3>
                            {!store.hasAll && (
                              <Badge variant="outline" className="text-xs">
                                {store.coveredCount}/{selectedProducts.length}品
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 grid gap-1">
                            {store.productPrices.map((pp) => {
                              const product = result.products.find(
                                (p) => p.id === pp.productId
                              );
                              return (
                                <div
                                  key={pp.productId}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span className="text-muted-foreground truncate mr-2">
                                    {product?.name ?? pp.productId}
                                  </span>
                                  {pp.minPrice != null ? (
                                    <span className="shrink-0 font-medium">
                                      ¥{pp.minPrice.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      記録なし
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted-foreground">合計</p>
                          <p
                            className={`text-xl font-bold ${index === 0 && store.hasAll ? "text-green-600" : ""}`}
                          >
                            ¥{store.total.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {!result && !isLoading && selectedProducts.length === 0 && (
          <div className="text-center py-10">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              商品を追加して、一番安い店舗を見つけましょう
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
