"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle2, XCircle, Clock, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ScrapingJob {
  id: string;
  storeId: string;
  status: "pending" | "running" | "completed" | "failed";
  imagesScraped: number;
  imagesOcred: number;
  pricesRegistered: number;
  errorLog: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  store: {
    id: string;
    name: string;
  };
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs?limit=50");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "—";
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.round(diffMs / 1000);
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainSec = seconds % 60;
    return `${minutes}分${remainSec}秒`;
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-zinc-400" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "完了";
      case "failed":
        return "失敗";
      case "running":
        return "実行中";
      default:
        return "待機中";
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-zinc-200 dark:bg-zinc-800"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/stores">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">ジョブ履歴</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchJobs}>
          <RefreshCw className="h-4 w-4 mr-1" />
          更新
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <Clock className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
          <p className="text-zinc-500">ジョブ履歴はありません</p>
          <p className="text-sm text-zinc-400 mt-1">
            店舗ページから「自動取得」を実行するとここに表示されます
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {statusIcon(job.status)}
                  <span className="font-medium text-sm">
                    {job.store.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      job.status === "completed"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : job.status === "failed"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : job.status === "running"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {statusLabel(job.status)}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">
                  {formatDate(job.createdAt)}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-4 text-center text-sm">
                <div>
                  <p className="text-zinc-400 text-xs">画像取得</p>
                  <p className="font-semibold">{job.imagesScraped}</p>
                </div>
                <div>
                  <p className="text-zinc-400 text-xs">OCR処理</p>
                  <p className="font-semibold">{job.imagesOcred}</p>
                </div>
                <div>
                  <p className="text-zinc-400 text-xs">価格登録</p>
                  <p className="font-semibold">{job.pricesRegistered}</p>
                </div>
                <div>
                  <p className="text-zinc-400 text-xs">所要時間</p>
                  <p className="font-semibold">
                    {formatDuration(job.startedAt, job.completedAt)}
                  </p>
                </div>
              </div>

              {job.errorLog && (
                <details className="mt-2">
                  <summary className="text-xs text-red-500 cursor-pointer">
                    エラーログ
                  </summary>
                  <pre className="mt-1 text-xs text-red-400 bg-red-50 dark:bg-red-950/20 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                    {job.errorLog}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
