import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  computeCostSheet,
  round2,
  type CostLine,
  type ChargeLine as EngineChargeLine,
} from "@/lib/costing";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const CostSheetHeaderSchema = z.object({
  id: z.string().optional(),
  sheet_no: z.string().min(1).max(50),
  design_no: z.string().max(50).optional().nullable(),
  party_id: z.string().uuid().optional().nullable(),
  party_name: z.string().max(200).optional(),
  quality: z.string().max(500).optional(),
  reed: z.number().int().nonnegative(),
  pick: z.number().int().nonnegative(),
  panna_inch: z.number().positive().default(49.5),
  length_metre: z.number().positive().default(6.65),
  wastage_pct: z.number().nonnegative().default(10),
  card_rate: z.number().nonnegative().default(0),
  number_of_cards: z.number().int().nonnegative().default(0),
  kg_divisor: z.number().int().positive().default(9000000),
  card_divisor: z.number().positive().default(39.37),
  status: z.enum(["draft", "approved", "archived"]).default("draft"),
  version: z.number().int().positive().default(1),
  remarks: z.string().optional(),
  costing_date: z.string().optional(),
  prepared_by: z.string().max(150).optional(),
  unit_basis: z.enum(["per metre", "per piece"]).default("per metre"),
  markup_pct: z.number().nonnegative().optional(),
  manual_sale_rate: z.number().nonnegative().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type CostSheetHeader = z.infer<typeof CostSheetHeaderSchema>;

export const CostLineSchema = z.object({
  id: z.string().optional(),
  section: z.enum(["warp", "weft"]),
  label: z.string().max(100).optional(),
  material_id: z.string().uuid().optional().nullable(),
  yarn_name: z.string().max(200).optional(),
  quantity: z.number().nonnegative(),
  denier: z.number().nonnegative(),
  length_metre: z.number().nonnegative(),
  panna_inch: z.number().nonnegative(),
  rate_per_kg: z.number().nonnegative(),
});

export type CostSheetLine = z.infer<typeof CostLineSchema>;

export const ChargeLineSchema = z.object({
  id: z.string().optional(),
  charge_name: z.string().max(150).optional(),
  rate: z.number().nonnegative(),
  quantity: z.number().nonnegative(),
});

export type ChargeLine = z.infer<typeof ChargeLineSchema>;

export const CostSheetFullSchema = z.object({
  header: CostSheetHeaderSchema,
  lines: z.array(CostLineSchema),
  charges: z.array(ChargeLineSchema),
});

export type CostSheetFull = z.infer<typeof CostSheetFullSchema>;

// ============================================================================
// ERROR TYPES
// ============================================================================

export class CostSheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CostSheetError";
  }
}

