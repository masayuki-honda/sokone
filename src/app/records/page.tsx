"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Clock,
  Filter,
  ChevronDown,
} from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface PriceRecord {
  id: string;
  price: number;
  taxIncluded: boolean;
  sourceType: string;
  sourceImageId: string | null;
  recordedAt: string;
  createdAt: string;
  product: { id: string; name: string };
  store: { id: string; name: string };
}

interface StoreItem {
  id: string;
  name: string;
}

const sourceTypeLabels: Record<string, string> = {
  photo: "店頭写真",
  flyer: "チラシ",
  auto_flyer: "自動チラシ",
  instagram: "Instagram",
  receipt: "レシート",
};

export default function RecordsPage() {
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedSource, setSelectedSource] = useState("");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<PriceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch stores
  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((data) => setStores(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (selectedStore) params.set("storeId", selectedStore);
    if (selectedSource) params.set("sourceType", selectedSource);

    try {
      const res = await fetch(`/api/prices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setNextCursor(data.nextCursor || null);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [selectedStore, selectedSource]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  async function loadMore() {
    if (!nextCursor) return;
    const params = new URLSearchParams();
    params.set("limit", "50");
    params.set("cursor", nextCursor);
    if (selectedStore) params.set("storeId", selectedStore);
    if (selectedSource) params.set("sourceType", selectedSource);

    try {
      const res = await fetch(`/api/prices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecords((prev) => [...prev, ...(data.records || [])]);
        setNextCursor(data.nextCursor || null);
      }
    } catch {
      // silently fail
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/prices/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error || "削除に失敗しました");
        return;
      }
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError("削除中にエラーが発生しました");
    } finally {
      setIsDeleting(false);
    }
  }

  // Group records by date
  const grouped = records.reduce<Record<string, PriceRecord[]>>((acc, record) => {
    const date = new Date(record.createdAt).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(record);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">登録履歴</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            フィルタ
            <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </Button>
        </div>

        {showFilters && (
          <div className="flex gap-3 flex-wrap">
            <select
              className="text-sm border rounded px-3 py-1.5 bg-background"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            >
              <option value="">すべての店舗</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              className="text-sm border rounded px-3 py-1.5 bg-background"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              <option value="">すべてのソース</option>
              {Object.entries(sourceTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-zinc-500">登録履歴はありません</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, dateRecords]) => (
              <div key={date}>
                <h2 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-1">
                  {date}（{dateRecords.length}件）
                </h2>
                <div className="space-y-1">
                  {dateRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center gap-3 rounded-lg border bg-background p-3 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/products/${record.product.id}`}
                            className="font-medium text-sm hover:underline truncate"
                          >
                            {record.product.name}
                          </Link>
                          <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                            ¥{record.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{record.store.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {sourceTypeLabels[record.sourceType] || record.sourceType}
                          </Badge>
                          <span>
                            {new Date(record.createdAt).toLocaleTimeString("ja-JP", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => { setDeleteTarget(record); setDeleteError(null); }}
                        title="削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {nextCursor && (
              <div className="text-center pt-2">
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
            <DialogTitle>価格記録を削除</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.product.name}」の ¥{deleteTarget?.price.toLocaleString()} の記録を削除します。この操作は取り消せません。
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
    </div>
  );
}
