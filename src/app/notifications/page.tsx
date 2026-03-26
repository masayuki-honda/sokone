"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`/api/notifications?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    return data;
  }, []);

  useEffect(() => {
    fetchNotifications().then((data) => {
      if (data) {
        setNotifications(data.items);
        setNextCursor(data.nextCursor);
      }
      setLoading(false);
    });
  }, [fetchNotifications]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchNotifications(nextCursor);
    if (data) {
      setNotifications((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  };

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "今";
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}時間前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}日前`;
    return date.toLocaleDateString("ja-JP");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bottom_price_update":
        return "📉";
      case "deal_alert":
        return "🏷️";
      case "watch_target_reached":
        return "🎯";
      default:
        return "🔔";
    }
  };

  const getNotificationLink = (notification: NotificationItem): string | null => {
    const data = notification.data;
    if (data?.productId) {
      return `/products/${data.productId}`;
    }
    return null;
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-zinc-200 dark:bg-zinc-800"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <h1 className="text-2xl font-bold">通知</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1" />
              すべて既読
            </Button>
          )}
          <Link href="/notifications/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1" />
              設定
            </Button>
          </Link>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <Bell className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
          <p className="text-zinc-500">通知はまだありません</p>
          <p className="text-sm text-zinc-400 mt-1">
            商品をウォッチすると、価格更新時に通知が届きます
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const link = getNotificationLink(n);
            const content = (
              <div
                className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                  !n.isRead
                    ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <span className="text-xl mt-0.5">{getTypeIcon(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {n.body}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {formatTime(n.createdAt)}
                  </p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markAsRead(n.id);
                    }}
                    className="mt-1 p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    aria-label="既読にする"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            );

            return link ? (
              <Link
                key={n.id}
                href={link}
                onClick={() => {
                  if (!n.isRead) markAsRead(n.id);
                }}
              >
                {content}
              </Link>
            ) : (
              <div key={n.id}>{content}</div>
            );
          })}

          {nextCursor && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "読み込み中..." : "もっと見る"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
