import { describe, it, expect } from "vitest";
import {
  parseVolume,
  parseQuantity,
  calculateUnitPrice,
  calculateUnitPriceForStorage,
  formatUnitPrice,
} from "@/lib/unit-price";

describe("parseVolume", () => {
  it("returns null for null/undefined/empty", () => {
    expect(parseVolume(null)).toBeNull();
    expect(parseVolume(undefined)).toBeNull();
    expect(parseVolume("")).toBeNull();
  });

  it("parses ml values", () => {
    expect(parseVolume("350ml")).toEqual({ value: 350, baseUnit: "ml" });
    expect(parseVolume("500ML")).toEqual({ value: 500, baseUnit: "ml" });
    expect(parseVolume("200mL")).toEqual({ value: 200, baseUnit: "ml" });
  });

  it("parses L values and converts to ml", () => {
    expect(parseVolume("1L")).toEqual({ value: 1000, baseUnit: "ml" });
    expect(parseVolume("1.5l")).toEqual({ value: 1500, baseUnit: "ml" });
    expect(parseVolume("2ℓ")).toEqual({ value: 2000, baseUnit: "ml" });
  });

  it("parses g values", () => {
    expect(parseVolume("500g")).toEqual({ value: 500, baseUnit: "g" });
    expect(parseVolume("100G")).toEqual({ value: 100, baseUnit: "g" });
    expect(parseVolume("250グラム")).toEqual({ value: 250, baseUnit: "g" });
  });

  it("parses kg values and converts to g", () => {
    expect(parseVolume("1kg")).toEqual({ value: 1000, baseUnit: "g" });
    expect(parseVolume("1.5Kg")).toEqual({ value: 1500, baseUnit: "g" });
    expect(parseVolume("2KG")).toEqual({ value: 2000, baseUnit: "g" });
    expect(parseVolume("1キロ")).toEqual({ value: 1000, baseUnit: "g" });
  });

  it("returns null for unrecognized formats", () => {
    expect(parseVolume("3個")).toBeNull();
    expect(parseVolume("abc")).toBeNull();
    expect(parseVolume("100")).toBeNull();
  });

  it("parses decimal values", () => {
    expect(parseVolume("1.5L")).toEqual({ value: 1500, baseUnit: "ml" });
    expect(parseVolume("0.5kg")).toEqual({ value: 500, baseUnit: "g" });
  });
});

describe("parseQuantity", () => {
  it("returns null for null/undefined/empty", () => {
    expect(parseQuantity(null)).toBeNull();
    expect(parseQuantity(undefined)).toBeNull();
    expect(parseQuantity("")).toBeNull();
  });

  it("parses × multiply patterns", () => {
    expect(parseQuantity("×24")).toEqual({ value: 24, baseUnit: "個" });
    expect(parseQuantity("x6")).toEqual({ value: 6, baseUnit: "個" });
    expect(parseQuantity("X12")).toEqual({ value: 12, baseUnit: "個" });
  });

  it("parses Japanese unit patterns with 入", () => {
    expect(parseQuantity("24缶入り")).toEqual({ value: 24, baseUnit: "個" });
    expect(parseQuantity("6本入")).toEqual({ value: 6, baseUnit: "個" });
    expect(parseQuantity("10個入り")).toEqual({ value: 10, baseUnit: "個" });
  });

  it("parses simple count patterns (>1 only)", () => {
    expect(parseQuantity("6本")).toEqual({ value: 6, baseUnit: "個" });
    expect(parseQuantity("24缶")).toEqual({ value: 24, baseUnit: "個" });
    expect(parseQuantity("3個")).toEqual({ value: 3, baseUnit: "個" });
  });

  it("returns null for single items (count = 1)", () => {
    expect(parseQuantity("1本")).toBeNull();
    expect(parseQuantity("1個")).toBeNull();
  });

  it("returns null for unrecognized formats", () => {
    expect(parseQuantity("abc")).toBeNull();
    expect(parseQuantity("100g")).toBeNull();
  });
});

