import { SchemaType, type Schema } from "@google/generative-ai";
import { genAI, GEMINI_MODEL } from "@/lib/gemini";

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
- unit: 単位（個/袋/本/パック/100g等）
- volume: 容量（350ml/1L等）
- category_hint: 推定カテゴリ名（後述のリストから選択）
- is_tax_included: 元の表示が税込かどうか
- confidence: 読み取り確信度（0.0-1.0）
- identified_by: text（テキストから識別）/ image（画像から識別）/ both（両方）`;

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
    flyer: `\n\n【補足】この画像はスーパーのチラシです。\n1枚の画像に複数商品が並んでいます。すべての商品を抽出してください。\nセール価格がある場合はセール価格を優先してください。\n元の価格と割引後の価格がある場合は、割引後の価格を使用してください。`,
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
