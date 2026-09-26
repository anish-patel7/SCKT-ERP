// Phase 4 — Inventory & Warehouse Management Store (M30 & M31)

export type BeamStockStatus = "in_store" | "loaded_on_loom" | "sizing" | "depleted";
export type FabricStage = "grey" | "processing" | "finished" | "dispatched";
export type QualityGrade = "Grade A" | "Grade B" | "Grade C" | "Hold";
export type MovementType =
  | "inward_grn"
  | "issue_to_production"
  | "beam_warping"
  | "roll_weave"
  | "roll_split"
  | "location_transfer"
  | "dispatch";

export interface YarnStockItem {
  id: string;
  lot_no: string;
  yarn_code: string;
  yarn_name: string;
  supplier_name: string;
  grn_no: string;
  location_bin: string;
  total_kg: number;
  reserved_kg: number;
  available_kg: number;
  rate_per_kg: number;
  reorder_level_kg: number;
  received_date: string;
  fifo_priority: number;
}

export interface BeamStockItem {
  id: string;
  beam_no: string;
  beam_type: string;
  count: string;
  set_no: string;
  warp_yarn_code: string;
  total_ends: number;
  length_metre: number;
  location_rack: string;
  status: BeamStockStatus;
  loom_no: string | null;
  qr_code: string;
  created_at: string;
}

export interface FabricRollItem {
  id: string;
  roll_no: string;
  piece_no: string;
  item_code: string;
  design_no: string;
  length_metre: number;
  weight_kg: number;
  location_bay: string;
  stage: FabricStage;
  grade: QualityGrade;
  parent_roll_id: string | null;
  job_card_no: string | null;
  beam_no: string | null;
  yarn_lot_no: string | null;
  qr_code: string;
  created_at: string;
  is_closed?: boolean;
}

export interface StockMovement {
  id: string;
  date: string;
  movement_type: MovementType;
  ref_doc: string;
  item_type: "yarn" | "beam" | "fabric";
  item_id: string;
  item_label: string;
  qty_change: number;
  unit: "kg" | "m" | "beam" | "roll";
  location_from: string;
  location_to: string;
  user_name: string;
  remarks: string;
}

export interface InventoryData {
  yarn: YarnStockItem[];
  beams: BeamStockItem[];
  fabricRolls: FabricRollItem[];
  movements: StockMovement[];
}

const STORAGE_KEY = "sckt_inventory_v1";

