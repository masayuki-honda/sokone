"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Eye,
  Trash2,
  Loader2,
  ArrowLeft,
  TrendingDown,
  Store,
} from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface WatchItem {
  id: string;
  productId: string;
  productName: string;
  targetPrice: number | null;
  enabled: boolean;
  createdAt: string;
  bottomPrice: number | null;
  latestPrice: number | null;
  latestStore: string | null;
  latestDate: string | null;
}

export default function WatchesPage() {
  const [watches, setWatches] = useState<WatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWatches();
  }, []);

  async function fetchWatches() {
    try {
      const res = await fetch("/api/watches");
      if (res.ok) {
        setWatches(await res.json());
      }
    } catch (error) {
      console.error("Failed to load watches:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleEnabled(watchId: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/watches/${watchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setWatches((prev) =>
          prev.map((w) => (w.id === watchId ? { ...w, enabled } : w))
        );
      }
    } catch (error) {
      console.error("Failed to toggle watch:", error);
    }
  }

  async function handleDelete(watchId: string) {
    try {
      const res = await fetch(`/api/watches/${watchId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWatches((prev) => prev.filter((w) => w.id !== watchId));
      }
    } catch (error) {
      console.error("Failed to delete watch:", error);
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
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
            <h1 className="text-xl font-bold">ウォッチリスト</h1>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {watches.length}件
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : watches.length === 0 ? (
          <div className="text-center py-20">
            <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              ウォッチリストに商品がありません
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              商品詳細ページからウォッチに追加できます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {watches.map((watch) => {
              const isNearBottom =
                watch.bottomPrice != null &&
                watch.latestPrice != null &&
                watch.latestPrice <= watch.bottomPrice * 1.1;
              const hitTarget =
                watch.targetPrice != null &&
                watch.latestPrice != null &&
                watch.latestPrice <= watch.targetPrice;

              return (
                <Card
                  key={watch.id}
                  className={`${!watch.enabled ? "opacity-60" : ""} ${hitTarget ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/products/${watch.productId}`}
                        className="min-w-0 flex-1 hover:underline"
                      >
                        <h3 className="font-medium truncate">
                          {watch.productName}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {watch.latestPrice != null && (
                            <span className="flex items-center gap-1">
                              <Store className="h-3 w-3" />
                              最新 ¥{watch.latestPrice.toLocaleString()}
                              {watch.latestStore && ` (${watch.latestStore})`}
                            </span>
                          )}
                          {watch.bottomPrice != null && (
                            <span className="flex items-center gap-1">
                              <TrendingDown className="h-3 w-3 text-green-600" />
                              底値 ¥{watch.bottomPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {watch.targetPrice != null && (
                            <Badge
                              variant={hitTarget ? "default" : "outline"}
                              className="text-xs"
                            >
                              目標 ¥{watch.targetPrice.toLocaleString()}
                              {hitTarget && " ✓"}
                            </Badge>
                          )}
                          {isNearBottom && (
                            <Badge className="text-xs bg-green-600">
                              底値付近
                            </Badge>
                          )}
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={watch.enabled}
                          onCheckedChange={(checked) =>
                            handleToggleEnabled(watch.id, checked)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(watch.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
