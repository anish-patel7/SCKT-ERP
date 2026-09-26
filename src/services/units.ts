import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * STEP 21 PHASE 3: Units of Measurement Service
 * Manages unit masters and conversion factors
 */

// ============================================================================
// TYPES
// ============================================================================

type Unit = Database["public"]["Tables"]["units"]["Row"];
type UnitInsert = Database["public"]["Tables"]["units"]["Insert"];
type UnitUpdate = Database["public"]["Tables"]["units"]["Update"];

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const UnitSchema = z.object({
  unit_code: z.string().min(1).max(20),
  unit_name: z.string().min(1).max(100),
  unit_symbol: z.string().min(1).max(10),
  unit_category: z.enum(["Weight", "Length", "Volume", "Quantity", "Area", "Temperature"]),
  base_unit_id: z.string().uuid().nullable().optional(),
  conversion_factor: z.number().positive().default(1),
  remarks: z.string().max(500).optional(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

// ============================================================================
// ERROR TYPES
// ============================================================================

export class UnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnitError";
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

export const unitsService = {
  async listUnits(includeInactive = false): Promise<Unit[]> {
    let query = supabase.from("units").select("*").order("unit_code");

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query;

    if (error) throw new UnitError(`Failed to fetch units: ${error.message}`);
    return (data || []) as Unit[];
  },

  async getUnitById(id: string): Promise<Unit> {
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new NotFoundError("Unit", id);
    return data as Unit;
  },

  async getUnitByCode(code: string): Promise<Unit | null> {
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("unit_code", code.toUpperCase())
      .eq("status", "Active")
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new UnitError(`Failed to fetch unit: ${error.message}`);
    }

    return data as Unit;
  },

  async createUnit(input: unknown): Promise<Unit> {
    const validated = UnitSchema.parse(input);

    // Check for duplicate unit code
    const existing = await this.getUnitByCode(validated.unit_code);
    if (existing) {
      throw new ValidationError("unit_code", "This unit code already exists");
    }

    // If base_unit_id provided, verify it exists
    if (validated.base_unit_id) {
      try {
        await this.getUnitById(validated.base_unit_id);
      } catch {
        throw new ValidationError("base_unit_id", "Base unit does not exist");
      }
    }

    const { data, error } = await supabase
      .from("units")
      .insert([
        {
          ...validated,
          unit_code: validated.unit_code.toUpperCase(),
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ValidationError("unit_code", "This unit code already exists");
      }
      throw new UnitError(`Failed to create unit: ${error.message}`);
    }

    return data as Unit;
  },

  async updateUnit(id: string, updates: unknown): Promise<Unit> {
    const partial = UnitSchema.partial().parse(updates);

    // Check for duplicate unit code if updating code
    if (partial.unit_code) {
      const existing = await this.getUnitByCode(partial.unit_code);
      if (existing && existing.id !== id) {
        throw new ValidationError("unit_code", "This unit code already exists");
      }
    }

    // If base_unit_id provided, verify it exists
    if (partial.base_unit_id) {
      try {
        await this.getUnitById(partial.base_unit_id);
      } catch {
        throw new ValidationError("base_unit_id", "Base unit does not exist");
      }
    }

    const { data, error } = await supabase
      .from("units")
      .update({
        ...partial,
        unit_code: partial.unit_code ? partial.unit_code.toUpperCase() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new UnitError(`Failed to update unit: ${error.message}`);
    return data as Unit;
  },

  async setUnitStatus(id: string, status: "Active" | "Inactive"): Promise<Unit> {
    const { data, error } = await supabase
      .from("units")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new UnitError(`Failed to update unit status: ${error.message}`);
    return data as Unit;
  },

  async searchUnits(query: string, limit = 10): Promise<Unit[]> {
    const q = `%${query}%`;
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .or(`unit_code.ilike.${q},unit_name.ilike.${q},unit_symbol.ilike.${q}`)
      .eq("status", "Active")
      .limit(limit);

    if (error) throw new UnitError(`Failed to search units: ${error.message}`);
    return (data || []) as Unit[];
  },

  async convertQuantity(
    quantity: number,
    fromUnitId: string,
    toUnitId: string,
  ): Promise<number> {
    if (fromUnitId === toUnitId) {
      return quantity;
    }

    const fromUnit = await this.getUnitById(fromUnitId);
    const toUnit = await this.getUnitById(toUnitId);

    // Both units must have same base_unit_id or one must be the base unit of the other
    if (fromUnit.base_unit_id !== toUnit.base_unit_id) {
      throw new UnitError(
        `Cannot convert between ${fromUnit.unit_code} and ${toUnit.unit_code}: different unit categories`,
      );
    }

    // Convert: (quantity * from_conversion_factor) / to_conversion_factor
    const fromFactorToBase = fromUnit.conversion_factor || 1;
    const toFactorToBase = toUnit.conversion_factor || 1;

    return (quantity * fromFactorToBase) / toFactorToBase;
  },
};
