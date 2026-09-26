import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { processesService } from "./processes";
import { warehousesService } from "./warehouses";

/**
 * STEP 21 PHASE 3: Machines Service
 * Manages production equipment and machinery with process/warehouse links
 */

// ============================================================================
// TYPES
// ============================================================================

type Machine = Database["public"]["Tables"]["machines"]["Row"];
type MachineInsert = Database["public"]["Tables"]["machines"]["Insert"];
type MachineUpdate = Database["public"]["Tables"]["machines"]["Update"];

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const MachineSchema = z.object({
  machine_code: z.string().min(1).max(50),
  machine_name: z.string().min(1).max(200),
  machine_type: z.enum([
    "Weaving Loom",
    "Dyeing Vat",
    "Printing Machine",
    "Winding Machine",
    "Twisting Machine",
    "Bleaching Unit",
    "Finishing Unit",
    "Other",
  ]),
  process_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  capacity_per_hour: z.number().int().positive().optional(),
  operational_status: z
    .enum(["Operational", "Maintenance", "Standby", "Decommissioned"])
    .default("Operational"),
  purchase_date: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

// ============================================================================
// ERROR TYPES
// ============================================================================

export class MachineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MachineError";
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

export const machinesService = {
  async listMachines(includeInactive = false): Promise<Machine[]> {
    let query = supabase.from("machines").select("*").order("machine_code");

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query;

    if (error) throw new MachineError(`Failed to fetch machines: ${error.message}`);
    return (data || []) as Machine[];
  },

  async getMachineById(id: string): Promise<Machine> {
    const { data, error } = await supabase
      .from("machines")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new NotFoundError("Machine", id);
    return data as Machine;
  },

  async getMachineByCode(code: string): Promise<Machine | null> {
    const { data, error } = await supabase
      .from("machines")
      .select("*")
      .eq("machine_code", code.toUpperCase())
      .eq("status", "Active")
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new MachineError(`Failed to fetch machine: ${error.message}`);
    }

    return data as Machine;
  },

  async createMachine(input: unknown): Promise<Machine> {
    const validated = MachineSchema.parse(input);

    // Check for duplicate machine code
    const existing = await this.getMachineByCode(validated.machine_code);
    if (existing) {
      throw new ValidationError("machine_code", "This machine code already exists");
    }

    // Verify process exists
    try {
      await processesService.getProcessById(validated.process_id);
    } catch {
      throw new ValidationError("process_id", "Process does not exist");
    }

    // Verify warehouse exists
    try {
      await warehousesService.getWarehouseById(validated.warehouse_id);
    } catch {
      throw new ValidationError("warehouse_id", "Warehouse does not exist");
    }

    const { data, error } = await supabase
      .from("machines")
      .insert([
        {
          ...validated,
          machine_code: validated.machine_code.toUpperCase(),
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ValidationError("machine_code", "This machine code already exists");
      }
      throw new MachineError(`Failed to create machine: ${error.message}`);
    }

    return data as Machine;
  },

  async updateMachine(id: string, updates: unknown): Promise<Machine> {
    const partial = MachineSchema.partial().parse(updates);

    // Check for duplicate machine code if updating code
    if (partial.machine_code) {
      const existing = await this.getMachineByCode(partial.machine_code);
      if (existing && existing.id !== id) {
        throw new ValidationError("machine_code", "This machine code already exists");
      }
    }

    // Verify process exists if updating
    if (partial.process_id) {
      try {
        await processesService.getProcessById(partial.process_id);
      } catch {
        throw new ValidationError("process_id", "Process does not exist");
      }
    }

    // Verify warehouse exists if updating
    if (partial.warehouse_id) {
      try {
        await warehousesService.getWarehouseById(partial.warehouse_id);
      } catch {
        throw new ValidationError("warehouse_id", "Warehouse does not exist");
      }
    }

    const { data, error } = await supabase
      .from("machines")
      .update({
        ...partial,
        machine_code: partial.machine_code ? partial.machine_code.toUpperCase() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new MachineError(`Failed to update machine: ${error.message}`);
    return data as Machine;
  },

  async setMachineStatus(id: string, status: "Active" | "Inactive"): Promise<Machine> {
    const { data, error } = await supabase
      .from("machines")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new MachineError(`Failed to update machine status: ${error.message}`);
    return data as Machine;
  },

  async setOperationalStatus(
    id: string,
    operationalStatus: "Operational" | "Maintenance" | "Standby" | "Decommissioned",
  ): Promise<Machine> {
    const { data, error } = await supabase
      .from("machines")
      .update({
        operational_status: operationalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new MachineError(`Failed to update operational status: ${error.message}`);
    return data as Machine;
  },

  async searchMachines(query: string, limit = 10): Promise<Machine[]> {
    const q = `%${query}%`;
    const { data, error } = await supabase
      .from("machines")
      .select("*")
      .or(`machine_code.ilike.${q},machine_name.ilike.${q},machine_type.ilike.${q}`)
      .eq("status", "Active")
      .limit(limit);

    if (error) throw new MachineError(`Failed to search machines: ${error.message}`);
    return (data || []) as Machine[];
  },

  async getMachinesByProcess(processId: string, includeInactive = false): Promise<Machine[]> {
    let query = supabase.from("machines").select("*").eq("process_id", processId);

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query.order("machine_code");

    if (error) throw new MachineError(`Failed to fetch machines by process: ${error.message}`);
    return (data || []) as Machine[];
  },

  async getMachinesByWarehouse(warehouseId: string, includeInactive = false): Promise<Machine[]> {
    let query = supabase.from("machines").select("*").eq("warehouse_id", warehouseId);

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query.order("machine_code");

    if (error) throw new MachineError(`Failed to fetch machines by warehouse: ${error.message}`);
    return (data || []) as Machine[];
  },

  async getMachinesByOperationalStatus(
    operationalStatus: "Operational" | "Maintenance" | "Standby" | "Decommissioned",
  ): Promise<Machine[]> {
    const { data, error } = await supabase
      .from("machines")
      .select("*")
      .eq("operational_status", operationalStatus)
      .eq("status", "Active")
      .order("machine_code");

    if (error)
      throw new MachineError(`Failed to fetch machines by operational status: ${error.message}`);
    return (data || []) as Machine[];
  },
};
