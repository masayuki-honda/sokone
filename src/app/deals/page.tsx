"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingDown,
  Store,
  Loader2,
  ArrowLeft,
  Zap,
  Calendar,
} from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DealItem {
  priceRecordId: string;
  product: {
    id: string;
    name: string;
    unit: string | null;
    volume: string | null;
    category: { id: string; name: string } | null;
  };
  store: { id: string; name: string };
  price: number;
  bottomPrice: number;
  isBottomPrice: boolean;
  discount: number;
  recordedAt: string;
  sourceType: string;
}

export default function DealsPage() {
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState(7);

  const fetchDeals = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/deals?days=${period}`);
      if (res.ok) {
        const data = await res.json();
        setDeals(data.deals || []);
      }
    } catch (error) {
      console.error("Failed to load deals:", error);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <h1 className="text-xl font-bold">お買い得商品</h1>
            </div>
          </div>
          <div className="flex gap-1">
            {[
              { value: 7, label: "7日" },
              { value: 14, label: "14日" },
              { value: 30, label: "30日" },
            ].map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "ghost"}
                size="sm"
                className="text-xs"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-20">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              直近{period}日間のお買い得商品はありません
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              底値の10%以内の価格で登録された商品が表示されます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              直近{period}日間のお買い得: {deals.length}件
            </p>
            {deals.map((deal) => (
              <Card
                key={deal.priceRecordId}
                className={
                  deal.isBottomPrice
                    ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                    : ""
                }
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/products/${deal.product.id}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-medium">{deal.product.name}</h3>
                        {deal.product.volume && (
                          <span className="text-sm text-muted-foreground">
                            {deal.product.volume}
                          </span>
                        )}
                        {deal.product.category && (
                          <Badge variant="outline" className="text-xs">
                            {deal.product.category.name}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Store className="h-3 w-3" />
                          {deal.store.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(deal.recordedAt).toLocaleDateString("ja-JP")}
                        </span>
                      </div>
                    </Link>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-bold text-green-600">
                        ¥{deal.price.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <TrendingDown className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          底値 ¥{deal.bottomPrice.toLocaleString()}
                        </span>
                      </div>
                      {deal.isBottomPrice ? (
                        <Badge className="mt-1 bg-green-600 text-xs">
                          底値
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          底値+{deal.discount}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
