import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * STEP 21 PHASE 3: Colors/Shades Master Service
 * Manages color and shade specifications with hex representation
 */

// ============================================================================
// TYPES
// ============================================================================

type Color = Database["public"]["Tables"]["colors"]["Row"];
type ColorInsert = Database["public"]["Tables"]["colors"]["Insert"];
type ColorUpdate = Database["public"]["Tables"]["colors"]["Update"];

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ColorSchema = z.object({
  color_code: z.string().min(1).max(50),
  color_name: z.string().min(1).max(200),
  color_hex: z.string().length(6).regex(/^[0-9a-fA-F]{6}$/, "Invalid hex color"),
  color_category: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

// ============================================================================
// ERROR TYPES
// ============================================================================

export class ColorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ColorError";
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

export const colorsService = {
  async listColors(includeInactive = false): Promise<Color[]> {
    let query = supabase.from("colors").select("*").order("color_code");

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query;

    if (error) throw new ColorError(`Failed to fetch colors: ${error.message}`);
    return (data || []) as Color[];
  },

  async getColorById(id: string): Promise<Color> {
    const { data, error } = await supabase
      .from("colors")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new NotFoundError("Color", id);
    return data as Color;
  },

  async getColorByCode(code: string): Promise<Color | null> {
    const { data, error } = await supabase
      .from("colors")
      .select("*")
      .eq("color_code", code.toUpperCase())
      .eq("status", "Active")
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new ColorError(`Failed to fetch color: ${error.message}`);
    }

    return data as Color;
  },

  async createColor(input: unknown): Promise<Color> {
    const validated = ColorSchema.parse(input);

    // Check for duplicate color code
    const existing = await this.getColorByCode(validated.color_code);
    if (existing) {
      throw new ValidationError("color_code", "This color code already exists");
    }

    const { data, error } = await supabase
      .from("colors")
      .insert([
        {
          ...validated,
          color_code: validated.color_code.toUpperCase(),
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ValidationError("color_code", "This color code already exists");
      }
      throw new ColorError(`Failed to create color: ${error.message}`);
    }

    return data as Color;
  },

  async updateColor(id: string, updates: unknown): Promise<Color> {
    const partial = ColorSchema.partial().parse(updates);

    // Check for duplicate color code if updating code
    if (partial.color_code) {
      const existing = await this.getColorByCode(partial.color_code);
      if (existing && existing.id !== id) {
        throw new ValidationError("color_code", "This color code already exists");
      }
    }

    const { data, error } = await supabase
      .from("colors")
      .update({
        ...partial,
        color_code: partial.color_code ? partial.color_code.toUpperCase() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new ColorError(`Failed to update color: ${error.message}`);
    return data as Color;
  },

  async setColorStatus(id: string, status: "Active" | "Inactive"): Promise<Color> {
    const { data, error } = await supabase
      .from("colors")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new ColorError(`Failed to update color status: ${error.message}`);
    return data as Color;
  },

  async searchColors(query: string, limit = 10): Promise<Color[]> {
    const q = `%${query}%`;
    const { data, error } = await supabase
      .from("colors")
      .select("*")
      .or(
        `color_code.ilike.${q},color_name.ilike.${q},color_category.ilike.${q},color_hex.ilike.${q}`,
      )
      .eq("status", "Active")
      .limit(limit);

    if (error) throw new ColorError(`Failed to search colors: ${error.message}`);
    return (data || []) as Color[];
  },

  async getColorsByCategory(category: string, includeInactive = false): Promise<Color[]> {
    let query = supabase.from("colors").select("*").eq("color_category", category);

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query.order("color_code");

    if (error) throw new ColorError(`Failed to fetch colors by category: ${error.message}`);
    return (data || []) as Color[];
  },
};
