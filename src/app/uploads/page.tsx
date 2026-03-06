"use client";

import { useState, useEffect, useCallback } from "react";
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
  status: "pending" | "processed" | "failed";
  createdAt: string;
  takenAt: string | null;
  store: { id: string; name: string } | null;
  ocrResultJson: OcrResult | null;
  _count: { priceRecords: number };
}

interface OcrResult {
  items?: Array<{
    name: string;
    price: number;
  }>;
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
                    onClick={() => !isDeleting && setLightboxImage(img)}
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

                  {/* OCR results summary */}
                  {lightboxImage.ocrResultJson?.items &&
                    lightboxImage.ocrResultJson.items.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <h4 className="text-sm font-medium mb-2">
                          <Eye className="h-4 w-4 inline mr-1" />
                          抽出結果（{lightboxImage.ocrResultJson.items.length}品目）
                        </h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {lightboxImage.ocrResultJson.items.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="truncate flex-1">
                                {item.name}
                              </span>
                              <span className="font-medium ml-2 text-green-700 dark:text-green-400">
                                ¥{item.price.toLocaleString()}
                              </span>
                            </div>
                          ))}
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
