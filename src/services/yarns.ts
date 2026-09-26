import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { escapeLike, nextSequentialCode, ServiceError, toServiceError } from "@/lib/master-codes";

export const YarnSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  denier: z.number().nonnegative().nullable().optional(),
  rate_per_kg: z.number().nonnegative(),
  remarks: z.string().nullable().optional(),
  composition: z.string().nullable().optional(),
  uom: z.string().default("KG"),
  active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/** Create input: the code is optional and generated (Y-01, Y-02, ...) when blank. */
export const NewYarnSchema = YarnSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  code: z.string().trim().max(50).optional(),
});

export const YARN_CODE_PREFIX = "Y-";

export type Yarn = z.infer<typeof YarnSchema>;

class YarnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YarnError";
  }
}

async function findCodeOwner(code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("materials")
    .select("id")
    .ilike("code", escapeLike(code))
    .limit(1);
  if (error) throw toServiceError(error, "yarn");
  return data?.[0]?.id ?? null;
}

export const yarnsService = {
  async list(filters?: { active?: boolean; search?: string }): Promise<Yarn[]> {
    let query = supabase.from("materials").select("*").order("code");

    if (filters?.active !== undefined) {
      query = query.eq("active", filters.active);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Database error:", error);
      throw new YarnError(`Failed to fetch yarns: ${error.message}`);
    }

    const results = (data || []) as Yarn[];

    // Client-side filtering for search
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      return results.filter(
        (y) =>
          y.code.toLowerCase().includes(q) ||
          y.name.toLowerCase().includes(q) ||
          (y.remarks && y.remarks.toLowerCase().includes(q)),
      );
    }

    return results;
  },

  /** Next free sequential yarn code (Y-01, Y-02, ...), based on all existing codes. */
  async nextCode(): Promise<string> {
    const { data, error } = await supabase.from("materials").select("code");
    if (error) throw toServiceError(error, "yarn");
    return nextSequentialCode(
      YARN_CODE_PREFIX,
      (data ?? []).map((r) => r.code),
    );
  },

  async getById(id: string): Promise<Yarn> {
    const { data, error } = await supabase.from("materials").select("*").eq("id", id).single();

    if (error) {
      console.error("Database error:", error);
      throw new YarnError(`Yarn not found: ${id}`);
    }

    return data as Yarn;
  },

  async create(input: unknown): Promise<Yarn> {
    const validated = NewYarnSchema.parse(input);
    // The service is the canonical generator; the persisted code must still be non-empty.
    const code = YarnSchema.shape.code.parse(
      (validated.code || (await this.nextCode())).toUpperCase(),
    );

    // materials.code has no unique constraint, so this check is the only duplicate guard.
    if (await findCodeOwner(code)) {
      throw new ServiceError("duplicate", `Yarn code ${code} already exists`, "code");
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data, error } = await supabase
      .from("materials")
      .insert([
        {
          code,
          name: validated.name,
          denier: validated.denier ?? null,
          rate_per_kg: validated.rate_per_kg,
          remarks: validated.remarks || null,
          composition: validated.composition || null,
          uom: validated.uom,
          active: validated.active,
          created_by: session?.user.id ?? null,
        },
      ])
      .select()
      .single();

    if (error) throw toServiceError(error, "yarn");

    return data as Yarn;
  },

  async update(id: string, updates: unknown): Promise<Yarn> {
    const partial = YarnSchema.partial().parse(updates);

    // If updating code, check for duplicates
    if (partial.code) {
      const owner = await findCodeOwner(partial.code);
      if (owner && owner !== id) {
        throw new ServiceError("duplicate", `Yarn code ${partial.code} already exists`, "code");
      }
    }

    const updateData = {
      code: partial.code ? partial.code.toUpperCase() : undefined,
      name: partial.name,
      denier: partial.denier,
      rate_per_kg: partial.rate_per_kg,
      remarks: partial.remarks,
      composition: partial.composition,
      uom: partial.uom,
      active: partial.active,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("materials")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw toServiceError(error, "yarn");

    return data as Yarn;
  },

  async setStatus(id: string, active: boolean): Promise<Yarn> {
    const { data, error } = await supabase
      .from("materials")
      .update({
        active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw toServiceError(error, "yarn");

    return data as Yarn;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("materials").delete().eq("id", id);

    if (error) throw toServiceError(error, "yarn");
  },
};
