// Phase 3 — Production module local store (mirrors the cost-sheet store pattern)

export type OrderStatus = "planned" | "in_progress" | "completed" | "hold";
export type LoomStatus = "idle" | "running" | "maintenance";
export type JobCardStatus = "open" | "running" | "closed";

export interface ProductionOrder {
  id: string;
  order_no: string;
  cost_sheet_id: string | null;
  design_no: string;
  party_name: string;
  quality: string;
  qty_metre: number;
  delivery_date: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: OrderStatus;
  remarks: string;
  created_at: string;
}

export interface Loom {
  id: string;
  loom_no: string;
  loom_type: string;
  panna_inch: number;
  status: LoomStatus;
  order_id: string | null;
  remarks: string;
}

export interface JobCard {
  id: string;
  card_no: string;
  order_id: string;
  loom_id: string | null;
  qty_metre: number;
  issued_date: string;
  status: JobCardStatus;
  feeder_notes: string;
  remarks: string;
}

export interface DailyProduction {
  id: string;
  entry_date: string;
  shift: "A" | "B" | "C";
  job_card_id: string;
  loom_id: string | null;
  metre_produced: number;
  yarn_kg_used: number;
  downtime_min: number;
  downtime_reason: string;
  remarks: string;
}

export interface ProductionData {
  orders: ProductionOrder[];
  looms: Loom[];
  jobCards: JobCard[];
  daily: DailyProduction[];
}

const STORAGE_KEY = "weaveone_production_v1";

const SEED: ProductionData = {
  orders: [
    {
      id: "po-001",
      order_no: "PO-2601",
      cost_sheet_id: "cs-sample-001",
      design_no: "D-015",
      party_name: "Shree Fabrics Pvt Ltd",
      quality: "Kashmiri Kota Pashmina",
      qty_metre: 4500,
      delivery_date: "2026-09-15",
      priority: "high",
      status: "in_progress",
      remarks: "Raised from approved cost sheet CS-001",
      created_at: "2026-08-02T09:00:00Z",
    },
    {
      id: "po-002",
      order_no: "PO-2602",
      cost_sheet_id: null,
      design_no: "D-022",
      party_name: "Ravi Textiles",
      quality: "Banarasi Silk Blend",
      qty_metre: 2200,
      delivery_date: "2026-09-30",
      priority: "normal",
      status: "planned",
      remarks: "",
      created_at: "2026-08-05T09:00:00Z",
    },
  ],
  looms: [
    {
      id: "lm-01",
      loom_no: "L-01",
      loom_type: "Jacquard",
      panna_inch: 52,
      status: "running",
      order_id: "po-001",
      remarks: "",
    },
    {
      id: "lm-02",
      loom_no: "L-02",
      loom_type: "Jacquard",
      panna_inch: 52,
      status: "running",
      order_id: "po-001",
      remarks: "",
    },
    {
      id: "lm-03",
      loom_no: "L-03",
      loom_type: "Rapier",
      panna_inch: 48,
      status: "idle",
      order_id: null,
      remarks: "",
    },
    {
      id: "lm-04",
      loom_no: "L-04",
      loom_type: "Rapier",
      panna_inch: 48,
      status: "maintenance",
      order_id: null,
      remarks: "Beam gear service",
    },
  ],
  jobCards: [
    {
      id: "jc-001",
      card_no: "JC-1001",
      order_id: "po-001",
      loom_id: "lm-01",
      qty_metre: 2500,
      issued_date: "2026-08-06",
      status: "running",
      feeder_notes: "F1 Black · F2 Jari · F3 Lichi Dyed",
      remarks: "",
    },
    {
      id: "jc-002",
      card_no: "JC-1002",
      order_id: "po-001",
      loom_id: "lm-02",
      qty_metre: 2000,
      issued_date: "2026-08-06",
      status: "running",
      feeder_notes: "F1 Black · F2 Jari",
      remarks: "",
    },
  ],
  daily: [
    {
      id: "dp-001",
      entry_date: "2026-08-07",
      shift: "A",
      job_card_id: "jc-001",
      loom_id: "lm-01",
      metre_produced: 62,
      yarn_kg_used: 9.4,
      downtime_min: 45,
      downtime_reason: "Warp breakage",
      remarks: "",
    },
    {
      id: "dp-002",
      entry_date: "2026-08-07",
      shift: "B",
      job_card_id: "jc-002",
      loom_id: "lm-02",
      metre_produced: 55,
      yarn_kg_used: 8.1,
      downtime_min: 20,
      downtime_reason: "Weft change",
      remarks: "",
    },
  ],
};

export function getProduction(): ProductionData {
  if (typeof window === "undefined") return SEED;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
    return SEED;
  }
  try {
    const parsed = JSON.parse(raw) as ProductionData;
    return {
      orders: parsed.orders ?? [],
      looms: parsed.looms ?? [],
      jobCards: parsed.jobCards ?? [],
      daily: parsed.daily ?? [],
    };
  } catch {
    return SEED;
  }
}

export function saveProduction(data: ProductionData): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Metres produced against an order, rolled up from daily entries via job cards. */
export function producedForOrder(data: ProductionData, orderId: string): number {
  const cardIds = data.jobCards.filter((c) => c.order_id === orderId).map((c) => c.id);
  return data.daily
    .filter((d) => cardIds.includes(d.job_card_id))
    .reduce((s, d) => s + (Number(d.metre_produced) || 0), 0);
}

export function producedForJobCard(data: ProductionData, cardId: string): number {
  return data.daily
    .filter((d) => d.job_card_id === cardId)
    .reduce((s, d) => s + (Number(d.metre_produced) || 0), 0);
}

export const pct = (done: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
