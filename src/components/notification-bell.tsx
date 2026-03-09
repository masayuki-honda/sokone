"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // silently fail
    }
  }, []);

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items);
      }
    } catch {
      // silently fail
    }
  }, []);

  // Fetch notifications when popover opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
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

  const getNotificationLink = (notification: NotificationItem): string | null => {
    const data = notification.data;
    if (data?.productId) {
      return `/products/${data.productId}`;
    }
    return null;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          aria-label="通知"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">通知</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              すべて既読
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              通知はありません
            </div>
          ) : (
            notifications.map((n) => {
              const link = getNotificationLink(n);
              const content = (
                <div
                  className={`flex items-start gap-3 px-4 py-3 ${
                    !n.isRead
                      ? "bg-blue-50 dark:bg-blue-950/30"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
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
                      className="mt-1 p-1 text-zinc-400 hover:text-zinc-600"
                      aria-label="既読にする"
                    >
                      <Check className="h-3.5 w-3.5" />
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
                    setOpen(false);
                  }}
                  className="block border-b last:border-b-0"
                >
                  {content}
                </Link>
              ) : (
                <div key={n.id} className="border-b last:border-b-0">
                  {content}
                </div>
              );
            })
          )}
        </div>
        <div className="border-t px-4 py-2">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            すべての通知を見る
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
