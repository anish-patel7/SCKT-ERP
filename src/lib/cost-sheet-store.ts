import { supabase } from "@/integrations/supabase/client";
import { type CostLine, type ChargeLine, computeCostSheet } from "./costing";

export interface CostSheetHeader {
  id: string;
  sheet_no: string;
  design_no: string;
  party_id: string | null;
  party_name: string;
  quality: string;
  reed: number;
  pick: number;
  panna_inch: number;
  length_metre: number;
  wastage_pct: number;
  card_rate: number;
  number_of_cards: number;
  kg_divisor: number;
  card_divisor: number;
  status: string; // draft, approved, archived
  version: number;
  remarks: string;
  costing_date: string;
  prepared_by: string;
  unit_basis: string; // per piece, per metre
  markup_pct?: number | undefined;
  manual_sale_rate?: number | undefined;
  created_at: string;
  updated_at: string;
}

export interface CostSheetFull {
  header: CostSheetHeader;
  lines: CostLine[];
  charges: ChargeLine[];
}

const STORAGE_KEY = "weaveone_cost_sheets_v1";

export const ACCEPTANCE_TEST_SAMPLE: CostSheetFull = {
  header: {
    id: "cs-sample-001",
    sheet_no: "CS-001",
    design_no: "D-015",
    party_id: null,
    party_name: "Shree Fabrics Pvt Ltd",
    quality: "Kashmiri Kota Pashmina",
    reed: 120,
    pick: 160,
    panna_inch: 49.5,
    length_metre: 6.65,
    wastage_pct: 10,
    card_rate: 0.4,
    number_of_cards: 17226,
    kg_divisor: 9000000,
    card_divisor: 39.37,
    status: "approved",
    version: 1,
    remarks: "Workbook Acceptance Verification Sample (Target Selling Rate ₹351.90 / ₹352)",
    costing_date: "2026-08-08",
    prepared_by: "Admin Costing User",
    unit_basis: "per metre",
    markup_pct: 0,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-08T00:00:00Z",
  },
  lines: [
    // Warp Lines
    {
      id: "line-warp-1",
      section: "warp",
      label: "WARP 1",
      material_id: "mat-30-kota-black-beam",
      yarn_name: "30 KOTA BLACK BEAM",
      quantity: 5444, // Ends
      denier: 35,
      length_metre: 6.65,
      panna_inch: 49.5,
      rate_per_kg: 232,
    },
    {
      id: "line-warp-2",
      section: "warp",
      label: "WARP 2",
      material_id: "mat-75-beam-jari",
      yarn_name: "75 BEAM JARI",
      quantity: 224, // Ends
      denier: 160,
      length_metre: 6.65,
      panna_inch: 49.5,
      rate_per_kg: 380,
    },
    {
      id: "line-warp-3",
      section: "warp",
      label: "WARP 3",
      material_id: null,
      yarn_name: "",
      quantity: 0,
      denier: 0,
      length_metre: 0,
      panna_inch: 0,
      rate_per_kg: 0,
    },
    // Weft Lines
    {
      id: "line-weft-1",
      section: "weft",
      label: "WEFT 1",
      material_id: "mat-30-spun-lalman",
      yarn_name: "30 SPUN LALMAN",
      quantity: 44, // Picks per inch
      denier: 183,
      length_metre: 6.65,
      panna_inch: 49.5,
      rate_per_kg: 235,
    },
    {
      id: "line-weft-2",
      section: "weft",
      label: "WEFT 2",
      material_id: "mat-double-kasab-jari",
      yarn_name: "DOUBLE KASAB JARI",
      quantity: 5.28, // Picks per inch
      denier: 311,
      length_metre: 6.65,
      panna_inch: 49.5,
      rate_per_kg: 315,
    },
    {
      id: "line-weft-3",
      section: "weft",
      label: "WEFT 3",
      material_id: "mat-150-lichi-dyed",
      yarn_name: "150 LICHI DYED",
      quantity: 15.33, // Picks per inch
      denier: 165,
      length_metre: 6.65,
      panna_inch: 49.5,
      rate_per_kg: 193,
    },
    {
      id: "line-weft-4",
      section: "weft",
      label: "WEFT 4",
      material_id: null,
      yarn_name: "",
      quantity: 0,
      denier: 0,
      length_metre: 0,
      panna_inch: 49.5,
      rate_per_kg: 180,
    },
    {
      id: "line-weft-5",
      section: "weft",
      label: "WEFT 5",
      material_id: null,
      yarn_name: "",
      quantity: 0,
      denier: 0,
      length_metre: 0,
      panna_inch: 0,
      rate_per_kg: 0,
    },
    {
      id: "line-weft-6",
      section: "weft",
      label: "WEFT 6",
      material_id: null,
      yarn_name: "",
      quantity: 0,
      denier: 0,
      length_metre: 0,
      panna_inch: 0,
      rate_per_kg: 0,
    },
  ],
  charges: [
    { id: "chg-1", charge_name: "Butta", rate: 2, quantity: 6.65 },
    { id: "chg-2", charge_name: "RFD", rate: 0, quantity: 7 },
  ],
};

