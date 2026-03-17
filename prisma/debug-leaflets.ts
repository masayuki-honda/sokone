import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never);

async function run() {
  const leaflets = await (prisma as any).scrapedLeaflet.findMany({
    orderBy: { scrapedAt: "desc" },
    take: 5,
    select: {
      id: true,
      leafletId: true,
      title: true,
      storeId: true,
      pageCount: true,
      scrapedAt: true,
    },
  });

  console.log("--- Leaflets (latest 5) ---");
  for (const l of leaflets) {
    console.log(JSON.stringify({ ...l, scrapedAt: l.scrapedAt.toISOString() }));

    const window = 30 * 60 * 1000;
    const imgs = await (prisma as any).uploadedImage.findMany({
      where: {
        storeId: l.storeId,
        sourceType: "auto_flyer",
        createdAt: {
          gte: new Date(l.scrapedAt.getTime() - window),
          lte: new Date(l.scrapedAt.getTime() + window),
        },
      },
      select: { id: true, status: true, createdAt: true },
    });
    console.log(
      "  images in window:",
      imgs.length,
      imgs.map((i: any) => `${i.status}@${new Date(i.createdAt).toISOString()}`)
    );
  }

  // Also check all auto_flyer images
  const allAutoFlyer = await (prisma as any).uploadedImage.count({
    where: { sourceType: "auto_flyer" },
  });
  console.log("\n--- Total auto_flyer images in DB:", allAutoFlyer);

  const recent = await (prisma as any).uploadedImage.findMany({
    where: { sourceType: "auto_flyer" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, status: true, storeId: true, createdAt: true },
  });
  console.log(
    "Recent auto_flyer images:",
    recent.map((i: any) => ({
      storeId: i.storeId,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    }))
  );

  await (prisma as any).$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
