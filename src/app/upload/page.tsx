"use client";

import { useState, useCallback } from "react";
import { useGeminiUsage } from "@/hooks/use-gemini-usage";
import { Camera, Newspaper, Instagram, Receipt, Link2, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { Header } from "@/components/header";
import { ImageDropzone } from "@/components/image-dropzone";
import { StoreSelect } from "@/components/store-select";
import { OcrResultsView } from "@/components/ocr-results-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SourceType = "photo" | "flyer" | "instagram" | "receipt";

interface UploadedFile {
  file: File;
  preview: string;
  id?: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  progress: number;
}

interface OcrResult {
  imageId: string;
  signedUrl: string;
  items: Array<{
    name: string;
    price: number;
    unit: string | null;
    volume: string | null;
    category_hint: string | null;
    is_tax_included: boolean;
    confidence: number;
    identified_by: string;
  }>;
  store_name?: string | null;
  takenAt?: string | null;
}

const SOURCE_TYPES: {
  value: SourceType;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: "photo",
    label: "店頭写真",
    icon: <Camera className="h-4 w-4" />,
    description: "店頭の値札・POPを撮影した写真",
  },
  {
    value: "flyer",
    label: "チラシ",
    icon: <Newspaper className="h-4 w-4" />,
    description: "スーパーのチラシ画像やスクリーンショット",
  },
  {
    value: "instagram",
    label: "Instagram",
    icon: <Instagram className="h-4 w-4" />,
    description: "Instagramセール投稿のスクリーンショット",
  },
  {
    value: "receipt",
    label: "レシート",
    icon: <Receipt className="h-4 w-4" />,
    description: "買い物レシートの写真",
  },
];

