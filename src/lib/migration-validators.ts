import { z } from "zod";

/**
 * Migration Validators for STEP 13: Data Migration
 * Zod schemas for validating localStorage data before import to PostgreSQL
 */

// ============================================================================
// Cost Sheet Validation Schemas
// ============================================================================

export const CostSheetLineSchema = z.object({
  id: z.string(),
  section: z.enum(["warp", "weft"]),
  label: z.string().optional(),
  material_id: z.string().nullable().optional(),
  yarn_name: z.string(),
  quantity: z.number().nonnegative(),
  denier: z.number().nonnegative(),
  length_metre: z.number().nonnegative(),
  panna_inch: z.number().nonnegative(),
  rate_per_kg: z.number().nonnegative(),
});

export type CostSheetLine = z.infer<typeof CostSheetLineSchema>;

export const CostSheetChargeSchema = z.object({
  id: z.string(),
  charge_name: z.string(),
  rate: z.number().nonnegative(),
  quantity: z.number().nonnegative(),
});

export type CostSheetCharge = z.infer<typeof CostSheetChargeSchema>;

export const CostSheetHeaderSchema = z.object({
  id: z.string(),
  sheet_no: z.string().min(1).max(50),
  design_no: z.string().optional(),
  party_id: z.string().nullable().optional(),
  party_name: z.string().optional(),
  quality: z.string().max(500).optional(),
  reed: z.number().int().positive().optional(),
  pick: z.number().int().positive().optional(),
  panna_inch: z.number().positive().default(49.5),
  length_metre: z.number().positive().default(6.65),
  wastage_pct: z.number().nonnegative().default(10),
  card_rate: z.number().nonnegative().default(0),
  number_of_cards: z.number().int().nonnegative().default(0),
  kg_divisor: z.number().int().positive().default(9000000),
  card_divisor: z.number().positive().default(39.37),
  markup_pct: z.number().optional(),
  manual_sale_rate: z.number().optional(),
  status: z.enum(["draft", "approved", "archived"]),
  version: z.number().int().positive().default(1),
  remarks: z.string().optional(),
  costing_date: z.string().optional(),
  prepared_by: z.string().optional(),
  unit_basis: z.enum(["per metre", "per piece"]).default("per metre"),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CostSheetHeader = z.infer<typeof CostSheetHeaderSchema>;

export const CostSheetFullSchema = z.object({
  header: CostSheetHeaderSchema,
  lines: z.array(CostSheetLineSchema),
  charges: z.array(CostSheetChargeSchema),
});

export type CostSheetFull = z.infer<typeof CostSheetFullSchema>;

// ============================================================================
// Yarn Masters Validation Schema
// ============================================================================

export const YarnMasterSchema = z.object({
  id: z.string(),
  code: z.string().regex(/^Y-\d+$/, "Code must match pattern Y-NN"),
  name: z.string().min(1).max(200),
  denier: z.number().positive(),
  ratePerKg: z.number().positive(),
  composition: z.string().optional(),
  remark: z.string().optional(),
  active: z.boolean().default(true),
  updatedAt: z.string(),
});

export type YarnMaster = z.infer<typeof YarnMasterSchema>;

// ============================================================================
// Inventory Validation Schemas
// ============================================================================

export const YarnStockItemSchema = z.object({
  id: z.string(),
  lot_no: z.string(),
  yarn_code: z.string().min(1).max(50),
  yarn_name: z.string().min(1).max(200),
  supplier_name: z.string().optional(),
  grn_no: z.string().optional(),
  location_bin: z.string().optional(),
  total_kg: z.number().nonnegative(),
  reserved_kg: z.number().nonnegative(),
  available_kg: z.number().nonnegative(),
  rate_per_kg: z.number().nonnegative(),
  reorder_level_kg: z.number().nonnegative().optional(),
  received_date: z.string().optional(),
  fifo_priority: z.number().int().nonnegative().optional(),
});

export type YarnStockItem = z.infer<typeof YarnStockItemSchema>;

export const BeamStockItemSchema = z.object({
  id: z.string(),
  beam_no: z.string().min(1).max(50),
  beam_type: z.string(),
  count: z.string().optional(),
  set_no: z.string().optional(),
  warp_yarn_code: z.string().optional(),
  total_ends: z.number().nonnegative().optional(),
  length_metre: z.number().nonnegative(),
  location_rack: z.string().optional(),
  status: z.enum(["in_store", "loaded_on_loom", "sizing", "depleted"]).optional(),
  loom_no: z.string().nullable().optional(),
  qr_code: z.string().optional(),
  created_at: z.string(),
});

export type BeamStockItem = z.infer<typeof BeamStockItemSchema>;

export const FabricRollItemSchema = z.object({
  id: z.string(),
  roll_no: z.string().min(1).max(50),
  piece_no: z.string().optional(),
  item_code: z.string().optional(),
  design_no: z.string().optional(),
  length_metre: z.number().nonnegative(),
  weight_kg: z.number().nonnegative().optional(),
  location_bay: z.string().optional(),
  stage: z.enum(["grey", "processing", "finished", "dispatched"]).optional(),
  grade: z.enum(["Grade A", "Grade B", "Grade C", "Hold"]).optional(),
  parent_roll_id: z.string().nullable().optional(),
  job_card_no: z.string().optional(),
  beam_no: z.string().optional(),
  yarn_lot_no: z.string().optional(),
  qr_code: z.string().optional(),
  created_at: z.string(),
  is_closed: z.boolean().optional(),
});

export type FabricRollItem = z.infer<typeof FabricRollItemSchema>;

export const StockMovementSchema = z.object({
  id: z.string(),
  date: z.string().datetime(),
  movement_type: z.enum([
    "inward_grn",
    "issue_to_production",
    "beam_warping",
    "roll_weave",
    "roll_split",
    "location_transfer",
    "dispatch",
  ]),
  ref_doc: z.string(),
  item_type: z.enum(["yarn", "beam", "fabric"]),
  item_id: z.string(),
  item_label: z.string(),
  qty_change: z.number().refine((n) => n !== 0, "qty_change must not be zero"),
  unit: z.enum(["kg", "m", "beam", "roll"]),
  location_from: z.string(),
  location_to: z.string(),
  user_name: z.string(),
  remarks: z.string().optional(),
});

export type StockMovement = z.infer<typeof StockMovementSchema>;

export const InventoryDataSchema = z.object({
  yarn: z.array(YarnStockItemSchema),
  beams: z.array(BeamStockItemSchema),
  fabricRolls: z.array(FabricRollItemSchema),
  movements: z.array(StockMovementSchema),
});

export type InventoryData = z.infer<typeof InventoryDataSchema>;

// ============================================================================
// Migration Validation Results
// ============================================================================

export interface ValidationResult<T> {
  valid: boolean;
  data?: T[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
}

export interface ValidationError {
  index: number;
  record: string;
  field: string;
  message: string;
  severity: "critical" | "error";
}

export interface ValidationWarning {
  index: number;
  record: string;
  field: string;
  message: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

export function validateCostSheets(
  data: unknown[]
): ValidationResult<CostSheetFull> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const validData: CostSheetFull[] = [];

  data.forEach((item, idx) => {
    try {
      const parsed = CostSheetFullSchema.parse(item);

      // Additional validation: sheet_no uniqueness
      const duplicateIndex = validData.findIndex(
        (cs) => cs.header.sheet_no === parsed.header.sheet_no
      );
      if (duplicateIndex >= 0) {
        warnings.push({
          index: idx,
          record: parsed.header.sheet_no,
          field: "sheet_no",
          message: `Duplicate sheet_no (first occurrence at index ${duplicateIndex})`,
        });
      }

      // Additional validation: Must have at least one line
      if (parsed.lines.length === 0) {
        errors.push({
          index: idx,
          record: parsed.header.sheet_no,
          field: "lines",
          message: "Cost sheet must have at least one warp or weft line",
          severity: "error",
        });
      } else {
        validData.push(parsed);
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        e.errors.forEach((err) => {
          errors.push({
            index: idx,
            record: item?.toString() || "unknown",
            field: err.path.join("."),
            message: err.message,
            severity: "critical",
          });
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    data: validData,
    errors,
    warnings,
    summary: {
      total: data.length,
      valid: validData.length,
      invalid: errors.length > 0 ? 1 : 0,
      warnings: warnings.length,
    },
  };
}

export function validateYarnMasters(
  data: unknown[]
): ValidationResult<YarnMaster> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const validData: YarnMaster[] = [];
  const seenCodes = new Set<string>();

  data.forEach((item, idx) => {
    try {
      const parsed = YarnMasterSchema.parse(item);

      // Check for duplicate codes
      if (seenCodes.has(parsed.code)) {
        warnings.push({
          index: idx,
          record: parsed.code,
          field: "code",
          message: `Duplicate yarn code`,
        });
      } else {
        seenCodes.add(parsed.code);
      }

      // Check for duplicate names
      const duplicateNameIndex = validData.findIndex(
        (y) => y.name.toLowerCase() === parsed.name.toLowerCase()
      );
      if (duplicateNameIndex >= 0) {
        warnings.push({
          index: idx,
          record: parsed.code,
          field: "name",
          message: `Duplicate yarn name (first at index ${duplicateNameIndex})`,
        });
      }

      validData.push(parsed);
    } catch (e) {
      if (e instanceof z.ZodError) {
        e.errors.forEach((err) => {
          errors.push({
            index: idx,
            record: item?.toString() || "unknown",
            field: err.path.join("."),
            message: err.message,
            severity: "critical",
          });
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    data: validData,
    errors,
    warnings,
    summary: {
      total: data.length,
      valid: validData.length,
      invalid: data.length - validData.length,
      warnings: warnings.length,
    },
  };
}

export function validateInventoryItems(
  data: unknown
): ValidationResult<InventoryData> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const parsed = InventoryDataSchema.parse(data);

    // Check for duplicate yarn codes
    const yarnCodes = new Set<string>();
    parsed.yarn.forEach((item, idx) => {
      if (yarnCodes.has(item.yarn_code)) {
        warnings.push({
          index: idx,
          record: item.yarn_code,
          field: "yarn_code",
          message: "Duplicate yarn code in inventory",
        });
      }
      yarnCodes.add(item.yarn_code);
    });

    // Check for duplicate beam numbers
    const beamNos = new Set<string>();
    parsed.beams.forEach((item, idx) => {
      if (beamNos.has(item.beam_no)) {
        warnings.push({
          index: idx,
          record: item.beam_no,
          field: "beam_no",
          message: "Duplicate beam number in inventory",
        });
      }
      beamNos.add(item.beam_no);
    });

    // Check for duplicate roll numbers
    const rollNos = new Set<string>();
    parsed.fabricRolls.forEach((item, idx) => {
      if (rollNos.has(item.roll_no)) {
        warnings.push({
          index: idx,
          record: item.roll_no,
          field: "roll_no",
          message: "Duplicate roll number in inventory",
        });
      }
      rollNos.add(item.roll_no);
    });

    // Validate movements reference existing items
    const allItemIds = new Set([
      ...parsed.yarn.map((y) => y.id),
      ...parsed.beams.map((b) => b.id),
      ...parsed.fabricRolls.map((f) => f.id),
    ]);

    parsed.movements.forEach((mvt, idx) => {
      if (!allItemIds.has(mvt.item_id)) {
        errors.push({
          index: idx,
          record: mvt.id,
          field: "item_id",
          message: `Movement references non-existent item: ${mvt.item_id}`,
          severity: "error",
        });
      }
    });

    return {
      valid: errors.length === 0,
      data: errors.length === 0 ? [parsed] : undefined,
      errors,
      warnings,
      summary: {
        total: 1,
        valid: errors.length === 0 ? 1 : 0,
        invalid: errors.length === 0 ? 0 : 1,
        warnings: warnings.length,
      },
    };
  } catch (e) {
    if (e instanceof z.ZodError) {
      e.errors.forEach((err) => {
        errors.push({
          index: 0,
          record: "inventory_data",
          field: err.path.join("."),
          message: err.message,
          severity: "critical",
        });
      });
    }
    return {
      valid: false,
      errors,
      warnings,
      summary: {
        total: 1,
        valid: 0,
        invalid: 1,
        warnings: warnings.length,
      },
    };
  }
}

// ============================================================================
// Movement Type Mapping
// ============================================================================

export const MovementTypeMap: Record<
  StockMovement["movement_type"],
  string
> = {
  inward_grn: "inward_purchase",
  issue_to_production: "issue_to_production",
  beam_warping: "inward_production_return",
  roll_weave: "issue_to_production",
  roll_split: "issue_to_production",
  location_transfer: "location_transfer",
  dispatch: "dispatch",
};

/**
 * Map legacy movement type to new PostgreSQL movement type
 */
export function mapMovementType(
  oldType: StockMovement["movement_type"]
): string {
  return MovementTypeMap[oldType] || oldType;
}
