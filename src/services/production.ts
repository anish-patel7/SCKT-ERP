import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// Schemas
export const ProductionOrderSchema = z.object({
  order_no: z.string().min(1).max(50),
  cost_sheet_id: z.string().uuid().nullable().optional(),
  design_no: z.string().min(1).max(50),
  party_id: z.string().uuid(),
  quality_name: z.string().min(1).max(200),
  qty_metre: z.number().positive(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  target_delivery_date: z.string().refine((d) => !isNaN(Date.parse(d))),
  remarks: z.string().optional(),
});

export const JobCardIssueSchema = z.object({
  production_order_id: z.string().uuid(),
  card_count: z.number().int().positive(),
});

export const JobCardUpdateSchema = z.object({
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "ARCHIVED"]).optional(),
  loom_id: z.string().uuid().nullable().optional(),
  feeder_notes: z.string().optional(),
  remarks: z.string().optional(),
});

export const ProductionOrderUpdateSchema = z.object({
  status: z
    .enum(["PLANNED", "JOB_CARDS_ISSUED", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "ON_HOLD", "CANCELLED"])
    .optional(),
  remarks: z.string().optional(),
  qty_completed_metre: z.number().nonnegative().optional(),
});

export type ProductionOrder = z.infer<typeof ProductionOrderSchema>;
export type JobCardIssue = z.infer<typeof JobCardIssueSchema>;
export type JobCardUpdate = z.infer<typeof JobCardUpdateSchema>;
export type ProductionOrderUpdate = z.infer<typeof ProductionOrderUpdateSchema>;

// Error class
export class ProductionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionError";
  }
}

// Helper function to get current user
async function getAuthUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user;
}

