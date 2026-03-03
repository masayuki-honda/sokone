"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Edit2,
  Trash2,
  Plus,
  Sparkles,
  Eye,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OcrItem {
  name: string;
  price: number;
  unit: string | null;
  volume: string | null;
  category_hint: string | null;
  is_tax_included: boolean;
  confidence: number;
  identified_by: string;
}

interface OcrResult {
  imageId: string;
  signedUrl: string;
  items: OcrItem[];
  store_name?: string | null;
}

interface OcrResultsViewProps {
  results: OcrResult[];
  sourceType: string;
  storeId: string | null;
  onBack: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  if (pct >= 80) {
    return (
      <Badge variant="default" className="bg-green-600 text-xs">
        {pct}%
      </Badge>
    );
  }
  if (pct >= 50) {
    return (
      <Badge variant="secondary" className="text-xs">
        {pct}%
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-xs">
      {pct}%
    </Badge>
  );
}

function IdentifiedByBadge({ identifiedBy }: { identifiedBy: string }) {
  switch (identifiedBy) {
    case "text":
      return (
        <Badge variant="outline" className="text-xs">
          テキスト
        </Badge>
      );
    case "image":
      return (
        <Badge variant="outline" className="text-xs">
          <Eye className="mr-1 h-3 w-3" />
          画像識別
        </Badge>
      );
    case "both":
      return (
        <Badge variant="outline" className="text-xs">
          <Sparkles className="mr-1 h-3 w-3" />
          テキスト+画像
        </Badge>
      );
    default:
      return null;
  }
}

function EditableItem({
  item,
  onUpdate,
  onDelete,
}: {
  item: OcrItem;
  onUpdate: (updated: OcrItem) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editPrice, setEditPrice] = useState(String(item.price));
  const [editUnit, setEditUnit] = useState(item.unit || "");
  const [suggestions, setSuggestions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch product name suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/products?q=${encodeURIComponent(query)}&limit=5`,
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.products || []);
        setShowSuggestions(true);
      }
    } catch {
      // Ignore suggestion errors
    }
  }, []);

  function handleNameChange(value: string) {
    setEditName(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  }

  function handleSelectSuggestion(suggestion: { id: string; name: string }) {
    setEditName(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSave() {
    onUpdate({
      ...item,
      name: editName,
      price: parseInt(editPrice) || item.price,
      unit: editUnit || null,
    });
    setIsEditing(false);
  }

  function handleCancel() {
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditUnit(item.unit || "");
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3">
        <div className="relative grid grid-cols-3 gap-2">
          <div className="relative col-span-2" ref={suggestionsRef}>
            <Input
              value={editName}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="商品名"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                    onClick={() => handleSelectSuggestion(s)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Input
            type="number"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            placeholder="価格"
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={editUnit}
            onChange={(e) => setEditUnit(e.target.value)}
            placeholder="単位（個/袋/本等）"
            className="w-40"
          />
          <div className="flex-1" />
          <Button size="sm" onClick={handleSave}>
            <Check className="mr-1 h-3 w-3" />
            保存
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            キャンセル
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.name}</span>
          {item.volume && (
            <span className="text-sm text-muted-foreground">
              {item.volume}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {item.unit && (
            <span className="text-xs text-muted-foreground">
              {item.unit}
            </span>
          )}
          {item.category_hint && (
            <Badge variant="outline" className="text-xs">
              {item.category_hint}
            </Badge>
          )}
          <IdentifiedByBadge identifiedBy={item.identified_by} />
          <ConfidenceBadge confidence={item.confidence} />
        </div>
      </div>
      <div className="text-right">
        <span className="text-lg font-bold">
          ¥{item.price.toLocaleString()}
        </span>
        {!item.is_tax_included && (
          <span className="block text-xs text-muted-foreground">
            (税込換算)
          </span>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function OcrResultsView({
  results,
  sourceType,
  storeId,
  onBack,
}: OcrResultsViewProps) {
  const router = useRouter();
  const [editableResults, setEditableResults] = useState(results);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(
    null,
  );
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  function handleUpdateItem(
    resultIndex: number,
    itemIndex: number,
    updated: OcrItem,
  ) {
    setEditableResults((prev) =>
      prev.map((r, ri) => {
        if (ri !== resultIndex) return r;
        return {
          ...r,
          items: r.items.map((item, ii) =>
            ii === itemIndex ? updated : item,
          ),
        };
      }),
    );
  }

  function handleDeleteItem(resultIndex: number, itemIndex: number) {
    setEditableResults((prev) =>
      prev.map((r, ri) => {
        if (ri !== resultIndex) return r;
        return {
          ...r,
          items: r.items.filter((_, ii) => ii !== itemIndex),
        };
      }),
    );
  }

  function handleAddItem(resultIndex: number) {
    setEditableResults((prev) =>
      prev.map((r, ri) => {
        if (ri !== resultIndex) return r;
        return {
          ...r,
          items: [
            ...r.items,
            {
              name: "",
              price: 0,
              unit: null,
              volume: null,
              category_hint: null,
              is_tax_included: true,
              confidence: 1.0,
              identified_by: "text",
            },
          ],
        };
      }),
    );
  }

  // Register prices via API
  async function handleRegisterPrices() {
    if (!storeId) {
      setRegistrationError("店舗を選択してください。戻って店舗を選択し直してください。");
      return;
    }

    const allItems = editableResults.flatMap((r) =>
      r.items.map((item) => ({
        name: item.name,
        price: item.price,
        unit: item.unit,
        volume: item.volume,
        category_hint: item.category_hint,
        is_tax_included: item.is_tax_included,
      })),
    );

    if (allItems.length === 0) {
      setRegistrationError("登録する商品がありません");
      return;
    }

    // Validate items have names and positive prices
    const invalidItems = allItems.filter((item) => !item.name || item.price <= 0);
    if (invalidItems.length > 0) {
      setRegistrationError("商品名と正の価格が入力されていない商品があります");
      return;
    }

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      // Register for each image (to link sourceImageId)
      const allResults = [];
      const allErrors = [];

      for (const result of editableResults) {
        if (result.items.length === 0) continue;

        const res = await fetch("/api/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: result.items.map((item) => ({
              name: item.name,
              price: item.price,
              unit: item.unit,
              volume: item.volume,
              category_hint: item.category_hint,
              is_tax_included: item.is_tax_included,
            })),
            storeId,
            sourceType,
            sourceImageId: result.imageId,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          allErrors.push(data.error || "価格の登録に失敗しました");
          continue;
        }

        allResults.push(...(data.results || []));
        allErrors.push(...(data.errors || []));
      }

      if (allErrors.length > 0 && allResults.length === 0) {
        setRegistrationError(
          `登録に失敗しました: ${allErrors.map((e: { error?: string } | string) => (typeof e === "string" ? e : e.error)).join(", ")}`,
        );
      } else {
        setRegistrationSuccess(true);
        // Navigate to dashboard after short delay
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      }
    } catch (error) {
      console.error("Price registration error:", error);
      setRegistrationError("ネットワークエラーが発生しました");
    } finally {
      setIsRegistering(false);
    }
  }

  const totalItems = editableResults.reduce(
    (sum, r) => sum + r.items.length,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">解析結果</h2>
            <p className="text-sm text-muted-foreground">
              {editableResults.length}枚の画像から{totalItems}
              件の商品を検出しました
            </p>
          </div>
        </div>
        <Button
          size="lg"
          disabled={totalItems === 0 || isRegistering || registrationSuccess}
          onClick={handleRegisterPrices}
        >
          {isRegistering ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              登録中...
            </>
          ) : registrationSuccess ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              登録完了！
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              すべて確認して登録（{totalItems}件）
            </>
          )}
        </Button>
      </div>

      {/* Error/Success messages */}
      {registrationError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {registrationError}
        </div>
      )}
      {registrationSuccess && (
        <div className="rounded-lg border border-green-500 bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {totalItems}件の価格を登録しました。ダッシュボードに移動します...
        </div>
      )}

      {/* Results per image */}
      {editableResults.map((result, resultIndex) => (
        <Card key={result.imageId}>
          <CardHeader>
            <div className="flex items-start gap-4">
              {/* Image preview */}
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border bg-muted">
                {result.signedUrl ? (
                  <img
                    src={result.signedUrl}
                    alt="アップロード画像"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">
                  画像 {resultIndex + 1}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.items.length}件の商品を検出
                </p>
                {result.store_name && (
                  <Badge variant="secondary" className="mt-1">
                    店舗: {result.store_name}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.items.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                この画像から商品を検出できませんでした
              </p>
            ) : (
              result.items.map((item, itemIndex) => (
                <EditableItem
                  key={`${resultIndex}-${itemIndex}`}
                  item={item}
                  onUpdate={(updated) =>
                    handleUpdateItem(resultIndex, itemIndex, updated)
                  }
                  onDelete={() =>
                    handleDeleteItem(resultIndex, itemIndex)
                  }
                />
              ))
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => handleAddItem(resultIndex)}
            >
              <Plus className="mr-1 h-3 w-3" />
              商品を手動追加
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
