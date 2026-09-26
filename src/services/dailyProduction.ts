import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// Schemas
export const DailyProductionSchema = z.object({
  entry_date: z.string().refine((d) => !isNaN(Date.parse(d))),
  shift: z.enum(["A", "B", "C"]),
  job_card_id: z.string().uuid(),
  loom_id: z.string().uuid(),
  metre_produced: z.number().positive(),
  yarn_kg_used: z.number().positive(),
  downtime_min: z.number().nonnegative().default(0),
  downtime_reason: z.string().optional(),
  quality_grade: z.string().optional(),
  remarks: z.string().optional(),
});

export type DailyProduction = z.infer<typeof DailyProductionSchema>;

// Error class
export class DailyProductionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyProductionError";
  }
}

// Helper function
async function getAuthUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user;
}

// Daily Production Service (Append-Only Ledger)
export const dailyProductionService = {
  async recordDailyProduction(data: unknown): Promise<any> {
    const validated = DailyProductionSchema.parse(data);
    const user = await getAuthUser();

    // Check for duplicate shift entry
    const { data: existing } = await supabase
      .from("daily_production")
      .select("id")
      .eq("job_card_id", validated.job_card_id)
      .eq("loom_id", validated.loom_id)
      .eq("entry_date", validated.entry_date)
      .eq("shift", validated.shift)
      .single();

    if (existing) {
      throw new DailyProductionError(
        `Production already logged for this shift (${validated.entry_date}, Shift ${validated.shift})`,
      );
    }

    // Validate job card exists and get current total
    const { data: jobCard, error: jobCardError } = await supabase
      .from("job_cards")
      .select("qty_metre, daily_production(metre_produced)")
      .eq("id", validated.job_card_id)
      .single();

    if (jobCardError) {
      throw new DailyProductionError(`Invalid job card: ${validated.job_card_id}`);
    }

    // Check cumulative total doesn't exceed job card quantity
    const totalProduced = (jobCard.daily_production || []).reduce(
      (sum: number, log: any) => sum + (log.metre_produced || 0),
      0,
    );

    if (totalProduced + validated.metre_produced > jobCard.qty_metre) {
      throw new DailyProductionError(
        `Production entry (${validated.metre_produced}m) would exceed job card quantity. ` +
          `Already logged: ${totalProduced}m, Limit: ${jobCard.qty_metre}m`,
      );
    }

    // Insert immutable production record
    const { data: result, error } = await supabase
      .from("daily_production")
      .insert([
        {
          ...validated,
          recorded_by: user.email,
        },
      ])
      .select()
      .single();

    if (error) throw new DailyProductionError(`Failed to record production: ${error.message}`);

    // Update job card status if not already IN_PROGRESS
    await supabase
      .from("job_cards")
      .update({
        status: "IN_PROGRESS",
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.job_card_id)
      .eq("status", "ASSIGNED");

    return result;
  },

  async getDailyProductionLogs(
    filters: {
      job_card_id?: string;
      loom_id?: string;
      entry_date?: string;
      from_date?: string;
      to_date?: string;
    } = {},
  ): Promise<any[]> {
    let query = supabase.from("daily_production").select("*, job_cards(card_no), looms(loom_no)");

    if (filters.job_card_id) {
      query = query.eq("job_card_id", filters.job_card_id);
    }
    if (filters.loom_id) {
      query = query.eq("loom_id", filters.loom_id);
    }
    if (filters.entry_date) {
      query = query.eq("entry_date", filters.entry_date);
    }
    if (filters.from_date) {
      query = query.gte("entry_date", filters.from_date);
    }
    if (filters.to_date) {
      query = query.lte("entry_date", filters.to_date);
    }

    const { data, error } = await query.order("entry_date", { ascending: false });

    if (error) throw new DailyProductionError(`Failed to fetch logs: ${error.message}`);
    return data || [];
  },

  async getVarianceAnalysis(job_card_id: string): Promise<any> {
    const { data: jobCard, error: jobCardError } = await supabase
      .from("job_cards")
      .select("qty_metre, production_orders(qty_metre)")
      .eq("id", job_card_id)
      .single();

    if (jobCardError) {
      throw new DailyProductionError(`Job card not found: ${job_card_id}`);
    }

    const { data: logs } = await supabase
      .from("daily_production")
      .select("*")
      .eq("job_card_id", job_card_id)
      .order("entry_date", { ascending: true });

    const totalProduced = (logs || []).reduce((sum, log) => sum + (log.metre_produced || 0), 0);
    const totalYarnUsed = (logs || []).reduce((sum, log) => sum + (log.yarn_kg_used || 0), 0);
    const totalDowntime = (logs || []).reduce((sum, log) => sum + (log.downtime_min || 0), 0);

    const variance = jobCard.qty_metre - totalProduced;
    const variancePercent = (variance / jobCard.qty_metre) * 100;

    return {
      job_card_id,
      planned_qty: jobCard.qty_metre,
      actual_produced: totalProduced,
      variance: variance,
      variance_percent: variancePercent,
      total_yarn_kg: totalYarnUsed,
      avg_yarn_per_metre: totalProduced > 0 ? totalYarnUsed / totalProduced : 0,
      total_downtime_min: totalDowntime,
      entries_count: logs?.length || 0,
      status: totalProduced >= jobCard.qty_metre ? "COMPLETED" : "IN_PROGRESS",
    };
  },

  async getShiftSummary(entry_date: string): Promise<any> {
    const { data: logs } = await supabase
      .from("daily_production")
      .select("*, job_cards(card_no, production_orders(order_no)), looms(loom_no)")
      .eq("entry_date", entry_date)
      .order("shift", { ascending: true });

    const shifts = { A: [], B: [], C: [] };

    (logs || []).forEach((log) => {
      shifts[log.shift as "A" | "B" | "C"].push({
        loom: log.looms.loom_no,
        card: log.job_cards.card_no,
        order: log.job_cards.production_orders.order_no,
        metre: log.metre_produced,
        yarn_kg: log.yarn_kg_used,
        downtime_min: log.downtime_min,
      });
    });

    return {
      entry_date,
      shift_A: {
        entries: shifts.A.length,
        total_metre: shifts.A.reduce((sum, e) => sum + e.metre, 0),
        total_yarn_kg: shifts.A.reduce((sum, e) => sum + e.yarn_kg, 0),
        total_downtime_min: shifts.A.reduce((sum, e) => sum + e.downtime_min, 0),
        logs: shifts.A,
      },
      shift_B: {
        entries: shifts.B.length,
        total_metre: shifts.B.reduce((sum, e) => sum + e.metre, 0),
        total_yarn_kg: shifts.B.reduce((sum, e) => sum + e.yarn_kg, 0),
        total_downtime_min: shifts.B.reduce((sum, e) => sum + e.downtime_min, 0),
        logs: shifts.B,
      },
      shift_C: {
        entries: shifts.C.length,
        total_metre: shifts.C.reduce((sum, e) => sum + e.metre, 0),
        total_yarn_kg: shifts.C.reduce((sum, e) => sum + e.yarn_kg, 0),
        total_downtime_min: shifts.C.reduce((sum, e) => sum + e.downtime_min, 0),
        logs: shifts.C,
      },
    };
  },

  async getYarnConsumptionStats(from_date: string, to_date: string): Promise<any> {
    const { data: logs } = await supabase
      .from("daily_production")
      .select("*, job_cards(production_orders(quality_name))")
      .gte("entry_date", from_date)
      .lte("entry_date", to_date);

    const qualityStats: Record<string, any> = {};

    (logs || []).forEach((log) => {
      const quality = log.job_cards.production_orders.quality_name;
      if (!qualityStats[quality]) {
        qualityStats[quality] = {
          total_metre: 0,
          total_yarn_kg: 0,
          entries: 0,
          avg_kg_per_metre: 0,
        };
      }

      qualityStats[quality].total_metre += log.metre_produced;
      qualityStats[quality].total_yarn_kg += log.yarn_kg_used;
      qualityStats[quality].entries += 1;
    });

    Object.keys(qualityStats).forEach((quality) => {
      const stats = qualityStats[quality];
      stats.avg_kg_per_metre = stats.total_metre > 0 ? stats.total_yarn_kg / stats.total_metre : 0;
    });

    return {
      period: { from: from_date, to: to_date },
      by_quality: qualityStats,
      total_logs: logs?.length || 0,
    };
  },

  async recordProductionCorrection(
    original_entry_id: string,
    corrected_data: unknown,
  ): Promise<any> {
    // In a real system, this would be a reversal entry + new entry
    // For now, we create a new entry with correction flag
    const user = await getAuthUser();
    const validated = DailyProductionSchema.parse(corrected_data);

    const { data: result, error } = await supabase
      .from("daily_production")
      .insert([
        {
          ...validated,
          recorded_by: user.email,
          remarks: `Correction for entry ${original_entry_id} (original removed)`,
        },
      ])
      .select()
      .single();

    if (error) throw new DailyProductionError(`Failed to record correction: ${error.message}`);
    return result;
  },
};
