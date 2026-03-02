import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <main className="flex flex-col items-center gap-8 p-8 text-center">
        <h1 className="text-5xl font-bold tracking-tight">🏷️ Sokone</h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          チラシ・Instagram・店頭写真から商品価格をAIで読み取り、底値データを蓄積・可視化
        </p>
        <Link
          href="/auth/signin"
          className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          はじめる
        </Link>
      </main>
    </div>
  );
}
