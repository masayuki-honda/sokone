"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, AlertTriangle } from "lucide-react";

interface OcrItem {
  name: string;
  price: number;
  unit: string | null;
  volume: string | null;
  category_hint: string | null;
  is_tax_included: boolean;
  confidence: number;
  identified_by: string;
  productId?: string | null;
  excluded?: boolean;
}

interface BulkEditTableProps {
  results: Array<{
    imageId: string;
    items: OcrItem[];
  }>;
  onUpdateItem: (resultIndex: number, itemIndex: number, updated: OcrItem) => void;
  onDeleteItem: (resultIndex: number, itemIndex: number) => void;
  onAddItem: (resultIndex: number) => void;
  onToggleItem: (resultIndex: number, itemIndex: number, excluded: boolean) => void;
}

export function BulkEditTable({
  results,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onToggleItem,
}: BulkEditTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  // Build a flat list of rows for keyboard navigation
  const rows: Array<{ resultIndex: number; itemIndex: number; item: OcrItem }> = [];
  results.forEach((result, ri) => {
    result.items.forEach((item, ii) => {
      rows.push({ resultIndex: ri, itemIndex: ii, item });
    });
  });

  function handleKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colName: string
  ) {
    if (e.key === "Tab" || e.key === "Enter") {
      // Let Tab work as expected for natural navigation
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const nextRow = e.key === "ArrowDown" ? rowIdx + 1 : rowIdx - 1;
      if (nextRow >= 0 && nextRow < rows.length) {
        const input = tableRef.current?.querySelector<HTMLInputElement>(
          `[data-row="${nextRow}"][data-col="${colName}"]`
        );
        input?.focus();
        input?.select();
      }
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table ref={tableRef} className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="w-10 px-2 py-2 text-center">
              <span className="sr-only">選択</span>
            </th>
            <th className="px-2 py-2 text-left font-medium">商品名</th>
            <th className="w-28 px-2 py-2 text-left font-medium">価格(税込)</th>
            <th className="w-24 px-2 py-2 text-left font-medium">単位</th>
            <th className="w-20 px-2 py-2 text-center font-medium">信頼度</th>
            <th className="w-28 px-2 py-2 text-left font-medium">カテゴリ</th>
            <th className="w-10 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {results.map((result, ri) => (
            <ImageSection
              key={result.imageId}
              resultIndex={ri}
              items={result.items}
              imageNumber={ri + 1}
              showImageHeader={results.length > 1}
              globalRowOffset={rows.findIndex(
                (r) => r.resultIndex === ri && r.itemIndex === 0
              )}
              totalRows={rows.length}
              onUpdate={onUpdateItem}
              onDelete={onDeleteItem}
              onAdd={onAddItem}
              onToggle={onToggleItem}
              onKeyDown={handleKeyDown}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImageSection({
  resultIndex,
  items,
  imageNumber,
  showImageHeader,
  globalRowOffset,
  totalRows: _totalRows,
  onUpdate,
  onDelete,
  onAdd,
  onToggle,
  onKeyDown,
}: {
  resultIndex: number;
  items: OcrItem[];
  imageNumber: number;
  showImageHeader: boolean;
  globalRowOffset: number;
  totalRows: number;
  onUpdate: (ri: number, ii: number, updated: OcrItem) => void;
  onDelete: (ri: number, ii: number) => void;
  onAdd: (ri: number) => void;
  onToggle: (ri: number, ii: number, excluded: boolean) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colName: string) => void;
}) {
  return (
    <>
      {showImageHeader && (
        <tr className="border-b bg-muted/30">
          <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            画像 {imageNumber}（{items.filter((i) => !i.excluded).length}/{items.length}件）
          </td>
        </tr>
      )}
      {items.map((item, ii) => (
        <EditableRow
          key={`${resultIndex}-${ii}`}
          item={item}
          resultIndex={resultIndex}
          itemIndex={ii}
          globalRowIndex={globalRowOffset + ii}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onToggle={onToggle}
          onKeyDown={onKeyDown}
        />
      ))}
      <tr className="border-b">
        <td colSpan={7} className="px-2 py-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => onAdd(resultIndex)}
          >
            <Plus className="mr-1 h-3 w-3" />
            行を追加
          </Button>
        </td>
      </tr>
    </>
  );
}

function EditableRow({
  item,
  resultIndex,
  itemIndex,
  globalRowIndex,
  onUpdate,
  onDelete,
  onToggle,
  onKeyDown,
}: {
  item: OcrItem;
  resultIndex: number;
  itemIndex: number;
  globalRowIndex: number;
  onUpdate: (ri: number, ii: number, updated: OcrItem) => void;
  onDelete: (ri: number, ii: number) => void;
  onToggle: (ri: number, ii: number, excluded: boolean) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colName: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [unit, setUnit] = useState(item.unit || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitUpdate = useCallback(
    (updates: Partial<OcrItem>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate(resultIndex, itemIndex, { ...item, ...updates });
      }, 300);
    },
    [item, resultIndex, itemIndex, onUpdate]
  );

  const excluded = item.excluded ?? false;
  const pct = Math.round(item.confidence * 100);

  return (
    <tr className={`border-b transition-colors hover:bg-muted/30 ${excluded ? "opacity-40" : ""}`}>
      <td className="px-2 py-1.5 text-center">
        <input
          type="checkbox"
          checked={!excluded}
          onChange={(e) => onToggle(resultIndex, itemIndex, !e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-primary"
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          data-row={globalRowIndex}
          data-col="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            commitUpdate({ name: e.target.value });
          }}
          onKeyDown={(e) => onKeyDown(e, globalRowIndex, "name")}
          className="h-8 text-sm"
          placeholder="商品名"
        />
      </td>
      <td className="px-2 py-1.5">
        <div className="relative">
          <Input
            data-row={globalRowIndex}
            data-col="price"
            type="number"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              const p = parseInt(e.target.value);
              if (!isNaN(p) && p > 0) commitUpdate({ price: p });
            }}
            onKeyDown={(e) => onKeyDown(e, globalRowIndex, "price")}
            className="h-8 text-sm"
            placeholder="¥"
          />
          {item.confidence < 0.6 && (
            <AlertTriangle className="absolute right-2 top-1.5 h-4 w-4 text-amber-500" />
          )}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <Input
          data-row={globalRowIndex}
          data-col="unit"
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value);
            commitUpdate({ unit: e.target.value || null });
          }}
          onKeyDown={(e) => onKeyDown(e, globalRowIndex, "unit")}
          className="h-8 text-sm"
          placeholder="個/袋"
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <Badge
          variant={pct >= 80 ? "default" : pct >= 50 ? "secondary" : "destructive"}
          className={`text-xs ${pct >= 80 ? "bg-green-600" : ""}`}
        >
          {pct}%
        </Badge>
      </td>
      <td className="px-2 py-1.5">
        {item.category_hint && (
          <span className="text-xs text-muted-foreground">{item.category_hint}</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => onDelete(resultIndex, itemIndex)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}
