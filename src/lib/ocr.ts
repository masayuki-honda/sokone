import { SchemaType, type Schema } from "@google/generative-ai";
import { genAI, GEMINI_MODEL } from "@/lib/gemini";
import sharp from "sharp";

// Note: use-gemini-usage.ts tracks free-tier limits for GEMINI_MODEL

// === Types ===

export interface OcrItem {
  name: string;
  price: number;
  unit: string | null;
  volume: string | null;
  category_hint: string | null;
  is_tax_included: boolean;
  confidence: number;
  identified_by: "text" | "image" | "both";
}

export interface OcrResult {
  items: OcrItem[];
  store_name?: string | null;
}

export type OcrSourceType = "photo" | "flyer" | "instagram" | "receipt";

// === Response schema for structured output ===

const ocrResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: "商品名",
          },
          price: {
            type: SchemaType.NUMBER,
            description: "税込価格（数値）。税抜表示の場合は×1.10で計算した値",
          },
          unit: {
            type: SchemaType.STRING,
            description: "単位（個/袋/本/パック/100g等）。不明ならnull",
            nullable: true,
          },
          volume: {
            type: SchemaType.STRING,
            description: "容量（350ml/1L等）。不明ならnull",
            nullable: true,
          },
          category_hint: {
            type: SchemaType.STRING,
            description: "推定カテゴリ名。リストの中から最も近いものを選択してください。該当なしの場合はnull",
            nullable: true,
          },
          is_tax_included: {
            type: SchemaType.BOOLEAN,
            description: "元の表示が税込かどうか",
          },
          confidence: {
            type: SchemaType.NUMBER,
            description: "読み取り確信度（0.0-1.0）。価格の数字が明確に読める場合は0.8以上、不髦明または引きの写真で小さく写っている場合は0.5未満、読み取り不能な場合は0.3以下"
          },
          identified_by: {
            type: SchemaType.STRING,
            description: "テキストから識別: text / 画像から識別: image / 両方: both",
            format: "enum",
            enum: ["text", "image", "both"],
          },
        },
        required: [
          "name",
          "price",
          "is_tax_included",
          "confidence",
          "identified_by",
        ],
      },
    },
    store_name: {
      type: SchemaType.STRING,
      description: "画像から読み取れる店舗名（ある場合のみ）",
      nullable: true,
    },
  },
  required: ["items"],
};

// === Prompts ===

const BASE_PROMPT = `以下の画像はスーパーマーケットの商品価格が写っています。
画像から読み取れるすべての商品について、JSON形式で出力してください。
価格は税込価格で統一してください。税抜表示の場合は×1.10で計算してください。

【最重要: 実売価格のみを抽出すること】
価格タグに複数の金額が表示されている場合は、実際にレジで支払う「実売価格（販売価格）」のみを使用してください。
以下のような参考価格・比較価格は除外し、絶対に採用しないでください:
- 「商談時使用売価」「参考価格」「通常価格」「定価」「メーカー希望小売価格」と記載された金額
- 打ち消し線（取消線）が引かれた金額
- 「より」「→」などで示された値引き前の元の金額
特にロピア（Lopia）は価格タグに「商談時使用売価」という補足表示とともに参考価格を記載し、
大きく目立つ数字が実際の販売価格です。必ず大きく表示されている実売価格（販売価格）を採用し、
「商談時使用売価」と記載された金額は絶対に使用しないでください。

【重要】テキストだけでなく、写っている商品の見た目からも商品名を推定してください。
例えば、野菜や果物など商品名のテキストラベルがない場合でも、
画像に写っている商品の外見から「大根」「トマト」「りんご」等を識別し、
近くの価格表示と紐付けてください。

【確信度（confidence）の基準】
- 0.8～1.0: 価格の数字が明確にテキストとして読める場合
- 0.5～0.7: 価格が読めるが若干不髦明、または推測が含まれる場合
- 0.3～0.5: 引きの写真・辺りの写真で価格札が小さい/ぼやけている場合
- 0.3未満: 価格が明確に読み取れない場合

※引きの写真・複数商品が小さく写っている場合は、価格を断言せず confidence 0.5未満を設定してください。
価格数字が全く読めない場合はその商品をリストから除外するか、confidence 0.3以下にしてください。

各商品について以下の情報を抽出してください：
- name: 商品名
- price: 税込価格（数値）
- unit: 単位（個/袋/本/パック/100g等）。箱入り・ケース売りの場合は入数を「×24」「×6」のように記載してください
- volume: 容量（350ml/1L/500g/1kg等）。内容量が記載されていれば必ず抽出してください
- category_hint: 推定カテゴリ名（後述のリストから選択）
- is_tax_included: 元の表示が税込かどうか
- confidence: 読み取り確信度（0.0-1.0）
- identified_by: text（テキストから識別）/ image（画像から識別）/ both（両方）

【容量・入数の抽出ルール】
- ビール・飲料のケース売り（例: 24缶入、6本パック）→ unit に「×24」「×6」と記載し、volume に1缶/1本あたりの容量（例: 350ml）を記載してください
- 肉類・食材の重量表示（例: 100gあたり○○円で500g）→ volume に「500g」と記載してください
- 調味料等の内容量（例: マヨネーズ450g）→ volume に「450g」と記載してください
- 「○個入」「○本入」の場合 → unit に「×○」と記載してください`;

