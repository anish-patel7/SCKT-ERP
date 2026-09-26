import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export const DefectEntrySchema = z.object({
  id: z.string(),
  defect_type: z.enum([
    "weft_slub",
    "warp_float",
    "broken_end",
    "oil_stain",
    "hole",
    "tension_variation",
  ]),
  size_inches: z.number().positive(),
  points_scored: z.number().nonnegative(),
  yard_position: z.number().positive(),
  x_position_inch: z.number().nonnegative(),
});

export const ProductionInspectionSchema = z.object({
  id: z.string().uuid().optional(),
  inspection_no: z.string().min(1).max(50).optional(),
  roll_id: z.string().uuid().optional(),
  roll_no: z.string().min(1).max(100),
  item_code: z.string().min(1).max(100),
  design_no: z.string().min(1).max(100),
  loom_no: z.string().min(1).max(50),
  shift: z.enum(["A", "B", "C"]),
  operator_name: z.string().max(200).optional(),
  roll_length_yd: z.number().positive(),
  roll_width_inch: z.number().positive(),
  defects: z.array(DefectEntrySchema).default([]),
  total_raw_points: z.number().nonnegative(),
  capped_points: z.number().nonnegative(),
  points_per_100_sq_yd: z.number().nonnegative(),
  system_grade: z.enum(["Grade A", "Grade B", "Grade C", "Hold"]),
  manual_grade_override: z
    .enum(["Grade A", "Grade B", "Grade C", "Hold"])
    .optional(),
  override_reason: z.string().optional(),
  status: z.enum(["verified", "pending_supervisor"]).default("verified"),
  verified_by: z.string().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
});

export const ShadeApprovalSchema = z.object({
  id: z.string().uuid().optional(),
  lab_dip_no: z.string().min(1).max(50).optional(),
  customer_name: z.string().min(1).max(200),
  design_no: z.string().min(1).max(100),
  shade_name: z.string().min(1).max(200),
  hex_color: z.string().regex(/^#[0-9A-F]{6}$/i),
  delta_e_value: z.number().nonnegative(),
  status: z.enum(["approved", "pending_buyer", "rejected"]).optional(),
  buyer_remarks: z.string().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
});

export const LabTestSchema = z.object({
  id: z.string().uuid().optional(),
  test_no: z.string().min(1).max(50).optional(),
  roll_no: z.string().min(1).max(100),
  gsm_actual: z.number().positive(),
  gsm_spec: z.number().positive(),
  tear_strength_warp: z.number().nonnegative().optional(),
  tear_strength_weft: z.number().nonnegative().optional(),
  shrinkage_pct: z.number().nonnegative().optional(),
  status: z.enum(["pass", "fail"]).optional(),
  is_active: z.boolean().default(true),
  tested_at: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
});

export type DefectEntry = z.infer<typeof DefectEntrySchema>;
export type ProductionInspection = z.infer<typeof ProductionInspectionSchema>;
export type ShadeApproval = z.infer<typeof ShadeApprovalSchema>;
export type LabTest = z.infer<typeof LabTestSchema>;

class QualityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QualityError";
  }
}

class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// ============================================================================
// PRODUCTION INSPECTIONS SERVICE
// ============================================================================

