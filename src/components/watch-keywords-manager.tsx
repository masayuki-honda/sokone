"use client";

import { useState, useEffect } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface WatchKeyword {
  id: string;
  keyword: string;
  createdAt: string;
}

export function WatchKeywordsManager() {
  const [keywords, setKeywords] = useState<WatchKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/watch-keywords")
      .then((r) => r.json())
      .then((data) => setKeywords(data.keywords ?? []))
      .catch(() => toast.error("キーワードの読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    const keyword = newKeyword.trim();
    if (!keyword) return;

    setIsAdding(true);
    try {
      const res = await fetch("/api/watch-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "追加に失敗しました");
        return;
      }
      setKeywords((prev) => [...prev, data.keyword]);
      setNewKeyword("");
      toast.success(`「${keyword}」を追加しました`);
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(id: string, keyword: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/watch-keywords/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("削除に失敗しました");
        return;
      }
      setKeywords((prev) => prev.filter((k) => k.id !== id));
      toast.success(`「${keyword}」を削除しました`);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        キーワードを登録すると、チラシ・レシートのOCR結果から一致する商品のみが自動的に登録対象として選択されます。
        チェックボックスで個別に変更することも可能です。
      </p>

      {/* Keyword badges */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          読み込み中...
        </div>
      ) : keywords.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          キーワードが登録されていません。フィルタなしで全商品が登録対象になります。
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {keywords.map((kw) => (
            <Badge
              key={kw.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1 text-sm"
            >
              {kw.keyword}
              <button
                type="button"
                onClick={() => handleDelete(kw.id, kw.keyword)}
                disabled={deletingId === kw.id}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:opacity-50"
                aria-label={`${kw.keyword}を削除`}
              >
                {deletingId === kw.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add keyword form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
        className="flex gap-2"
      >
        <Input
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          placeholder="例: 牛肉、鶏もも、豚バラ"
          maxLength={50}
          className="max-w-xs"
          disabled={isAdding}
        />
        <Button type="submit" size="sm" disabled={!newKeyword.trim() || isAdding}>
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="mr-1 h-4 w-4" />
              追加
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
