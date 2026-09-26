import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// Schemas
export const LoomSchema = z.object({
  loom_no: z.string().min(1).max(50),
  loom_type: z.string().min(1).max(100),
  panna_inch: z.number().positive(),
  reed_size: z.number().positive().optional(),
  picks_per_minute: z.number().positive().optional(),
  remarks: z.string().optional(),
});

export const LoomStatusUpdateSchema = z.object({
  status: z.enum(["IDLE", "RUNNING", "MAINTENANCE", "BLOCKED", "DECOMMISSIONED"]),
  assigned_operator_id: z.string().uuid().nullable().optional(),
  remarks: z.string().optional(),
});

export const MaintenanceScheduleSchema = z.object({
  loom_id: z.string().uuid(),
  maintenance_type: z.enum(["ROUTINE", "PREVENTIVE", "BREAKDOWN", "URGENT"]),
  scheduled_start: z.string().refine((d) => !isNaN(Date.parse(d))),
  scheduled_end: z.string().refine((d) => !isNaN(Date.parse(d))),
  description: z.string().optional(),
});

export type Loom = z.infer<typeof LoomSchema>;
export type LoomStatusUpdate = z.infer<typeof LoomStatusUpdateSchema>;
export type MaintenanceSchedule = z.infer<typeof MaintenanceScheduleSchema>;

// Error class
export class LoomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoomError";
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

// Loom Service
export const loomService = {
  async createLoom(data: unknown): Promise<any> {
    const validated = LoomSchema.parse(data);
    const user = await getAuthUser();

    const { data: result, error } = await supabase
      .from("looms")
      .insert([
        {
          ...validated,
          status: "IDLE",
          is_active: true,
          created_by: user.email,
          updated_by: user.email,
        },
      ])
      .select()
      .single();

    if (error) throw new LoomError(`Failed to create loom: ${error.message}`);
    return result;
  },

  async getLoomById(id: string): Promise<any> {
    const { data, error } = await supabase
      .from("looms")
      .select(
        `
        *,
        job_cards(card_no, status, qty_metre),
        profiles(full_name)
      `,
      )
      .eq("id", id)
      .single();

    if (error) throw new LoomError(`Failed to fetch loom: ${error.message}`);
    if (!data) throw new LoomError(`Loom not found: ${id}`);
    return data;
  },

  async listLooms(filters?: {
    status?: string;
    is_active?: boolean;
    loom_type?: string;
  }): Promise<any[]> {
    let query = supabase.from("looms").select("*, profiles(full_name), job_cards(card_no, status)");

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }
    if (filters?.loom_type) {
      query = query.eq("loom_type", filters.loom_type);
    }

    const { data, error } = await query.order("loom_no", { ascending: true });

    if (error) throw new LoomError(`Failed to list looms: ${error.message}`);
    return data || [];
  },

  async updateLoomStatus(id: string, updates: unknown): Promise<any> {
    const validated = LoomStatusUpdateSchema.parse(updates);
    const user = await getAuthUser();

    const { data, error } = await supabase
      .from("looms")
      .update({
        ...validated,
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new LoomError(`Failed to update loom status: ${error.message}`);
    return data;
  },

  async assignJobCard(loom_id: string, job_card_id: string): Promise<any> {
    const user = await getAuthUser();

    // Update loom with job card
    const { data, error } = await supabase
      .from("looms")
      .update({
        current_job_card_id: job_card_id,
        status: "RUNNING",
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loom_id)
      .select()
      .single();

    if (error) throw new LoomError(`Failed to assign job card: ${error.message}`);

    // Update job card status
    await supabase
      .from("job_cards")
      .update({
        loom_id,
        status: "ASSIGNED",
        started_date: new Date().toISOString(),
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job_card_id);

    return data;
  },

  async unassignJobCard(loom_id: string): Promise<any> {
    const user = await getAuthUser();

    const { data, error } = await supabase
      .from("looms")
      .update({
        current_job_card_id: null,
        status: "IDLE",
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loom_id)
      .select()
      .single();

    if (error) throw new LoomError(`Failed to unassign job card: ${error.message}`);
    return data;
  },

  async getLoomUtilization(loom_id: string, days = 30): Promise<any> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { data, error } = await supabase
      .from("daily_production")
      .select(
        `
        entry_date,
        shift,
        metre_produced,
        downtime_min,
        job_cards(card_no)
      `,
      )
      .eq("loom_id", loom_id)
      .gte("entry_date", fromDate.toISOString().split("T")[0])
      .order("entry_date", { ascending: false });

    if (error) throw new LoomError(`Failed to fetch utilization: ${error.message}`);

    const totalShifts = days * 3; // 3 shifts per day
    const actualShifts = data?.length || 0;
    const totalMetres = data?.reduce((sum, log) => sum + (log.metre_produced || 0), 0) || 0;
    const totalDowntime = data?.reduce((sum, log) => sum + (log.downtime_min || 0), 0) || 0;

    return {
      loom_id,
      days,
      utilization_percent: (actualShifts / totalShifts) * 100,
      actual_shifts: actualShifts,
      total_shifts: totalShifts,
      total_metres_produced: totalMetres,
      total_downtime_minutes: totalDowntime,
      entries: data,
    };
  },

  // Maintenance
  async scheduleMaintenance(data: unknown): Promise<any> {
    const validated = MaintenanceScheduleSchema.parse(data);
    const user = await getAuthUser();

    const { data: result, error } = await supabase
      .from("loom_maintenance")
      .insert([
        {
          ...validated,
          status: "SCHEDULED",
          created_by: user.email,
        },
      ])
      .select()
      .single();

    if (error) throw new LoomError(`Failed to schedule maintenance: ${error.message}`);
    return result;
  },

  async getMaintenanceSchedule(
    loom_id?: string,
    status?: string,
  ): Promise<any[]> {
    let query = supabase
      .from("loom_maintenance")
      .select("*, looms(loom_no)");

    if (loom_id) {
      query = query.eq("loom_id", loom_id);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("scheduled_start", { ascending: true });

    if (error) throw new LoomError(`Failed to fetch maintenance schedule: ${error.message}`);
    return data || [];
  },

  async startMaintenance(id: string): Promise<any> {
    const { data, error } = await supabase
      .from("loom_maintenance")
      .update({
        status: "IN_PROGRESS",
        actual_start: new Date().toISOString().split("T")[0],
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new LoomError(`Failed to start maintenance: ${error.message}`);

    // Update loom status to MAINTENANCE
    const maintenance = data;
    if (maintenance?.loom_id) {
      await supabase
        .from("looms")
        .update({
          status: "MAINTENANCE",
          current_job_card_id: null,
        })
        .eq("id", maintenance.loom_id);
    }

    return data;
  },

  async completeMaintenance(id: string): Promise<any> {
    const { data, error } = await supabase
      .from("loom_maintenance")
      .update({
        status: "COMPLETED",
        actual_end: new Date().toISOString().split("T")[0],
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new LoomError(`Failed to complete maintenance: ${error.message}`);

    // Update loom status back to IDLE
    const maintenance = data;
    if (maintenance?.loom_id) {
      await supabase
        .from("looms")
        .update({
          status: "IDLE",
        })
        .eq("id", maintenance.loom_id);
    }

    return data;
  },

  async getBlockoutPeriods(from_date: string, to_date: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("loom_maintenance")
      .select("*, looms(loom_no)")
      .eq("status", "SCHEDULED")
      .gte("scheduled_start", from_date)
      .lte("scheduled_end", to_date);

    if (error) throw new LoomError(`Failed to fetch blockout periods: ${error.message}`);
    return data || [];
  },
};
