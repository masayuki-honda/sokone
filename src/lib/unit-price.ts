/**
 * Unit price calculation utilities
 *
 * Parses volume/unit/quantity strings from OCR and calculates
 * standardized unit prices for comparison across different sizes.
 *
 * Examples:
 *  - "350ml" → { value: 350, baseUnit: "ml" }
 *  - "1L" → { value: 1000, baseUnit: "ml" }
 *  - "500g" → { value: 500, baseUnit: "g" }
 *  - "1kg" → { value: 1000, baseUnit: "g" }
 *  - "×24" → { value: 24, baseUnit: "個" }  (case of beer)
 *  - "6本" → { value: 6, baseUnit: "個" }
 */

export interface ParsedVolume {
  value: number;
  baseUnit: string; // "ml", "g", "個"
}

export interface UnitPriceResult {
  unitPrice: number; // Price per base unit (per ml, per g, or per item)
  displayUnit: string; // Human-readable unit label: "100mlあたり", "100gあたり", "1本あたり"
  displayPrice: number; // Price formatted for display unit (per 100ml, per 100g, per 1 item)
}

// Volume patterns: 350ml, 1L, 500ML, 1.5l, 2ℓ
const VOLUME_ML_PATTERN = /(\d+(?:\.\d+)?)\s*(ml|mL|ML|ミリリットル)/i;
const VOLUME_L_PATTERN = /(\d+(?:\.\d+)?)\s*(l|L|ℓ|リットル)/i;

// Weight patterns: 500g, 1kg, 100G, 1.5Kg
const WEIGHT_G_PATTERN = /(\d+(?:\.\d+)?)\s*(g|G|グラム)(?!al)/i;
const WEIGHT_KG_PATTERN = /(\d+(?:\.\d+)?)\s*(kg|KG|Kg|キログラム|キロ)/i;

// Count/quantity patterns: ×24, x6, 24缶, 6本, 6個入, 24本入り
const QUANTITY_MULTIPLY_PATTERN = /[×xX](\d+)/;
const QUANTITY_UNIT_PATTERN = /(\d+)\s*(缶|本|個|枚|袋|パック|食|包|玉|切れ|丁|尾|匹|束|房)\s*入/;
const QUANTITY_SIMPLE_PATTERN = /(\d+)\s*(缶|本|個|枚|袋|パック|食)\s*$/;

/**
 * Parse a volume string (e.g., "350ml", "1L", "500g") into standardized units
 */
export function parseVolume(volume: string | null | undefined): ParsedVolume | null {
  if (!volume) return null;
  const s = volume.trim();

  // Check ml first (before L to avoid false match)
  let match = s.match(VOLUME_ML_PATTERN);
  if (match) return { value: parseFloat(match[1]), baseUnit: "ml" };

  match = s.match(VOLUME_L_PATTERN);
  if (match) return { value: parseFloat(match[1]) * 1000, baseUnit: "ml" };

  match = s.match(WEIGHT_KG_PATTERN);
  if (match) return { value: parseFloat(match[1]) * 1000, baseUnit: "g" };

  match = s.match(WEIGHT_G_PATTERN);
  if (match) return { value: parseFloat(match[1]), baseUnit: "g" };

  return null;
}

/**
 * Parse a quantity/unit string (e.g., "×24", "6本", "24缶入り") into a count
 */
export function parseQuantity(unit: string | null | undefined): ParsedVolume | null {
  if (!unit) return null;
  const s = unit.trim();

  let match = s.match(QUANTITY_MULTIPLY_PATTERN);
  if (match) return { value: parseInt(match[1], 10), baseUnit: "個" };

  match = s.match(QUANTITY_UNIT_PATTERN);
  if (match) return { value: parseInt(match[1], 10), baseUnit: "個" };

  match = s.match(QUANTITY_SIMPLE_PATTERN);
  if (match) {
    const val = parseInt(match[1], 10);
    // Only treat as multi-pack if count > 1
    if (val > 1) return { value: val, baseUnit: "個" };
  }

  return null;
}

/**
 * Calculate unit price from total price, volume, and quantity info.
 *
 * Priority:
 * 1. If quantity is provided (e.g., ×24 for beer case), calculate per-item price
 * 2. If volume is provided (e.g., 500g, 350ml), calculate per-unit price
 *
 * Returns null if no volume/quantity info is available.
 */
export function calculateUnitPrice(
  totalPrice: number,
  volume: string | null | undefined,
  unit: string | null | undefined,
): UnitPriceResult | null {
  // 1. Check for multi-pack quantity (beer cases, etc.)
  const qty = parseQuantity(unit) || parseQuantity(volume);
  if (qty && qty.value > 1) {
    const perItem = totalPrice / qty.value;
    return {
      unitPrice: perItem,
      displayUnit: "1本あたり",
      displayPrice: Math.round(perItem * 10) / 10,
    };
  }

  // 2. Check for volume/weight
  const vol = parseVolume(volume) || parseVolume(unit);
  if (vol && vol.value > 0) {
    const pricePerBaseUnit = totalPrice / vol.value;

    if (vol.baseUnit === "ml") {
      return {
        unitPrice: pricePerBaseUnit,
        displayUnit: "100mlあたり",
        displayPrice: Math.round(pricePerBaseUnit * 100 * 10) / 10,
      };
    }

    if (vol.baseUnit === "g") {
      return {
        unitPrice: pricePerBaseUnit,
        displayUnit: "100gあたり",
        displayPrice: Math.round(pricePerBaseUnit * 100 * 10) / 10,
      };
    }
  }

  return null;
}

/**
 * Calculate the raw unitPrice (price per smallest base unit) for storage in DB.
 * This is the value stored in PriceRecord.unitPrice.
 *
 * Returns price per ml, price per g, or price per item.
 * Returns null if no unit info is available.
 */
export function calculateUnitPriceForStorage(
  totalPrice: number,
  volume: string | null | undefined,
  unit: string | null | undefined,
): number | null {
  const result = calculateUnitPrice(totalPrice, volume, unit);
  if (!result) return null;
  return result.unitPrice;
}

/**
 * Format unit price for display.
 * Example: "¥42.5/100g", "¥178/1本"
 */
export function formatUnitPrice(
  totalPrice: number,
  volume: string | null | undefined,
  unit: string | null | undefined,
): string | null {
  const result = calculateUnitPrice(totalPrice, volume, unit);
  if (!result) return null;
  return `¥${result.displayPrice.toLocaleString()} / ${result.displayUnit}`;
}
