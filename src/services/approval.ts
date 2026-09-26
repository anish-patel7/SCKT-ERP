import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * STEP 14 Phase 6: Inbound Approval Workflow Service
 *
 * Manages QA inspection and manager approval for inbound transactions:
 * - Record quality inspections with defect tracking
 * - Approve/reject inbound receipts with quality grades
 * - Track approval workflow with audit trail
 * - Adjust inventory based on approval status
 */

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export type ApprovalStatus = "PENDING" | "QA_INSPECTED" | "APPROVED" | "REJECTED" | "PARTIAL_REJECT";
export type QualityGrade = "A" | "B" | "C" | "REJECTED";

export interface InventoryTransaction {
  id: string;
  transaction_date: string;
  movement_type: string;
  reference_doc?: string | null;
  item_id: string;
  qty_change: number;
  unit: string;
  approval_status: ApprovalStatus;
  quality_grade?: QualityGrade | null;
  quality_remarks?: string | null;
  inspected_by?: string | null;
  inspected_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  rejection_qty: number;
  created_at: string;
  created_by: string;
}

export interface QualityInspection {
  id: string;
  transaction_id: string;
  inspection_date: string;
  inspected_by: string;
  quality_grade: QualityGrade;
  remarks?: string | null;
  defects_found: any[];
  sample_size?: number | null;
  defect_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InspectionRequest {
  transaction_id: string;
  quality_grade: QualityGrade;
  remarks?: string;
  defects_found?: string[];
  sample_size?: number;
  defect_count?: number;
}

export interface ApprovalRequest {
  transaction_id: string;
  approval_status: "APPROVED" | "REJECTED" | "PARTIAL_REJECT";
  rejection_qty?: number;
  rejection_reason?: string;
}

export interface ApprovalQueueItem {
  id: string;
  transaction_date: string;
  reference_doc?: string;
  item_code?: string;
  item_name?: string;
  qty_change: number;
  unit: string;
  approval_status: ApprovalStatus;
  quality_grade?: QualityGrade;
  quality_remarks?: string;
  inspected_by?: string;
  inspected_at?: string;
}

// Validation Schemas
const InspectionSchema = z.object({
  transaction_id: z.string().uuid(),
  quality_grade: z.enum(["A", "B", "C", "REJECTED"]),
  remarks: z.string().max(500).optional(),
  defects_found: z.array(z.string()).optional(),
  sample_size: z.number().int().positive().optional(),
  defect_count: z.number().int().nonnegative().optional(),
});

const ApprovalSchema = z.object({
  transaction_id: z.string().uuid(),
  approval_status: z.enum(["APPROVED", "REJECTED", "PARTIAL_REJECT"]),
  rejection_qty: z.number().nonnegative().optional(),
  rejection_reason: z.string().max(500).optional(),
});

type NewInspection = z.infer<typeof InspectionSchema>;
type ApprovalUpdate = z.infer<typeof ApprovalSchema>;

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

export const approvalService = {
  /**
   * Get pending approvals for QA inspection
   */
  async getPendingQAInspections(): Promise<ApprovalQueueItem[]> {
    const { data, error } = await supabase
      .from("inventory_transactions")
      .select(
        `
        id,
        transaction_date,
        reference_doc,
        qty_change,
        unit,
        approval_status,
        quality_grade,
        quality_remarks,
        inventory_items(item_code, item_name)
      `,
      )
      .eq("approval_status", "PENDING")
      .in("movement_type", ["inward_purchase", "inward_production_return"])
      .order("transaction_date", { ascending: true });

    if (error) throw new Error(`Failed to fetch QA queue: ${error.message}`);

    return (data || []).map((t: any) => ({
      id: t.id,
      transaction_date: t.transaction_date,
      reference_doc: t.reference_doc,
      item_code: t.inventory_items?.item_code,
      item_name: t.inventory_items?.item_name,
      qty_change: t.qty_change,
      unit: t.unit,
      approval_status: t.approval_status,
      quality_grade: t.quality_grade,
      quality_remarks: t.quality_remarks,
      inspected_by: t.inspected_by,
      inspected_at: t.inspected_at,
    }));
  },

  /**
   * Get pending approvals for manager review (after QA inspection)
   */
  async getPendingManagerApprovals(): Promise<ApprovalQueueItem[]> {
    const { data, error } = await supabase
      .from("inventory_transactions")
      .select(
        `
        id,
        transaction_date,
        reference_doc,
        qty_change,
        unit,
        approval_status,
        quality_grade,
        quality_remarks,
        inspected_by,
        inspected_at,
        inventory_items(item_code, item_name)
      `,
      )
      .eq("approval_status", "QA_INSPECTED")
      .in("movement_type", ["inward_purchase", "inward_production_return"])
      .order("inspected_at", { ascending: true });

    if (error) throw new Error(`Failed to fetch manager queue: ${error.message}`);

    return (data || []).map((t: any) => ({
      id: t.id,
      transaction_date: t.transaction_date,
      reference_doc: t.reference_doc,
      item_code: t.inventory_items?.item_code,
      item_name: t.inventory_items?.item_name,
      qty_change: t.qty_change,
      unit: t.unit,
      approval_status: t.approval_status,
      quality_grade: t.quality_grade,
      quality_remarks: t.quality_remarks,
      inspected_by: t.inspected_by,
      inspected_at: t.inspected_at,
    }));
  },

  /**
   * Record QA inspection for a transaction
   */
  async recordQAInspection(input: unknown): Promise<{
    transaction: InventoryTransaction;
    inspection: QualityInspection;
  }> {
    const validated = InspectionSchema.parse(input);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (!user || userError) throw new Error("Not authenticated");

    // Get the transaction
    const { data: transaction, error: txError } = await supabase
      .from("inventory_transactions")
      .select("*")
      .eq("id", validated.transaction_id)
      .single();

    if (txError || !transaction) throw new Error("Transaction not found");

    // Create quality inspection record
    const { data: inspection, error: inspectionError } = await supabase
      .from("quality_inspections")
      .insert([
        {
          transaction_id: validated.transaction_id,
          inspected_by: user.email,
          quality_grade: validated.quality_grade,
          remarks: validated.remarks,
          defects_found: validated.defects_found || [],
          sample_size: validated.sample_size,
          defect_count: validated.defect_count || 0,
        },
      ])
      .select()
      .single();

    if (inspectionError)
      throw new Error(`Failed to record inspection: ${inspectionError.message}`);

    // Update transaction with QA inspection status
    const { data: updatedTx, error: updateError } = await supabase
      .from("inventory_transactions")
      .update({
        approval_status: "QA_INSPECTED",
        quality_grade: validated.quality_grade,
        quality_remarks: validated.remarks,
        inspected_by: user.email,
        inspected_at: new Date().toISOString(),
      })
      .eq("id", validated.transaction_id)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to update transaction: ${updateError.message}`);

    // Create approval workflow record
    await supabase.from("approval_workflow").insert([
      {
        transaction_id: validated.transaction_id,
        step_number: 1,
        step_name: "QA_INSPECTION",
        status: "COMPLETED",
        completed_by: user.email,
        completed_at: new Date().toISOString(),
      },
    ]);

    return {
      transaction: updatedTx as InventoryTransaction,
      inspection: inspection as QualityInspection,
    };
  },

  /**
   * Approve an inbound transaction (manager action)
   */
  async approveTransaction(input: unknown): Promise<InventoryTransaction> {
    const validated = ApprovalSchema.parse(input);

    if (validated.approval_status === "REJECTED" && !validated.rejection_reason) {
      throw new Error("Rejection reason required when rejecting");
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (!user || userError) throw new Error("Not authenticated");

    // Get the transaction
    const { data: transaction, error: txError } = await supabase
      .from("inventory_transactions")
      .select("*")
      .eq("id", validated.transaction_id)
      .single();

    if (txError || !transaction) throw new Error("Transaction not found");

    // Update transaction with approval status
    const { data, error } = await supabase
      .from("inventory_transactions")
      .update({
        approval_status:
          validated.approval_status === "PARTIAL_REJECT" ? "PARTIAL_REJECT" : validated.approval_status,
        approved_by: user.email,
        approved_at: new Date().toISOString(),
        rejection_reason: validated.rejection_reason,
        rejection_qty: validated.rejection_qty || 0,
      })
      .eq("id", validated.transaction_id)
      .select()
      .single();

    if (error) throw new Error(`Failed to approve: ${error.message}`);

    // Create approval workflow record
    await supabase.from("approval_workflow").insert([
      {
        transaction_id: validated.transaction_id,
        step_number: 2,
        step_name: "MANAGER_APPROVAL",
        status: "COMPLETED",
        completed_by: user.email,
        completed_at: new Date().toISOString(),
        notes: validated.rejection_reason,
      },
    ]);

    // If partial reject, adjust the qty_change
    if (validated.approval_status === "PARTIAL_REJECT" && validated.rejection_qty) {
      const newQty = transaction.qty_change - validated.rejection_qty;
      await supabase
        .from("inventory_transactions")
        .update({ qty_change: newQty })
        .eq("id", validated.transaction_id);
    }

    return data as InventoryTransaction;
  },

  /**
   * Get inspection details for a transaction
   */
  async getInspectionDetails(transactionId: string): Promise<QualityInspection | null> {
    const { data, error } = await supabase
      .from("quality_inspections")
      .select("*")
      .eq("transaction_id", transactionId)
      .order("inspection_date", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch inspection: ${error.message}`);
    }