export function getLocalCostSheets(): CostSheetFull[] {
  if (typeof window === "undefined") return [ACCEPTANCE_TEST_SAMPLE];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([ACCEPTANCE_TEST_SAMPLE]));
    return [ACCEPTANCE_TEST_SAMPLE];
  }
  try {
    return JSON.parse(stored);
  } catch {
    return [ACCEPTANCE_TEST_SAMPLE];
  }
}

export function saveLocalCostSheets(sheets: CostSheetFull[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets));
  }
}

export function getCostSheetById(id: string): CostSheetFull | null {
  const all = getLocalCostSheets();
  return all.find((cs) => cs.header.id === id) || null;
}

export function saveCostSheet(fullSheet: CostSheetFull): CostSheetFull {
  const all = getLocalCostSheets();
  const now = new Date().toISOString();
  const isNew = !fullSheet.header.id || fullSheet.header.id.startsWith("new-");

  const id = isNew ? `cs-${Date.now()}` : fullSheet.header.id;

  const header: CostSheetHeader = {
    ...fullSheet.header,
    id,
    updated_at: now,
    created_at: fullSheet.header.created_at || now,
  };

  const updatedFull: CostSheetFull = {
    header,
    lines: fullSheet.lines,
    charges: fullSheet.charges,
  };

  const idx = all.findIndex((cs) => cs.header.id === id);
  if (idx >= 0) {
    all[idx] = updatedFull;
  } else {
    all.unshift(updatedFull);
  }

  saveLocalCostSheets(all);
  return updatedFull;
}

export function duplicateCostSheet(originalId: string, newSheetNo: string): CostSheetFull {
  const original = getCostSheetById(originalId);
  if (!original) throw new Error("Original cost sheet not found");

  const now = new Date().toISOString();
  const newId = `cs-dup-${Date.now()}`;

  const duplicatedHeader: CostSheetHeader = {
    ...original.header,
    id: newId,
    sheet_no: newSheetNo.trim(),
    version: 1,
    status: "draft",
    remarks: `Duplicated from ${original.header.sheet_no}`,
    created_at: now,
    updated_at: now,
  };

  const duplicatedLines: CostLine[] = original.lines.map((l, idx) => ({
    ...l,
    id: `dup-l-${Date.now()}-${idx}`,
  }));

  const duplicatedCharges: ChargeLine[] = original.charges.map((c, idx) => ({
    ...c,
    id: `dup-c-${Date.now()}-${idx}`,
  }));

  const full: CostSheetFull = {
    header: duplicatedHeader,
    lines: duplicatedLines,
    charges: duplicatedCharges,
  };

  const all = getLocalCostSheets();
  all.unshift(full);
  saveLocalCostSheets(all);
  return full;
}

export function createNewVersion(originalId: string): CostSheetFull {
  const original = getCostSheetById(originalId);
  if (!original) throw new Error("Original cost sheet not found");

  const now = new Date().toISOString();
  const newVersion = original.header.version + 1;
  const newId = `cs-v${newVersion}-${Date.now()}`;

  const versionHeader: CostSheetHeader = {
    ...original.header,
    id: newId,
    version: newVersion,
    status: "draft",
    remarks: `Version ${newVersion} of ${original.header.sheet_no}`,
    created_at: now,
    updated_at: now,
  };

  const lines: CostLine[] = original.lines.map((l, idx) => ({
    ...l,
    id: `ver-l-${Date.now()}-${idx}`,
  }));

  const charges: ChargeLine[] = original.charges.map((c, idx) => ({
    ...c,
    id: `ver-c-${Date.now()}-${idx}`,
  }));

  const full: CostSheetFull = {
    header: versionHeader,
    lines,
    charges,
  };

  const all = getLocalCostSheets();
  all.unshift(full);
  saveLocalCostSheets(all);
  return full;
}
