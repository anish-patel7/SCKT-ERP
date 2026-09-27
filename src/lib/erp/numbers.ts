/**
 * Decimal-safe arithmetic for production quantities and money.
 *
 * Values are held as JS numbers at the UI boundary but every operation is done on
 * scaled integers, so 0.1 + 0.2 style float drift never reaches a balance. These are
 * UI PREVIEW CALCULATIONS — FINAL BACKEND MUST RECALCULATE WITH NUMERIC/DECIMAL TYPES.
 */

/** Decimal places per kind of value. */
export const PRECISION = {
  qty: 3,
  metres: 3,
  rate: 2,
  amount: 2,
  percent: 2,
  weight: 3,
  /** Unit conversion factors and multipliers. */
  conversion: 4,
} as const;

export type PrecisionKind = keyof typeof PRECISION;

const QTY_SCALE = 10 ** PRECISION.qty;

/** Round half away from zero to `places` decimals. */
export function roundTo(value: number, places: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** places;
  const scaled = Math.abs(value) * factor;
  // Nudge by a tiny epsilon so 1.005 → 1.01 despite binary representation.
  const rounded = Math.round(scaled + 1e-9) / factor;
  return value < 0 ? -rounded : rounded;
}

function toUnits(qty: number): number {
  return Math.round(roundTo(qty, PRECISION.qty) * QTY_SCALE);
}

function fromUnits(units: number): number {
  return units / QTY_SCALE;
}

/** Sum quantities (3 decimals). */
export function sumQty(values: readonly number[]): number {
  return fromUnits(values.reduce((total, v) => total + toUnits(v), 0));
}

/** a − b − c … (3 decimals). */
export function subtractQty(from: number, ...values: number[]): number {
  return fromUnits(values.reduce((total, v) => total - toUnits(v), toUnits(from)));
}

/** Compare quantities at 3-decimal precision: -1, 0 or 1. */
export function compareQty(a: number, b: number): -1 | 0 | 1 {
  const diff = toUnits(a) - toUnits(b);
  return diff === 0 ? 0 : diff < 0 ? -1 : 1;
}

export function isPositiveQty(value: number): boolean {
  return Number.isFinite(value) && toUnits(value) > 0;
}

/**
 * Amount = Quantity × Rate, rounded to 2 decimals.
 * UI PREVIEW CALCULATION — FINAL BACKEND MUST VALIDATE.
 */
export function lineAmount(qty: number, rate: number): number {
  const qtyUnits = toUnits(qty); // qty × 1000
  const rateCents = Math.round(roundTo(rate, PRECISION.rate) * 100); // rate × 100
  // (qty × 1000) × (rate × 100) = amount × 100000 → amount with 2 decimals
  return roundTo((qtyUnits * rateCents) / 100000, PRECISION.amount);
}

/** Sum money values (2 decimals). */
export function sumAmount(values: readonly number[]): number {
  const cents = values.reduce((total, v) => total + Math.round(roundTo(v, 2) * 100), 0);
  return cents / 100;
}

/** Parse user input; empty or invalid text becomes NaN so validation can reject it. */
export function parseDecimal(text: string): number {
  const trimmed = text.trim().replace(/,/g, "");
  if (trimmed === "") return Number.NaN;
  return /^-?\d*\.?\d*$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}
