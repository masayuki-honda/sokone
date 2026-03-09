import { describe, it, expect, vi } from "vitest";
import { normalizeProductName } from "@/lib/product-matcher";

// Mock prisma to prevent actual DB connections on module load
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

describe("normalizeProductName", () => {
  it("converts full-width alphanumeric to half-width", () => {
    expect(normalizeProductName("Ａ１")).toBe("a1");
    expect(normalizeProductName("ＡＢＣ１２３")).toBe("abc123");
  });

  it("converts full-width space to half-width", () => {
    expect(normalizeProductName("金麦\u3000350ml")).toBe("金麦 350ml");
  });

  it("normalizes volume notations", () => {
    expect(normalizeProductName("コーラ\uFF14\uFF15\uFF10\uff4d\uff4c")).toBe(
      "コーラ450ml",
    );
  });

  it("removes extra spaces", () => {
    expect(normalizeProductName("  金麦   350ml  ")).toBe("金麦 350ml");
  });

  it("converts to lowercase", () => {
    expect(normalizeProductName("Coca-Cola 350ML")).toBe("coca-cola 350ml");
  });

  it("handles empty string", () => {
    expect(normalizeProductName("")).toBe("");
  });

  it("handles Japanese product names", () => {
    expect(normalizeProductName("鶏もも肉")).toBe("鶏もも肉");
  });

  it("normalizes mixed content", () => {
    // Full-width letters + full-width space + full-width ml
    const input = "サッポロ\u3000金麦\u3000\uFF13\uFF15\uFF10\uff4d\uff4c";
    const result = normalizeProductName(input);
    expect(result).toBe("サッポロ 金麦 350ml");
  });

  it("handles product with price-like text stripped out", () => {
    const input = "大根 1本";
    expect(normalizeProductName(input)).toBe("大根 1本");
  });
});
