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
          <Link href="/upload">
            <Button size="sm">
              <Camera className="h-4 w-4 mr-1" />
              新しくアップロード
            </Button>
          </Link>
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

                return (
                  <Card
                    key={img.id}
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setLightboxImage(img)}
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
                    </div>

                    <CardContent className="p-3">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(img.createdAt)}
                        </span>
                        {itemCount > 0 && (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {itemCount}品目抽出
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
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            {lightboxImage && (
              <div>
                {/* Full image */}
                <div className="relative bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lightboxImage.signedUrl}
                    alt="アップロード画像"
                    className="w-full max-h-[70vh] object-contain"
                  />
                </div>

                {/* Details */}
                <div className="p-4 space-y-2">
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
      </main>
    </div>
  );
}
