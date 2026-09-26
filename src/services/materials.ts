import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Material = Database["public"]["Tables"]["materials"]["Row"];
type MaterialInsert = Database["public"]["Tables"]["materials"]["Insert"];
type MaterialUpdate = Database["public"]["Tables"]["materials"]["Update"];

class MaterialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterialError";
  }
}

export const materialsService = {
  async listMaterials(includeInactive = false): Promise<Material[]> {
    let query = supabase.from("materials").select("*").order("code");

    if (!includeInactive) {
      query = query.eq("active", true);
    }

    const { data, error } = await query;

    if (error) {
      throw new MaterialError(`Failed to fetch materials: ${error.message}`);
    }

    return (data || []) as Material[];
  },

  async getMaterialById(id: string): Promise<Material> {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new MaterialError(`Failed to fetch material: ${error.message}`);
    }

    return data as Material;
  },

  async getMaterialByCode(code: string): Promise<Material | null> {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new MaterialError(`Failed to fetch material: ${error.message}`);
    }

    return data as Material;
  },

  async createMaterial(material: Omit<MaterialInsert, "id" | "created_at" | "updated_at">): Promise<Material> {
    const { data, error } = await supabase
      .from("materials")
      .insert([
        {
          ...material,
          code: (material.code || "").toUpperCase(),
          active: material.active ?? true,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new MaterialError(`Material code already exists: ${material.code}`);
      }
      throw new MaterialError(`Failed to create material: ${error.message}`);
    }

    return data as Material;
  },

  async updateMaterial(id: string, updates: MaterialUpdate): Promise<Material> {
    const { data, error } = await supabase
      .from("materials")
      .update({
        ...updates,
        code: updates.code ? updates.code.toUpperCase() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new MaterialError(`Failed to update material: ${error.message}`);
    }

    return data as Material;
  },

  async deactivateMaterial(id: string): Promise<Material> {
    return this.updateMaterial(id, { active: false });
  },

  async activateMaterial(id: string): Promise<Material> {
    return this.updateMaterial(id, { active: true });
  },

  async searchMaterials(query: string, limit = 20): Promise<Material[]> {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .or(`code.ilike.%${query}%,name.ilike.%${query}%`)
      .eq("active", true)
      .limit(limit);

    if (error) {
      throw new MaterialError(`Search failed: ${error.message}`);
    }

    return (data || []) as Material[];
  },

  async getNextMaterialCode(prefix = "Y"): Promise<string> {
    // Get max code number for prefix
    const { data, error } = await supabase
      .from("materials")
      .select("code")
      .ilike("code", `${prefix}-%`)
      .order("code", { ascending: false })
      .limit(1);

    if (error) {
      throw new MaterialError(`Failed to generate code: ${error.message}`);
    }

    let nextNum = 1;
    if (data && data.length > 0) {
      const lastCode = data[0].code;
      const match = lastCode.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    return `${prefix}-${String(nextNum).padStart(2, "0")}`;
  },

  async getMaterialsByType(type: string): Promise<Material[]> {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("material_type", type)
      .eq("active", true)
      .order("code");

    if (error) {
      throw new MaterialError(`Failed to fetch materials by type: ${error.message}`);
    }

    return (data || []) as Material[];
  },

  async getMaterialRateHistory(materialId: string, limit = 12): Promise<any[]> {
    const { data, error } = await supabase
      .from("material_rate_history")
      .select("*")
      .eq("material_id", materialId)
      .order("effective_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("Failed to fetch rate history:", error);
      return [];
    }

    return (data || []) as any[];
  },

  async recordMaterialRateChange(
    materialId: string,
    newRate: number,
    reason: string = "Manual update",
  ): Promise<any> {
    const material = await this.getMaterialById(materialId);

    if (material.rate_per_kg === newRate) {
      return null; // No change
    }

    const { data, error } = await supabase
      .from("material_rate_history")
      .insert([
        {
          material_id: materialId,
          old_rate: material.rate_per_kg,
          new_rate: newRate,
          effective_date: new Date().toISOString(),
          change_reason: reason,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new MaterialError(`Failed to record rate change: ${error.message}`);
    }

    return data;
  },
};
