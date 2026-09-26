import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { nextSequentialCode, ServiceError, toServiceError } from "@/lib/master-codes";

/**
 * STEP 21 PHASE 3: Warehouses Service
 * Manages warehouse/godown masters with capacity tracking
 */

// ============================================================================
// TYPES
// ============================================================================

type Warehouse = Database["public"]["Tables"]["warehouses"]["Row"];
type WarehouseInsert = Database["public"]["Tables"]["warehouses"]["Insert"];
type WarehouseUpdate = Database["public"]["Tables"]["warehouses"]["Update"];

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

/** Warehouse types offered by the Warehouse Master form (warehouse_type is free text in the DB). */
export const WAREHOUSE_TYPES = [
  "Raw Material",
  "Yarn",
  "Beam",
  "Grey Fabric",
  "Finished Goods",
  "Chemical",
  "Packing Material",
  "General",
  "Third Party",
  "Other",
] as const;

const WarehouseSchema = z.object({
  warehouse_code: z.string().trim().min(1).max(50),
  warehouse_name: z.string().trim().min(1).max(200),
  warehouse_type: z.enum(WAREHOUSE_TYPES),
  warehouse_type_other: optionalText(200),
  address_line1: optionalText(500),
  address_line2: optionalText(500),
  area: optionalText(150),
  city: optionalText(100),
  district: optionalText(100),
  state: optionalText(100),
  pin_code: optionalText(20),
  country: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .transform((v) => v || "India"),
  contact_person: optionalText(150),
  mobile: optionalText(20),
  email: z
    .union([z.string().trim().email(), z.literal("")])
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  remarks: optionalText(500),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

/** Create input: the code is optional and generated (WH-01, WH-02, ...) when blank. */
const NewWarehouseSchema = WarehouseSchema.extend({
  warehouse_code: z.string().trim().max(50).optional(),
});

export const WAREHOUSE_CODE_PREFIX = "WH-";

// ============================================================================
// ERROR TYPES
// ============================================================================

export class WarehouseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WarehouseError";
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

/** Id of the warehouse (active or not) holding this code; warehouse_code is unique. */
async function findCodeOwner(code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("warehouses")
    .select("id")
    .eq("warehouse_code", code.toUpperCase())
    .limit(1);
  if (error) throw toServiceError(error, "warehouse");
  return data?.[0]?.id ?? null;
}

const MAX_CODE_ATTEMPTS = 3;

// ============================================================================
// SERVICE LAYER
// ============================================================================

export const warehousesService = {
  async listWarehouses(includeInactive = false): Promise<Warehouse[]> {
    let query = supabase.from("warehouses").select("*").order("warehouse_code");

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query;

    if (error) throw new WarehouseError(`Failed to fetch warehouses: ${error.message}`);
    return (data || []) as Warehouse[];
  },

  async getWarehouseById(id: string): Promise<Warehouse> {
    const { data, error } = await supabase.from("warehouses").select("*").eq("id", id).single();

    if (error) throw new NotFoundError("Warehouse", id);
    return data as Warehouse;
  },

  async getWarehouseByCode(code: string): Promise<Warehouse | null> {
    const { data, error } = await supabase
      .from("warehouses")
      .select("*")
      .eq("warehouse_code", code.toUpperCase())
      .eq("status", "Active")
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new WarehouseError(`Failed to fetch warehouse: ${error.message}`);
    }

    return data as Warehouse;
  },

  /** Next free sequential warehouse code (WH-01, WH-02, ...), based on all existing codes. */
  async nextWarehouseCode(): Promise<string> {
    const { data, error } = await supabase.from("warehouses").select("warehouse_code");
    if (error) throw toServiceError(error, "warehouse");
    return nextSequentialCode(
      WAREHOUSE_CODE_PREFIX,
      (data ?? []).map((r) => r.warehouse_code),
    );
  },

  async createWarehouse(input: unknown): Promise<Warehouse> {
    const validated = NewWarehouseSchema.parse(input);
    const supplied = validated.warehouse_code?.toUpperCase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // A generated code can be taken by a concurrent save between generation and insert;
    // the unique constraint rejects it (23505) and a fresh code is generated.
    for (let attempt = 1; ; attempt++) {
      const warehouse_code = WarehouseSchema.shape.warehouse_code.parse(
        supplied || (await this.nextWarehouseCode()),
      );

      if (await findCodeOwner(warehouse_code)) {
        if (!supplied && attempt < MAX_CODE_ATTEMPTS) continue;
        throw new ServiceError(
          "duplicate",
          `Warehouse code ${warehouse_code} already exists`,
          "warehouse_code",
        );
      }

      const insertData: WarehouseInsert = {
        ...validated,
        warehouse_code,
        is_active: validated.status === "Active",
        created_by: session?.user.id ?? null,
      };

      const { data, error } = await supabase
        .from("warehouses")
        .insert([insertData])
        .select()
        .single();

      if (!error) return data as Warehouse;
      if (error.code === "23505" && !supplied && attempt < MAX_CODE_ATTEMPTS) continue;
      throw toServiceError(error, "warehouse");
    }
  },

  async updateWarehouse(id: string, updates: unknown): Promise<Warehouse> {
    const partial = WarehouseSchema.partial().parse(updates);

    // Check for duplicate warehouse code if updating code
    if (partial.warehouse_code) {
      const owner = await findCodeOwner(partial.warehouse_code);
      if (owner && owner !== id) {
        throw new ServiceError(
          "duplicate",
          `Warehouse code ${partial.warehouse_code} already exists`,
          "warehouse_code",
        );
      }
    }

    const updateData: WarehouseUpdate = {
      ...partial,
      warehouse_code: partial.warehouse_code ? partial.warehouse_code.toUpperCase() : undefined,
      ...(partial.status ? { is_active: partial.status === "Active" } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("warehouses")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw toServiceError(error, "warehouse");
    return data as Warehouse;
  },

  async setWarehouseStatus(id: string, status: "Active" | "Inactive"): Promise<Warehouse> {
    const { data, error } = await supabase
      .from("warehouses")
      .update({
        status,
        is_active: status === "Active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw toServiceError(error, "warehouse");
    return data as Warehouse;
  },

  async searchWarehouses(query: string, limit = 10): Promise<Warehouse[]> {
    const q = `%${query}%`;
    const { data, error } = await supabase
      .from("warehouses")
      .select("*")
      .or(
        `warehouse_code.ilike.${q},warehouse_name.ilike.${q},warehouse_type.ilike.${q},city.ilike.${q}`,
      )
      .eq("status", "Active")
      .limit(limit);

    if (error) throw new WarehouseError(`Failed to search warehouses: ${error.message}`);
    return (data || []) as Warehouse[];
  },

  async getWarehousesByType(warehouseType: string, includeInactive = false): Promise<Warehouse[]> {
    let query = supabase.from("warehouses").select("*").eq("warehouse_type", warehouseType);

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query.order("warehouse_code");

    if (error) throw new WarehouseError(`Failed to fetch warehouses by type: ${error.message}`);
    return (data || []) as Warehouse[];
  },

  // TODO: Implement getWarehouseCapacityUtilization once warehouse schema includes
  // capacity_in_units and current_stock_value fields
  // async getWarehouseCapacityUtilization(
  //   warehouseId: string,
  // ): Promise<{ currentStock: number; capacity: number; utilizationPercent: number } | null> {
  //   const warehouse = await this.getWarehouseById(warehouseId);
  //
  //   if (!warehouse.capacity_in_units) {
  //     return null;
  //   }
  //
  //   const currentStock = warehouse.current_stock_value || 0;
  //   const capacity = warehouse.capacity_in_units;
  //   const utilizationPercent = (currentStock / capacity) * 100;
  //
  //   return {
  //     currentStock,
  //     capacity,
  //     utilizationPercent,
  //   };
  // },
};
