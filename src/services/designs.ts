import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { DesignWithDetails, DesignFilter, FeederCrossReferenceItem } from "@/types/design";

/**
 * Design master (designs + beam_colours + feeders). Writes go through the save_design() RPC so a
 * design and its beam colour x feeder matrix are saved in one transaction under the caller's RLS.
 */

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

type DesignRow = Database["public"]["Tables"]["designs"]["Row"];
type BeamColourRow = Database["public"]["Tables"]["beam_colours"]["Row"];
type FeederRow = Database["public"]["Tables"]["feeders"]["Row"];
type DesignRowWithMatrix = DesignRow & {
  beam_colours: (BeamColourRow & { feeders: FeederRow[] | null })[] | null;
};

/** Embedded select for a design with its beam colour x feeder matrix. */
const DESIGN_WITH_MATRIX = "*, beam_colours(*, feeders(*))";

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.number().positive().optional(),
);

const FeederInputSchema = z.object({
  feederNumber: z.string().min(1).max(50),
  colorName: z.string().max(200).default(""),
  oldNumber: z.string().max(100).optional(),
  pick: z.number().positive("Pick must be positive"),
  card: z.number().positive("Card must be positive"),
  displayOrder: z.number().int().positive(),
});

const BeamColourInputSchema = z.object({
  beamColour: z.string().trim().min(1, "Beam colour name is required").max(200),
  displayOrder: z.number().int().positive(),
  feeders: z.array(FeederInputSchema),
});

const DesignSchema = z.object({
  designNumber: z.string().trim().min(1).max(50),
  designName: z.string().trim().min(1).max(200),
  dn: z.string().optional(),
  dnCode: z.string().optional(),
  reed: optionalNumber,
  pick: optionalNumber,
  cards: optionalNumber,
  patti: optionalNumber,
  totalDC: optionalNumber,
  totalCut: optionalNumber,
  work: z.string().optional(),
  blueApt: z.string().optional(),
  description: z.string().optional(),
  remarks: z.string().optional(),
  // http(s) URL or an uploaded image as a data: URL
  image: z.string().optional(),
  beamColours: z.array(BeamColourInputSchema).default([]),
});

export type DesignInput = z.input<typeof DesignSchema>;

// ============================================================================
// ERROR TYPES
// ============================================================================

export class DesignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignError";
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
  constructor(
    resource: string,
    id: string,
  ) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const num = (v: number | null | undefined) => (v == null ? undefined : Number(v));
const text = (v: string | null | undefined) => v ?? undefined;
const byOrder = <T extends { display_order: number }>(a: T, b: T) =>
  a.display_order - b.display_order;

function toDesignWithDetails(row: DesignRowWithMatrix): DesignWithDetails {
  return {
    id: row.id,
    designNumber: row.design_number,
    designName: row.design_name ?? "",
    dn: text(row.dn),
    dnCode: text(row.dn_code),
    reed: num(row.reed),
    pick: num(row.pick),
    cards: num(row.cards),
    patti: num(row.patti),
    totalDC: num(row.total_dc),
    totalCut: num(row.total_cut),
    work: text(row.work),
    blueApt: text(row.blue_apt),
    description: text(row.description),
    remarks: text(row.remarks),
    image: text(row.image),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    beamColours: [...(row.beam_colours ?? [])].sort(byOrder).map((bc) => ({
      id: bc.id,
      designId: bc.design_id,
      beamColour: bc.beam_colour,
      displayOrder: bc.display_order,
      createdAt: bc.created_at,
      updatedAt: bc.updated_at,
      feeders: [...(bc.feeders ?? [])].sort(byOrder).map((f) => ({
        id: f.id,
        beamColourId: f.beam_colour_id,
        feederNumber: f.feeder_number ?? `FDR-${f.display_order}`,
        colorName: f.color_name,
        oldNumber: text(f.old_number),
        pick: num(f.pick),
        card: num(f.card),
        displayOrder: f.display_order,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      })),
    })),
  };
}

