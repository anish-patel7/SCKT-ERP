/**
 * STEP 23 PHASE 6: Quality & Inventory Integration
 *
 * Coordinate between Quality Inspection system (M35) and Inventory system:
 * - Update fabric roll grade when inspection grade is set/overridden
 * - Block dispatch of rolls in Quality Hold status (BR-153)
 * - Maintain audit trail across both systems
 */

import { supabase } from "@/integrations/supabase/client";
import type { ProductionInspection } from "./quality";

export interface QualityHoldState {
  isOnHold: boolean;
  heldSince?: string;
  heldBy?: string;
  holdReason?: string;
  canDispatch: boolean;
}

class QualityIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QualityIntegrationError";
  }
}

/**
 * Update inventory fabric roll grade when inspection is created/updated
 * Maintains BR-153: Grade information flows from Quality to Inventory
 */
export async function updateFabricRollGrade(
  rollNo: string,
  grade: string
): Promise<void> {
  const { error } = await supabase
    .from("fabric_rolls")
    .update({
      grade: grade,
      updated_at: new Date().toISOString(),
    })
    .eq("roll_no", rollNo);

  if (error) {
    console.error("Failed to update fabric roll grade:", error);
    throw new QualityIntegrationError(
      `Failed to update grade for roll ${rollNo}: ${error.message}`
    );
  }
}

/**
 * Check if a roll is under quality hold
 * Used to block inventory dispatch operations
 */
export async function getQualityHoldState(
  rollNo: string
): Promise<QualityHoldState> {
  // Get latest inspection for this roll
  const { data: inspection, error: inspectionError } = await supabase
    .from("production_inspections")
    .select("id, system_grade, manual_grade_override")
    .eq("roll_no", rollNo)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (inspectionError && inspectionError.code !== "PGRST116") {
    // PGRST116 = no rows returned (expected if not inspected)
    console.error("Failed to fetch inspection:", inspectionError);
    throw new QualityIntegrationError(
      `Failed to check quality status for roll ${rollNo}`
    );
  }

  // No inspection = not on hold
  if (!inspection) {
    return {
      isOnHold: false,
      canDispatch: true,
    };
  }

  const finalGrade = inspection.manual_grade_override || inspection.system_grade;
  const isHeld = finalGrade === "Hold";

  if (!isHeld) {
    return {
      isOnHold: false,
      canDispatch: true,
    };
  }

  // Get hold record for additional context
  const { data: holdRecord } = await supabase
    .from("quality_hold_records")
    .select("held_at, held_by, hold_reason, released_at")
    .eq("production_inspection_id", inspection.id)
    .eq("released_at", null)
    .order("held_at", { ascending: false })
    .limit(1)
    .single();

  return {
    isOnHold: true,
    heldSince: holdRecord?.held_at,
    heldBy: holdRecord?.held_by,
    holdReason: holdRecord?.hold_reason,
    canDispatch: false, // BR-153: Quality hold blocks dispatch
  };
}

/**
 * Record quality hold on a roll
 * Called when inspection system grade is "Hold" or manager overrides to "Hold"
 */
export async function recordQualityHold(
  productionInspectionId: string,
  rollNo: string,
  reason: string
): Promise<void> {
  const currentUser = await supabase.auth.getUser();
  const userId = currentUser.data.user?.email || "system";

  const { error } = await supabase
    .from("quality_hold_records")
    .insert([
      {
        production_inspection_id: productionInspectionId,
        roll_no: rollNo,
        hold_reason: reason,
        held_by: userId,
      },
    ]);

  if (error) {
    console.error("Failed to record quality hold:", error);
    throw new QualityIntegrationError(
      `Failed to record hold for roll ${rollNo}: ${error.message}`
    );
  }
}

/**
 * Release quality hold on a roll
 * Called when manager approves release of previously held roll
 */
