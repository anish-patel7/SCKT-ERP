import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * STEP 21 PHASE 3: Manufacturing Processes Service
 * Manages process masters with rate tracking
 */

// ============================================================================
// TYPES
// ============================================================================

type Process = Database["public"]["Tables"]["processes"]["Row"];
type ProcessInsert = Database["public"]["Tables"]["processes"]["Insert"];
type ProcessUpdate = Database["public"]["Tables"]["processes"]["Update"];

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ProcessSchema = z.object({
  process_code: z.string().min(1).max(50),
  process_name: z.string().min(1).max(200),
  process_category: z.enum([
    "Dyeing",
    "Finishing",
    "Printing",
    "Weaving",
    "Winding",
    "Twisting",
    "Blending",
    "Warping",
    "Beaming",
    "Other",
  ]),
  description: z.string().max(500).optional(),
  default_rate_per_unit: z.number().positive().default(0),
  remarks: z.string().max(500).optional(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

// ============================================================================
// ERROR TYPES
// ============================================================================

export class ProcessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessError";
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

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

// ============================================================================
// SERVICE LAYER
// ============================================================================

export const processesService = {
  async listProcesses(includeInactive = false): Promise<Process[]> {
    let query = supabase.from("processes").select("*").order("process_code");

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query;

    if (error) throw new ProcessError(`Failed to fetch processes: ${error.message}`);
    return (data || []) as Process[];
  },

  async getProcessById(id: string): Promise<Process> {
    const { data, error } = await supabase
      .from("processes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new NotFoundError("Process", id);
    return data as Process;
  },

  async getProcessByCode(code: string): Promise<Process | null> {
    const { data, error } = await supabase
      .from("processes")
      .select("*")
      .eq("process_code", code.toUpperCase())
      .eq("status", "Active")
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new ProcessError(`Failed to fetch process: ${error.message}`);
    }

    return data as Process;
  },

  async createProcess(input: unknown): Promise<Process> {
    const validated = ProcessSchema.parse(input);

    // Check for duplicate process code
    const existing = await this.getProcessByCode(validated.process_code);
    if (existing) {
      throw new ValidationError("process_code", "This process code already exists");
    }

    const { data, error } = await supabase
      .from("processes")
      .insert([
        {
          ...validated,
          process_code: validated.process_code.toUpperCase(),
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ValidationError("process_code", "This process code already exists");
      }
      throw new ProcessError(`Failed to create process: ${error.message}`);
    }

    return data as Process;
  },

  async updateProcess(id: string, updates: unknown): Promise<Process> {
    const partial = ProcessSchema.partial().parse(updates);

    // Check for duplicate process code if updating code
    if (partial.process_code) {
      const existing = await this.getProcessByCode(partial.process_code);
      if (existing && existing.id !== id) {
        throw new ValidationError("process_code", "This process code already exists");
      }
    }

    const { data, error } = await supabase
      .from("processes")
      .update({
        ...partial,
        process_code: partial.process_code ? partial.process_code.toUpperCase() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new ProcessError(`Failed to update process: ${error.message}`);
    return data as Process;
  },

  async setProcessStatus(id: string, status: "Active" | "Inactive"): Promise<Process> {
    const { data, error } = await supabase
      .from("processes")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new ProcessError(`Failed to update process status: ${error.message}`);
    return data as Process;
  },

  async searchProcesses(query: string, limit = 10): Promise<Process[]> {
    const q = `%${query}%`;
    const { data, error } = await supabase
      .from("processes")
      .select("*")
      .or(
        `process_code.ilike.${q},process_name.ilike.${q},process_category.ilike.${q},description.ilike.${q}`,
      )
      .eq("status", "Active")
      .limit(limit);

    if (error) throw new ProcessError(`Failed to search processes: ${error.message}`);
    return (data || []) as Process[];
  },

  async getCurrentRate(processId: string): Promise<number> {
    const process = await this.getProcessById(processId);
    return process.default_rate_per_unit || 0;
  },

  async getProcessesByCategory(category: string, includeInactive = false): Promise<Process[]> {
    let query = supabase.from("processes").select("*").eq("process_category", category);

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query.order("process_code");

    if (error) throw new ProcessError(`Failed to fetch processes by category: ${error.message}`);
    return (data || []) as Process[];
  },
};
