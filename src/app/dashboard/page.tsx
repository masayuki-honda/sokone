import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/header";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          ようこそ、{session?.user?.name ?? "ゲスト"}さん
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="店舗"
            description="登録済み店舗の管理"
            href="/stores"
            icon="🏪"
          />
          <DashboardCard
            title="アップロード"
            description="画像から価格を読み取り"
            href="/upload"
            icon="📷"
          />
          <DashboardCard
            title="底値一覧"
            description="記録した底値データ（準備中）"
            href="#"
            icon="📊"
          />
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <span className="text-3xl">{icon}</span>
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </a>
  );
}