export async function releaseQualityHold(
  productionInspectionId: string,
  rollNo: string,
  releaseReason: string
): Promise<void> {
  const currentUser = await supabase.auth.getUser();
  const userId = currentUser.data.user?.email || "system";

  const { error } = await supabase
    .from("quality_hold_records")
    .update({
      released_by: userId,
      released_at: new Date().toISOString(),
      release_reason: releaseReason,
    })
    .eq("production_inspection_id", productionInspectionId)
    .eq("released_at", null);

  if (error) {
    console.error("Failed to release quality hold:", error);
    throw new QualityIntegrationError(
      `Failed to release hold for roll ${rollNo}: ${error.message}`
    );
  }
}

/**
 * Get all rolls currently on quality hold
 * Used in inventory dispatch workflow to prevent release
 */
export async function getQualityHeldRolls(): Promise<
  Array<{
    roll_no: string;
    held_since: string;
    held_by: string;
    hold_reason: string;
  }>
> {
  const { data, error } = await supabase
    .from("quality_hold_records")
    .select(
      `
      roll_no,
      held_at,
      held_by,
      hold_reason,
      production_inspections(id)
    `
    )
    .is("released_at", null)
    .order("held_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch quality held rolls:", error);
    throw new QualityIntegrationError(
      `Failed to fetch quality holds: ${error.message}`
    );
  }

  return (data || []).map((record: any) => ({
    roll_no: record.roll_no,
    held_since: record.held_at,
    held_by: record.held_by,
    hold_reason: record.hold_reason,
  }));
}

/**
 * Validate that inspection update does not violate constraints
 * E.g., cannot mark as inspected if already dispatched
 */
export async function validateInspectionUpdate(
  rollNo: string,
  newGrade: string
): Promise<{
  isValid: boolean;
  reason?: string;
}> {
  // Check if roll has already been dispatched from inventory
  const { data: fabricRoll, error: fabricError } = await supabase
    .from("fabric_rolls")
    .select("status, dispatch_date")
    .eq("roll_no", rollNo)
    .single();

  if (fabricError && fabricError.code !== "PGRST116") {
    console.error("Failed to check fabric roll status:", fabricError);
    throw new QualityIntegrationError(
      `Failed to validate roll ${rollNo}: ${fabricError.message}`
    );
  }

  if (fabricRoll && fabricRoll.dispatch_date) {
    return {
      isValid: false,
      reason: `Cannot update inspection: Roll ${rollNo} was already dispatched on ${fabricRoll.dispatch_date}`,
    };
  }

  // If new grade is "Hold", ensure we can apply the hold
  if (newGrade === "Hold") {
    if (fabricRoll && fabricRoll.status === "dispatched") {
      return {
        isValid: false,
        reason: `Cannot place hold: Roll ${rollNo} has already been dispatched`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Get quality summary for a roll
 * Used in inventory detail view to show inspection history
 */
export async function getRollQualitySummary(rollNo: string): Promise<{
  hasInspection: boolean;
  finalGrade?: string;
  systemGrade?: string;
  manualGrade?: string;
  overrideReason?: string;
  isHeld: boolean;
  holdReason?: string;
  defectCount?: number;
  pointsPer100SqYd?: number;
}> {
  const { data: inspection, error: inspectionError } = await supabase
    .from("production_inspections")
    .select(
      `
      system_grade,
      manual_grade_override,
      override_reason,
      defects,
      points_per_100_sq_yd
    `
    )
    .eq("roll_no", rollNo)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (inspectionError && inspectionError.code !== "PGRST116") {
    console.error("Failed to fetch inspection for summary:", inspectionError);
    return { hasInspection: false, isHeld: false };
  }

  if (!inspection) {
    return { hasInspection: false, isHeld: false };
  }

  const holdState = await getQualityHoldState(rollNo);
  const defects = typeof inspection.defects === "string"
    ? JSON.parse(inspection.defects)
    : inspection.defects || [];

  return {
    hasInspection: true,
    finalGrade: inspection.manual_grade_override || inspection.system_grade,
    systemGrade: inspection.system_grade,
    manualGrade: inspection.manual_grade_override,
    overrideReason: inspection.override_reason,
    isHeld: holdState.isOnHold,
    holdReason: holdState.holdReason,
    defectCount: defects.length,
    pointsPer100SqYd: inspection.points_per_100_sq_yd,
  };
}