export const productionInspectionsService = {
  async list(filters?: {
    status?: string;
    gradeFilter?: string;
    search?: string;
  }): Promise<ProductionInspection[]> {
    let query = supabase.from("production_inspections").select("*");

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.gradeFilter && filters.gradeFilter !== "all") {
      query = query.eq("system_grade", filters.gradeFilter);
    }

    const { data, error } = await query.eq("is_active", true);

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(
        `Failed to fetch inspections: ${error.message}`
      );
    }

    const results = (data || []) as ProductionInspection[];

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      return results.filter(
        (i) =>
          i.inspection_no.toLowerCase().includes(q) ||
          i.roll_no.toLowerCase().includes(q) ||
          i.item_code.toLowerCase().includes(q) ||
          i.design_no.toLowerCase().includes(q) ||
          i.loom_no.toLowerCase().includes(q),
      );
    }

    return results;
  },

  async getById(id: string): Promise<ProductionInspection> {
    const { data, error } = await supabase
      .from("production_inspections")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(`Inspection not found: ${id}`);
    }

    return data as ProductionInspection;
  },

  async create(input: unknown): Promise<ProductionInspection> {
    const validated = ProductionInspectionSchema.parse(input);

    const inspectionNo = `INS-${Date.now()}`;
    const currentUser = await supabase.auth.getUser();
    const userId = currentUser.data.user?.email || "system";

    const { data, error } = await supabase
      .from("production_inspections")
      .insert([
        {
          inspection_no: inspectionNo,
          roll_no: validated.roll_no,
          item_code: validated.item_code,
          design_no: validated.design_no,
          loom_no: validated.loom_no,
          shift: validated.shift,
          operator_name: validated.operator_name,
          roll_length_yd: validated.roll_length_yd,
          roll_width_inch: validated.roll_width_inch,
          defects: validated.defects,
          total_raw_points: validated.total_raw_points,
          capped_points: validated.capped_points,
          points_per_100_sq_yd: validated.points_per_100_sq_yd,
          system_grade: validated.system_grade,
          status: validated.status,
          verified_by: validated.verified_by,
          created_by: userId,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(`Failed to create inspection: ${error.message}`);
    }

    return data as ProductionInspection;
  },

  async update(
    id: string,
    updates: unknown
  ): Promise<ProductionInspection> {
    const partial = ProductionInspectionSchema.partial().parse(updates);
    const currentUser = await supabase.auth.getUser();
    const userId = currentUser.data.user?.email || "system";

    const { data, error } = await supabase
      .from("production_inspections")
      .update({
        ...partial,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(`Failed to update inspection: ${error.message}`);
    }

    return data as ProductionInspection;
  },

  async overrideGrade(
    id: string,
    grade: string,
    reason: string
  ): Promise<ProductionInspection> {
    if (!reason.trim()) {
      throw new ValidationError(
        "override_reason",
        "Audit reason required for grade override (BR-152)"
      );
    }

    const currentUser = await supabase.auth.getUser();
    const userId = currentUser.data.user?.email || "system";

    const { data, error } = await supabase
      .from("production_inspections")
      .update({
        manual_grade_override: grade,
        override_reason: reason.trim(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(
        `Failed to override grade: ${error.message}`
      );
    }

    return data as ProductionInspection;
  },

  // ===== ATOMIC RPC: Complete Quality Inspection =====
  // Applies grade decision and creates saleable inventory record
  async completeQualityInspection(
    inspectionId: string,
    systemGrade: string,
    overrideGrade?: string,
    decisionBy?: string,
  ): Promise<{ final_grade: string; saleable_qty: number; decision_at: string }> {
    const { data, error } = await supabase.rpc("complete_quality_inspection", {
      p_inspection_id: inspectionId,
      p_system_grade: systemGrade,
      p_override_grade: overrideGrade || null,
      p_decision_by: decisionBy || null,
    });

    if (error) {
      console.error("RPC error:", error);
      throw new QualityError(`Failed to complete quality inspection: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new QualityError("Quality inspection completion RPC returned no results");
    }

    const result = data[0];
    return {
      final_grade: result.final_grade,
      saleable_qty: result.saleable_qty,
      decision_at: result.decision_at,
    };
  },
};

// ============================================================================
// SHADE APPROVALS SERVICE
// ============================================================================

export const shadeApprovalsService = {
  async list(filters?: { status?: string; search?: string }): Promise<ShadeApproval[]> {
    let query = supabase.from("shade_approvals").select("*");

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query.eq("is_active", true);

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(`Failed to fetch shade approvals: ${error.message}`);
    }

    const results = (data || []) as ShadeApproval[];

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      return results.filter(
        (s) =>
          s.lab_dip_no.toLowerCase().includes(q) ||
          s.customer_name.toLowerCase().includes(q) ||
          s.design_no.toLowerCase().includes(q) ||
          s.shade_name.toLowerCase().includes(q),
      );
    }

    return results;
  },

  async getById(id: string): Promise<ShadeApproval> {
    const { data, error } = await supabase
      .from("shade_approvals")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(`Shade approval not found: ${id}`);
    }

    return data as ShadeApproval;
  },

  async create(input: unknown): Promise<ShadeApproval> {
    const validated = ShadeApprovalSchema.parse(input);
    const currentUser = await supabase.auth.getUser();
    const userId = currentUser.data.user?.email || "system";

    const deltaE = validated.delta_e_value;
    const status = deltaE <= 1.0 ? "approved" : "pending_buyer";

    const labDipNo = `LIP-${Date.now()}`;

    const { data, error } = await supabase
      .from("shade_approvals")
      .insert([
        {
          lab_dip_no: labDipNo,
          customer_name: validated.customer_name,
          design_no: validated.design_no,
          shade_name: validated.shade_name,
          hex_color: validated.hex_color,
          delta_e_value: deltaE,
          status: status,
          buyer_remarks: validated.buyer_remarks,
          created_by: userId,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(`Failed to create shade approval: ${error.message}`);
    }

    return data as ShadeApproval;
  },

  async updateStatus(
    id: string,
    status: "approved" | "pending_buyer" | "rejected"
  ): Promise<ShadeApproval> {
    const currentUser = await supabase.auth.getUser();
    const userId = currentUser.data.user?.email || "system";

    const { data, error } = await supabase
      .from("shade_approvals")
      .update({
        status: status,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(`Failed to update shade status: ${error.message}`);
    }

    return data as ShadeApproval;
  },
};

// ============================================================================
// LAB TESTS SERVICE
// ============================================================================

export const labTestsService = {
  async list(filters?: { status?: string }): Promise<LabTest[]> {
    let query = supabase.from("lab_tests").select("*");

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query.eq("is_active", true);

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(`Failed to fetch lab tests: ${error.message}`);
    }

    return (data || []) as LabTest[];
  },

  async getById(id: string): Promise<LabTest> {
    const { data, error } = await supabase
      .from("lab_tests")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(`Lab test not found: ${id}`);
    }

    return data as LabTest;
  },

  async create(input: unknown): Promise<LabTest> {
    const validated = LabTestSchema.parse(input);
    const currentUser = await supabase.auth.getUser();
    const userId = currentUser.data.user?.email || "system";

    const gsmActual = validated.gsm_actual;
    const gsmSpec = validated.gsm_spec;
    const shrink = validated.shrinkage_pct || 0;

    const isPass = Math.abs(gsmActual - gsmSpec) <= 10 && shrink <= 3.0;
    const testNo = `LAB-${Date.now()}`;

    const { data, error } = await supabase
      .from("lab_tests")
      .insert([
        {
          test_no: testNo,
          roll_no: validated.roll_no,
          gsm_actual: gsmActual,
          gsm_spec: gsmSpec,
          tear_strength_warp: validated.tear_strength_warp,
          tear_strength_weft: validated.tear_strength_weft,
          shrinkage_pct: shrink,
          status: isPass ? "pass" : "fail",
          created_by: userId,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new QualityError(`Failed to create lab test: ${error.message}`);
    }

    return data as LabTest;
  },
};
