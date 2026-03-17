import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

// 1. Products with no category
const noCat = await prisma.product.count({ where: { categoryId: null }, });
const total = await prisma.product.count();

// 2. Products with price records but no category
const noCatWithRecords = await prisma.product.findMany({
  where: { categoryId: null, priceRecords: { some: {} } },
  select: { name: true, unit: true, volume: true, priceRecords: { select: { id: true } } },
  orderBy: { name: "asc" },
});

// 3. Products with 0 price records (orphans)
const orphans = await prisma.product.count({ where: { priceRecords: { none: {} } } });

// 4. Unit diversity
const unitValues = await prisma.product.groupBy({
  by: ["unit"],
  _count: { id: true },
  orderBy: { _count: { id: "desc" } },
  take: 30,
});

console.log(`\n=== 基本統計 ===`);
console.log(`総商品数: ${total}`);
console.log(`カテゴリ未設定: ${noCat} 件 (${((noCat/total)*100).toFixed(1)}%)`);
console.log(`カテゴリ未設定 かつ 価格記録あり: ${noCatWithRecords.length} 件`);
console.log(`価格記録なし（孤立商品）: ${orphans} 件`);

console.log(`\n=== Unit 値の分布（上位30） ===`);
for (const u of unitValues) {
  console.log(`  "${u.unit ?? "(null)"}"  : ${u._count.id} 件`);
}

console.log(`\n=== カテゴリ未設定 かつ 価格記録あり (先頭40件) ===`);
for (const p of noCatWithRecords.slice(0,40)) {
  console.log(`  ${p.name}  unit=${p.unit}  vol=${p.volume}  records=${p.priceRecords.length}`);
}
