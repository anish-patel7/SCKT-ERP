import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * STEP 21 PHASE 3: Parties & Party Sub-Parties Service
 * Manages party master data (customers, suppliers, job workers)
 * Supports multi-location parties via party_sub_parties
 */

// ============================================================================
// TYPES
// ============================================================================

type Party = Database["public"]["Tables"]["parties"]["Row"];
type PartyInsert = Database["public"]["Tables"]["parties"]["Insert"];
type PartyUpdate = Database["public"]["Tables"]["parties"]["Update"];

type SubParty = Database["public"]["Tables"]["party_sub_parties"]["Row"];
type SubPartyInsert = Database["public"]["Tables"]["party_sub_parties"]["Insert"];
type SubPartyUpdate = Database["public"]["Tables"]["party_sub_parties"]["Update"];

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Optional text: "" and NULL (from a loaded row) are stored as NULL, so clearing a field works.
 * An absent key stays absent, so partial updates don't touch fields they don't mention.
 */
const blankToNull = (v: unknown) =>
  v === undefined ? undefined : v === null || (typeof v === "string" && v.trim() === "") ? null : v;
const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
const optionalEmail = z.preprocess(blankToNull, z.string().trim().email().nullable().optional());

const PartySchema = z.object({
  party_code: z.string().min(1).max(50),
  party_name: z.string().min(1).max(200),
  // Party Master tab the party belongs to (parties.party_type, migration 006E).
  party_type: z.enum(["Job Party", "Purchase Party", "Sell Party"]).default("Job Party"),
  office_name: z.string().min(1).max(200),
  address_line1: z.string().min(1).max(500),
  address_line2: optionalText(500),
  area: optionalText(200),
  city: z.string().min(1).max(100),
  district: optionalText(100),
  state: z.string().min(1).max(100),
  pin_code: z.string().min(1).max(10),
  country: z.string().max(100).default("India"),
  contact_person: optionalText(150),
  designation: optionalText(150),
  mobile: optionalText(20),
  alternate_mobile: optionalText(20),
  email: optionalEmail,
  whatsapp_number: optionalText(20),
  gstin: optionalText(50),
  pan: optionalText(50),
  job_work_applicable: z.enum(["Yes", "No"]).default("Yes"),
  job_work_remarks: optionalText(500),
  remarks: optionalText(500),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  transaction_count: z.number().int().default(0).optional(),
});

const SubPartySchema = z.object({
  party_id: z.string().uuid(),
  sub_party_code: z.string().min(1).max(50),
  sub_party_name: z.string().min(1).max(200),
  party_type: z.enum(["Job Party", "Purchase Party", "Sell Party"]).default("Job Party"),
  location_type: z.string().max(100).default("Branch Office"),
  location_type_other: optionalText(200),
  address_line1: z.string().min(1).max(500),
  address_line2: optionalText(500),
  area: optionalText(200),
  city: z.string().min(1).max(100),
  district: optionalText(100),
  state: z.string().min(1).max(100),
  pin_code: optionalText(10),
  country: z.string().max(100).default("India"),
  gstin: optionalText(50),
  pan: optionalText(50),
  contact_person: optionalText(150),
  mobile: optionalText(20),
  alternate_mobile: optionalText(20),
  phone: optionalText(20),
  email: optionalEmail,
  alternate_email: optionalEmail,
  billing_address: optionalText(500),
  shipping_address: optionalText(500),
  delivery_address: optionalText(500),
  is_default: z.boolean().default(false),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  remarks: optionalText(500),
  internal_notes: optionalText(500),
  transaction_count: z.number().int().default(0).optional(),
});

async function currentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class PartyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartyError";
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

