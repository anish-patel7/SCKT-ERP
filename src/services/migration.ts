import { supabase } from "@/integrations/supabase/client";
import {
  validateCostSheets,
  validateYarnMasters,
  validateInventoryItems,
  mapMovementType,
  type CostSheetFull,
  type YarnMaster,
  type InventoryData,
  type ValidationResult,
} from "@/lib/migration-validators";

/**
 * Migration Service for STEP 13: Data Migration
 * Handles batch migration from localStorage to PostgreSQL with validation and error handling
 */

// ============================================================================
// Migration Result Types
// ============================================================================

export interface MigrationProgress {
  phase: "validation" | "import" | "verification";
  status: "pending" | "in_progress" | "completed" | "failed";
  processed: number;
  total: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  message: string;
  startTime: Date;
  estimatedEndTime?: Date;
}

export interface MigrationSummary {
  costSheets: {
    total: number;
    imported: number;
    skipped: number;
    errors: number;
  };
  yarnMasters: {
    total: number;
    imported: number;
    skipped: number;
    errors: number;
  };
  inventoryItems: {
    total: number;
    imported: number;
    skipped: number;
    errors: number;
  };
  inventoryTransactions: {
    total: number;
    imported: number;
    skipped: number;
    errors: number;
  };
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  success: boolean;
}

// ============================================================================
// Cost Sheet Migration
// ============================================================================

