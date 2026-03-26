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
  CheckSquare,
  Square,
  X,
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

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Single delete state
  const [deleteTarget, setDeleteTarget] = useState<PriceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // Y/N keyboard shortcuts for any open delete dialog
  useEffect(() => {
    const isOpen = !!deleteTarget || showBulkDeleteDialog;
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        if (deleteTarget) document.getElementById("confirm-delete-btn")?.click();
        else document.getElementById("confirm-bulk-delete-btn")?.click();
      } else if (e.key.toLowerCase() === "n" || e.key === "Escape") {
        e.preventDefault();
        setDeleteTarget(null);
        setShowBulkDeleteDialog(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteTarget, showBulkDeleteDialog]);

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

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

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    const ids = Array.from(selectedIds);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/prices/${id}`, { method: "DELETE" }))
      );
      const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
      setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      setSelectionMode(false);
      if (failed.length > 0) {
        setBulkDeleteError(`${failed.length}件の削除に失敗しました`);
      }
    } catch {
      setBulkDeleteError("削除中にエラーが発生しました");
    } finally {
      setIsBulkDeleting(false);
    }
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(groupIds: string[]) {
    const allSelected = groupIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) groupIds.forEach((id) => next.delete(id));
      else groupIds.forEach((id) => next.add(id));
      return next;
    });
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
          <div className="flex items-center gap-2">
            {!isLoading && records.length > 0 && (
              <Button
                variant={selectionMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
              >
                {selectionMode ? (
                  <><X className="h-4 w-4 mr-1" />選択解除</>
                ) : (
                  <><CheckSquare className="h-4 w-4 mr-1" />選択
                  </>
                )}
              </Button>
            )}
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
            {Object.entries(grouped).map(([date, dateRecords]) => {
              const groupIds = dateRecords.map((r) => r.id);
              const allGroupSelected = groupIds.every((id) => selectedIds.has(id));
              const someGroupSelected = groupIds.some((id) => selectedIds.has(id));
              return (
              <div key={date}>
                <div className="flex items-center gap-2 sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-1 mb-2">
                  {selectionMode && (
                    <button
                      onClick={() => toggleGroup(groupIds)}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      title={allGroupSelected ? "この日を全解除" : "この日を全選択"}
                    >
                      {allGroupSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : someGroupSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary/50" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {date}（{dateRecords.length}件）
                  </h2>
                </div>
                <div className="space-y-1">
                  {dateRecords.map((record) => {
                    const isChecked = selectedIds.has(record.id);
                    return (
                    <div
                      key={record.id}
                      className={`flex items-center gap-3 rounded-lg border bg-background p-3 hover:shadow-sm transition-shadow ${
                        selectionMode ? "cursor-pointer select-none" : ""
                      } ${isChecked ? "border-primary/50 bg-primary/5" : ""}`}
                      onClick={selectionMode ? () => toggleId(record.id) : undefined}
                    >
                      {selectionMode && (
                        <div className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); toggleId(record.id); }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleId(record.id)}
                            className="h-4 w-4 rounded border-zinc-300 text-primary accent-primary cursor-pointer"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/products/${record.product.id}`}
                            className="font-medium text-sm hover:underline truncate"
                            onClick={(e) => selectionMode && e.preventDefault()}
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
                      {!selectionMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => { setDeleteTarget(record); setDeleteError(null); }}
                          title="削除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            );
            })}

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
          <p className="text-xs text-muted-foreground">
            <kbd className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">Y</kbd> で削除　
            <kbd className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">N</kbd> でキャンセル
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              キャンセル (N)
            </Button>
            <Button id="confirm-delete-btn" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />削除中...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" />削除する (Y)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={(open) => !open && setShowBulkDeleteDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>一括削除</DialogTitle>
            <DialogDescription>
              選択した {selectedIds.size} 件の価格記録を削除します。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          {bulkDeleteError && (
            <p className="text-sm text-destructive">{bulkDeleteError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            <kbd className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">Y</kbd> で削除　
            <kbd className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-xs">N</kbd> でキャンセル
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)} disabled={isBulkDeleting}>
              キャンセル (N)
            </Button>
            <Button id="confirm-bulk-delete-btn" variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />削除中...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" />{selectedIds.size}件を削除 (Y)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticky bottom action bar (selection mode) */}
      {selectionMode && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
          <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const allIds = records.map((r) => r.id);
                  const allSelected = allIds.every((id) => selectedIds.has(id));
                  if (allSelected) setSelectedIds(new Set());
                  else setSelectedIds(new Set(allIds));
                }}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                {records.every((r) => selectedIds.has(r.id)) ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                全選択
              </button>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size > 0 ? `${selectedIds.size}件選択中` : "未選択"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exitSelectionMode}>
                キャンセル
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => { setBulkDeleteError(null); setShowBulkDeleteDialog(true); }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {selectedIds.size > 0 ? `${selectedIds.size}件削除` : "削除"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
