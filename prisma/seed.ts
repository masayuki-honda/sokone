import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Use WebSocket so seed works even when TCP port 5432 is blocked (e.g. Neon free tier)
neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const categories = [
  // 酒類サブカテゴリ（旧「酒類」を細分化）
  { name: "酒類（ビール・発泡酒）", displayOrder: 1 },
  { name: "酒類（チューハイ）", displayOrder: 2 },
  { name: "酒類（ワイン）", displayOrder: 3 },
  { name: "酒類（日本酒）", displayOrder: 4 },
  { name: "酒類（焼酎）", displayOrder: 5 },
  { name: "酒類（ウィスキー）", displayOrder: 6 },
  { name: "酒類（梅酒・リキュール）", displayOrder: 7 },
  { name: "酒類（その他）", displayOrder: 8 },
  { name: "肉類", displayOrder: 9 },
  { name: "野菜類", displayOrder: 10 },
  { name: "魚介類", displayOrder: 11 },
  { name: "卵", displayOrder: 12 },
  { name: "乳製品", displayOrder: 13 },
  { name: "飲料", displayOrder: 14 },
  { name: "調味料", displayOrder: 15 },
  { name: "冷凍食品", displayOrder: 16 },
  { name: "お菓子", displayOrder: 17 },
  { name: "日用品", displayOrder: 18 },
  { name: "その他", displayOrder: 99 },
];

async function main() {
  console.log("Seeding product categories...");

  for (const category of categories) {
    const existing = await prisma.productCategory.findFirst({
      where: { name: category.name },
    });

    if (existing) {
      await prisma.productCategory.update({
        where: { id: existing.id },
        data: { displayOrder: category.displayOrder },
      });
    } else {
      await prisma.productCategory.create({
        data: {
          name: category.name,
          displayOrder: category.displayOrder,
        },
      });
    }
  }

  const count = await prisma.productCategory.count();
  console.log(`Seeded ${count} product categories.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