// Production Order Service
export const productionService = {
  async createProductionOrder(data: unknown): Promise<any> {
    const validated = ProductionOrderSchema.parse(data);
    const user = await getAuthUser();

    const { data: result, error } = await supabase
      .from("production_orders")
      .insert([
        {
          ...validated,
          status: "PLANNED",
          created_by: user.email,
          updated_by: user.email,
        },
      ])
      .select()
      .single();

    if (error) throw new ProductionError(`Failed to create order: ${error.message}`);
    return result;
  },

  async getProductionOrder(id: string): Promise<any> {
    const { data, error } = await supabase
      .from("production_orders")
      .select(
        `
        *,
        cost_sheets(sheet_no, quality),
        parties(party_name, contact_person),
        job_cards(*)
      `,
      )
      .eq("id", id)
      .single();

    if (error) throw new ProductionError(`Failed to fetch order: ${error.message}`);
    if (!data) throw new ProductionError(`Order not found: ${id}`);
    return data;
  },

  async listProductionOrders(filters?: {
    status?: string;
    priority?: string;
    party_id?: string;
    date_range?: { from: string; to: string };
  }): Promise<any[]> {
    let query = supabase
      .from("production_orders")
      .select("*, parties(party_name), cost_sheets(sheet_no)");

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.priority) {
      query = query.eq("priority", filters.priority);
    }
    if (filters?.party_id) {
      query = query.eq("party_id", filters.party_id);
    }
    if (filters?.date_range) {
      query = query.gte("target_delivery_date", filters.date_range.from).lte("target_delivery_date", filters.date_range.to);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw new ProductionError(`Failed to list orders: ${error.message}`);
    return data || [];
  },

  async updateProductionOrder(id: string, updates: unknown): Promise<any> {
    const validated = ProductionOrderUpdateSchema.parse(updates);
    const user = await getAuthUser();

    const { data, error } = await supabase
      .from("production_orders")
      .update({
        ...validated,
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new ProductionError(`Failed to update order: ${error.message}`);
    return data;
  },

  async startProduction(id: string): Promise<any> {
    const user = await getAuthUser();

    const { data, error } = await supabase
      .from("production_orders")
      .update({
        status: "IN_PROGRESS",
        started_date: new Date().toISOString().split("T")[0],
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "JOB_CARDS_ISSUED")
      .select()
      .single();

    if (error) throw new ProductionError(`Failed to start production: ${error.message}`);

    // Audit trail
    await supabase.from("production_audit_trail").insert({
      order_id: id,
      action: "PRODUCTION_STARTED",
      actor_id: (await supabase.auth.getSession()).data.session?.user.id,
      actor_name: user.email,
      details: { timestamp: new Date().toISOString() },
    });

    return data;
  },

  async completeProduction(id: string, qty_completed: number): Promise<any> {
    const user = await getAuthUser();

    // Get order to validate
    const order = await this.getProductionOrder(id);
    if (qty_completed < order.qty_metre) {
      throw new ProductionError(`Completion qty (${qty_completed}) less than order qty (${order.qty_metre})`);
    }

    const { data, error } = await supabase
      .from("production_orders")
      .update({
        status: "COMPLETED",
        completed_date: new Date().toISOString().split("T")[0],
        qty_completed_metre: qty_completed,
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new ProductionError(`Failed to complete order: ${error.message}`);

    // Audit trail
    await supabase.from("production_audit_trail").insert({
      order_id: id,
      action: "ORDER_COMPLETED",
      actor_id: (await supabase.auth.getSession()).data.session?.user.id,
      actor_name: user.email,
      details: { qty_completed },
    });

    return data;
  },

  async holdProduction(id: string, reason?: string): Promise<any> {
    const user = await getAuthUser();

    const { data, error } = await supabase
      .from("production_orders")
      .update({
        status: "ON_HOLD",
        updated_by: user.email,
        updated_at: new Date().toISOString(),
        remarks: reason || undefined,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new ProductionError(`Failed to hold production: ${error.message}`);

    // Audit trail
    await supabase.from("production_audit_trail").insert({
      order_id: id,
      action: "STATUS_CHANGED",
      actor_id: (await supabase.auth.getSession()).data.session?.user.id,
      actor_name: user.email,
      details: { new_status: "ON_HOLD", reason },
    });

    return data;
  },

  // Job Cards - ATOMIC ISSUANCE
  async issueJobCards(production_order_id: string, card_count: number): Promise<any[]> {
    const user = await getAuthUser();

    // Validate order
    const order = await this.getProductionOrder(production_order_id);
    if (order.status !== "PLANNED") {
      throw new ProductionError(`Cannot issue cards for order with status: ${order.status}`);
    }

    // Calculate qty per card
    const qty_per_card = order.qty_metre / card_count;

    // Generate card numbers
    const cards = Array.from({ length: card_count }, (_, i) => ({
      card_no: `${order.order_no}-JC${String(i + 1).padStart(2, "0")}`,
      production_order_id,
      sequence_number: i + 1,
      qty_metre: Math.ceil(qty_per_card * 100) / 100, // Round to 2 decimals
      status: "OPEN",
      issued_date: new Date().toISOString(),
      created_by: user.email,
      updated_by: user.email,
    }));

    // ATOMIC: Insert all cards or none
    const { data, error } = await supabase
      .from("job_cards")
      .insert(cards)
      .select();

    if (error) {
      throw new ProductionError(`Failed to issue job cards: ${error.message}`);
    }

    // Update order status
    await supabase
      .from("production_orders")
      .update({
        status: "JOB_CARDS_ISSUED",
        issued_date: new Date().toISOString().split("T")[0],
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", production_order_id);

    // Audit trail
    await supabase.from("production_audit_trail").insert({
      order_id: production_order_id,
      action: "JOB_CARDS_ISSUED",
      actor_id: (await supabase.auth.getSession()).data.session?.user.id,
      actor_name: user.email,
      details: { card_count, cards_created: data?.length },
    });

    return data || [];
  },

  async getJobCardsByOrder(production_order_id: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("job_cards")
      .select("*, looms(loom_no, status), daily_production(*)")
      .eq("production_order_id", production_order_id)
      .order("sequence_number", { ascending: true });

    if (error) throw new ProductionError(`Failed to fetch job cards: ${error.message}`);
    return data || [];
  },

  async getJobCardDetails(job_card_id: string): Promise<any> {
    const { data, error } = await supabase
      .from("job_cards")
      .select(
        `
        *,
        looms(loom_no, status, panna_inch),
        production_orders(order_no, party_id, quality_name),
        daily_production(*)
      `,
      )
      .eq("id", job_card_id)
      .single();

    if (error) throw new ProductionError(`Failed to fetch job card: ${error.message}`);
    return data;
  },

  async updateJobCard(id: string, updates: unknown): Promise<any> {
    const validated = JobCardUpdateSchema.parse(updates);
    const user = await getAuthUser();

    const { data, error } = await supabase
      .from("job_cards")
      .update({
        ...validated,
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new ProductionError(`Failed to update job card: ${error.message}`);
    return data;
  },

  async completeJobCard(id: string): Promise<any> {
    const user = await getAuthUser();

    const { data, error } = await supabase
      .from("job_cards")
      .update({
        status: "COMPLETED",
        completed_date: new Date().toISOString(),
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new ProductionError(`Failed to complete job card: ${error.message}`);
    return data;
  },

  async getOrderProgress(order_id: string): Promise<{
    total_qty: number;
    completed_qty: number;
    percent_complete: number;
    total_cards: number;
    completed_cards: number;
    in_progress_cards: number;
  }> {
    const order = await this.getProductionOrder(order_id);
    const cards = await this.getJobCardsByOrder(order_id);

    const totalProduced = cards.reduce((sum, card) => {
      const cardProduced = (card.daily_production || []).reduce(
        (s: number, log: any) => s + (log.metre_produced || 0),
        0,
      );
      return sum + cardProduced;
    }, 0);

    return {
      total_qty: order.qty_metre,
      completed_qty: totalProduced,
      percent_complete: (totalProduced / order.qty_metre) * 100,
      total_cards: cards.length,
      completed_cards: cards.filter((c: any) => c.status === "COMPLETED").length,
      in_progress_cards: cards.filter((c: any) => c.status === "IN_PROGRESS").length,
    };
  },

  // Manual job card creation (for custom party/sub-party/loom assignments)
  async createJobCard(data: {
    card_no: string;
    production_order_id: string;
    qty_metre: number;
    party_id?: string;
    sub_party_id?: string;
    loom_id?: string | null;
    feeder_notes?: string;
    remarks?: string;
  }): Promise<any> {
    const user = await getAuthUser();

    // Validate order exists
    const order = await this.getProductionOrder(data.production_order_id);
    if (!order) {
      throw new ProductionError(`Production order not found: ${data.production_order_id}`);
    }

    const { data: result, error } = await supabase
      .from("job_cards")
      .insert([
        {
          card_no: data.card_no,
          production_order_id: data.production_order_id,
          qty_metre: data.qty_metre,
          party_id: data.party_id || null,
          sub_party_id: data.sub_party_id || null,
          loom_id: data.loom_id || null,
          feeder_notes: data.feeder_notes || null,
          remarks: data.remarks || null,
          status: "OPEN",
          issued_date: new Date().toISOString(),
          created_by: user.email,
          updated_by: user.email,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new ProductionError(`Failed to create job card: ${error.message}`);
    }

    return result;
  },

  // Delete job card (soft-delete via archive status)
  async deleteJobCard(id: string): Promise<void> {
    const user = await getAuthUser();

    const { error } = await supabase
      .from("job_cards")
      .update({
        status: "ARCHIVED",
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new ProductionError(`Failed to delete job card: ${error.message}`);
    }
  },

  // Fetch all job cards (unfiltered)
  async getAllJobCards(): Promise<any[]> {
    const { data, error } = await supabase
      .from("job_cards")
      .select("*, looms(loom_no), production_orders(order_no, qty_metre), daily_production(*)")
      .order("created_at", { ascending: false });

    if (error) throw new ProductionError(`Failed to fetch job cards: ${error.message}`);
    return data || [];
  },

  // ===== ATOMIC RPC 1: Issue Material to Production =====
  // Atomically decrements inventory and creates transaction ledger entry
  async issueMaterialToProduction(
    jobCardId: string,
    inventoryItemId: string,
    qtyToIssue: number,
    issuedBy?: string,
  ): Promise<{ qty_issued: number; available_after: number; transaction_id: string }> {
    const { data, error } = await supabase.rpc("issue_material_to_production", {
      p_job_card_id: jobCardId,
      p_inventory_item_id: inventoryItemId,
      p_qty_to_issue: qtyToIssue,
      p_issued_by: issuedBy || null,
    });

    if (error) {
      console.error("RPC error:", error);
      throw new ProductionError(`Failed to issue material: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new ProductionError("Material issue RPC returned no results");
    }

    const result = data[0];
    return {
      qty_issued: result.qty_issued,
      available_after: result.available_after,
      transaction_id: result.transaction_id,
    };
  },

  // ===== ATOMIC RPC 2: Complete Job Output =====
  // Records production output with grade and updates inventory
  async completeJobOutput(
    jobCardId: string,
    outputQty: number,
    outputGrade: string = "Grade A",
    completedBy?: string,
  ): Promise<{ output_id: string; qty: number; grade: string; completed_at: string }> {
    const { data, error } = await supabase.rpc("complete_job_output", {
      p_job_card_id: jobCardId,
      p_output_qty: outputQty,
      p_output_grade: outputGrade,
      p_completed_by: completedBy || null,
    });

    if (error) {
      console.error("RPC error:", error);
      throw new ProductionError(`Failed to complete job output: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new ProductionError("Job output completion RPC returned no results");
    }

    const result = data[0];
    return {
      output_id: result.output_id,
      qty: result.output_qty,
      grade: result.grade,
      completed_at: result.completed_at,
    };
  },
};
