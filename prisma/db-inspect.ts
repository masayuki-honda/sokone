/**
 * prisma/db-inspect.ts
 *
 * DB容量確認 + 不要レコードの調査・削除スクリプト。
 *
 * Usage:
 *   # 調査のみ（削除なし）:
 *   npx tsx prisma/db-inspect.ts
 *
 *   # 不要レコードを実際に削除:
 *   npx tsx prisma/db-inspect.ts --clean
 */

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const dryRun = !process.argv.includes("--clean");

async function main() {
  // ── DB size ──────────────────────────────────────────────────────────────
  const [sizeRow] = await prisma.$queryRaw<[{ size_bytes: bigint; size_pretty: string }]>`
    SELECT
      pg_database_size(current_database()) AS size_bytes,
      pg_size_pretty(pg_database_size(current_database())) AS size_pretty
  `;
  const usedMB = Number(sizeRow.size_bytes) / 1024 / 1024;
  const limitMB = 512;
  const pct = (usedMB / limitMB * 100).toFixed(1);
  console.log(`\n=== DB 使用容量 ===`);
  console.log(`  使用: ${sizeRow.size_pretty}  (${usedMB.toFixed(1)} MB)`);
  console.log(`  上限: ${limitMB} MB (Neon Free tier)`);
  console.log(`  使用率: ${pct}%`);

  // ── テーブル別サイズ ──────────────────────────────────────────────────────
  const tableRows = await prisma.$queryRaw<{ table_name: string; row_count: bigint; size_pretty: string }[]>`
    SELECT
      s.relname::text AS table_name,
      s.n_live_tup AS row_count,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS size_pretty
    FROM pg_stat_user_tables s
    JOIN pg_class c ON c.relname = s.relname
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 15
  `;
  console.log(`\n=== テーブル別サイズ (上位15) ===`);
  for (const row of tableRows) {
    console.log(`  ${row.table_name.padEnd(40)} ${String(row.row_count).padStart(7)} 行  ${row.size_pretty}`);
  }

  // ── 不要レコード調査 ─────────────────────────────────────────────────────
  console.log(`\n=== 不要レコード調査 ===`);

  // 1. 価格記録が0件・お気に入りなし・ウォッチなしの商品（孤立商品）
  const orphanProducts = await prisma.product.findMany({
    where: {
      priceRecords: { none: {} },
      favoriteProducts: { none: {} },
      priceWatches: { none: {} },
    },
    select: { id: true, name: true },
  });
  console.log(`\n  [1] 価格記録/お気に入り/ウォッチが全てない孤立商品: ${orphanProducts.length} 件`);
  if (orphanProducts.length > 0 && orphanProducts.length <= 20) {
    orphanProducts.forEach(p => console.log(`      - ${p.name}`));
  }

  // 2. R2画像なし + 価格記録なし + ステータスがfailedのUploadedImage
  const failedImages = await prisma.uploadedImage.findMany({
    where: {
      status: "failed",
      priceRecords: { none: {} },
    },
    select: { id: true, imageUrl: true, createdAt: true },
  });
  console.log(`\n  [2] status=failed かつ価格記録なしの画像: ${failedImages.length} 件`);

  // 3. status=no_products の画像（OCRで商品なし判定済み）
  const noProductImages = await prisma.uploadedImage.findMany({
    where: { status: "no_products" },
    select: { id: true, imageUrl: true, createdAt: true, sourceType: true },
  });
  const oldNoProduct = noProductImages.filter(
    img => img.createdAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  console.log(`\n  [3] status=no_products の画像: 合計 ${noProductImages.length} 件`);
  console.log(`      うち30日以上前: ${oldNoProduct.length} 件（削除候補）`);

  // 4. 解決済み(approved/rejected)の PendingReview
  const resolvedReviews = await prisma.pendingReview.findMany({
    where: { status: { in: ["approved", "rejected"] } },
    select: { id: true, status: true, resolvedAt: true },
  });
  const oldResolved = resolvedReviews.filter(
    r => r.resolvedAt && r.resolvedAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  console.log(`\n  [4] 解決済み PendingReview: 合計 ${resolvedReviews.length} 件`);
  console.log(`      うち30日以上前: ${oldResolved.length} 件（削除候補）`);

  // 5. 既読通知
  const readNotifications = await prisma.notification.findMany({
    where: {
      isRead: true,
      createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  console.log(`\n  [5] 30日以上前の既読通知: ${readNotifications.length} 件（削除候補）`);

  // 6. 完了/失敗済みの古いジョブログ
  const oldJobs = await prisma.scrapingJob.findMany({
    where: {
      status: { in: ["completed", "failed"] },
      createdAt: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  console.log(`\n  [6] 60日以上前の完了/失敗ジョブ: ${oldJobs.length} 件（削除候補）`);

  // ── サマリー ────────────────────────────────────────────────────────────
  const totalDeletable =
    orphanProducts.length +
    failedImages.length +
    oldNoProduct.length +
    oldResolved.length +
    readNotifications.length +
    oldJobs.length;

  console.log(`\n=== 削除候補サマリー ===`);  console.log(`  孤立商品 (価格/お気に入り/ウォッチなし): ${orphanProducts.length} 件`);  console.log(`  失敗済み画像 (価格なし):          ${failedImages.length} 件`);
  console.log(`  no_products画像 (30日以上前):     ${oldNoProduct.length} 件`);
  console.log(`  解決済みレビュー (30日以上前):      ${oldResolved.length} 件`);
  console.log(`  既読通知 (30日以上前):             ${readNotifications.length} 件`);
  console.log(`  旧ジョブログ (60日以上前):          ${oldJobs.length} 件`);
  console.log(`  ────────────────────────────────────────`);
  console.log(`  合計:                              ${totalDeletable} 件`);

  if (dryRun) {
    console.log(`\n[DRY RUN] 削除は実行されていません。--clean を付けて再実行してください。`);
    return;
  }

  // ── 削除実行 ─────────────────────────────────────────────────────────────
  console.log(`\n=== 削除実行 ===`);

  // 孤立商品（ProductAlias は CASCADE で自動削除）
  if (orphanProducts.length > 0) {
    const { count } = await prisma.product.deleteMany({
      where: { id: { in: orphanProducts.map(p => p.id) } },
    });
    console.log(`  孤立商品: ${count} 件 削除`);
  }

  // 失敗画像
  if (failedImages.length > 0) {
    const { count } = await prisma.uploadedImage.deleteMany({
      where: { id: { in: failedImages.map(i => i.id) } },
    });
    console.log(`  失敗済み画像: ${count} 件 削除`);
  }

  // no_products 30日以上前
  if (oldNoProduct.length > 0) {
    const { count } = await prisma.uploadedImage.deleteMany({
      where: { id: { in: oldNoProduct.map(i => i.id) } },
    });
    console.log(`  no_products画像 (30日以上前): ${count} 件 削除`);
  }

  // 解決済みレビュー 30日以上前
  if (oldResolved.length > 0) {
    const { count } = await prisma.pendingReview.deleteMany({
      where: { id: { in: oldResolved.map(r => r.id) } },
    });
    console.log(`  解決済みレビュー (30日以上前): ${count} 件 削除`);
  }

  // 既読通知 30日以上前
  if (readNotifications.length > 0) {
    const { count } = await prisma.notification.deleteMany({
      where: { id: { in: readNotifications.map(n => n.id) } },
    });
    console.log(`  既読通知: ${count} 件 削除`);
  }

  // 旧ジョブログ 60日以上前
  if (oldJobs.length > 0) {
    const { count } = await prisma.scrapingJob.deleteMany({
      where: { id: { in: oldJobs.map(j => j.id) } },
    });
    console.log(`  旧ジョブログ: ${count} 件 削除`);
  }

  console.log(`\n完了。`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