export const partiesService = {
  // ========== MAIN PARTIES ==========

  async listParties(includeInactive = false): Promise<Party[]> {
    let query = supabase.from("parties").select("*").order("party_code");

    if (!includeInactive) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query;

    if (error) throw new PartyError(`Failed to fetch parties: ${error.message}`);
    return (data || []) as Party[];
  },

  async getPartyById(id: string): Promise<Party> {
    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new NotFoundError("Party", id);
    return data as Party;
  },

  async getPartyByCode(code: string): Promise<Party | null> {
    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .eq("party_code", code.toUpperCase())
      .eq("status", "Active")
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new PartyError(`Failed to fetch party: ${error.message}`);
    }

    return data as Party;
  },

  async createParty(input: unknown): Promise<Party> {
    const validated = PartySchema.parse(input);

    // Check for duplicate party code
    const existing = await this.getPartyByCode(validated.party_code);
    if (existing) {
      throw new ValidationError("party_code", "This party code already exists");
    }

    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("parties")
      .insert([
        {
          ...validated,
          party_code: validated.party_code.toUpperCase(),
          created_by: userId,
          updated_by: userId,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ValidationError("party_code", "This party code already exists");
      }
      throw new PartyError(`Failed to create party: ${error.message}`);
    }

    return data as Party;
  },

  async updateParty(id: string, updates: unknown): Promise<Party> {
    const partial = PartySchema.partial().parse(updates);

    // Check for duplicate party code if updating code
    if (partial.party_code) {
      const existing = await this.getPartyByCode(partial.party_code);
      if (existing && existing.id !== id) {
        throw new ValidationError("party_code", "This party code already exists");
      }
    }

    const { data, error } = await supabase
      .from("parties")
      .update({
        ...partial,
        party_code: partial.party_code ? partial.party_code.toUpperCase() : undefined,
        updated_by: await currentUserId(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new PartyError(`Failed to update party: ${error.message}`);
    return data as Party;
  },

  async setPartyStatus(id: string, status: "Active" | "Inactive"): Promise<Party> {
    const { data, error } = await supabase
      .from("parties")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new PartyError(`Failed to update party status: ${error.message}`);
    return data as Party;
  },

  // ========== PARTY SUB-PARTIES ==========

  async listSubPartiesByPartyId(partyId: string, activeOnly = false): Promise<SubParty[]> {
    let query = supabase.from("party_sub_parties").select("*").eq("party_id", partyId);

    if (activeOnly) {
      query = query.eq("status", "Active");
    }

    const { data, error } = await query.order("is_default", { ascending: false });

    if (error) throw new PartyError(`Failed to fetch sub-parties: ${error.message}`);
    return (data || []) as SubParty[];
  },

  async getSubPartyById(id: string): Promise<SubParty> {
    const { data, error } = await supabase
      .from("party_sub_parties")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new NotFoundError("SubParty", id);
    return data as SubParty;
  },

  async createSubParty(input: unknown): Promise<SubParty> {
    const validated = SubPartySchema.parse(input);

    // Check for duplicate sub-party code
    const existing = await supabase
      .from("party_sub_parties")
      .select("*")
      .eq("sub_party_code", validated.sub_party_code)
      .single();

    if (existing.data) {
      throw new ValidationError("sub_party_code", "This sub-party code already exists");
    }

    // If setting as default, unset other defaults for this party
    if (validated.is_default) {
      await supabase
        .from("party_sub_parties")
        .update({ is_default: false })
        .eq("party_id", validated.party_id)
        .neq("id", "");
    }

    const { data, error } = await supabase
      .from("party_sub_parties")
      .insert([{ ...validated, created_by: await currentUserId() }])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ValidationError("sub_party_code", "This sub-party code already exists");
      }
      throw new PartyError(`Failed to create sub-party: ${error.message}`);
    }

    return data as SubParty;
  },

  async updateSubParty(id: string, updates: unknown): Promise<SubParty> {
    const partial = SubPartySchema.partial().parse(updates);

    // Check for duplicate sub-party code if updating
    if (partial.sub_party_code) {
      const existing = await supabase
        .from("party_sub_parties")
        .select("*")
        .eq("sub_party_code", partial.sub_party_code)
        .single();

      if (existing.data && existing.data.id !== id) {
        throw new ValidationError("sub_party_code", "This sub-party code already exists");
      }
    }

    // If setting as default, unset other defaults for this party
    if (partial.is_default) {
      const currentSubParty = await this.getSubPartyById(id);
      await supabase
        .from("party_sub_parties")
        .update({ is_default: false })
        .eq("party_id", currentSubParty.party_id)
        .neq("id", id);
    }

    const { data, error } = await supabase
      .from("party_sub_parties")
      .update({
        ...partial,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new PartyError(`Failed to update sub-party: ${error.message}`);
    return data as SubParty;
  },

  async setSubPartyStatus(id: string, status: "Active" | "Inactive"): Promise<SubParty> {
    const { data, error } = await supabase
      .from("party_sub_parties")
      .update({
        status,
        // Inactive sub-parties cannot be default
        is_default: status === "Inactive" ? false : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new PartyError(`Failed to update sub-party status: ${error.message}`);
    return data as SubParty;
  },

  async setSubPartyAsDefault(partyId: string, subPartyId: string): Promise<SubParty> {
    // Get the sub-party to verify it exists and is active
    const subParty = await this.getSubPartyById(subPartyId);

    if (subParty.status === "Inactive") {
      throw new ValidationError("status", "Cannot set inactive sub-party as default");
    }

    // Unset other defaults for this party
    await supabase
      .from("party_sub_parties")
      .update({ is_default: false })
      .eq("party_id", partyId)
      .neq("id", subPartyId);

    // Set this one as default
    const { data, error } = await supabase
      .from("party_sub_parties")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", subPartyId)
      .select()
      .single();

    if (error) throw new PartyError(`Failed to set default sub-party: ${error.message}`);
    return data as SubParty;
  },

  // ========== SEARCH & FILTER ==========

  async searchParties(query: string, limit = 10): Promise<Party[]> {
    const q = `%${query}%`;
    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .or(`party_code.ilike.${q},party_name.ilike.${q},mobile.ilike.${q}`)
      .eq("status", "Active")
      .limit(limit);

    if (error) throw new PartyError(`Failed to search parties: ${error.message}`);
    return (data || []) as Party[];
  },
};
