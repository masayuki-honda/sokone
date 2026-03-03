"use client";

import { useState, useEffect } from "react";
import { Plus, Store as StoreIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Store {
  id: string;
  name: string;
  address?: string | null;
}

interface StoreSelectProps {
  value: string | null;
  onChange: (storeId: string | null, storeName?: string) => void;
}

export function StoreSelect({ value, onChange }: StoreSelectProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewStore, setShowNewStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  async function fetchStores() {
    try {
      const res = await fetch("/api/stores");
      if (res.ok) {
        const data = await res.json();
        setStores(data);
      }
    } catch (error) {
      console.error("Failed to fetch stores:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStore() {
    if (!newStoreName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStoreName.trim(),
          address: newStoreAddress.trim() || null,
        }),
      });

      if (res.ok) {
        const store = await res.json();
        setStores((prev) => [store, ...prev]);
        onChange(store.id, store.name);
        setShowNewStore(false);
        setNewStoreName("");
        setNewStoreAddress("");
      }
    } catch (error) {
      console.error("Failed to create store:", error);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <StoreIcon className="h-4 w-4" />
        店舗を読み込み中...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>店舗</Label>

      <div className="flex gap-2">
        <Select
          value={value || "__none__"}
          onValueChange={(val) => {
            if (val === "__none__") {
              onChange(null);
            } else if (val === "__new__") {
              setShowNewStore(true);
            } else {
              const store = stores.find((s) => s.id === val);
              onChange(val, store?.name);
            }
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="店舗を選択（任意）" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">あとで設定</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
                {store.address && (
                  <span className="ml-1 text-muted-foreground">
                    ({store.address})
                  </span>
                )}
              </SelectItem>
            ))}
            <SelectItem value="__new__">
              <span className="flex items-center gap-1">
                <Plus className="h-3 w-3" />
                新しい店舗を追加
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inline new store form */}
      {showNewStore && (
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <p className="text-sm font-medium">新しい店舗を追加</p>
          <div className="space-y-2">
            <Input
              placeholder="店舗名（必須）"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              disabled={creating}
            />
            <div className="space-y-1">
              <Input
                placeholder="住所（任意）"
                value={newStoreAddress}
                onChange={(e) => setNewStoreAddress(e.target.value)}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                📍 住所を入力すると座標を自動取得し、写真のGPSから店舗を自動選択できます
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreateStore}
              disabled={!newStoreName.trim() || creating}
            >
              {creating ? "作成中..." : "追加"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowNewStore(false);
                setNewStoreName("");
                setNewStoreAddress("");
              }}
              disabled={creating}
            >
              キャンセル
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