describe("calculateUnitPrice", () => {
  it("returns null when no volume or unit info", () => {
    expect(calculateUnitPrice(1000, null, null)).toBeNull();
    expect(calculateUnitPrice(1000, "", "")).toBeNull();
  });

  it("calculates per-item price for multi-packs (beer case)", () => {
    // 24-can case for ¥4,800
    const result = calculateUnitPrice(4800, "350ml", "×24");
    expect(result).not.toBeNull();
    expect(result!.displayUnit).toBe("1本あたり");
    expect(result!.displayPrice).toBe(200); // 4800 / 24 = 200
  });

  it("calculates per-item price for 6-packs", () => {
    const result = calculateUnitPrice(1200, "500ml", "6本");
    expect(result).not.toBeNull();
    expect(result!.displayUnit).toBe("1本あたり");
    expect(result!.displayPrice).toBe(200); // 1200 / 6 = 200
  });

  it("calculates per 100ml for liquid products", () => {
    // 1L milk for ¥250
    const result = calculateUnitPrice(250, "1L", null);
    expect(result).not.toBeNull();
    expect(result!.displayUnit).toBe("100mlあたり");
    expect(result!.displayPrice).toBe(25); // 250 / 1000 * 100 = 25
  });

  it("calculates per 100ml for smaller volumes", () => {
    // 350ml beer for ¥210
    const result = calculateUnitPrice(210, "350ml", null);
    expect(result).not.toBeNull();
    expect(result!.displayUnit).toBe("100mlあたり");
    expect(result!.displayPrice).toBe(60); // 210 / 350 * 100 = 60
  });

  it("calculates per 100g for weight products", () => {
    // 500g ground meat for ¥400
    const result = calculateUnitPrice(400, "500g", null);
    expect(result).not.toBeNull();
    expect(result!.displayUnit).toBe("100gあたり");
    expect(result!.displayPrice).toBe(80); // 400 / 500 * 100 = 80
  });

  it("calculates per 100g for kg products", () => {
    // 1kg chicken for ¥980
    const result = calculateUnitPrice(980, "1kg", null);
    expect(result).not.toBeNull();
    expect(result!.displayUnit).toBe("100gあたり");
    expect(result!.displayPrice).toBe(98); // 980 / 1000 * 100 = 98
  });

  it("prioritizes quantity over volume (beer case scenario)", () => {
    // Beer case: ×24 should give per-item, not per-ml
    const result = calculateUnitPrice(4800, "350ml", "×24");
    expect(result!.displayUnit).toBe("1本あたり");
    expect(result!.displayPrice).toBe(200);
  });

  it("handles decimal results with rounding", () => {
    // 450g mayonnaise for ¥298
    const result = calculateUnitPrice(298, "450g", null);
    expect(result).not.toBeNull();
    expect(result!.displayUnit).toBe("100gあたり");
    // 298 / 450 * 100 = 66.222... → rounded to 66.2
    expect(result!.displayPrice).toBe(66.2);
  });

  it("handles quantity in volume string", () => {
    // quantity encoded as volume: "24缶入り"
    const result = calculateUnitPrice(4800, "24缶入り", null);
    expect(result).not.toBeNull();
    expect(result!.displayUnit).toBe("1本あたり");
    expect(result!.displayPrice).toBe(200);
  });
});

describe("calculateUnitPriceForStorage", () => {
  it("returns null when no volume/unit info", () => {
    expect(calculateUnitPriceForStorage(1000, null, null)).toBeNull();
  });

  it("returns price per base unit for ml", () => {
    // ¥250 / 1L = ¥0.25/ml
    const result = calculateUnitPriceForStorage(250, "1L", null);
    expect(result).toBeCloseTo(0.25, 5);
  });

  it("returns price per base unit for g", () => {
    // ¥400 / 500g = ¥0.8/g
    const result = calculateUnitPriceForStorage(400, "500g", null);
    expect(result).toBeCloseTo(0.8, 5);
  });

  it("returns price per item for multi-packs", () => {
    // ¥4800 / 24 = ¥200/item
    const result = calculateUnitPriceForStorage(4800, "350ml", "×24");
    expect(result).toBe(200);
  });
});

describe("formatUnitPrice", () => {
  it("returns null when no volume/unit info", () => {
    expect(formatUnitPrice(1000, null, null)).toBeNull();
    expect(formatUnitPrice(1000, "", "")).toBeNull();
  });

  it("formats per-item price", () => {
    const result = formatUnitPrice(4800, "350ml", "×24");
    expect(result).toBe("¥200 / 1本あたり");
  });

  it("formats per 100ml price", () => {
    const result = formatUnitPrice(250, "1L", null);
    expect(result).toBe("¥25 / 100mlあたり");
  });

  it("formats per 100g price", () => {
    const result = formatUnitPrice(400, "500g", null);
    expect(result).toBe("¥80 / 100gあたり");
  });

  it("formats decimal prices", () => {
    const result = formatUnitPrice(298, "450g", null);
    expect(result).toBe("¥66.2 / 100gあたり");
  });
});
