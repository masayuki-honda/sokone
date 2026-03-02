import { Header } from "@/components/header";
import { StoreList } from "@/components/store-list";

export default function StoresPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">店舗管理</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          価格を記録する店舗を登録・管理します
        </p>
        <div className="mt-6">
          <StoreList />
        </div>
      </main>
    </div>
  );
}