    return (data as QualityInspection) || null;
  },

  /**
   * Get approval workflow audit trail
   */
  async getApprovalAuditTrail(transactionId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("approval_workflow")
      .select("*")
      .eq("transaction_id", transactionId)
      .order("step_number", { ascending: true });

    if (error) throw new Error(`Failed to fetch audit trail: ${error.message}`);
    return data || [];
  },

  /**
   * Get approval statistics
   */
  async getApprovalStats(): Promise<{
    pending_qa: number;
    pending_approval: number;
    approved_today: number;
    rejected_today: number;
  }> {
    const today = new Date().toISOString().split("T")[0];

    const [pendingQA, pendingApproval, approvedToday, rejectedToday] = await Promise.all([
      supabase
        .from("inventory_transactions")
        .select("id", { count: "exact" })
        .eq("approval_status", "PENDING")
        .in("movement_type", ["inward_purchase", "inward_production_return"]),
      supabase
        .from("inventory_transactions")
        .select("id", { count: "exact" })
        .eq("approval_status", "QA_INSPECTED")
        .in("movement_type", ["inward_purchase", "inward_production_return"]),
      supabase
        .from("inventory_transactions")
        .select("id", { count: "exact" })
        .eq("approval_status", "APPROVED")
        .gte("approved_at", `${today}T00:00:00`)
        .in("movement_type", ["inward_purchase", "inward_production_return"]),
      supabase
        .from("inventory_transactions")
        .select("id", { count: "exact" })
        .eq("approval_status", "REJECTED")
        .gte("approved_at", `${today}T00:00:00`)
        .in("movement_type", ["inward_purchase", "inward_production_return"]),
    ]);

    return {
      pending_qa: pendingQA.count || 0,
      pending_approval: pendingApproval.count || 0,
      approved_today: approvedToday.count || 0,
      rejected_today: rejectedToday.count || 0,
    };
  },
};
