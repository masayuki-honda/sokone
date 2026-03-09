"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

interface Store {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  tokubaiShopUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ScrapeResult {
  message: string;
  scraped: number;
  alreadyExists: number;
  imageIds: string[];
  errors: string[];
}

export function StoreList() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geocodingId, setGeocodingId] = useState<string | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // Add/Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formLatitude, setFormLatitude] = useState("");
  const [formLongitude, setFormLongitude] = useState("");
  const [formTokubaiShopUrl, setFormTokubaiShopUrl] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [pipelineRunningId, setPipelineRunningId] = useState<string | null>(null);
  const [scrapeResults, setScrapeResults] = useState<Record<string, ScrapeResult>>({});
  const formRef = useRef<HTMLFormElement>(null);

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
    setFormLatitude("");
    setFormLongitude("");
    setFormTokubaiShopUrl("");
    setShowForm(true);
  };

  const openEditForm = (store: Store) => {
    setEditingStore(store);
    setFormName(store.name);
    setFormAddress(store.address || "");
    setFormLatitude(store.latitude != null ? String(store.latitude) : "");
    setFormLongitude(store.longitude != null ? String(store.longitude) : "");
    setFormTokubaiShopUrl(store.tokubaiShopUrl || "");
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingStore(null);
    setFormName("");
    setFormAddress("");
    setFormLatitude("");
    setFormLongitude("");
    setFormTokubaiShopUrl("");
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("このブラウザは位置情報に対応していません");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLatitude(String(pos.coords.latitude));
        setFormLongitude(String(pos.coords.longitude));
        setGettingLocation(false);
      },
      () => {
        toast.error("位置情報の取得に失敗しました。ブラウザの位置情報許可を確認してください。");
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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

      const parsedLat = formLatitude !== "" ? parseFloat(formLatitude) : null;
      const parsedLng = formLongitude !== "" ? parseFloat(formLongitude) : null;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          address: formAddress || null,
          latitude: parsedLat != null && isFinite(parsedLat) ? parsedLat : null,
          longitude: parsedLng != null && isFinite(parsedLng) ? parsedLng : null,
          tokubaiShopUrl: formTokubaiShopUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存に失敗しました");
      }

      closeForm();
      await fetchStores();
      toast.success(editingStore ? "店舗を更新しました" : "店舗を追加しました");
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
      toast.success(`「${store.name}」を削除しました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  const handleGeocode = async (store: Store) => {
    setGeocodingId(store.id);
    setGeocodeError(null);
    try {
      const res = await fetch(`/api/stores/${store.id}/geocode`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setGeocodeError(`「${store.name}」: ${data.error}`);
      } else {
        setStores((prev) =>
          prev.map((s) => (s.id === store.id ? data : s))
        );
      }
    } catch {
      setGeocodeError("通信エラーが発生しました");
    } finally {
      setGeocodingId(null);
    }
  };

  const handleScrape = async (store: Store, force = false) => {
    setScrapingId(store.id);
    try {
      const res = await fetch(`/api/stores/${store.id}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "スクレイピングに失敗しました");
      } else {
        setScrapeResults((prev) => ({ ...prev, [store.id]: data }));
        if (data.scraped > 0) {
          toast.success(`${data.scraped} 枚の画像を取り込みました。アップロード履歴からOCRを実行してください。`);
        } else {
          toast.info(data.message || "新しいチラシはありませんでした");
        }
      }
    } catch {
      toast.error("通信エラーが発生しました");
    } finally {
      setScrapingId(null);
    }
  };

  const handlePipeline = async (store: Store) => {
    setPipelineRunningId(store.id);
    try {
      const res = await fetch(`/api/stores/${store.id}/pipeline`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "自動取得に失敗しました");
      } else {
        const msg = `画像 ${data.imagesScraped} 枚取得 → OCR ${data.imagesOcred} 枚処理 → 価格 ${data.pricesRegistered} 件登録`;
        if (data.pricesRegistered > 0) {
          toast.success(msg);
        } else if (data.imagesScraped === 0) {
          toast.info("新しいチラシはありませんでした");
        } else {
          toast.info(msg);
        }
      }
    } catch {
      toast.error("通信エラーが発生しました");
    } finally {
      setPipelineRunningId(null);
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

      {geocodeError && (
        <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
          📍 GPS取得失敗: {geocodeError}
          <button
            onClick={() => setGeocodeError(null)}
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
          ref={formRef}
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
              <p className="mt-1 text-xs text-zinc-500">
                住所を入力すると座標を自動取得します。うまくいかない場合は下の手動入力をご利用ください。
              </p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium">GPS座標（手動入力）</label>
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={gettingLocation}
                  className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {gettingLocation ? "取得中..." : "📍 現在地を使う"}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={formLatitude}
                  onChange={(e) => setFormLatitude(e.target.value)}
                  placeholder="緯度 例: 35.4478"
                  step="any"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  type="number"
                  value={formLongitude}
                  onChange={(e) => setFormLongitude(e.target.value)}
                  placeholder="経度 例: 139.6425"
                  step="any"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                空欄にすると住所から自動取得します。座標は
                <a
                  href="https://maps.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:no-underline"
                >
                  Google マップ
                </a>
                で右クリック→コピーでも確認できます。
              </p>
            </div>
            <div>
              <label
                htmlFor="store-tokubai-url"
                className="mb-1 block text-sm font-medium"
              >
                チラシ取得URL（トクバイ）
              </label>
              <input
                id="store-tokubai-url"
                type="text"
                value={formTokubaiShopUrl}
                onChange={(e) => setFormTokubaiShopUrl(e.target.value)}
                placeholder="例: https://tokubai.co.jp/ライフ/2330"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <p className="mt-1 text-xs text-zinc-500">
                tokubai.co.jp の店舗ページURLを入力すると「チラシ取得」ボタンでチラシ画像を自動取り込みできます。
              </p>
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
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{store.name}</h3>
                  {store.address && (
                    <p className="mt-0.5 text-sm text-zinc-500 break-words">
                      {store.address}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs">
                    {store.latitude != null && store.longitude != null ? (
                      <span className="text-green-600 dark:text-green-400">
                        📍 GPS対応済（{store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}）
                      </span>
                    ) : (
                      <span className="text-zinc-400">
                        GPS座標未設定
                      </span>
                    )}
                  </p>
                  {store.tokubaiShopUrl && (
                    <p className="mt-0.5 text-xs text-blue-600 dark:text-blue-400 break-all">
                      🗞️{" "}
                      <a
                        href={store.tokubaiShopUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:no-underline"
                      >
                        {store.tokubaiShopUrl}
                      </a>
                    </p>
                  )}
                  {scrapeResults[store.id] && (
                    <p className="mt-1 text-xs text-zinc-500">
                      前回取得: {scrapeResults[store.id].scraped} 枚
                      {scrapeResults[store.id].errors.length > 0 && (
                        <span className="ml-1 text-red-500">
                          （エラー {scrapeResults[store.id].errors.length} 件）
                        </span>
                      )}
                      {scrapeResults[store.id].scraped === 0 && scrapeResults[store.id].alreadyExists > 0 && (
                        <button
                          onClick={() => handleScrape(store, true)}
                          disabled={scrapingId === store.id}
                          className="ml-2 text-blue-600 underline hover:no-underline disabled:opacity-50 dark:text-blue-400"
                        >
                          🔄 履歴クリアして再取得
                        </button>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {store.tokubaiShopUrl && (
                  <button
                    onClick={() => handleScrape(store)}
                    disabled={scrapingId === store.id}
                    className="rounded-md px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                  >
                    {scrapingId === store.id ? "取得中..." : "🗞️ チラシ取得"}
                  </button>
                )}
                {store.tokubaiShopUrl && (
                  <button
                    onClick={() => handlePipeline(store)}
                    disabled={pipelineRunningId === store.id}
                    className="rounded-md px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    {pipelineRunningId === store.id ? "処理中..." : "🤖 自動取得"}
                  </button>
                )}
                <button
                  onClick={() => openEditForm(store)}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  編集
                </button>
                {store.address && (
                  <button
                    onClick={() => handleGeocode(store)}
                    disabled={geocodingId === store.id}
                    className="rounded-md px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    {geocodingId === store.id
                      ? "GPS取得中..."
                      : store.latitude != null
                        ? "📍 GPS再取得"
                        : "📍 GPS取得"}
                  </button>
                )}
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
