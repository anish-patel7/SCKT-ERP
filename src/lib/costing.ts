/**
 * WeaveOne exact costing engine (M10).
 * Rounding order is load-bearing:
 *  - warp/weft line costs round to 2dp BEFORE summing
 *  - wastage cost rounds to 2dp
 *  - card cost is NOT rounded before the final addition
 */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type CostLine = {
  id: string;
  section: "warp" | "weft";
  label: string;
  material_id: string | null;
  yarn_name: string;
  quantity: number; // ends (warp) or picks per inch (weft)
  denier: number;
  length_metre: number;
  panna_inch: number;
  rate_per_kg: number;
};

export type ChargeLine = {
  id: string;
  charge_name: string;
  rate: number;
  quantity: number;
};

export type CostInputs = {
  lines: CostLine[];
  charges: ChargeLine[];
  wastage_pct: number;
  card_rate: number;
  number_of_cards: number;
  kg_divisor: number;
  card_divisor: number;
  markup_pct?: number | undefined;
  manual_sale_rate?: number | undefined;
};

export const isBlankLine = (l: CostLine) =>
  !l.material_id &&
  !l.label.trim() &&
  [l.quantity, l.denier, l.length_metre, l.panna_inch, l.rate_per_kg].every((v) => !v);

export const lineKg = (l: CostLine, kgDivisor: number) => {
  if (!kgDivisor) return 0;
  const base = l.quantity * l.denier * l.length_metre;
  return l.section === "weft" ? (base * l.panna_inch) / kgDivisor : base / kgDivisor;
};

export const lineCost = (l: CostLine, kgDivisor: number) =>
  round2(lineKg(l, kgDivisor) * l.rate_per_kg);

export const chargeAmount = (c: ChargeLine) => c.rate * c.quantity;

export function computeCostSheet(input: CostInputs) {
  const active = input.lines.filter((l) => !isBlankLine(l));
  const warp = active.filter((l) => l.section === "warp");
  const weft = active.filter((l) => l.section === "weft");

  const sum = (arr: CostLine[], fn: (l: CostLine) => number) => arr.reduce((a, l) => a + fn(l), 0);

  const warpKg = sum(warp, (l) => lineKg(l, input.kg_divisor));
  const weftKg = sum(weft, (l) => lineKg(l, input.kg_divisor));
  const warpCost = sum(warp, (l) => lineCost(l, input.kg_divisor));
  const weftCost = sum(weft, (l) => lineCost(l, input.kg_divisor));

  const totalKg = warpKg + weftKg;
  const baseMaterialCost = warpCost + weftCost;
  const wastageCost = round2((baseMaterialCost * input.wastage_pct) / 100);
  const materialWithWastage = baseMaterialCost + wastageCost;
  const processCost = input.charges.reduce((a, c) => a + chargeAmount(c), 0);
  const cardCost = input.card_divisor
    ? (input.number_of_cards * input.card_rate) / input.card_divisor
    : 0;
  const finalCost = materialWithWastage + processCost + cardCost;

  const markupPct = input.markup_pct ?? 0;
  const suggestedSaleRate = finalCost * (1 + markupPct / 100);
  const saleRate =
    input.manual_sale_rate && input.manual_sale_rate > 0 ? input.manual_sale_rate : finalCost;
  const grossProfit = saleRate - finalCost;
  const grossMarginPct = saleRate > 0 ? (grossProfit / saleRate) * 100 : 0;

  return {
    warpKg,
    weftKg,
    warpCost,
    weftCost,
    totalWarpEnds: sum(warp, (l) => l.quantity),
    totalWeftPicks: sum(weft, (l) => l.quantity),
    totalKg,
    baseMaterialCost,
    wastageCost,
    materialWithWastage,
    processCost,
    cardCost,
    finalCost,
    saleRate,
    suggestedSaleRate,
    grossProfit,
    grossMarginPct,
  };
}

export const fmt = (n: number, dp = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp })
    : "—";

export const fmtCurr = (n: number) => `₹${fmt(n, 2)}`;
