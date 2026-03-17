"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Store,
  ImageOff,
  Loader2,
  Tag,
  Flame,
} from "lucide-react";
// ---- types ------------------------------------------------------------------

interface PendingItem {
  id: string;
  productName: string;
  price: number;
  unit: string | null;
  volume: string | null;
  confidence: number;
  saleDate: string | null;
  categoryHint: string | null;
}

interface LeafletImage {
  id: string;
  signedUrl: string | null;
  status: string;
}

interface Leaflet {
  id: string;
  leafletId: string;
  title: string | null;
  storeId: string;
  storeName: string;
  pageCount: number;
  validFrom: string | null;
  validTo: string | null;
  scrapedAt: string;
  images: LeafletImage[];
  pendingItems: PendingItem[];
}

// ---- helpers ----------------------------------------------------------------

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS_JA[d.getDay()]})`;
}

function fmtValidRange(from: string | null, to: string | null): string {
  if (from && to) return `${fmtDate(from)} 〜 ${fmtDate(to)}`;
  if (from) return `${fmtDate(from)} 〜`;
  if (to) return `〜 ${fmtDate(to)}`;
  return "";
}

function isTodaySaleDate(saleDate: string | null): boolean {
  if (!saleDate) return false;
  const today = new Date();
  const d = new Date(saleDate);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function isCurrentlyActive(validFrom: string | null, validTo: string | null): boolean {
  const now = Date.now();
  if (validFrom && new Date(validFrom).getTime() > now) return false;
  if (validTo && new Date(validTo).getTime() < now) return false;
  return true;
}

// Group pending items by saleDate for display
function groupByDate(items: PendingItem[]): Map<string, PendingItem[]> {
  const groups = new Map<string, PendingItem[]>();
  for (const item of items) {
    const key = item.saleDate ?? "date_unknown";
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }
  return groups;
}

// ---- sub-components ---------------------------------------------------------

function ImageCarousel({ images }: { images: LeafletImage[] }) {
  const [index, setIndex] = useState(0);
  const validImages = images.filter((img) => img.signedUrl);

  if (validImages.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-muted rounded-lg text-muted-foreground gap-2">
        <ImageOff className="h-5 w-5" />
        <span className="text-sm">画像なし</span>
      </div>
    );
  }

  const current = validImages[index];

  return (
    <div className="relative">
      <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.signedUrl!}
          alt={`チラシ ${index + 1}ページ目`}
          className="w-full h-full object-contain"
        />
      </div>

      {validImages.length > 1 && (
        <div className="flex items-center justify-between mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {index + 1} / {validImages.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndex((i) => Math.min(validImages.length - 1, i + 1))}
            disabled={index === validImages.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SaleItemsSection({ items }: { items: PendingItem[] }) {
  if (items.length === 0) return null;

  const grouped = groupByDate(items);
  const today = new Date().toDateString();

  const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
    if (a === "date_unknown") return 1;
    if (b === "date_unknown") return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <div className="mt-4 space-y-3">
      {sortedKeys.map((key) => {
        const dayItems = grouped.get(key)!;
        const isToday =
          key !== "date_unknown" && new Date(key).toDateString() === today;

        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {key === "date_unknown"
                  ? "日付不明"
                  : fmtDate(key)}
              </span>
              {isToday && (
                <Badge className="bg-red-500 text-white text-xs gap-1">
                  <Flame className="h-3 w-3" />
                  今日の特売
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {dayItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm ${
                    isToday
                      ? "border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800"
                      : "border-border bg-muted/40"
                  }`}
                >
                  <span className="font-medium truncate mr-2">
                    {item.productName}
                    {item.volume && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        {item.volume}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-bold text-primary">
                    ¥{item.price.toLocaleString()}
                    {item.unit && (
                      <span className="font-normal text-muted-foreground text-xs ml-0.5">
                        /{item.unit}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeafletCard({ leaflet }: { leaflet: Leaflet }) {
  const active = isCurrentlyActive(leaflet.validFrom, leaflet.validTo);
  const hasTodayItems = leaflet.pendingItems.some((i) => isTodaySaleDate(i.saleDate));
  const validRange = fmtValidRange(leaflet.validFrom, leaflet.validTo);

  return (
    <Card className={`${hasTodayItems ? "ring-2 ring-red-400" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{leaflet.storeName}</span>
            </div>
            {leaflet.title && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {leaflet.title}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {active && (
              <Badge variant="default" className="text-xs">開催中</Badge>
            )}
            {hasTodayItems && (
              <Badge className="bg-red-500 text-white text-xs gap-1">
                <Flame className="h-3 w-3" />
                今日の特売あり
              </Badge>
            )}
          </div>
        </div>

        {validRange && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{validRange}</span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <ImageCarousel images={leaflet.images} />
        <SaleItemsSection items={leaflet.pendingItems} />
      </CardContent>
    </Card>
  );
}

// ---- main page --------------------------------------------------------------

export default function LeafletsPage() {
  const [leaflets, setLeaflets] = useState<Leaflet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);

  const fetchLeaflets = async (active: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaflets?limit=20${active ? "&active=1" : ""}`);
      if (!res.ok) throw new Error("Failed to fetch");
      setLeaflets(await res.json());
    } catch {
      setLeaflets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaflets(activeOnly);
  }, [activeOnly]);

  const hasTodayLeaflets = leaflets.some((l) =>
    l.pendingItems.some((i) => isTodaySaleDate(i.saleDate))
  );

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">チラシ一覧</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              自動収集されたチラシを確認できます
            </p>
          </div>
          <Button
            variant={activeOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveOnly((v) => !v)}
          >
            <CalendarDays className="h-4 w-4 mr-1.5" />
            {activeOnly ? "開催中のみ" : "すべて表示"}
          </Button>
        </div>

        {hasTodayLeaflets && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <Flame className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              今日の特売商品があるチラシがあります
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : leaflets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
            <Tag className="h-10 w-10" />
            <p className="text-sm">チラシが見つかりません</p>
            <p className="text-xs">
              {activeOnly
                ? "現在有効なチラシがありません。フィルターを解除してみてください。"
                : "まだチラシが収集されていません。店舗を登録してスクレイピングを実行してください。"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {leaflets.map((leaflet) => (
              <LeafletCard key={leaflet.id} leaflet={leaflet} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