// Default fallback categories if none are defined in DB
const DEFAULT_CATEGORIES = [
  "酒類", "肉類", "野菜類", "魚介類", "卵", "乳製品", "飲料", "ノンアル飲料",
  "調味料", "冷凍食品", "お菓子", "パン・ベーカリー", "日用品", "その他",
];

function buildPrompt(sourceType: OcrSourceType, categoryNames: string[]): string {
  const categoryList = categoryNames.length > 0 ? categoryNames : DEFAULT_CATEGORIES;
  const categorySection = `【カテゴリ一覧】category_hint には以下のカテゴリ名のいずれかを使ってください。該当しない場合はnullを指定してください:\n${categoryList.map((c) => `- ${c}`).join("\n")}`;

  const baseWithCategory = `${BASE_PROMPT}\n\n${categorySection}`;

  const suffixes: Record<OcrSourceType, string> = {
    photo: "",
    flyer: `\n\n【補足】この画像はスーパーのチラシ（広告）です。
1枚の画像に多数の商品が並んでいます（10〜30商品の場合があります）。すべての商品を漏れなく抽出してください。

【チラシ特有のレイアウト注意事項】
- 段組み（2段・3段・4段）、格子状レイアウト、吹き出し、矢印、斜め配置などの複雑なレイアウトに注意
- 商品名と価格が離れた位置にある場合でも正しく紐付けてください
- 見出し（「本日の目玉」「お買い得」等）やセクション名は商品名ではありません
- 装飾テキスト（「驚きの価格！」「限定特価」等）は商品名に含めないでください

【価格の読み取り】
- セール価格（赤字・太字・大きいフォント）と通常価格が併記されている場合は、セール価格を使用してください
- 「円」「税込」「税抜」の表示を確認し、税抜の場合は×1.10で税込に換算してください
- 「2個で○○円」「3パック○○円」等のまとめ買い価格は、1個あたりの単価に換算してunit欄に記載してください
- 「○○円引き」等の割引表現は元の価格から差し引いた後の価格を使用してください`,
    instagram: `\n\n【補足】この画像はスーパーのInstagram投稿のスクリーンショットです。\nInstagram UIの要素（いいね数、コメント欄、ユーザ名等）は無視し、\n投稿画像・テキスト内の商品名と価格情報のみを抽出してください。`,
    receipt: `\n\n【補足】この画像は買い物のレシートです。\nレシートに記載されているすべての商品の商品名と購入価格を抽出してください。\n値引き・割引がある場合は割引後の価格を使用してください。\n小計・合計・ポイントなどの合算行は除外してください。\nレシート上部に記載されている店舗名も store_name フィールドに抽出してください。`,
  };

  return baseWithCategory + suffixes[sourceType];
}

// === Main OCR function ===

/**
 * Analyze an image using Gemini Flash
 * @param imageBuffer - The image data as a Buffer
 * @param mimeType - The MIME type of the image
 * @param sourceType - The type of source (photo/flyer/instagram/receipt)
 * @param categoryNames - Category names from DB (injected by caller). Falls back to defaults.
 * @returns OCR result with extracted items
 */
