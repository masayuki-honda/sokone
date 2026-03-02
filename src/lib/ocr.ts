import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
            description: "推定カテゴリ（酒類/肉類/野菜類/魚介類/卵/乳製品/飲料/調味料/冷凍食品/お菓子/日用品/その他）",
            nullable: true,
          },
          is_tax_included: {
            type: SchemaType.BOOLEAN,
            description: "元の表示が税込かどうか",
          },
          confidence: {
            type: SchemaType.NUMBER,
            description: "読み取り確信度（0.0-1.0）",
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

【重要】テキストだけでなく、写っている商品の見た目からも商品名を推定してください。
例えば、野菜や果物など商品名のテキストラベルがない場合でも、
画像に写っている商品の外見から「大根」「トマト」「りんご」等を識別し、
近くの価格表示と紐付けてください。

各商品について以下の情報を抽出してください：
- name: 商品名
- price: 税込価格（数値）
- unit: 単位（個/袋/本/パック/100g等）
- volume: 容量（350ml/1L等）
- category_hint: 推定カテゴリ（酒類/肉類/野菜類/魚介類/卵/乳製品/飲料/調味料/冷凍食品/お菓子/日用品/その他）
- is_tax_included: 元の表示が税込かどうか
- confidence: 読み取り確信度（0.0-1.0）
- identified_by: text（テキストから識別）/ image（画像から識別）/ both（両方）`;

const SOURCE_TYPE_PROMPTS: Record<OcrSourceType, string> = {
  photo: BASE_PROMPT,
  flyer: `${BASE_PROMPT}

【補足】この画像はスーパーのチラシです。
1枚の画像に複数商品が並んでいます。すべての商品を抽出してください。
セール価格がある場合はセール価格を優先してください。
元の価格と割引後の価格がある場合は、割引後の価格を使用してください。`,
  instagram: `${BASE_PROMPT}

【補足】この画像はスーパーのInstagram投稿のスクリーンショットです。
Instagram UIの要素（いいね数、コメント欄、ユーザ名等）は無視し、
投稿画像・テキスト内の商品名と価格情報のみを抽出してください。`,
  receipt: `${BASE_PROMPT}

【補足】この画像は買い物のレシートです。
レシートに記載されているすべての商品の商品名と購入価格を抽出してください。
値引き・割引がある場合は割引後の価格を使用してください。
小計・合計・ポイントなどの合算行は除外してください。
レシート上部に記載されている店舗名も store_name フィールドに抽出してください。`,
};

// === Main OCR function ===

/**
 * Analyze an image using Gemini 2.0 Flash
 * @param imageBuffer - The image data as a Buffer
 * @param mimeType - The MIME type of the image
 * @param sourceType - The type of source (photo/flyer/instagram/receipt)
 * @returns OCR result with extracted items
 */
export async function analyzeImage(
  imageBuffer: Buffer,
  mimeType: string,
  sourceType: OcrSourceType,
): Promise<OcrResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ocrResponseSchema,
      temperature: 0.1, // Low temperature for factual extraction
    },
  });

  const prompt = SOURCE_TYPE_PROMPTS[sourceType];
  const base64Image = imageBuffer.toString("base64");

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ]);

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
  } catch (parseError) {
    console.error("Failed to parse OCR response:", text);
    throw new Error("OCR結果のパースに失敗しました");
  }
}
