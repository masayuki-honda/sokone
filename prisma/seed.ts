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
  { name: "酒類", displayOrder: 1 },
  { name: "肉類", displayOrder: 2 },
  { name: "野菜類", displayOrder: 3 },
  { name: "魚介類", displayOrder: 4 },
  { name: "卵", displayOrder: 5 },
  { name: "乳製品", displayOrder: 6 },
  { name: "飲料", displayOrder: 7 },
  { name: "調味料", displayOrder: 8 },
  { name: "冷凍食品", displayOrder: 9 },
  { name: "お菓子", displayOrder: 10 },
  { name: "日用品", displayOrder: 11 },
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
