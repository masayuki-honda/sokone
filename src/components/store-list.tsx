"use client";

import { useState, useEffect, useCallback } from "react";

interface Store {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export function StoreList() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch("/api/stores");
      if (!res.ok) throw new Error("店舗一覧の取得に失敗しました");
      const data = await res.json();
      setStores(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const openAddForm = () => {
    setEditingStore(null);
    setFormName("");
    setFormAddress("");
    setShowForm(true);
  };

  const openEditForm = (store: Store) => {
    setEditingStore(store);
    setFormName(store.name);
    setFormAddress(store.address || "");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingStore(null);
    setFormName("");
    setFormAddress("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = editingStore
        ? `/api/stores/${editingStore.id}`
        : "/api/stores";
      const method = editingStore ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          address: formAddress || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存に失敗しました");
      }

      closeForm();
      await fetchStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (store: Store) => {
    if (!confirm(`「${store.name}」を削除しますか？`)) return;

    try {
      const res = await fetch(`/api/stores/${store.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "削除に失敗しました");
      }
      await fetchStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-zinc-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            閉じる
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {stores.length} 件の店舗
        </p>
        <button
          onClick={openAddForm}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + 店舗を追加
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h3 className="mb-4 text-lg font-semibold">
            {editingStore ? "店舗を編集" : "新しい店舗を追加"}
          </h3>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="store-name"
                className="mb-1 block text-sm font-medium"
              >
                店舗名 <span className="text-red-500">*</span>
              </label>
              <input
                id="store-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例: イオン 横浜店"
                required
                maxLength={100}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label
                htmlFor="store-address"
                className="mb-1 block text-sm font-medium"
              >
                住所
              </label>
              <input
                id="store-address"
                type="text"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="例: 横浜市西区みなとみらい1-1-1"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {submitting
                ? "保存中..."
                : editingStore
                  ? "更新"
                  : "追加"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* Store List */}
      {stores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-zinc-500">
            まだ店舗が登録されていません。
            <br />
            「+ 店舗を追加」から最初の店舗を登録しましょう。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map((store) => (
            <div
              key={store.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <h3 className="font-medium">{store.name}</h3>
                {store.address && (
                  <p className="mt-0.5 text-sm text-zinc-500">
                    📍 {store.address}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditForm(store)}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(store)}
                  className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
