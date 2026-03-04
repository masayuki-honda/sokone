import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const CATEGORIES = [
  "酒類",
  "肉類",
  "野菜類",
  "魚介類",
  "卵",
  "乳製品",
  "飲料",
  "調味料",
  "冷凍食品",
  "お菓子",
  "日用品",
  "その他",
] as const;

const categorizationSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
        },
        required: ["id", "category"],
      },
    },
  },
  required: ["results"],
};

/**
 * POST /api/products/auto-categorize
 * Use Gemini to assign categories to all uncategorized products.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all products without a category
  const uncategorized = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (uncategorized.length === 0) {
    return NextResponse.json({
      updated: 0,
      message: "カテゴリ未設定の商品はありません",
    });
  }

  // Get category map: name -> id
  const categoryRecords = await prisma.productCategory.findMany({
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categoryRecords.map((c) => [c.name, c.id]));

  const BATCH_SIZE = 20;
  let totalUpdated = 0;
  const errors: string[] = [];

  // Process in batches to respect Gemini rate limits
  for (let i = 0; i < uncategorized.length; i += BATCH_SIZE) {
    const batch = uncategorized.slice(i, i + BATCH_SIZE);

    const productList = batch
      .map((p) => `{"id": "${p.id}", "name": "${p.name.replace(/"/g, "'")}"}`)
      .join(",\n");

    const prompt = `以下の商品リストに対して、それぞれ最も適切なカテゴリを1つ割り当ててください。
カテゴリは必ず以下の12種類の中から選んでください：
${CATEGORIES.join("、")}

商品リスト（JSON形式）：
[${productList}]

各商品の id と割り当てたカテゴリ名を results 配列で返してください。`;

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: categorizationSchema,
          temperature: 0.1,
        },
      });

      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text()) as {
        results: Array<{ id: string; category: string }>;
      };

      // Update each product in the DB
      for (const item of parsed.results) {
        const categoryId = categoryMap.get(item.category);
        if (!categoryId) continue;

        await prisma.product.update({
          where: { id: item.id },
          data: { categoryId },
        });
        totalUpdated++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`バッチ ${Math.floor(i / BATCH_SIZE) + 1}: ${msg}`);
      // Continue with next batch even if one fails
    }

    // Small delay between batches to avoid per-minute rate limit
    if (i + BATCH_SIZE < uncategorized.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return NextResponse.json({
    updated: totalUpdated,
    total: uncategorized.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `${uncategorized.length}件中${totalUpdated}件にカテゴリを設定しました`,
  });
}