export async function analyzeImage(
  imageBuffer: Buffer,
  mimeType: string,
  sourceType: OcrSourceType,
  categoryNames: string[] = [],
): Promise<OcrResult> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ocrResponseSchema,
      temperature: 0.1, // Low temperature for factual extraction
    },
  });

  const prompt = buildPrompt(sourceType, categoryNames);
  const base64Image = imageBuffer.toString("base64");

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ]).catch((error: Error) => {
    const msg = error.message ?? "";

    // Model not found / deprecated
    if (msg.includes("404") || msg.includes("no longer available") || msg.includes("Not Found")) {
      throw new Error(
        `Geminiモデルが利用できません: ${msg.slice(0, 200)}`,
      );
    }
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      // Log the full error for debugging
      console.error("Gemini API rate limit error (full message):", msg);

      const msgLower = msg.toLowerCase();

      // Check if the free tier quota limit is literally 0
      // e.g. "limit: 0, model: gemini-2.0-flash"
      const limitZero = /limit:\s*0[,\s]/.test(msg);
      if (limitZero) {
        const e = new Error(
          "Gemini APIの無料枠が利用できません（limit: 0）。Google AI Studioでプロジェクトのクォータ設定を確認するか、有料プラン（Pay-as-you-go）に切り替えてください。",
        );
        (e as Error & { rateLimitType: string }).rateLimitType = "quota_zero";
        throw e;
      }

      // Per-minute check takes precedence: if retry delay is seconds (not hours),
      // it's a per-minute limit. The Gemini API often reports BOTH PerMinute and
      // PerDay violations in the same error when per-minute is the trigger.
      const isPerMinute =
        msgLower.includes("perminute") ||
        msgLower.includes("per-minute") ||
        msgLower.includes("per_minute") ||
        msgLower.includes("ratelimitexceeded") ||
        /retrydelay.*?"\d+s"/.test(msgLower);
      // Only classify as per-day if there is NO per-minute signal at all
      const isPerDay =
        !isPerMinute &&
        (msgLower.includes("perday") ||
          msgLower.includes("per-day") ||
          msgLower.includes("per_day") ||
          msgLower.includes("dailylimit") ||
          msgLower.includes("daily"));

      if (isPerDay) {
        const e = new Error(
          "Gemini APIの1日あたりの上限（1,500回/日）に達しました。翌日（日本時間17時頃）にリセットされます。",
        );
        (e as Error & { rateLimitType: string }).rateLimitType = "daily";
        throw e;
      } else {
        // Default to per-minute (most common; also covers mixed PerMinute+PerDay messages)
        const e = new Error(
          "Gemini APIの1分あたりのリクエスト上限（15回/分）に達しました。1分ほど待ってから再試行してください。",
        );
        (e as Error & { rateLimitType: string }).rateLimitType = "per_minute";
        throw e;
      }
    }
    throw error;
  });

  const response = result.response;
  const text = response.text();

  try {
    const parsed = JSON.parse(text) as OcrResult;

    // Post-process: ensure tax-included prices
    if (parsed.items) {
      parsed.items = parsed.items.map((item) => ({
        ...item,
        // Ensure price is rounded to integer (yen)
        price: Math.round(item.price),
        // Clamp confidence between 0 and 1
        confidence: Math.max(0, Math.min(1, item.confidence)),
      }));
    }

    return parsed;
  } catch {
    console.error("Failed to parse OCR response:", text);
    throw new Error("OCR結果のパースに失敗しました");
  }
}

// === Flyer image splitting ===

const SPLIT_THRESHOLD = 1200; // Split images larger than this in both dimensions
const OVERLAP_RATIO = 0.1; // 10% overlap between quadrants

/**
 * Determine if an image should be split for better OCR accuracy.
 * Large flyer images benefit from being split into quadrants.
 */
export function shouldSplitImage(
  width: number,
  height: number,
  sourceType: OcrSourceType,
): boolean {
  return (
    sourceType === "flyer" &&
    width >= SPLIT_THRESHOLD &&
    height >= SPLIT_THRESHOLD
  );
}

/**
 * Split an image buffer into 4 overlapping quadrants.
 * Overlap prevents items at quadrant boundaries from being missed.
 */
