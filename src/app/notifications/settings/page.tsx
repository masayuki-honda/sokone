"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Mail } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Preference {
  id: string;
  notificationType: string;
  channel: string;
  enabled: boolean;
}

const NOTIFICATION_TYPES = [
  {
    type: "bottom_price_update",
    label: "底値更新",
    description: "ウォッチ中の商品が底値を更新した時",
    icon: "📉",
  },
  {
    type: "deal_alert",
    label: "お買い得情報",
    description: "ウォッチ中の商品がお買い得価格になった時",
    icon: "🏷️",
  },
  {
    type: "watch_target_reached",
    label: "目標価格到達",
    description: "設定した目標価格以下になった時",
    icon: "🎯",
  },
];

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((res) => res.json())
      .then((data) => {
        setPreferences(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getEnabled = (type: string, channel: string) => {
    const pref = preferences.find(
      (p) => p.notificationType === type && p.channel === channel
    );
    // in_app defaults to enabled, email defaults to disabled
    if (!pref) return channel === "in_app";
    return pref.enabled;
  };

  const togglePreference = async (
    type: string,
    channel: string,
    enabled: boolean
  ) => {
    const key = `${type}_${channel}`;
    setSaving(key);

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationType: type,
          channel,
          enabled,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setPreferences((prev) => {
          const existing = prev.findIndex(
            (p) => p.notificationType === type && p.channel === channel
          );
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = updated;
            return next;
          }
          return [...prev, updated];
        });
      }
    } catch {
      // silently fail
    } finally {
      setSaving(null);
    }
  };

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
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/notifications"
          className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-bold">通知設定</h1>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">アプリ内通知</h2>
          <div className="space-y-4">
            {NOTIFICATION_TYPES.map((nt) => {
              const enabled = getEnabled(nt.type, "in_app");
              const key = `${nt.type}_in_app`;
              return (
                <div
                  key={nt.type}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{nt.icon}</span>
                    <div>
                      <Label htmlFor={key} className="text-sm font-medium">
                        {nt.label}
                      </Label>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {nt.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={key}
                    checked={enabled}
                    disabled={saving === key}
                    onCheckedChange={(checked) =>
                      togglePreference(nt.type, "in_app", checked)
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5" />
            <h2 className="text-lg font-semibold">メール通知</h2>
          </div>
          <p className="text-sm text-zinc-500 mb-4">
            登録メールアドレスに通知を送信します
          </p>
          <div className="space-y-4">
            {NOTIFICATION_TYPES.map((nt) => {
              const enabled = getEnabled(nt.type, "email");
              const key = `${nt.type}_email`;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{nt.icon}</span>
                    <div>
                      <Label htmlFor={key} className="text-sm font-medium">
                        {nt.label}
                      </Label>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {nt.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={key}
                    checked={enabled}
                    disabled={saving === key}
                    onCheckedChange={(checked) =>
                      togglePreference(nt.type, "email", checked)
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