export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authorized to perform this action");
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends Error {
  constructor(
    public resource: string,
    public id: string,
  ) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

// ============================================================================
// ROW MAPPING (service shape -> cost_sheets / cost_sheet_lines / cost_sheet_charges)
// ============================================================================

const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/** Header columns plus the stored totals the list, dashboard and reports read. */
function headerColumns(h: CostSheetHeader, lines: CostSheetLine[], charges: ChargeLine[]) {
  const totals = computeCostSheet({
    lines: toCostLines(lines),
    charges: toChargeLines(charges),
    wastage_pct: h.wastage_pct,
    card_rate: h.card_rate,
    number_of_cards: h.number_of_cards,
    kg_divisor: h.kg_divisor,
    card_divisor: h.card_divisor,
    markup_pct: h.markup_pct,
    manual_sale_rate: h.manual_sale_rate,
  });
  return {
    sheet_no: h.sheet_no.trim(),
    design_no: h.design_no || null,
    party_id: h.party_id || null,
    party_name: h.party_name || null,
    quality: h.quality || null,
    reed: h.reed,
    pick: h.pick,
    panna_inch: h.panna_inch,
    length_metre: h.length_metre,
    wastage_pct: h.wastage_pct,
    card_rate: h.card_rate,
    number_of_cards: h.number_of_cards,
    kg_divisor: h.kg_divisor,
    card_divisor: h.card_divisor,
    markup_pct: h.markup_pct ?? null,
    manual_sale_rate: h.manual_sale_rate ?? null,
    unit_basis: h.unit_basis,
    costing_date: h.costing_date || new Date().toISOString().split("T")[0]!,
    remarks: h.remarks || null,
    warp_cost: round2(totals.warpCost),
    weft_cost: round2(totals.weftCost),
    total_kg: round4(totals.totalKg),
    wastage_cost: round2(totals.wastageCost),
    process_cost: round2(totals.processCost),
    card_cost: round2(totals.cardCost),
    final_cost: round2(totals.finalCost),
    sale_rate: round2(totals.saleRate),
  };
}

function toCostLines(lines: CostSheetLine[]): CostLine[] {
  return lines.map((l, i) => ({
    id: l.id ?? `line-${i}`,
    section: l.section,
    label: l.label ?? "",
    material_id: l.material_id ?? null,
    yarn_name: l.yarn_name ?? "",
    quantity: l.quantity,
    denier: l.denier,
    length_metre: l.length_metre,
    panna_inch: l.panna_inch,
    rate_per_kg: l.rate_per_kg,
  }));
}

function toChargeLines(charges: ChargeLine[]): EngineChargeLine[] {
  return charges.map((c, i) => ({
    id: c.id ?? `charge-${i}`,
    charge_name: c.charge_name ?? "",
    rate: c.rate,
    quantity: c.quantity,
  }));
}

// calculated_kg / cost / amount keep their DB defaults: the generated types don't list them
// and nothing reads them; the header stores the computed totals.
function lineRows(sheetId: string, lines: CostSheetLine[]) {
  return toCostLines(lines).map((l, idx) => ({
    cost_sheet_id: sheetId,
    section: l.section,
    label: l.label || null,
    material_id: l.material_id || null,
    yarn_name: l.yarn_name || null,
    quantity: l.quantity,
    denier: l.denier,
    length_metre: l.length_metre,
    panna_inch: l.panna_inch,
    rate_per_kg: l.rate_per_kg,
    sequence: idx + 1,
  }));
}

function chargeRows(sheetId: string, charges: ChargeLine[]) {
  return toChargeLines(charges).map((c, idx) => ({
    cost_sheet_id: sheetId,
    charge_name: c.charge_name || "Charge",
    rate: c.rate,
    quantity: c.quantity,
    sequence: idx + 1,
  }));
}

type CostSheetRow = Database["public"]["Tables"]["cost_sheets"]["Row"];
type CostLineRow = Database["public"]["Tables"]["cost_sheet_lines"]["Row"];
type ChargeRow = Database["public"]["Tables"]["cost_sheet_charges"]["Row"];

const num = (v: number | null | undefined, fallback = 0) => (v == null ? fallback : Number(v));
const opt = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

/** DB row -> header in the service/editor shape (NULL columns become undefined/defaults). */
function mapHeader(row: CostSheetRow): CostSheetHeader {
  return {
    id: row.id,
    sheet_no: row.sheet_no,
    design_no: row.design_no ?? null,
    party_id: row.party_id ?? null,
    party_name: opt(row.party_name),
    quality: opt(row.quality),
    reed: num(row.reed),
    pick: num(row.pick),
    panna_inch: num(row.panna_inch, 49.5),
    length_metre: num(row.length_metre, 6.65),
    wastage_pct: num(row.wastage_pct, 10),
    card_rate: num(row.card_rate),
    number_of_cards: num(row.number_of_cards),
    kg_divisor: num(row.kg_divisor, 9000000),
    card_divisor: num(row.card_divisor, 39.37),
    status: (row.status ?? "draft") as CostSheetHeader["status"],
    version: num(row.version, 1),
    remarks: opt(row.remarks),
    costing_date: opt(row.costing_date),
    prepared_by: opt(row.prepared_by),
    unit_basis: (row.unit_basis ?? "per metre") as CostSheetHeader["unit_basis"],
    markup_pct: row.markup_pct == null ? undefined : Number(row.markup_pct),
    manual_sale_rate: row.manual_sale_rate == null ? undefined : Number(row.manual_sale_rate),
    created_at: opt(row.created_at),
    updated_at: opt(row.updated_at),
  };
}

function mapLine(l: CostLineRow): CostLine {
  return {
    id: l.id,
    section: l.section as "warp" | "weft",
    label: l.label ?? "",
    material_id: l.material_id ?? null,
    yarn_name: l.yarn_name ?? "",
    quantity: num(l.quantity),
    denier: num(l.denier),
    length_metre: num(l.length_metre),
    panna_inch: num(l.panna_inch),
    rate_per_kg: num(l.rate_per_kg),
  };
}

function mapCharge(c: ChargeRow): EngineChargeLine {
  return {
    id: c.id,
    charge_name: c.charge_name ?? "",
    rate: num(c.rate),
    quantity: num(c.quantity),
  };
}

/** Insert a sheet's lines and charges (RLS: the sheet must be a draft owned by the caller). */
async function insertDetails(sheetId: string, sheet: CostSheetFull): Promise<void> {
  if (sheet.lines.length > 0) {
    const { error } = await supabase
      .from("cost_sheet_lines")
      .insert(lineRows(sheetId, sheet.lines));
    if (error) throw new CostSheetError(`Failed to save cost lines: ${error.message}`);
  }
  if (sheet.charges.length > 0) {
    const { error } = await supabase
      .from("cost_sheet_charges")
      .insert(chargeRows(sheetId, sheet.charges));
    if (error) throw new CostSheetError(`Failed to save charges: ${error.message}`);
  }
}

// ============================================================================
// SERVICE: costSheetsService
// ============================================================================

export const costSheetsService = {
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // READ OPERATIONS
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  /**
   * Fetch all cost sheets accessible to current user
   */
  async list(): Promise<CostSheetFull[]> {
    const { data, error } = await supabase
      .from("cost_sheets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new CostSheetError(`Failed to fetch cost sheets: ${error.message}`);
    if (!data || data.length === 0) return [];

    const ids = data.map((h) => h.id);
    const [linesResult, chargesResult] = await Promise.all([
      supabase.from("cost_sheet_lines").select("*").in("cost_sheet_id", ids).order("sequence"),
      supabase.from("cost_sheet_charges").select("*").in("cost_sheet_id", ids).order("sequence"),
    ]);
    if (linesResult.error) {
      throw new CostSheetError(`Failed to fetch cost lines: ${linesResult.error.message}`);
    }
    if (chargesResult.error) {
      throw new CostSheetError(`Failed to fetch charges: ${chargesResult.error.message}`);
    }

    return data.map((row) => ({
      header: mapHeader(row),
      lines: (linesResult.data ?? []).filter((l) => l.cost_sheet_id === row.id).map(mapLine),
      charges: (chargesResult.data ?? []).filter((c) => c.cost_sheet_id === row.id).map(mapCharge),
    }));
  },

  /**
   * Fetch a single cost sheet by ID with all details
   */
  async getById(id: string): Promise<CostSheetFull> {
    const { data: header, error: headerError } = await supabase
      .from("cost_sheets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (headerError) throw new CostSheetError(`Failed to fetch cost sheet: ${headerError.message}`);
    if (!header) throw new NotFoundError("Cost Sheet", id);

    const [linesResult, chargesResult] = await Promise.all([
      supabase.from("cost_sheet_lines").select("*").eq("cost_sheet_id", id).order("sequence"),
      supabase.from("cost_sheet_charges").select("*").eq("cost_sheet_id", id).order("sequence"),
    ]);
    if (linesResult.error) {
      throw new CostSheetError(`Failed to fetch lines: ${linesResult.error.message}`);
    }
    if (chargesResult.error) {
      throw new CostSheetError(`Failed to fetch charges: ${chargesResult.error.message}`);
    }

    return {
      header: mapHeader(header),
      lines: (linesResult.data ?? []).map(mapLine),
      charges: (chargesResult.data ?? []).map(mapCharge),
    };
  },

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // WRITE OPERATIONS
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  /**
   * Create a new cost sheet (draft)
   */
  async create(input: unknown): Promise<CostSheetFull> {
    const validated = CostSheetFullSchema.parse(input);
    const session = await this._getAuthSession();

    const { data: headerData, error: headerError } = await supabase
      .from("cost_sheets")
      .insert([
        {
          ...headerColumns(validated.header, validated.lines, validated.charges),
          status: "draft",
          version: 1,
          prepared_by: validated.header.prepared_by || session.user.email || null,
          // RLS (cs_create, csl_insert) requires created_by = auth.uid().
          created_by: session.user.id,
          updated_by: session.user.email ?? null,
        },
      ])
      .select("id")
      .single();

    if (headerError) {
      if (headerError.code === "23505") {
        throw new ValidationError("sheet_no", "This sheet number already exists");
      }
      throw new CostSheetError(`Failed to create cost sheet: ${headerError.message}`);
    }

    await insertDetails(headerData.id, validated);
    return this.getById(headerData.id);
  },

  /**
   * Update a draft cost sheet (header, lines, charges)
   */
  async update(id: string, input: unknown): Promise<CostSheetFull> {
    const validated = CostSheetFullSchema.parse(input);
    const session = await this._getAuthSession();
    await this.getById(id);

    const { error: headerError } = await supabase
      .from("cost_sheets")
      .update({
        ...headerColumns(validated.header, validated.lines, validated.charges),
        prepared_by: validated.header.prepared_by || session.user.email || null,
        status: validated.header.status,
        version: validated.header.version,
        updated_by: session.user.email ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (headerError) {
      if (headerError.code === "23505") {
        throw new ValidationError("sheet_no", "This sheet number already exists");
      }
      throw new CostSheetError(`Failed to update cost sheet: ${headerError.message}`);
    }

    // Replace lines & charges (RLS allows this only on the owner's draft).
    const delLines = await supabase.from("cost_sheet_lines").delete().eq("cost_sheet_id", id);
    if (delLines.error)
      throw new CostSheetError(`Failed to update lines: ${delLines.error.message}`);
    const delCharges = await supabase.from("cost_sheet_charges").delete().eq("cost_sheet_id", id);
    if (delCharges.error) {
      throw new CostSheetError(`Failed to update charges: ${delCharges.error.message}`);
    }
    await insertDetails(id, validated);

    return this.getById(id);
  },

  /**
   * Approve a cost sheet (RLS: cost_sheet:approve on a draft)
   */
  async approve(id: string): Promise<CostSheetFull> {
    const session = await this._getAuthSession();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("cost_sheets")
      .update({
        status: "approved",
        approved_by: session.user.id,
        approved_at: now,
        updated_by: session.user.email ?? null,
        updated_at: now,
      })
      .eq("id", id);

    if (error) throw new CostSheetError(`Failed to approve cost sheet: ${error.message}`);
    return this.getById(id);
  },

  /**
   * Create a new version of a cost sheet (v1 → v2 → v3)
   */
  async createVersion(originalId: string): Promise<CostSheetFull> {
    const original = await this.getById(originalId);
    const version = original.header.version + 1;
    return this._insertCopy(original, {
      sheet_no: original.header.sheet_no,
      version,
      remarks: `Version ${version} of ${original.header.sheet_no}`,
    });
  },

  /**
   * Duplicate a cost sheet with new sheet number
   */
  async duplicate(originalId: string, newSheetNo: string): Promise<CostSheetFull> {
    const original = await this.getById(originalId);
    return this._insertCopy(original, {
      sheet_no: newSheetNo.trim(),
      version: 1,
      remarks: `Duplicated from ${original.header.sheet_no}`,
    });
  },

  /** Insert a draft copy of `original` (used by createVersion and duplicate). */
  async _insertCopy(
    original: CostSheetFull,
    overrides: { sheet_no: string; version: number; remarks: string },
  ): Promise<CostSheetFull> {
    const session = await this._getAuthSession();
    const header = { ...original.header, sheet_no: overrides.sheet_no, remarks: overrides.remarks };

    const { data: headerData, error: headerError } = await supabase
      .from("cost_sheets")
      .insert([
        {
          ...headerColumns(header, original.lines, original.charges),
          status: "draft",
          version: overrides.version,
          prepared_by: session.user.email ?? null,
          created_by: session.user.id,
          updated_by: session.user.email ?? null,
        },
      ])
      .select("id")
      .single();

    if (headerError) {
      if (headerError.code === "23505") {
        throw new ValidationError("sheet_no", `Sheet number ${overrides.sheet_no} already exists`);
      }
      throw new CostSheetError(`Failed to copy cost sheet: ${headerError.message}`);
    }

    await insertDetails(headerData.id, original);
    return this.getById(headerData.id);
  },

  /**
   * Delete a cost sheet (admin only, RLS enforced)
   */
  async delete(id: string): Promise<void> {
    try {
      // Verify exists
      await this.getById(id);

      const { error } = await supabase.from("cost_sheets").delete().eq("id", id);

      if (error) throw new CostSheetError(`Failed to delete cost sheet: ${error.message}`);
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof CostSheetError) throw err;
      throw new CostSheetError(`Unexpected error deleting cost sheet: ${String(err)}`);
    }
  },

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // CALCULATION & HELPER METHODS
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  /**
   * Compute totals for a cost sheet (uses costing.ts engine)
   */
  computeTotals(
    lines: CostLine[],
    charges: EngineChargeLine[],
    params: {
      wastage_pct: number;
      card_rate: number;
      number_of_cards: number;
      kg_divisor: number;
      card_divisor: number;
      markup_pct?: number;
      manual_sale_rate?: number;
    },
  ) {
    return computeCostSheet({
      lines,
      charges,
      wastage_pct: params.wastage_pct,
      card_rate: params.card_rate,
      number_of_cards: params.number_of_cards,
      kg_divisor: params.kg_divisor,
      card_divisor: params.card_divisor,
      markup_pct: params.markup_pct,
      manual_sale_rate: params.manual_sale_rate,
    });
  },

  /**
   * Get current auth session
   */
  async _getAuthSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      throw new UnauthorizedError();
    }

    return session;
  },
};