export async function migrateCostSheets(
  sheets: CostSheetFull[],
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationSummary["costSheets"]> {
  const startTime = new Date();
  const result = {
    total: sheets.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  if (onProgress) {
    onProgress({
      phase: "validation",
      status: "in_progress",
      processed: 0,
      total: sheets.length,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      message: `Validating ${sheets.length} cost sheets...`,
      startTime,
    });
  }

  // Validate all sheets first
  const validationResult = validateCostSheets(sheets);
  if (!validationResult.valid) {
    result.errors = validationResult.summary.invalid;
    if (onProgress) {
      onProgress({
        phase: "validation",
        status: "failed",
        processed: sheets.length,
        total: sheets.length,
        successCount: 0,
        errorCount: result.errors,
        warningCount: validationResult.summary.warnings,
        message: `Validation failed: ${result.errors} invalid sheet(s)`,
        startTime,
      });
    }
    return result;
  }

  if (onProgress) {
    onProgress({
      phase: "import",
      status: "in_progress",
      processed: 0,
      total: sheets.length,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      message: "Starting import...",
      startTime,
    });
  }

  // Import validated sheets
  for (let i = 0; i < validationResult.data!.length; i++) {
    const sheet = validationResult.data![i];
    try {
      // Check if sheet_no already exists (any version)
      const { data: existing } = await supabase
        .from("cost_sheets")
        .select("id")
        .eq("sheet_no", sheet.header.sheet_no)
        .limit(1);

      if (existing && existing.length > 0) {
        result.skipped++;
        continue;
      }

      // Insert header
      const { data: headerData, error: headerError } = await supabase
        .from("cost_sheets")
        .insert([
          {
            sheet_no: sheet.header.sheet_no,
            design_no: sheet.header.design_no || null,
            party_name: sheet.header.party_name || null,
            quality: sheet.header.quality,
            reed: sheet.header.reed,
            pick: sheet.header.pick,
            panna_inch: sheet.header.panna_inch,
            length_metre: sheet.header.length_metre,
            wastage_pct: sheet.header.wastage_pct,
            card_rate: sheet.header.card_rate,
            number_of_cards: sheet.header.number_of_cards,
            kg_divisor: sheet.header.kg_divisor,
            card_divisor: sheet.header.card_divisor,
            status: sheet.header.status,
            version: sheet.header.version,
            remarks: sheet.header.remarks,
            costing_date: sheet.header.costing_date,
            prepared_by: sheet.header.prepared_by,
            unit_basis: sheet.header.unit_basis,
            markup_pct: sheet.header.markup_pct,
            manual_sale_rate: sheet.header.manual_sale_rate,
            created_by: "migration",
            created_at: new Date(sheet.header.created_at).toISOString(),
            updated_by: "migration",
            updated_at: new Date(sheet.header.updated_at).toISOString(),
          },
        ])
        .select()
        .single();

      if (headerError) {
        console.error(`Failed to insert cost sheet ${sheet.header.sheet_no}:`, headerError);
        result.errors++;
        continue;
      }

      const costSheetId = headerData.id;

      // Insert lines
      for (const line of sheet.lines) {
        await supabase.from("cost_sheet_lines").insert([
          {
            cost_sheet_id: costSheetId,
            section: line.section,
            label: line.label,
            material_id: line.material_id || null,
            yarn_name: line.yarn_name,
            quantity: line.quantity,
            denier: line.denier,
            length_metre: line.length_metre,
            panna_inch: line.panna_inch,
            rate_per_kg: line.rate_per_kg,
          },
        ]);
      }

      // Insert charges
      for (const charge of sheet.charges) {
        await supabase.from("cost_sheet_charges").insert([
          {
            cost_sheet_id: costSheetId,
            charge_name: charge.charge_name,
            rate: charge.rate,
            quantity: charge.quantity,
          },
        ]);
      }

      result.imported++;
    } catch (error) {
      console.error(`Error importing cost sheet ${sheet.header.sheet_no}:`, error);
      result.errors++;
    }

    if (onProgress && i % 10 === 0) {
      onProgress({
        phase: "import",
        status: "in_progress",
        processed: i + 1,
        total: sheets.length,
        successCount: result.imported,
        errorCount: result.errors,
        warningCount: 0,
        message: `Imported ${result.imported}/${sheets.length} cost sheets...`,
        startTime,
      });
    }
  }

  if (onProgress) {
    onProgress({
      phase: "import",
      status: "completed",
      processed: sheets.length,
      total: sheets.length,
      successCount: result.imported,
      errorCount: result.errors,
      warningCount: 0,
      message: `Cost sheet migration complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`,
      startTime,
    });
  }

  return result;
}

// ============================================================================
// Yarn Masters Migration
// ============================================================================

export async function migrateYarnMasters(
  materials: YarnMaster[],
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationSummary["yarnMasters"]> {
  const startTime = new Date();
  const result = {
    total: materials.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  if (onProgress) {
    onProgress({
      phase: "validation",
      status: "in_progress",
      processed: 0,
      total: materials.length,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      message: `Validating ${materials.length} yarn materials...`,
      startTime,
    });
  }

  // Validate all materials
  const validationResult = validateYarnMasters(materials);
  if (!validationResult.valid) {
    result.errors = validationResult.summary.invalid;
    if (onProgress) {
      onProgress({
        phase: "validation",
        status: "failed",
        processed: materials.length,
        total: materials.length,
        successCount: 0,
        errorCount: result.errors,
        warningCount: validationResult.summary.warnings,
        message: `Validation failed: ${result.errors} invalid material(s)`,
        startTime,
      });
    }
    return result;
  }

  if (onProgress) {
    onProgress({
      phase: "import",
      status: "in_progress",
      processed: 0,
      total: materials.length,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      message: "Starting import...",
      startTime,
    });
  }

  // Import validated materials
  for (let i = 0; i < validationResult.data!.length; i++) {
    const material = validationResult.data![i];
    try {
      // Check if code already exists
      const { data: existing } = await supabase
        .from("materials")
        .select("id")
        .eq("code", material.code)
        .single();

      if (existing) {
        result.skipped++;
        continue;
      }

      const { error } = await supabase.from("materials").insert([
        {
          code: material.code,
          name: material.name,
          denier: material.denier,
          rate_per_kg: material.ratePerKg,
          composition: material.composition || null,
          remarks: material.remark || null,
          active: material.active,
          created_by: "migration",
          created_at: new Date().toISOString(),
          updated_by: "migration",
          updated_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error(`Failed to insert yarn material ${material.code}:`, error);
        result.errors++;
      } else {
        result.imported++;
      }
    } catch (error) {
      console.error(`Error importing yarn material ${material.code}:`, error);
      result.errors++;
    }

    if (onProgress && i % 10 === 0) {
      onProgress({
        phase: "import",
        status: "in_progress",
        processed: i + 1,
        total: materials.length,
        successCount: result.imported,
        errorCount: result.errors,
        warningCount: 0,
        message: `Imported ${result.imported}/${materials.length} yarn materials...`,
        startTime,
      });
    }
  }

  if (onProgress) {
    onProgress({
      phase: "import",
      status: "completed",
      processed: materials.length,
      total: materials.length,
      successCount: result.imported,
      errorCount: result.errors,
      warningCount: 0,
      message: `Yarn materials migration complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`,
      startTime,
    });
  }

  return result;
}

// ============================================================================
// Inventory Items & Transactions Migration
// ============================================================================

export async function migrateInventory(
  inventoryData: InventoryData,
  onProgress?: (progress: MigrationProgress) => void
): Promise<{
  items: MigrationSummary["inventoryItems"];
  transactions: MigrationSummary["inventoryTransactions"];
}> {
  const startTime = new Date();
  const itemsResult = {
    total: inventoryData.yarn.length + inventoryData.beams.length + inventoryData.fabricRolls.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };
  const txResult = {
    total: inventoryData.movements.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  if (onProgress) {
    onProgress({
      phase: "validation",
      status: "in_progress",
      processed: 0,
      total: itemsResult.total + txResult.total,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      message: `Validating inventory data...`,
      startTime,
    });
  }

  // Validate inventory data
  const validationResult = validateInventoryItems(inventoryData);
  if (!validationResult.valid) {
    if (onProgress) {
      onProgress({
        phase: "validation",
        status: "failed",
        processed: itemsResult.total + txResult.total,
        total: itemsResult.total + txResult.total,
        successCount: 0,
        errorCount: validationResult.summary.invalid,
        warningCount: validationResult.summary.warnings,
        message: `Inventory validation failed`,
        startTime,
      });
    }
    return { items: itemsResult, transactions: txResult };
  }

  const validData = validationResult.data![0];

  if (onProgress) {
    onProgress({
      phase: "import",
      status: "in_progress",
      processed: 0,
      total: itemsResult.total + txResult.total,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      message: "Starting inventory import...",
      startTime,
    });
  }

  // Map old IDs to new UUIDs for items
  const idMap = new Map<string, string>();

  // Import yarn items
  for (const item of validData.yarn) {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert([
          {
            item_type: "yarn",
            item_code: item.yarn_code,
            item_name: item.yarn_name,
            lot_no: item.lot_no,
            grn_no: item.grn_no,
            total_qty: item.total_kg,
            reserved_qty: item.reserved_kg,
            available_qty: item.available_kg,
            rate_per_unit: item.rate_per_kg,
            cost_basis: item.total_kg * item.rate_per_kg,
            current_location: item.location_bin,
            is_active: true,
            created_by: "migration",
            created_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (error) {
        console.error(`Failed to insert yarn item ${item.yarn_code}:`, error);
        itemsResult.errors++;
      } else {
        idMap.set(item.id, data.id);
        itemsResult.imported++;
      }
    } catch (error) {
      console.error(`Error importing yarn item ${item.yarn_code}:`, error);
      itemsResult.errors++;
    }
  }

  // Import beam items
  for (const item of validData.beams) {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert([
          {
            item_type: "beam",
            item_code: item.beam_no,
            item_name: item.beam_type,
            beam_no: item.beam_no,
            set_no: item.set_no,
            total_qty: item.length_metre,
            reserved_qty: 0,
            available_qty: item.length_metre,
            rate_per_unit: 0, // Will be set from first transaction
            cost_basis: 0,
            current_location: item.location_rack,
            is_active: true,
            created_by: "migration",
            created_at: item.created_at,
          },
        ])
        .select("id")
        .single();

      if (error) {
        console.error(`Failed to insert beam item ${item.beam_no}:`, error);
        itemsResult.errors++;
      } else {
        idMap.set(item.id, data.id);
        itemsResult.imported++;
      }
    } catch (error) {
      console.error(`Error importing beam item ${item.beam_no}:`, error);
      itemsResult.errors++;
    }
  }

  // Import fabric items
  for (const item of validData.fabricRolls) {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert([
          {
            item_type: "fabric",
            item_code: item.roll_no,
            item_name: item.item_code,
            piece_no: item.piece_no,
            design_no: item.design_no,
            total_qty: item.length_metre,
            reserved_qty: 0,
            available_qty: item.length_metre,
            rate_per_unit: 0,
            cost_basis: 0,
            current_location: item.location_bay,
            is_active: !item.is_closed,
            created_by: "migration",
            created_at: item.created_at,
          },
        ])
        .select("id")
        .single();

      if (error) {
        console.error(`Failed to insert fabric item ${item.roll_no}:`, error);
        itemsResult.errors++;
      } else {
        idMap.set(item.id, data.id);
        itemsResult.imported++;
      }
    } catch (error) {
      console.error(`Error importing fabric item ${item.roll_no}:`, error);
      itemsResult.errors++;
    }
  }

  // Import movements (transactions)
  for (const movement of validData.movements) {
    try {
      const newItemId = idMap.get(movement.item_id);
      if (!newItemId) {
        console.warn(`Skipping movement ${movement.id}: Item not imported`);
        txResult.skipped++;
        continue;
      }

      const { error } = await supabase.from("inventory_transactions").insert([
        {
          transaction_date: movement.date,
          movement_type: mapMovementType(movement.movement_type),
          item_id: newItemId,
          qty_change: movement.qty_change,
          unit: movement.unit,
          location_from: movement.location_from,
          location_to: movement.location_to,
          rate_per_unit: 0, // TODO: Extract from item or movement
          cost_value: 0,
          reference_doc: movement.ref_doc,
          created_by: movement.user_name,
          created_at: movement.date,
          remarks: movement.remarks || null,
        },
      ]);

      if (error) {
        console.error(`Failed to insert movement ${movement.id}:`, error);
        txResult.errors++;
      } else {
        txResult.imported++;
      }
    } catch (error) {
      console.error(`Error importing movement ${movement.id}:`, error);
      txResult.errors++;
    }
  }

  if (onProgress) {
    onProgress({
      phase: "import",
      status: "completed",
      processed: itemsResult.total + txResult.total,
      total: itemsResult.total + txResult.total,
      successCount: itemsResult.imported + txResult.imported,
      errorCount: itemsResult.errors + txResult.errors,
      warningCount: 0,
      message: `Inventory migration complete: ${itemsResult.imported} items, ${txResult.imported} transactions imported`,
      startTime,
    });
  }

  return {
    items: itemsResult,
    transactions: txResult,
  };
}

// ============================================================================
// Full Migration Orchestration
// ============================================================================

export async function executeFullMigration(
  costSheets: CostSheetFull[],
  yarnMasters: YarnMaster[],
  inventoryData: InventoryData,
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationSummary> {
  const startTime = new Date();

  try {
    const costSheetsResult = await migrateCostSheets(costSheets, onProgress);
    const yarnMastersResult = await migrateYarnMasters(yarnMasters, onProgress);
    const inventoryResult = await migrateInventory(inventoryData, onProgress);

    const endTime = new Date();

    return {
      costSheets: costSheetsResult,
      yarnMasters: yarnMastersResult,
      inventoryItems: inventoryResult.items,
      inventoryTransactions: inventoryResult.transactions,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      success:
        costSheetsResult.errors === 0 &&
        yarnMastersResult.errors === 0 &&
        inventoryResult.items.errors === 0 &&
        inventoryResult.transactions.errors === 0,
    };
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}