const SEED: InventoryData = {
  yarn: [
    {
      id: "yn-001",
      lot_no: "LOT-Y2026-081",
      yarn_code: "YRN-75-POLY",
      yarn_name: "75/36 Poly Filament Bright",
      supplier_name: "Vardhman Yarns Ltd",
      grn_no: "GRN-8810",
      location_bin: "BIN-A-01",
      total_kg: 1450,
      reserved_kg: 200,
      available_kg: 1250,
      rate_per_kg: 185,
      reorder_level_kg: 500,
      received_date: "2026-07-28",
      fifo_priority: 1,
    },
    {
      id: "yn-002",
      lot_no: "LOT-Y2026-094",
      yarn_code: "YRN-150-VISC",
      yarn_name: "150/48 Viscose Dyed Navy",
      supplier_name: "Grasim Industries",
      grn_no: "GRN-8842",
      location_bin: "BIN-A-04",
      total_kg: 820,
      reserved_kg: 150,
      available_kg: 670,
      rate_per_kg: 240,
      reorder_level_kg: 400,
      received_date: "2026-08-01",
      fifo_priority: 2,
    },
    {
      id: "yn-003",
      lot_no: "LOT-Y2026-102",
      yarn_code: "YRN-30-COT",
      yarn_name: "30s Combed Cotton Warp",
      supplier_name: "Kothari Textiles",
      grn_no: "GRN-8890",
      location_bin: "BIN-B-02",
      total_kg: 320,
      reserved_kg: 0,
      available_kg: 320,
      rate_per_kg: 295,
      reorder_level_kg: 600, // Trigger reorder alert
      received_date: "2026-08-04",
      fifo_priority: 3,
    },
  ],
  beams: [
    {
      id: "bm-2601",
      beam_no: "BM-101",
      beam_type: "Kota Black Warp",
      count: "35 Denier",
      set_no: "SET-881",
      warp_yarn_code: "YRN-75-POLY",
      total_ends: 5444,
      length_metre: 1200,
      location_rack: "RACK-B-01",
      status: "loaded_on_loom",
      loom_no: "L-01",
      qr_code: "QR-BM-101-SET881",
      created_at: "2026-08-02T10:00:00Z",
    },
    {
      id: "bm-2602",
      beam_no: "BM-102",
      beam_type: "Banarasi Gold Jari",
      count: "160 Denier",
      set_no: "SET-884",
      warp_yarn_code: "YRN-150-VISC",
      total_ends: 3200,
      length_metre: 850,
      location_rack: "RACK-B-03",
      status: "in_store",
      loom_no: null,
      qr_code: "QR-BM-102-SET884",
      created_at: "2026-08-04T14:30:00Z",
    },
    {
      id: "bm-2603",
      beam_no: "BM-103",
      beam_type: "Bright Mono Warp",
      count: "21 Denier",
      set_no: "SET-889",
      warp_yarn_code: "YRN-30-COT",
      total_ends: 4800,
      length_metre: 1500,
      location_rack: "SIZING-BAY-1",
      status: "sizing",
      loom_no: null,
      qr_code: "QR-BM-103-SET889",
      created_at: "2026-08-06T09:15:00Z",
    },
  ],
  fabricRolls: [
    {
      id: "rol-1001",
      roll_no: "ROL-9901",
      piece_no: "PC-001",
      item_code: "ITEM-001",
      design_no: "D-015",
      length_metre: 120,
      weight_kg: 18.5,
      location_bay: "BAY-C-02",
      stage: "finished",
      grade: "Grade A",
      parent_roll_id: null,
      job_card_no: "JC-901",
      beam_no: "BM-101",
      yarn_lot_no: "LOT-Y2026-081",
      qr_code: "QR-ROL-9901",
      created_at: "2026-08-05T11:20:00Z",
    },
    {
      id: "rol-1002",
      roll_no: "ROL-9902",
      piece_no: "PC-002",
      item_code: "ITEM-001",
      design_no: "D-015",
      length_metre: 115,
      weight_kg: 17.8,
      location_bay: "BAY-C-02",
      stage: "grey",
      grade: "Grade A",
      parent_roll_id: null,
      job_card_no: "JC-901",
      beam_no: "BM-101",
      yarn_lot_no: "LOT-Y2026-081",
      qr_code: "QR-ROL-9902",
      created_at: "2026-08-06T15:45:00Z",
    },
    {
      id: "rol-1003",
      roll_no: "ROL-9903",
      piece_no: "PC-003",
      item_code: "ITEM-002",
      design_no: "D-022",
      length_metre: 95,
      weight_kg: 14.2,
      location_bay: "BAY-D-01",
      stage: "processing",
      grade: "Hold",
      parent_roll_id: null,
      job_card_no: "JC-902",
      beam_no: "BM-102",
      yarn_lot_no: "LOT-Y2026-094",
      qr_code: "QR-ROL-9903",
      created_at: "2026-08-07T08:10:00Z",
    },
  ],
  movements: [
    {
      id: "mvt-001",
      date: "2026-07-28T09:00:00Z",
      movement_type: "inward_grn",
      ref_doc: "GRN-8810",
      item_type: "yarn",
      item_id: "yn-001",
      item_label: "75/36 Poly Filament Bright (LOT-Y2026-081)",
      qty_change: 1450,
      unit: "kg",
      location_from: "SUPPLIER: Vardhman",
      location_to: "BIN-A-01",
      user_name: "Store Manager",
      remarks: "Initial GRN receipt verified",
    },
    {
      id: "mvt-002",
      date: "2026-08-02T10:00:00Z",
      movement_type: "beam_warping",
      ref_doc: "SET-881",
      item_type: "beam",
      item_id: "bm-2601",
      item_label: "Beam BM-101 (Kota Black Warp)",
      qty_change: 1200,
      unit: "m",
      location_from: "WARPING-DEPT",
      location_to: "RACK-B-01",
      user_name: "Warping Supervisor",
      remarks: "Beam warping completed",
    },
  ],
};

export function getInventory(): InventoryData {
  if (typeof window === "undefined") return SEED;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
    return SEED;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return SEED;
  }
}

export function saveInventory(data: InventoryData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}
