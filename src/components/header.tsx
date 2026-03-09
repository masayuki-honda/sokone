"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

export function Header() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold">🏷️ Sokone</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-4">
          {status === "loading" ? (
            <span className="text-sm text-zinc-400">...</span>
          ) : session ? (
            <>
              <Link
                href="/stores"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                店舗管理
              </Link>
              <Link
                href="/products"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                商品一覧
              </Link>
              <Link
                href="/categories"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                カテゴリ
              </Link>
              <Link
                href="/watches"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                ウォッチ
              </Link>
              <Link
                href="/upload"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                アップロード
              </Link>
              <Link
                href="/uploads"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                履歴
              </Link>
              <NotificationBell />
              <div className="flex items-center gap-3">
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-7 w-7 rounded-full"
                  />
                )}
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {session.user.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  ログアウト
                </button>
              </div>
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              ログイン
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        {session && (
          <button
            className="sm:hidden p-2 -mr-2 text-zinc-600 dark:text-zinc-400"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="メニュー"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
        {!session && status !== "loading" && (
          <Link
            href="/auth/signin"
            className="sm:hidden rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            ログイン
          </Link>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && session && (
        <div className="sm:hidden border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <nav className="mx-auto max-w-5xl px-4 py-3 space-y-1">
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              📊 ダッシュボード
            </Link>
            <Link
              href="/stores"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              🏪 店舗管理
            </Link>
            <Link
              href="/products"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              📦 商品一覧
            </Link>
            <Link
              href="/categories"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              📂 カテゴリ
            </Link>
            <Link
              href="/watches"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              👁️ ウォッチ
            </Link>
            <Link
              href="/upload"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              📷 アップロード
            </Link>
            <Link
              href="/uploads"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              🖼️ 履歴
            </Link>
            <Link
              href="/notifications"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              🔔 通知
            </Link>
            <div className="border-t border-zinc-200 dark:border-zinc-800 mt-2 pt-2 flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-6 w-6 rounded-full"
                  />
                )}
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {session.user.name}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                ログアウト
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
