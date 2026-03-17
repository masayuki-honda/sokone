/**
 * Reclassify products in the generic "酒類" category into specific subcategories.
 *
 * Usage:
 *   npx tsx --env-file=.env prisma/reclassify-alcohol.ts --dry-run   # Preview only
 *   npx tsx --env-file=.env prisma/reclassify-alcohol.ts             # Apply changes
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SUBCATEGORIES = [
  "酒類（ビール・発泡酒）",
  "酒類（チューハイ）",
  "酒類（ワイン）",
  "酒類（日本酒）",
  "酒類（焼酎）",
  "酒類（ウィスキー）",
  "酒類（梅酒・リキュール）",
  "酒類（その他）",
] as const;

type AlcoholSubcategory = (typeof SUBCATEGORIES)[number];

// Fast keyword-based classification — avoids Gemini API calls for obvious cases
function classifyByKeyword(name: string): AlcoholSubcategory | null {
  const n = name.toLowerCase();

  // Whisky/Whiskey — check before beer to avoid matching "バドワイザー" etc.
  if (/whisky|whiskey|scotch|bourbon|blended scotch|irish whiskey|blended.*whisky|whisky.*blended/.test(n) ||
      /ウィスキー|ウイスキー|バーボン|スコッチ|ブランデー|ジン[^ジャ]|ウォッカ|テキーラ|ラム酒|角瓶|ブラックニッカ|サントリー.*オールド|山崎|白州.*ウイスキー/.test(n) ||
      // Named whisky brands in Japanese without "ウィスキー" suffix
      /ジャックダニエル|ジムビーム|カティサーク|グランツ|トリス.*クラシック|バランタイン|ティーチャーズ|デュワーズ|ホワイトホース/.test(n) ||
      // English brand names (dewar's, white horse already matched via English names above but also via Japanese)
      /dewar[s']?[ ]/.test(n))
    return "酒類（ウィスキー）";

  // Beer/低アルコール — many brands don't say "ビール" explicitly
  if (/ビール|発泡酒|新ジャンル|第三.*ビール|ビール.*第三/.test(n) ||
      // Japanese beer brands by product name
      /スーパードライ|一番搾り|のどごし|晴れ風|本麒麟|金麦|プレミアム.*モルツ|淡麗|グッドエール|ゴールドスター|ハートランド|黒ラベル|白穂乃果/.test(n) ||
      // PSB = Perfect Suntory Beer
      /パーフェクト.*ビール|perfect.*beer|psb|パーフェクトサントリー/.test(n) ||
      // International brands
      /バドワイザー|ハイネケン|コロナ[ .]|ヱビス|エビス.*ビール|カールスバーグ|ギネス|バス.*エール/.test(n))
    return "酒類（ビール・発泡酒）";

  // Chuhai / canned cocktails
  if (/チューハイ|ストロング.*ゼロ|氷結|ほろよい|-196|もぎたて|レモンサワー|缶チューハイ|カクテルパートナー|旬果搾り/.test(n))
    return "酒類（チューハイ）";

  // Wine (Japanese and English names)
  if (/ワイン|シャルドネ|メルロー|カベルネ|ソーヴィニヨン|スパークリング.*ワイン|シャンパン|プロセッコ|ボジョレー|ロゼ/.test(n) ||
      /cabernet|chardonnay|merlot|tempranillo|pinot|rosé|rouge|blanc|sauvignon|shiraz|bio-ral|don mendo/.test(n) ||
      // Spanish wine terms sometimes appear in product names
      /ブランコ|ティント|ロホ|ヴェラタ|ソーヴィニョン/.test(n))
    return "酒類（ワイン）";

  // Nihonshu — extend with common brand names
  if (/日本酒|清酒|純米|吟醸|大吟醸|本醸造|獺祭|八海山|久保田|菊水|白鶴|大関|黄桜|松竹梅|剣菱|西の関|国稀|灘/.test(n))
    return "酒類（日本酒）";

  // Shochu
  if (/焼酎|芋焼酎|麦焼酎|そば焼酎|泡盛|黒霧島|いいちこ|二階堂|白岳|宝焼酎|壱岐スーパーゴールド|玄海酒造|蔵八/.test(n) ||
      // "芋 XXX" pattern (sweet potato shochu named without 焼酎 suffix)
      /^芋[ 　\u30fb]/.test(n))
    return "酒類（焼酎）";

  // Umeshu / liqueur
  if (/梅酒|リキュール|みかん酒|いちご酒|桃.*お酒|果実酒/.test(n))
    return "酒類（梅酒・リキュール）";

  return null;
}

const classificationSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          idx: { type: SchemaType.INTEGER },
          category: { type: SchemaType.STRING },
        },
        required: ["idx", "category"],
      },
    },
  },
  required: ["results"],
};

async function classifyWithGemini(
  products: Array<{ id: string; name: string }>,
): Promise<Map<string, AlcoholSubcategory>> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: classificationSchema,
      temperature: 0.1,
    },
  });

  const result = new Map<string, AlcoholSubcategory>();
  const BATCH_SIZE = 20;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const productList = batch.map((p, idx) => `${idx}: ${p.name}`).join("\n");

    const prompt = `以下の酒類商品を、最も適切なサブカテゴリに分類してください。
サブカテゴリは必ず以下の中から選んでください：
${SUBCATEGORIES.map((c) => `- ${c}`).join("\n")}

商品リスト（番号: 商品名）：
${productList}

各商品の番号(idx)と割り当てたカテゴリ名(category)をresults配列で返してください。`;

    try {
      const response = await model.generateContent(prompt);
      const parsed = JSON.parse(response.response.text()) as {
        results: Array<{ idx: number; category: string }>;
      };

      for (const item of parsed.results) {
        const product = batch[item.idx];
        if (!product) continue;
        const validCategory = SUBCATEGORIES.find((c) => c === item.category);
        result.set(product.id, validCategory ?? "酒類（その他）");
      }
    } catch (err) {
      console.error(`[Gemini] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err);
      // Fallback: mark all in batch as その他
      for (const p of batch) {
        result.set(p.id, "酒類（その他）");
      }
    }

    // Rate limit: 15 req/min
    if (i + BATCH_SIZE < products.length) {
      await new Promise((r) => setTimeout(r, 4500));
    }
  }

  return result;
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(isDryRun ? "=== DRY RUN ===" : "=== APPLYING CHANGES ===");

  // 1. Ensure subcategories exist in DB
  const subCatMap = new Map<string, string>(); // name -> id
  for (let i = 0; i < SUBCATEGORIES.length; i++) {
    const name = SUBCATEGORIES[i];
    let cat = await prisma.productCategory.findFirst({ where: { name } });
    if (!cat) {
      if (!isDryRun) {
        cat = await prisma.productCategory.create({
          data: { name, displayOrder: i + 1 },
        });
        console.log(`  Created: ${name}`);
      } else {
        console.log(`  [dry-run] Would create: ${name}`);
        subCatMap.set(name, `(new:${i})`);
        continue;
      }
    }
    subCatMap.set(name, cat.id);
  }

  // 2. Find the generic "酒類" category
  const alcoholCat = await prisma.productCategory.findFirst({
    where: { name: "酒類" },
  });
  if (!alcoholCat) {
    console.log("「酒類」カテゴリが見つかりません。再分類不要です。");
    await prisma.$disconnect();
    return;
  }

  // 3. Get all products in "酒類"
  const products = await prisma.product.findMany({
    where: { categoryId: alcoholCat.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  console.log(`\n「酒類」カテゴリの商品: ${products.length}件`);

  if (products.length === 0) {
    console.log("再分類対象の商品はありません。");
    await prisma.$disconnect();
    return;
  }

  // 4. Classify: keyword first, then Gemini for unknowns
  const assignments = new Map<string, AlcoholSubcategory>();
  const needGemini: typeof products = [];

  for (const p of products) {
    const kw = classifyByKeyword(p.name);
    if (kw) {
      assignments.set(p.id, kw);
    } else {
      needGemini.push(p);
    }
  }

  console.log(`  キーワード分類: ${assignments.size}件`);
  console.log(`  Gemini分類待ち: ${needGemini.length}件`);

  if (needGemini.length > 0) {
    console.log("  Gemini APIで分類中...");
    const geminiResults = await classifyWithGemini(needGemini);
    for (const [id, cat] of geminiResults) {
      assignments.set(id, cat);
    }
  }

  // 5. Show summary
  const summary = new Map<string, string[]>();
  for (const [productId, cat] of assignments) {
    const p = products.find((x) => x.id === productId)!;
    if (!summary.has(cat)) summary.set(cat, []);
    summary.get(cat)!.push(p.name);
  }
  console.log("\n--- 分類結果 ---");
  for (const [cat, names] of [...summary.entries()].sort()) {
    console.log(`\n${cat} (${names.length}件):`);
    for (const n of names) console.log(`  - ${n}`);
  }

  if (isDryRun) {
    console.log("\nDRY RUN 完了。変更は適用されていません。");
    await prisma.$disconnect();
    return;
  }

  // 6. Apply changes
  let updated = 0;
  for (const [productId, catName] of assignments) {
    const catId = subCatMap.get(catName);
    if (!catId) {
      console.warn(`  ID not found for category: ${catName}`);
      continue;
    }
    await prisma.product.update({
      where: { id: productId },
      data: { categoryId: catId },
    });
    updated++;
  }
  console.log(`\n${updated}件の商品を再分類しました。`);

  // 7. Delete "酒類" if now empty
  const remaining = await prisma.product.count({
    where: { categoryId: alcoholCat.id },
  });
  if (remaining === 0) {
    await prisma.productCategory.delete({ where: { id: alcoholCat.id } });
    console.log("「酒類」カテゴリ（空）を削除しました。");
  } else {
    console.log(`「酒類」カテゴリに${remaining}件残っています。手動確認してください。`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
