import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the gemini module before importing ocr
const mockGenerateContent = vi.fn();

vi.mock("@/lib/gemini", () => ({
  GEMINI_MODEL: "test-model",
  genAI: {
    getGenerativeModel: vi.fn(() => ({
      generateContent: mockGenerateContent,
    })),
  },
}));

const { analyzeImage } = await import("@/lib/ocr");

describe("analyzeImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed OCR items from Gemini response", async () => {
    const geminiResponse = {
      items: [
        {
          name: "金麦 350ml",
          price: 128,
          unit: "本",
          volume: "350ml",
          category_hint: "酒類",
          is_tax_included: true,
          confidence: 0.95,
          identified_by: "text",
        },
        {
          name: "大根",
          price: 158,
          unit: "本",
          volume: null,
          category_hint: "野菜類",
          is_tax_included: true,
          confidence: 0.8,
          identified_by: "image",
        },
      ],
      store_name: "テストスーパー",
    };

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(geminiResponse),
      },
    });

    const result = await analyzeImage(
      Buffer.from("fake-image-data"),
      "image/jpeg",
      "photo",
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe("金麦 350ml");
    expect(result.items[0].price).toBe(128);
    expect(result.items[1].name).toBe("大根");
    expect(result.items[1].identified_by).toBe("image");
    expect(result.store_name).toBe("テストスーパー");
  });

  it("rounds prices to integer (yen)", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            items: [
              {
                name: "卵",
                price: 213.8, // tax-calculated price
                unit: "パック",
                volume: null,
                category_hint: "卵",
                is_tax_included: false,
                confidence: 0.9,
                identified_by: "text",
              },
            ],
          }),
      },
    });

    const result = await analyzeImage(
      Buffer.from("fake"),
      "image/jpeg",
      "photo",
    );

    expect(result.items[0].price).toBe(214); // Rounded
  });

  it("clamps confidence between 0 and 1", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            items: [
              {
                name: "テスト商品",
                price: 100,
                unit: null,
                volume: null,
                category_hint: null,
                is_tax_included: true,
                confidence: 1.5, // Over 1
                identified_by: "text",
              },
              {
                name: "テスト商品2",
                price: 200,
                unit: null,
                volume: null,
                category_hint: null,
                is_tax_included: true,
                confidence: -0.2, // Below 0
                identified_by: "text",
              },
            ],
          }),
      },
    });

    const result = await analyzeImage(
      Buffer.from("fake"),
      "image/jpeg",
      "photo",
    );

    expect(result.items[0].confidence).toBe(1);
    expect(result.items[1].confidence).toBe(0);
  });

  it("throws Japanese error on parse failure", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "invalid json {{{",
      },
    });

    await expect(
      analyzeImage(Buffer.from("fake"), "image/jpeg", "photo"),
    ).rejects.toThrow("OCR結果のパースに失敗しました");
  });

  it("throws rate limit error for 429 per-minute", async () => {
    mockGenerateContent.mockRejectedValue(
      new Error("429 RESOURCE_EXHAUSTED: PerMinute quota exceeded"),
    );

    await expect(
      analyzeImage(Buffer.from("fake"), "image/jpeg", "photo"),
    ).rejects.toThrow("1分あたりのリクエスト上限");
  });

  it("throws daily limit error for per-day quota", async () => {
    mockGenerateContent.mockRejectedValue(
      new Error("429 RESOURCE_EXHAUSTED: PerDay quota exceeded"),
    );

    await expect(
      analyzeImage(Buffer.from("fake"), "image/jpeg", "photo"),
    ).rejects.toThrow("1日あたりの上限");
  });

  it("throws quota zero error when limit is 0", async () => {
    mockGenerateContent.mockRejectedValue(
      new Error("429 RESOURCE_EXHAUSTED: limit: 0, model: gemini-2.5-flash"),
    );

    await expect(
      analyzeImage(Buffer.from("fake"), "image/jpeg", "photo"),
    ).rejects.toThrow("無料枠が利用できません");
  });

  it("throws model error for 404", async () => {
    mockGenerateContent.mockRejectedValue(
      new Error("404 models/gemini-2.0-flash is no longer available"),
    );

    await expect(
      analyzeImage(Buffer.from("fake"), "image/jpeg", "photo"),
    ).rejects.toThrow("Geminiモデルが利用できません");
  });

  it("uses different prompts for different source types", async () => {
    // We just need to verify it doesn't throw for each type
    const response = {
      response: { text: () => JSON.stringify({ items: [] }) },
    };
    mockGenerateContent.mockResolvedValue(response);

    for (const type of ["photo", "flyer", "instagram", "receipt"] as const) {
      await analyzeImage(Buffer.from("fake"), "image/jpeg", type);
    }

    expect(mockGenerateContent).toHaveBeenCalledTimes(4);

    // Verify that flyer prompt includes チラシ-specific instructions
    const flyerCall = mockGenerateContent.mock.calls[1];
    const flyerPrompt = flyerCall[0][0] as string;
    expect(flyerPrompt).toContain("チラシ");

    // Verify receipt prompt includes レシート-specific instructions
    const receiptCall = mockGenerateContent.mock.calls[3];
    const receiptPrompt = receiptCall[0][0] as string;
    expect(receiptPrompt).toContain("レシート");
  });
});