async function splitIntoQuadrants(
  imageBuffer: Buffer,
): Promise<Buffer[]> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const overlapX = Math.floor(width * OVERLAP_RATIO);
  const overlapY = Math.floor(height * OVERLAP_RATIO);

  const regions = [
    // Top-left
    { left: 0, top: 0, width: midX + overlapX, height: midY + overlapY },
    // Top-right
    { left: Math.max(0, midX - overlapX), top: 0, width: width - midX + overlapX, height: midY + overlapY },
    // Bottom-left
    { left: 0, top: Math.max(0, midY - overlapY), width: midX + overlapX, height: height - midY + overlapY },
    // Bottom-right
    { left: Math.max(0, midX - overlapX), top: Math.max(0, midY - overlapY), width: width - midX + overlapX, height: height - midY + overlapY },
  ];

  const quadrants: Buffer[] = [];
  for (const region of regions) {
    // Clamp region to image bounds
    const clampedWidth = Math.min(region.width, width - region.left);
    const clampedHeight = Math.min(region.height, height - region.top);

    const buf = await sharp(imageBuffer)
      .extract({
        left: region.left,
        top: region.top,
        width: clampedWidth,
        height: clampedHeight,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    quadrants.push(buf);
  }

  return quadrants;
}

/**
 * Check if two items are duplicates (same product extracted from overlapping regions).
 * Uses normalized name match + similar price.
 */
function isDuplicate(a: OcrItem, b: OcrItem): boolean {
  const nameA = a.name.toLowerCase().replace(/[\s\u3000]/g, "");
  const nameB = b.name.toLowerCase().replace(/[\s\u3000]/g, "");

  // Exact name match
  if (nameA === nameB && a.price === b.price) return true;

  // Substring containment with same price (handles slight variations)
  if (
    a.price === b.price &&
    (nameA.includes(nameB) || nameB.includes(nameA)) &&
    Math.min(nameA.length, nameB.length) >= 2
  ) {
    return true;
  }

  return false;
}

/**
 * Merge OCR results from multiple quadrants, removing duplicates.
 * When duplicates are found, keep the one with higher confidence.
 */
function mergeResults(results: OcrResult[]): OcrResult {
  const merged: OcrItem[] = [];
  let storeName: string | null = null;

  for (const result of results) {
    if (result.store_name && !storeName) {
      storeName = result.store_name;
    }

    for (const item of result.items) {
      const existingIdx = merged.findIndex((m) => isDuplicate(m, item));
      if (existingIdx >= 0) {
        // Keep the higher-confidence version
        if (item.confidence > merged[existingIdx].confidence) {
          merged[existingIdx] = item;
        }
      } else {
        merged.push(item);
      }
    }
  }

  return { items: merged, store_name: storeName };
}

/**
 * Analyze a flyer image by splitting into quadrants and merging results.
 * Falls back to single-image analysis for small images.
 */
export async function analyzeImageWithSplit(
  imageBuffer: Buffer,
  mimeType: string,
  sourceType: OcrSourceType,
  categoryNames: string[] = [],
  imageWidth?: number,
  imageHeight?: number,
): Promise<OcrResult> {
  // Determine dimensions if not provided
  let width = imageWidth;
  let height = imageHeight;
  if (!width || !height) {
    const metadata = await sharp(imageBuffer).metadata();
    width = metadata.width ?? 0;
    height = metadata.height ?? 0;
  }

  if (!shouldSplitImage(width, height, sourceType)) {
    return analyzeImage(imageBuffer, mimeType, sourceType, categoryNames);
  }

  console.log(
    `[OCR Split] Splitting ${width}x${height} flyer into 4 quadrants`,
  );

  const quadrants = await splitIntoQuadrants(imageBuffer);
  const results: OcrResult[] = [];

  // Process quadrants sequentially to respect Gemini rate limits
  for (let i = 0; i < quadrants.length; i++) {
    console.log(`[OCR Split] Analyzing quadrant ${i + 1}/4`);
    const result = await analyzeImage(
      quadrants[i],
      "image/jpeg",
      sourceType,
      categoryNames,
    );
    results.push(result);
  }

  const merged = mergeResults(results);
  console.log(
    `[OCR Split] Merged: ${results.reduce((s, r) => s + r.items.length, 0)} raw → ${merged.items.length} unique items`,
  );

  return merged;
}