export default function UploadPage() {
  const [sourceType, setSourceType] = useState<SourceType>("photo");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [gpsSuggestedStore, setGpsSuggestedStore] = useState<string | null>(null);
  const geminiUsage = useGeminiUsage();

  // Handle file selection
  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    const newFiles: UploadedFile[] = selectedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending" as const,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  // Remove file
  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => {
      const file = prev[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Upload files and run OCR
  async function handleUploadAndAnalyze() {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    // Step 1: Upload files
    const formData = new FormData();
    formData.append("sourceType", sourceType);
    if (storeId) {
      formData.append("storeId", storeId);
    }

    // Mark all files as uploading
    setFiles((prev) =>
      prev.map((f) => ({ ...f, status: "uploading" as const, progress: 30 })),
    );

    for (const file of files) {
      formData.append("files", file.file);
    }

    try {
      const uploadRes = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        const errorMsg = uploadData.error || "アップロードに失敗しました";
        setFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: "error" as const,
            error: errorMsg,
          })),
        );
        setUploadError(errorMsg);
        setIsUploading(false);
        return;
      }

      // Update file statuses
      setFiles((prev) =>
        prev.map((f, i) => {
          const uploaded = uploadData.uploaded[i];
          const error = uploadData.errors.find(
            (e: { name: string }) => e.name === f.file.name,
          );
          if (error) {
            return { ...f, status: "error" as const, error: error.error };
          }
          return {
            ...f,
            id: uploaded?.id,
            status: "success" as const,
            progress: 100,
          };
        }),
      );

      // Auto-suggest store from GPS if no store selected
      if (!storeId && uploadData.uploaded.length > 0) {
        const imageWithGps = uploadData.uploaded.find(
          (img: { gpsLatitude?: number; gpsLongitude?: number }) =>
            img.gpsLatitude != null && img.gpsLongitude != null,
        );
        if (imageWithGps) {
          try {
            const nearbyRes = await fetch(
              `/api/stores/nearby?lat=${imageWithGps.gpsLatitude}&lng=${imageWithGps.gpsLongitude}`,
            );
            if (nearbyRes.ok) {
              const nearbyData = await nearbyRes.json();
              if (nearbyData.store) {
                setStoreId(nearbyData.store.id);
                setGpsSuggestedStore(nearbyData.store.name);
              }
            }
          } catch {
            // GPS store suggestion is best-effort
          }
        }
      }

      setIsUploading(false);

      // Step 2: Run OCR on each uploaded image
      if (uploadData.uploaded.length > 0) {
        setIsAnalyzing(true);
        const results: OcrResult[] = [];
        const ocrErrors: string[] = [];

        for (const image of uploadData.uploaded) {
          geminiUsage.recordCall();
          try {
            const analyzeRes = await fetch(
              `/api/images/${image.id}/analyze`,
              { method: "POST" },
            );

            if (analyzeRes.ok) {
              const analyzeData = await analyzeRes.json();

              // Use signed URL from analyze response
              let signedUrl = analyzeData.signedUrl || "";

              // Fallback: get signed URL from image detail API
              if (!signedUrl) {
                try {
                  const imageDetailRes = await fetch(`/api/images/${image.id}`);
                  if (imageDetailRes.ok) {
                    const imageDetail = await imageDetailRes.json();
                    signedUrl = imageDetail.signedUrl || "";
                  }
                } catch {
                  // Proceed without signed URL - the result is still usable
                }
              }

              results.push({
                imageId: image.id,
                signedUrl,
                items: analyzeData.ocrResult?.items || [],
                store_name: analyzeData.ocrResult?.store_name,
                takenAt: analyzeData.takenAt || image.takenAt || null,
              });
            } else {
              const errorData = await analyzeRes.json().catch(() => ({}));
              const rateLimitType = errorData.rateLimitType as string | null;
              if (rateLimitType === "per_minute") {
                ocrErrors.push(
                  "Gemini APIの1分あたりの制限（1,000回/分）に達しました。少し待ってから再試行してください。"
                );
              } else if (rateLimitType === "daily") {
                ocrErrors.push(
                  "Gemini APIの1日あたりの上限（10,000回/日）に達しました。翌日（日本時間9時頃）にリセットされます。"
                );
              } else if (rateLimitType === "quota_zero") {
                ocrErrors.push(
                  "Gemini APIの無料枠が利用できません（limit: 0）。Google AI Studioでクォータ設定を確認するか、有料プランに切り替えてください。"
                );
              } else {
                // Show details for non-rate-limit errors to help debugging
                const detail = errorData.details || errorData.error || `画像 ${image.id} の解析に失敗しました`;
                ocrErrors.push(`OCR解析エラー: ${detail}`);
              }
            }
          } catch (error) {
            console.error(`OCR failed for image ${image.id}:`, error);
            ocrErrors.push(`画像の解析中にネットワークエラーが発生しました`);
          }
        }

        setOcrResults(results);
        setIsAnalyzing(false);

        // Show error if OCR completely failed
        if (results.length === 0 && ocrErrors.length > 0) {
          // Rate limit messages are already user-friendly, don't prefix them
          const firstError = ocrErrors[0];
          const isRateLimit =
            firstError.includes("制限") ||
            firstError.includes("上限") ||
            firstError.includes("リセット") ||
            firstError.includes("無料枠");
          setUploadError(
            isRateLimit ? firstError : `AI解析に失敗しました: ${firstError}`,
          );
        } else if (ocrErrors.length > 0) {
          setUploadError(
            `${ocrErrors.length}件の画像の解析に失敗しました`,
          );
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "error" as const,
          error: "ネットワークエラー",
        })),
      );
      setUploadError("ネットワークエラーが発生しました。通信環境を確認してください。");
      setIsUploading(false);
    }
  }

  // Handle URL import
  async function handleUrlImport() {
    if (!urlInput.trim()) return;

    setUrlLoading(true);
    setUrlError(null);

    try {
      const res = await fetch("/api/images/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urlInput.trim(),
          sourceType,
          storeId: storeId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUrlError(data.error || "URLからの画像取り込みに失敗しました");
        setUrlLoading(false);
        return;
      }

      // Run OCR on the imported image
      setIsAnalyzing(true);
      geminiUsage.recordCall();
      const analyzeRes = await fetch(`/api/images/${data.id}/analyze`, {
        method: "POST",
      });

      if (analyzeRes.ok) {
        const analyzeData = await analyzeRes.json();

        // Get signed URL
        const imageDetailRes = await fetch(`/api/images/${data.id}`);
        const imageDetail = await imageDetailRes.json();

        setOcrResults((prev) => [
          ...prev,
          {
            imageId: data.id,
            signedUrl: imageDetail.signedUrl,
            items: analyzeData.ocrResult?.items || [],
            store_name: analyzeData.ocrResult?.store_name,
          },
        ]);
      }

      setUrlInput("");
      setUrlLoading(false);
      setIsAnalyzing(false);
    } catch (error) {
      console.error("URL import error:", error);
      setUrlError("ネットワークエラーが発生しました");
      setUrlLoading(false);
      setIsAnalyzing(false);
    }
  }

  const hasResults = ocrResults.length > 0;
  const pendingFiles = files.filter((f) => f.status === "pending");
  const hasFinishedFiles = files.some(
    (f) => f.status === "success" || f.status === "error",
  );
  const canUpload = pendingFiles.length > 0 && !isUploading && !isAnalyzing;
  const canReset = hasFinishedFiles && !isUploading && !isAnalyzing;

  // Reset to allow re-upload
  function handleReset() {
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
    setOcrResults([]);
    setUploadError(null);
    setGpsSuggestedStore(null);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">画像アップロード</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              商品の画像をアップロードして、AIが価格を自動読み取りします
            </p>
          </div>
          {/* Gemini API usage counter for debugging */}
          <div className="rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Gemini API 使用状況</div>
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span>本日:</span>
                <span
                  className={geminiUsage.totalCalls >= geminiUsage.dailyLimit * 0.9 ? "font-bold text-destructive" : geminiUsage.totalCalls >= geminiUsage.dailyLimit * 0.7 ? "font-bold text-yellow-600" : ""}
                >
                  {geminiUsage.totalCalls} / {geminiUsage.dailyLimit} 回
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>直近1分:</span>
                <span
                  className={geminiUsage.callsLastMinute >= geminiUsage.perMinuteLimit ? "font-bold text-destructive" : geminiUsage.callsLastMinute >= geminiUsage.perMinuteLimit - 3 ? "font-bold text-yellow-600" : ""}
                >
                  {geminiUsage.callsLastMinute} / {geminiUsage.perMinuteLimit} 回
                </span>
              </div>
              <button
                onClick={geminiUsage.reset}
                className="mt-1 text-[10px] underline hover:no-underline"
              >
                カウントリセット
              </button>
            </div>
          </div>
        </div>

        {!hasResults ? (
          <div className="mt-6 space-y-6">
            {/* Source type selector */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  ソースタイプを選択
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={sourceType}
                  onValueChange={(v) => setSourceType(v as SourceType)}
                >
                  <TabsList className="grid w-full grid-cols-4">
                    {SOURCE_TYPES.map((st) => (
                      <TabsTrigger
                        key={st.value}
                        value={st.value}
                        className="flex items-center gap-1.5 text-xs sm:text-sm"
                      >
                        {st.icon}
                        <span className="hidden sm:inline">{st.label}</span>
                        <span className="sm:hidden">
                          {st.label.slice(0, 3)}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {SOURCE_TYPES.map((st) => (
                    <TabsContent key={st.value} value={st.value}>
                      <p className="text-sm text-muted-foreground">
                        {st.description}
                      </p>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            {/* Store selection */}
            <Card>
              <CardContent className="pt-6">
                <StoreSelect
                  value={storeId}
                  onChange={(id) => {
                    setStoreId(id);
                    setGpsSuggestedStore(null);
                  }}
                />
                {gpsSuggestedStore && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    📍 写真の位置情報から「{gpsSuggestedStore}」を自動選択しました
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Image upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">画像を追加</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ImageDropzone
                  onFilesSelected={handleFilesSelected}
                  uploadedFiles={files}
                  onRemoveFile={handleRemoveFile}
                  isUploading={isUploading}
                />

                {/* URL input for flyer/instagram */}
                {(sourceType === "flyer" || sourceType === "instagram") && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Link2 className="h-4 w-4" />
                      URLから画像を取り込み
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/flyer.jpg"
                        value={urlInput}
                        onChange={(e) => {
                          setUrlInput(e.target.value);
                          setUrlError(null);
                        }}
                        disabled={urlLoading}
                      />
                      <Button
                        onClick={handleUrlImport}
                        disabled={!urlInput.trim() || urlLoading}
                        variant="outline"
                      >
                        {urlLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "取り込み"
                        )}
                      </Button>
                    </div>
                    {urlError && (
                      <p className="text-sm text-destructive">{urlError}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upload button */}
            {files.length > 0 && (
              <div className="space-y-3">
                {/* Error message */}
                {uploadError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {files.length}枚の画像を選択中
                  </div>
                  <div className="flex gap-2">
                    {/* Reset button — shown after upload attempt */}
                    {canReset && (
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        size="lg"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        やり直す
                      </Button>
                    )}
                    <Button
                      onClick={handleUploadAndAnalyze}
                      disabled={!canUpload}
                      size="lg"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          アップロード中...
                        </>
                      ) : isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          AI解析中...
                        </>
                      ) : (
                        <>アップロードして解析</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Analyzing indicator */}
            {isAnalyzing && (
              <Card>
                <CardContent className="flex items-center justify-center gap-3 py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">AI解析中...</p>
                    <p className="text-sm text-muted-foreground">
                      画像から商品名と価格を読み取っています
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          /* OCR Results */
          <div className="mt-6">
            <OcrResultsView
              results={ocrResults}
              sourceType={sourceType}
              storeId={storeId}
              gpsSuggestedStore={gpsSuggestedStore}
              onStoreChange={(id) => setStoreId(id)}
              onBack={() => {
                setOcrResults([]);
                setFiles([]);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
