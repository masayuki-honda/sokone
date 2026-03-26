/**
 * prisma/cleanup-images-no-records.ts
 *
 * 価格記録が1件もない UploadedImage を DB + R2 から削除する。
 *
 * Usage:
 *   # Dry run（削除なし）:
 *   npx tsx prisma/cleanup-images-no-records.ts --dry-run
 *
 *   # 実際に削除:
 *   npx tsx prisma/cleanup-images-no-records.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME!;

const dryRun = process.argv.includes("--dry-run");

async function deleteFromR2(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

async function main() {
  const candidates = await prisma.uploadedImage.findMany({
    where: {
      priceRecords: { none: {} },
      // Keep images that still have pending reviews (not yet reviewed)
      pendingReviews: { none: {} },
    },
    select: { id: true, imageUrl: true, status: true, sourceType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`価格記録なし・確認待ちなし画像: ${candidates.length} 件`);
  if (candidates.length === 0) {
    console.log("削除対象なし。");
    return;
  }

  // Show breakdown by status
  const byStatus: Record<string, number> = {};
  for (const img of candidates) {
    byStatus[img.status] = (byStatus[img.status] ?? 0) + 1;
  }
  console.log("ステータス内訳:");
  for (const [s, n] of Object.entries(byStatus)) {
    console.log(`  ${s}: ${n} 件`);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] 削除は実行されていません。--dry-run を外して再実行してください。");
    return;
  }

  // Delete from R2 (best-effort)
  let r2Deleted = 0;
  let r2Errors = 0;
  await Promise.allSettled(
    candidates.map(async (img) => {
      try {
        await deleteFromR2(img.imageUrl);
        r2Deleted++;
      } catch {
        r2Errors++;
      }
    }),
  );
  console.log(`\nR2削除: ${r2Deleted} 件成功, ${r2Errors} 件失敗（DB削除は続行）`);

  // Delete from DB
  const { count } = await prisma.uploadedImage.deleteMany({
    where: { id: { in: candidates.map((i) => i.id) } },
  });
  console.log(`DB削除: ${count} 件`);
  console.log("完了。");
}

main().catch(console.error).finally(() => prisma.$disconnect());
