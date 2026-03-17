"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

// Items always visible in desktop nav
const PRIMARY_LINKS = [
  { href: "/products", label: "商品一覧" },
  { href: "/upload", label: "アップロード" },
  { href: "/watches", label: "ウォッチ" },
  { href: "/reviews", label: "確認待ち" },
];

// Items collapsed into the "管理" dropdown
const MANAGE_LINKS = [
  { href: "/dashboard", label: "📊 ダッシュボード" },
  { href: "/stores", label: "🏪 店舗管理" },
  { href: "/categories", label: "📂 カテゴリ" },
  { href: "/uploads", label: "🖼️ アップロード履歴" },
  { href: "/records", label: "📝 登録履歴" },
  { href: "/leaflets", label: "🗞️ チラシ" },
  { href: "/jobs", label: "⚙️ ジョブ" },
];

export function Header() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold">🏷️ Sokone</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-3">
          {status === "loading" ? (
            <span className="text-sm text-zinc-400">...</span>
          ) : session ? (
            <>
              {PRIMARY_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}

              {/* 管理 dropdown */}
              <div className="relative">
                <button
                  onClick={() => setManageOpen((o) => !o)}
                  className="flex items-center gap-0.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 whitespace-nowrap"
                >
                  管理
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${manageOpen ? "rotate-180" : ""}`} />
                </button>
                {manageOpen && (
                  <>
                    {/* backdrop */}
                    <div className="fixed inset-0 z-10" onClick={() => setManageOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-20 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      {MANAGE_LINKS.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setManageOpen(false)}
                          className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <NotificationBell />
              <div className="flex items-center gap-2">
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-7 w-7 rounded-full"
                  />
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 whitespace-nowrap"
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
            className="md:hidden p-2 -mr-2 text-zinc-600 dark:text-zinc-400"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="メニュー"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
        {!session && status !== "loading" && (
          <Link
            href="/auth/signin"
            className="md:hidden rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            ログイン
          </Link>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && session && (
        <div className="md:hidden border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <nav className="mx-auto max-w-6xl px-4 py-3 space-y-1">
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
              href="/records"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              📝 登録履歴
            </Link>
            <Link
              href="/notifications"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              🔔 通知
            </Link>
            <Link
              href="/jobs"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ⚙️ ジョブ
            </Link>
            <Link
              href="/leaflets"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              🗞️ チラシ
            </Link>
            <Link
              href="/reviews"
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              📋 確認待ち
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
