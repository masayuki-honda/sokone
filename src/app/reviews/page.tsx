"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { toast } from "sonner";

interface ReviewItem {
  id: string;
  productName: string;
  price: number;
  confidence: number;
  categoryHint: string | null;
  unit: string | null;
  volume: string | null;
  isTaxIncluded: boolean;
  createdAt: string;
  store: { id: string; name: string };
  sourceImage: { id: string; imageUrl: string };
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Track edited values per review item
  const [editedValues, setEditedValues] = useState<
    Record<string, { productName?: string; price?: number }>
  >({});

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/reviews?status=pending");
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
        setPendingCount(data.pendingCount);
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
            {reviews.map((review) => {
              return (
                <div
                  key={review.id}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-4">
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
                      <button
                        onClick={() => handleAction(review.id, "approve")}
                        disabled={processingId === review.id}
                        className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {processingId === review.id ? "..." : "✅ 登録"}
                      </button>
                      <button
                        onClick={() => handleAction(review.id, "reject")}
                        disabled={processingId === review.id}
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
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