/** App design -> save_design() arguments (snake_case JSON). */
function toSaveArgs(designId: string | null, input: z.output<typeof DesignSchema>) {
  return {
    p_design_id: designId,
    p_design: {
      design_number: input.designNumber,
      design_name: input.designName,
      dn: input.dn ?? null,
      dn_code: input.dnCode ?? null,
      reed: input.reed ?? null,
      pick: input.pick ?? null,
      cards: input.cards ?? null,
      patti: input.patti ?? null,
      total_dc: input.totalDC ?? null,
      total_cut: input.totalCut ?? null,
      work: input.work ?? null,
      blue_apt: input.blueApt ?? null,
      description: input.description ?? null,
      remarks: input.remarks ?? null,
      image: input.image ?? null,
    },
    p_beam_colours: input.beamColours.map((bc) => ({
      beam_colour: bc.beamColour,
      display_order: bc.displayOrder,
      feeders: bc.feeders.map((f) => ({
        feeder_number: f.feederNumber,
        color_name: f.colorName,
        old_number: f.oldNumber ?? null,
        pick: f.pick,
        card: f.card,
        display_order: f.displayOrder,
      })),
    })),
  };
}

async function saveDesign(designId: string | null, input: unknown): Promise<string> {
  const validated = DesignSchema.parse(input);
  const { data, error } = await supabase.rpc("save_design", toSaveArgs(designId, validated));
  if (error) {
    if (error.code === "23505") {
      throw new ValidationError(
        "designNumber",
        `Design number ${validated.designNumber.toUpperCase()} already exists (including archived designs)`,
      );
    }
    if (error.code === "42501") {
      throw new DesignError("You don't have permission to save this design");
    }
    throw new DesignError(`Failed to save design: ${error.message}`);
  }
  return z.string().uuid().parse(data);
}

// ============================================================================
// SERVICE LAYER
// ============================================================================

