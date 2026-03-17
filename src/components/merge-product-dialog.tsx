"use client";

import { useState, useEffect } from "react";
import { Search, X, Loader2, GitMerge } from "lucide-react";
import { Input } from "@/components/ui/input";
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

interface MergeProduct {
  id: string;
  name: string;
  recordCount: number;
}

interface SimilarProduct {
  id: string;
  name: string;
  recordCount: number;
  similarity: number;
}

interface MergeProductDialogProps {
  /** The source product to merge (or null to close) */
  source: MergeProduct | null;
  /** Called when the dialog should close */
  onClose: () => void;
  /** Called after a successful merge with the target product ID */
  onMerged: (sourceId: string, targetId: string) => void;
}

export function MergeProductDialog({
  source,
  onClose,
  onMerged,
}: MergeProductDialogProps) {
  const [mergeSearch, setMergeSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MergeProduct[]>([]);
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  const [target, setTarget] = useState<MergeProduct | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Reset state when source changes
  useEffect(() => {
    if (source) {
      setMergeSearch("");
      setSearchResults([]);
      setTarget(null);
      setError(null);
      setIsMerging(false);
      // Fetch similar products
      setLoadingSimilar(true);
      fetch(`/api/products/${source.id}/similar`)
        .then((r) => r.json())
        .then((data) => setSimilarProducts(data.similar || []))
        .catch(() => setSimilarProducts([]))
        .finally(() => setLoadingSimilar(false));
    } else {
      setSimilarProducts([]);
    }
  }, [source]);

  // Search for merge target
  useEffect(() => {
    if (!mergeSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?q=${encodeURIComponent(mergeSearch)}&limit=10`,
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            (data.products || [])
              .filter(
                (p: { id: string }) => p.id !== source?.id,
              )
              .map((p: { id: string; name: string; _count?: { priceRecords: number } }) => ({
                id: p.id,
                name: p.name,
                recordCount: p._count?.priceRecords ?? 0,
              })),
          );
        }
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mergeSearch, source]);

  async function handleMerge() {
    if (!source || !target) return;
    setIsMerging(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${source.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProductId: target.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "統合に失敗しました");
        return;
      }
      onMerged(source.id, target.id);
      onClose();
    } catch {
      setError("統合中にエラーが発生しました");
    } finally {
      setIsMerging(false);
    }
  }

  function selectTarget(product: MergeProduct) {
    setTarget(product);
    setMergeSearch(product.name);
    setSearchResults([]);
  }

  return (
    <Dialog open={!!source} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>商品を統合</DialogTitle>
          <DialogDescription>
            「{source?.name}」を別の商品に統合します。
            価格記録がすべて統合先に移動し、元の商品名は自動的にエイリアスとして保存されます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source info */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">統合元（削除される）</p>
            <p className="font-medium">{source?.name}</p>
            <p className="text-xs text-muted-foreground">
              {source?.recordCount}件の価格記録
            </p>
          </div>

          {/* Similar product suggestions */}
          {!target && similarProducts.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">💡 類似商品（統合候補）</p>
              <div className="rounded-md border bg-background shadow-sm max-h-36 overflow-y-auto">
                {similarProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between"
                    onClick={() => selectTarget({ id: p.id, name: p.name, recordCount: p.recordCount })}
                  >
                    <span>{p.name}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        類似度 {Math.round(p.similarity * 100)}%
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {p.recordCount}件
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!target && loadingSimilar && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              類似商品を検索中...
            </p>
          )}

          {/* Target search */}
          <div>
            <p className="text-sm font-medium mb-2">統合先を検索</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="商品名で検索..."
                value={mergeSearch}
                onChange={(e) => {
                  setMergeSearch(e.target.value);
                  setTarget(null);
                }}
                className="pl-10"
              />
            </div>
            {searchResults.length > 0 && !target && (
              <div className="mt-1 rounded-md border bg-background shadow-sm max-h-48 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between"
                    onClick={() => selectTarget(p)}
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.recordCount}件
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected target */}
          {target && (
            <div className="rounded-lg border border-green-400 bg-green-50 dark:bg-green-950 p-3 text-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">統合先（残る）</p>
                <p className="font-medium">{target.name}</p>
                <p className="text-xs text-muted-foreground">
                  {target.recordCount}件の価格記録
                </p>
              </div>
              <button
                onClick={() => { setTarget(null); setMergeSearch(""); }}
                className="rounded-full p-1 hover:bg-green-100 dark:hover:bg-green-900"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isMerging}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            disabled={!target || isMerging}
            onClick={handleMerge}
          >
            {isMerging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                統合中...
              </>
            ) : (
              <>
                <GitMerge className="mr-2 h-4 w-4" />
                統合する
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
