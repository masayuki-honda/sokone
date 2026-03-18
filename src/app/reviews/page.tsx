"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { toast } from "sonner";
import { X } from "lucide-react";

interface ReviewItem {
  id: string;
  productName: string;
  price: number;
  confidence: number;
  categoryHint: string | null;
  unit: string | null;
  volume: string | null;
  isTaxIncluded: boolean;
  saleDate: string | null;
  createdAt: string;
  store: { id: string; name: string };
  sourceImage: { id: string; imageUrl: string; signedUrl: string | null };
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Track edited values per review item
  const [editedValues, setEditedValues] = useState<
    Record<string, { productName?: string; price?: number }>
  >({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!lightboxUrl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxUrl]);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/reviews?status=pending");
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
        setPendingCount(data.pendingCount);
        setSelectedIds(new Set());
      }
    } catch {
      toast.error("確認待ちの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleAction = async (
    id: string,
    action: "approve" | "reject"
  ) => {
    setProcessingId(id);
    try {
      const body: Record<string, unknown> = { action };
      const edited = editedValues[id];
      if (action === "approve" && edited) {
        if (edited.productName) body.productName = edited.productName;
        if (edited.price) body.price = edited.price;
      }

      const res = await fetch(`/api/reviews/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const result = await res.json();
        if (action === "approve") {
          toast.success(`¥${result.price.toLocaleString()} で登録しました`);
        } else {
          toast.info("却下しました");
        }
        setReviews((prev) => prev.filter((r) => r.id !== id));
        setPendingCount((prev) => prev - 1);
        setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
        setEditedValues((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        const data = await res.json();
        toast.error(data.error || "処理に失敗しました");
      }
    } catch {
      toast.error("通信エラーが発生しました");
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkProcessing(true);
    try {
      const res = await fetch("/api/reviews/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      if (res.ok) {
        const result = await res.json();
        if (action === "approve") {
          toast.success(`${result.approved} 件を登録しました${result.errors > 0 ? `（${result.errors} 件失敗）` : ""}`);
        } else {
          toast.info(`${result.rejected} 件を却下しました`);
        }
        setReviews((prev) => prev.filter((r) => !selectedIds.has(r.id)));
        setPendingCount((prev) => prev - ids.length + (result.errors ?? 0));
        setSelectedIds(new Set());
      } else {
        const data = await res.json();
        toast.error(data.error || "一括処理に失敗しました");
      }
    } catch {
      toast.error("通信エラーが発生しました");
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === reviews.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reviews.map((r) => r.id)));
    }
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.5) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              確認待ち
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              自動取得で信頼度が低かった商品を確認・登録できます
            </p>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                {pendingCount} 件
              </span>
            )}
            <button
              onClick={() => {
                setLoading(true);
                fetchReviews();
              }}
              className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              🔄 更新
            </button>
          </div>
        </div>

        {/* Bulk action bar — visible when any item is selected */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {selectedIds.size} 件選択中
            </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => handleBulkAction("approve")}
                disabled={bulkProcessing}
                className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {bulkProcessing ? "処理中..." : `✅ 一括登録 (${selectedIds.size})`}
              </button>
              <button
                onClick={() => handleBulkAction("reject")}
                disabled={bulkProcessing}
                className="rounded-md bg-zinc-200 px-4 py-1.5 text-sm font-medium hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 disabled:opacity-50"
              >
                {bulkProcessing ? "..." : `❌ 一括却下 (${selectedIds.size})`}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                disabled={bulkProcessing}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                解除
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-zinc-500">読み込み中...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-lg text-zinc-500">✅ 確認待ちはありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select all header */}
            <div className="flex items-center gap-2 px-1 text-sm text-zinc-500 dark:text-zinc-400">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-green-600"
                checked={reviews.length > 0 && selectedIds.size === reviews.length}
                onChange={toggleSelectAll}
                title="全て選択 / 解除"
              />
              <span className="text-xs">
                {selectedIds.size === reviews.length && reviews.length > 0
                  ? "全て選択中"
                  : "全て選択"}
              </span>
            </div>

            {reviews.map((review) => {
              const isSelected = selectedIds.has(review.id);
              return (
                <div
                  key={review.id}
                  className={`rounded-lg border bg-white p-4 dark:bg-zinc-900 ${
                    isSelected
                      ? "border-green-400 dark:border-green-600"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-green-600"
                        checked={isSelected}
                        onChange={() => toggleSelect(review.id)}
                      />
                    </div>

                    <div className="flex flex-1 items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">
                          {review.store.name}
                        </span>
                        <span
                          className={`text-xs font-medium ${confidenceColor(review.confidence)}`}
                        >
                          信頼度 {Math.round(review.confidence * 100)}%
                        </span>
                        {review.saleDate && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {new Date(review.saleDate).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" })}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="text"
                          defaultValue={review.productName}
                          onChange={(e) =>
                            setEditedValues((prev) => ({
                              ...prev,
                              [review.id]: {
                                ...prev[review.id],
                                productName: e.target.value,
                              },
                            }))
                          }
                          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-zinc-500">¥</span>
                          <input
                            type="number"
                            defaultValue={review.price}
                            onChange={(e) =>
                              setEditedValues((prev) => ({
                                ...prev,
                                [review.id]: {
                                  ...prev[review.id],
                                  price: parseInt(e.target.value) || review.price,
                                },
                              }))
                            }
                            className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          />
                        </div>
                        {review.unit && (
                          <span className="text-xs text-zinc-400">
                            {review.unit}
                          </span>
                        )}
                        {review.categoryHint && (
                          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {review.categoryHint}
                          </span>
                        )}
                        {!review.isTaxIncluded && (
                          <span className="text-xs text-orange-500">税抜</span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-400">
                        {new Date(review.createdAt).toLocaleDateString("ja-JP")}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {review.sourceImage?.signedUrl && (
                        <button
                          onClick={() => setLightboxUrl(review.sourceImage.signedUrl)}
                          className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                          title="画像を開く"
                        >
                          🖼️
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(review.id, "approve")}
                        disabled={processingId === review.id || bulkProcessing}
                        className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {processingId === review.id ? "..." : "✅ 登録"}
                      </button>
                      <button
                        onClick={() => handleAction(review.id, "reject")}
                        disabled={processingId === review.id || bulkProcessing}
                        className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 disabled:opacity-50"
                      >
                        {processingId === review.id ? "..." : (
                          <span>
                            ❌ <span className="hidden sm:inline">却下</span>
                          </span>
                        )}
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            onClick={() => setLightboxUrl(null)}
            aria-label="閉じる"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="元画像"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