export const designsService = {
  /** List designs with their beam colours and feeders. */
  async listDesigns(includeArchived: boolean = false): Promise<DesignWithDetails[]> {
    let query = supabase.from("designs").select(DESIGN_WITH_MATRIX).order("design_number");
    if (!includeArchived) query = query.is("archived_at", null);

    const { data, error } = await query;
    if (error) throw new DesignError(`Failed to fetch designs: ${error.message}`);
    return ((data ?? []) as DesignRowWithMatrix[]).map(toDesignWithDetails);
  },

  async getDesignById(id: string): Promise<DesignWithDetails> {
    const { data, error } = await supabase
      .from("designs")
      .select(DESIGN_WITH_MATRIX)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new DesignError(`Failed to fetch design: ${error.message}`);
    if (!data) throw new NotFoundError("Design", id);
    return toDesignWithDetails(data as DesignRowWithMatrix);
  },

  /** Active design by number (design numbers are stored upper-case). */
  async getDesignByNumber(designNumber: string): Promise<DesignWithDetails | null> {
    const { data, error } = await supabase
      .from("designs")
      .select(DESIGN_WITH_MATRIX)
      .eq("design_number", designNumber.trim().toUpperCase())
      .is("archived_at", null)
      .maybeSingle();
    if (error) throw new DesignError(`Failed to fetch design: ${error.message}`);
    return data ? toDesignWithDetails(data as DesignRowWithMatrix) : null;
  },

  /** Create a design with its beam colour x feeder matrix (one transaction). */
  async createDesign(input: unknown): Promise<DesignWithDetails> {
    const id = await saveDesign(null, input);
    return this.getDesignById(id);
  },

  /** Update a design; its matrix is replaced (one transaction). */
  async updateDesign(id: string, input: unknown): Promise<DesignWithDetails> {
    await saveDesign(id, input);
    return this.getDesignById(id);
  },

  /** Archive design (soft delete). */
  async archiveDesign(id: string): Promise<void> {
    const user = await _getAuthUser();
    const { data, error } = await supabase
      .from("designs")
      .update({
        archived_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id");
    if (error) throw new DesignError(`Failed to archive design: ${error.message}`);
    if (!data || data.length === 0) {
      throw new DesignError("Design not found or you don't have permission to archive it");
    }
  },

  /** Copy a design (including its matrix) under a new number. */
  async cloneDesign(
    originalId: string,
    newDesignNumber: string,
    newDesignName?: string,
  ): Promise<DesignWithDetails> {
    const original = await this.getDesignById(originalId);
    return this.createDesign({
      ...original,
      designNumber: newDesignNumber,
      designName: newDesignName?.trim() || `${original.designName} (Copy)`,
      beamColours: original.beamColours.map((bc) => ({
        beamColour: bc.beamColour,
        displayOrder: bc.displayOrder,
        feeders: bc.feeders.map((f) => ({
          feederNumber: f.feederNumber,
          colorName: f.colorName,
          oldNumber: f.oldNumber,
          pick: f.pick,
          card: f.card,
          displayOrder: f.displayOrder,
        })),
      })),
    });
  },

  /** Search designs with pagination and filters. */
  async searchDesigns(filter: DesignFilter): Promise<{
    items: DesignWithDetails[];
    total: number;
    totalPages: number;
  }> {
    let query = supabase
      .from("designs")
      .select(DESIGN_WITH_MATRIX, { count: "exact" })
      .is("archived_at", null);

    if (filter.query && filter.query.trim()) {
      const q = `%${filter.query.trim().replace(/[,()]/g, " ")}%`;
      query = query.or(
        `design_number.ilike.${q},design_name.ilike.${q},work.ilike.${q},dn.ilike.${q}`,
      );
    }
    if (filter.work && filter.work !== "all") {
      query = query.eq("work", filter.work);
    }

    const sortBy =
      {
        designNumber: "design_number",
        designName: "design_name",
        updatedAt: "updated_at",
        reed: "reed",
        pick: "pick",
      }[filter.sortBy] || "design_number";
    query = query.order(sortBy, { ascending: filter.sortOrder === "asc" });

    const pageSize = filter.pageSize || 8;
    const page = Math.max(1, filter.page);
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new DesignError(`Failed to search designs: ${error.message}`);

    const total = count || 0;
    return {
      items: ((data ?? []) as DesignRowWithMatrix[]).map(toDesignWithDetails),
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  },

  /**
   * Feeder cross-reference: every feeder of every active design matching the query on design
   * number/name, beam colour, feeder colour, old number or feeder number. An empty query returns
   * every feeder.
   */
  async searchFeederCrossReference(query: string): Promise<FeederCrossReferenceItem[]> {
    const designs = await this.listDesigns(false);
    const q = query.trim().toLowerCase();
    const results: FeederCrossReferenceItem[] = [];
    for (const d of designs) {
      for (const bc of d.beamColours) {
        for (const f of bc.feeders) {
          const matches =
            !q ||
            d.designNumber.toLowerCase().includes(q) ||
            d.designName.toLowerCase().includes(q) ||
            bc.beamColour.toLowerCase().includes(q) ||
            f.colorName.toLowerCase().includes(q) ||
            (f.oldNumber ?? "").toLowerCase().includes(q) ||
            f.feederNumber.toLowerCase().includes(q);
          if (matches) {
            results.push({
              id: `${d.id}-${bc.id}-${f.id}`,
              designId: d.id,
              designNumber: d.designNumber,
              designName: d.designName,
              beamColourId: bc.id,
              beamColour: bc.beamColour,
              feederId: f.id,
              feederNumber: f.feederNumber,
              colorName: f.colorName,
              oldNumber: f.oldNumber || "—",
              work: d.work,
              image: d.image,
            });
          }
        }
      }
    }
    return results;
  },
};

async function _getAuthUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");
  return session.user;
}
