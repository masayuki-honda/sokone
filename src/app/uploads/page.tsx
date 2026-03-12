"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  Loader2,
  Camera,
  Newspaper,
  Smartphone,
  Receipt,
  Clock,
  MapPin,
  Eye,
  ChevronDown,
  Filter,
  Trash2,
  X,
  AlertTriangle,
  ScanText,
  PlusCircle,
} from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogHeader,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface UploadedImage {
  id: string;
  imageUrl: string;
  signedUrl: string;
  sourceType: "photo" | "flyer" | "instagram" | "receipt";
  status: "pending" | "processed" | "failed" | "no_products";
  createdAt: string;
  takenAt: string | null;
  store: { id: string; name: string } | null;
  ocrResultJson: OcrResult | null;
  _count: { priceRecords: number };
}

interface OcrItem {
  name: string;
  price: number;
  unit?: string | null;
  volume?: string | null;
  category_hint?: string | null;
  is_tax_included?: boolean;
  confidence?: number;
}

interface OcrResult {
  items?: OcrItem[];
}

const SOURCE_TYPE_LABELS: Record<string, { label: string; icon: typeof Camera }> = {
  photo: { label: "店頭写真", icon: Camera },
  flyer: { label: "チラシ", icon: Newspaper },
  instagram: { label: "Instagram", icon: Smartphone },
  receipt: { label: "レシート", icon: Receipt },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "未処理", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  processed: { label: "処理済み", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  failed: { label: "失敗", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  no_products: { label: "商品なし", color: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400" },
};

export default function UploadsPage() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<UploadedImage | null>(null);

  // Delete / cleanup state
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupConfirm, setCleanupConfirm] = useState(false);

  const [, startTransition] = useTransition();

  // OCR state
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  // Registration state
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registerResult, setRegisterResult] = useState<{ registered: number; errors: number } | null>(null);

  // Pre-select all items when lightbox opens or changes
  useEffect(() => {
    if (lightboxImage?.ocrResultJson?.items?.length) {
      setSelectedItems(new Set(lightboxImage.ocrResultJson.items.map((_, i) => i)));
    } else {
      setSelectedItems(new Set());
    }
    setRegisterResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxImage?.id]);

  const fetchImages = useCallback(
    async (cursor?: string | null) => {
      const params = new URLSearchParams();
      if (sourceTypeFilter !== "all") params.set("sourceType", sourceTypeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "20");
      if (cursor) params.set("cursor", cursor);

      try {
        const res = await fetch(`/api/images?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        return data;
      } catch {
        return null;
      }
    },
    [sourceTypeFilter, statusFilter],
  );

  // Initial load and filter change
  useEffect(() => {
    setIsLoading(true);
    setImages([]);
    setNextCursor(null);
    fetchImages().then((data) => {
      if (data) {
        setImages(data.images || []);
        setNextCursor(data.nextCursor || null);
        setHasMore(data.hasMore || false);
      }
      setIsLoading(false);
    });
  }, [fetchImages]);

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    const data = await fetchImages(nextCursor);
    if (data) {
      setImages((prev) => [...prev, ...(data.images || [])]);
      setNextCursor(data.nextCursor || null);
      setHasMore(data.hasMore || false);
    }
    setIsLoadingMore(false);
  };

  const handleAnalyze = async (id: string) => {
    setAnalyzingId(id);
    try {
      const res = await fetch(`/api/images/${id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        // Update both the list and the currently open lightbox
        const updated = (img: UploadedImage): UploadedImage =>
          img.id === id
            ? { ...img, status: "processed", ocrResultJson: data.ocrResult }
            : img;
        setImages((prev) => prev.map(updated));
        setLightboxImage((prev) => (prev?.id === id ? updated(prev) : prev));
        // Pre-select all newly extracted items
        const count = (data.ocrResult?.items?.length ?? 0) as number;
        setSelectedItems(new Set(Array.from({ length: count }, (_, i) => i)));
        setRegisterResult(null);
      } else {
        const msg = data.error || "OCRに失敗しました";
        const detail = data.details ? `\n\n詳細: ${data.details}` : "";
        alert(msg + detail);
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleRegister = async (image: UploadedImage) => {
    if (!image.store) {
      alert("店舗情報が設定されていません。画像の再アップロードか、アップロード時に店舗を選択してください");
      return;
    }
    const allItems = image.ocrResultJson?.items ?? [];
    const selected = allItems.filter((_, i) => selectedItems.has(i));
    if (selected.length === 0) {
      alert("登録する品目を選択してください");
      return;
    }
    setRegisteringId(image.id);
    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected,
          storeId: image.store.id,
          sourceType: image.sourceType,
          sourceImageId: image.id,
          recordedAt: image.takenAt ?? image.createdAt,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const registeredCount = (data.registered?.length ?? 0) as number;
        setRegisterResult({ registered: registeredCount, errors: data.errors?.length ?? 0 });
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, _count: { priceRecords: img._count.priceRecords + registeredCount } }
              : img,
          ),
        );
        setLightboxImage((prev) =>
          prev?.id === image.id
            ? { ...prev, _count: { priceRecords: prev._count.priceRecords + registeredCount } }
            : prev,
        );
      } else {
        alert(data.error || "登録に失敗しました");
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setRegisteringId(null);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/images/${id}`, { method: "DELETE" });
      if (res.ok) {
        setImages((prev) => prev.filter((img) => img.id !== id));
        if (lightboxImage?.id === id) setLightboxImage(null);
      }
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const res = await fetch("/api/images/cleanup", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json() as { deleted: number };
        setCleanupConfirm(false);
        setIsLoading(true);
        const fresh = await fetchImages();
        if (fresh) {
          setImages(fresh.images || []);
          setNextCursor(fresh.nextCursor || null);
          setHasMore(fresh.hasMore || false);
        }
        setIsLoading(false);
        if (data.deleted === 0) {
          alert("削除対象の画像はありませんでした");
        }
      }
    } finally {
      setIsCleaningUp(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getOcrItemCount = (img: UploadedImage) => {
    if (!img.ocrResultJson?.items) return 0;
    return img.ocrResultJson.items.length;
  };

  const unregisteredCount = images.filter((img) => img._count.priceRecords === 0).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ImageIcon className="h-6 w-6" />
              アップロード履歴
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              過去にアップロードした画像とOCR結果を確認できます
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unregisteredCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCleanupConfirm(true)}
                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                未登録を一括削除
              </Button>
            )}
            <Link href="/upload">
              <Button size="sm">
                <Camera className="h-4 w-4 mr-1" />
                新しくアップロード
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-500" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">絞り込み:</span>
          </div>
          <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="ソース" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="photo">店頭写真</SelectItem>
              <SelectItem value="flyer">チラシ</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="receipt">レシート</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="ステータス" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="pending">未処理</SelectItem>
              <SelectItem value="processed">処理済み</SelectItem>
              <SelectItem value="failed">失敗</SelectItem>
              <SelectItem value="no_products">商品なし</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </div>
        ) : images.length === 0 ? (
          <div className="mt-12 text-center text-zinc-500">
            <ImageIcon className="mx-auto h-12 w-12 text-zinc-300" />
            <p className="mt-2">アップロード画像がありません</p>
            <Link href="/upload" className="mt-4 inline-block">
              <Button variant="outline" size="sm">
                画像をアップロード
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Image grid */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {images.map((img) => {
                const sourceInfo = SOURCE_TYPE_LABELS[img.sourceType];
                const statusInfo = STATUS_LABELS[img.status];
                const SourceIcon = sourceInfo?.icon || Camera;
                const itemCount = getOcrItemCount(img);
                const isDeleting = deletingIds.has(img.id);
                const isUnregistered = img._count.priceRecords === 0;

                return (
                  <Card
                    key={img.id}
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative"
                    onClick={() => !isDeleting && startTransition(() => setLightboxImage(img))}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.signedUrl}
                        alt="アップロード画像"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant="secondary"
                          className="bg-white/90 dark:bg-zinc-900/90 text-xs"
                        >
                          <SourceIcon className="h-3 w-3 mr-1" />
                          {sourceInfo?.label}
                        </Badge>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${statusInfo?.color}`}
                        >
                          {statusInfo?.label}
                        </Badge>
                      </div>
                      {/* Per-card delete button */}
                      <button
                        className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-red-600 transition-colors"
                        onClick={(e) => handleDelete(img.id, e)}
                        disabled={isDeleting}
                        title="削除"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    <CardContent className="p-3">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(img.createdAt)}
                        </span>
                        {isUnregistered ? (
                          <span className="text-zinc-400 dark:text-zinc-500 font-medium">未登録</span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {itemCount > 0 ? `${itemCount}品目抽出` : `${img._count.priceRecords}件登録済み`}
                          </span>
                        )}
                      </div>
                      {img.store && (
                        <p className="mt-1 text-xs text-zinc-500 flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {img.store.name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-1" />
                  )}
                  もっと見る
                </Button>
              </div>
            )}
          </>
        )}

        {/* Lightbox dialog */}
        <Dialog
          open={!!lightboxImage}
          onOpenChange={(open) => !open && setLightboxImage(null)}
        >
          {/* Hide shadcn's auto-rendered close button — we render our own on the dark bg */}
          <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[90vh] [&>button:last-child]:hidden">
            <DialogTitle className="sr-only">アップロード画像の詳細</DialogTitle>
            {lightboxImage && (
              <div className="flex flex-col max-h-[90vh]">
                {/* Image section with custom close button */}
                <div className="relative bg-zinc-900 flex-shrink-0">
                  <DialogClose className="absolute top-2 right-2 z-50 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/90 transition-colors focus:outline-none focus:ring-2 focus:ring-white">
                    <X className="h-4 w-4" />
                    <span className="sr-only">閉じる</span>
                  </DialogClose>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lightboxImage.signedUrl}
                    alt="アップロード画像"
                    className="w-full max-h-[60vh] object-contain"
                  />
                </div>

                {/* Details — scrollable */}
                <div className="p-4 space-y-2 overflow-y-auto bg-background">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">
                        {SOURCE_TYPE_LABELS[lightboxImage.sourceType]?.label}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={STATUS_LABELS[lightboxImage.status]?.color}
                      >
                        {STATUS_LABELS[lightboxImage.status]?.label}
                      </Badge>
                      {lightboxImage.store && (
                        <Badge variant="outline">
                          <MapPin className="h-3 w-3 mr-1" />
                          {lightboxImage.store.name}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAnalyze(lightboxImage.id)}
                      disabled={analyzingId === lightboxImage.id}
                    >
                      {analyzingId === lightboxImage.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <ScanText className="h-4 w-4 mr-1" />
                      )}
                      {lightboxImage.status === "processed" ? "OCR再実行" : "OCR実行"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => handleDelete(lightboxImage.id)}
                      disabled={deletingIds.has(lightboxImage.id)}
                    >
                      {deletingIds.has(lightboxImage.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      削除
                    </Button>
                  </div>

                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      アップロード: {formatDate(lightboxImage.createdAt)}
                    </span>
                    {lightboxImage.takenAt && (
                      <span className="flex items-center gap-1 mt-1">
                        <Camera className="h-3.5 w-3.5" />
                        撮影: {formatDate(lightboxImage.takenAt)}
                      </span>
                    )}
                  </div>

                  {/* OCR results with checkboxes */}
                  {lightboxImage.ocrResultJson?.items &&
                    lightboxImage.ocrResultJson.items.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-medium">
                            <Eye className="mr-1 inline h-4 w-4" />
                            抽出結果（{lightboxImage.ocrResultJson.items.length}品目）
                          </h4>
                          <div className="flex items-center gap-3 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedItems(
                                  new Set(
                                    lightboxImage.ocrResultJson!.items!.map((_, i) => i),
                                  ),
                                )
                              }
                              className="text-blue-600 underline hover:no-underline dark:text-blue-400"
                            >
                              全選択
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedItems(new Set())}
                              className="text-zinc-500 underline hover:no-underline"
                            >
                              全解除
                            </button>
                          </div>
                        </div>

                        <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
                          {lightboxImage.ocrResultJson.items.map((item, i) => (
                            <label
                              key={i}
                              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            >
                              <input
                                type="checkbox"
                                checked={selectedItems.has(i)}
                                onChange={(e) => {
                                  setSelectedItems((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(i);
                                    else next.delete(i);
                                    return next;
                                  });
                                }}
                                className="h-4 w-4 rounded"
                              />
                              <span className="min-w-0 flex-1 truncate">{item.name}</span>
                              {item.unit && (
                                <span className="shrink-0 text-xs text-zinc-400">{item.unit}</span>
                              )}
                              <span className="shrink-0 font-medium text-green-700 dark:text-green-400">
                                ¥{item.price.toLocaleString()}
                              </span>
                            </label>
                          ))}
                        </div>

                        {registerResult && (
                          <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                            ✓ {registerResult.registered}品目を登録しました
                            {registerResult.errors > 0 && (
                              <span className="ml-1 text-red-500">
                                （失敗: {registerResult.errors}件）
                              </span>
                            )}
                          </p>
                        )}
                        {!lightboxImage.store && (
                          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                            ⚠️ 店舗が設定されていないため登録できません
                          </p>
                        )}

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-zinc-500">
                            {selectedItems.size}品目を選択中
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleRegister(lightboxImage)}
                            disabled={
                              !lightboxImage.store ||
                              selectedItems.size === 0 ||
                              registeringId === lightboxImage.id
                            }
                          >
                            {registeringId === lightboxImage.id ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <PlusCircle className="mr-1 h-4 w-4" />
                            )}
                            選択した {selectedItems.size} 品目を登録
                          </Button>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cleanup confirmation dialog */}
        <Dialog open={cleanupConfirm} onOpenChange={setCleanupConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                未登録画像の一括削除
              </DialogTitle>
              <DialogDescription>
                価格が登録されていない画像を{unregisteredCount}件削除します。
                この操作は取り消せません。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCleanupConfirm(false)}
                disabled={isCleaningUp}
              >
                キャンセル
              </Button>
              <Button
                variant="destructive"
                onClick={handleCleanup}
                disabled={isCleaningUp}
              >
                {isCleaningUp ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                削除する
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
