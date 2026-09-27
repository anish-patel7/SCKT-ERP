/** Calendar date, ISO `YYYY-MM-DD`. Never a locale-formatted string. */
export type IsoDate = string;
export type DateRange = { from: IsoDate; to: IsoDate };

import { PRECISION, roundTo, type PrecisionKind } from "@/lib/erp/numbers";

const formatters = new Map<PrecisionKind, Intl.NumberFormat>();

function formatterFor(kind: PrecisionKind): Intl.NumberFormat {
  let f = formatters.get(kind);
  if (!f) {
    f = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: PRECISION[kind],
      maximumFractionDigits: PRECISION[kind],
    });
    formatters.set(kind, f);
  }
  return f;
}

/** Display a number with the precision of its kind (qty/metres 3, rate/amount 2). */
export function formatNumber(value: number | null | undefined, kind: PrecisionKind): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return formatterFor(kind).format(roundTo(value, PRECISION[kind]));
}

export const formatQty = (v: number | null | undefined) => formatNumber(v, "qty");
export const formatMetres = (v: number | null | undefined) => formatNumber(v, "metres");
export const formatRate = (v: number | null | undefined) => formatNumber(v, "rate");
export const formatAmount = (v: number | null | undefined) => formatNumber(v, "amount");
export const formatPercent = (v: number | null | undefined) => formatNumber(v, "percent");
export const formatWeight = (v: number | null | undefined) => formatNumber(v, "weight");

/** Plain (no grouping) numeric text for CSV export. */
export function plainNumber(value: number, kind: PrecisionKind): string {
  return roundTo(value, PRECISION[kind]).toFixed(PRECISION[kind]);
}

// ---------------------------------------------------------------------------
// Dates: stored as ISO YYYY-MM-DD, displayed as DD/MM/YYYY
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1;
}

export function formatDate(value: IsoDate | null | undefined): string {
  if (!value) return "—";
  const m = ISO_DATE.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/** Local calendar date as ISO (not UTC, so late-evening entries keep today's date). */
export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const m = ISO_DATE.exec(date);
  if (!m) return date;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function isWithinRange(date: IsoDate, from: IsoDate, to: IsoDate): boolean {
  return (!from || date >= from) && (!to || date <= to);
}

/** Default register range: the last `days` days up to today. */
export function defaultRange(days = 30): DateRange {
  const to = todayIso();
  return { from: addDays(to, -days), to };
}
