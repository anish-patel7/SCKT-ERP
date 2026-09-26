import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * STEP 14 Phase 5: Stock Reservation Service
 *
 * Manages stock reservations with approval workflow:
 * - Create and track item reservations
 * - Approve/reject with manager review
 * - Auto-expire reservations past due date
 * - Sync reserved quantities with inventory
 * - Query reservations by item, status, user
 */

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export type ReservationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";
export type StockUnit = "kg" | "m" | "beam" | "roll";

export interface StockReservation {
  id: string;
  item_id: string;
  qty_reserved: number;
  unit: StockUnit;
  reserved_by: string;
  reservation_date: string;
  approval_status: ReservationStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  expires_at?: string | null;
  reference_doc?: string | null;
  remarks?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface ReservationWithItem extends StockReservation {
  item_code?: string;
  item_name?: string;
  item_type?: string;
  available_qty?: number;
}

export interface ReservationApprovalRequest {
  id: string;
  item_id: string;
  item_code?: string;
  item_name?: string;
  qty_reserved: number;
  unit: StockUnit;
  reserved_by: string;
  reservation_date: string;
  expires_at?: string | null;
  reference_doc?: string | null;
  remarks?: string | null;
}

// Validation Schemas
const StockReservationSchema = z.object({
  item_id: z.string().uuid(),
  qty_reserved: z.number().positive(),
  unit: z.enum(["kg", "m", "beam", "roll"]),
  expires_at: z.string().optional(),
  reference_doc: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

const ApproveReservationSchema = z.object({
  approval_status: z.enum(["APPROVED", "REJECTED"]),
  rejection_reason: z.string().max(500).optional(),
});

type NewReservation = z.infer<typeof StockReservationSchema>;
type ApprovalUpdate = z.infer<typeof ApproveReservationSchema>;

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

export const reservationsService = {
  /**
   * Create a new stock reservation
   */
  async createReservation(input: unknown): Promise<StockReservation> {
    const validated = StockReservationSchema.parse(input);

    // Get current user email
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (!user || userError) throw new Error("Not authenticated");

    // Validate item exists and get available quantity
    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .select("id, item_code, item_name, total_qty, reserved_qty")
      .eq("id", validated.item_id)
      .single();

    if (itemError || !item) throw new Error(`Item not found: ${validated.item_id}`);

    const availableQty = item.total_qty - (item.reserved_qty || 0);
    if (validated.qty_reserved > availableQty) {
      throw new Error(
        `Insufficient available quantity. Available: ${availableQty}, Requested: ${validated.qty_reserved}`,
      );
    }

    // Create reservation
    const { data, error } = await supabase
      .from("stock_reservations")
      .insert([
        {
          ...validated,
          reserved_by: user.email,
          approval_status: "PENDING",
          created_by: user.email,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(`Failed to create reservation: ${error.message}`);
    return data as StockReservation;
  },

  /**
   * Get pending reservations for manager approval
   */
  async getPendingReservations(): Promise<ReservationApprovalRequest[]> {
    const { data, error } = await supabase
      .from("stock_reservations")
      .select(
        `
        id,
        item_id,
        qty_reserved,
        unit,
        reserved_by,
        reservation_date,
        expires_at,
        reference_doc,
        remarks,
        inventory_items(item_code, item_name)
      `,
      )
      .eq("approval_status", "PENDING")
      .eq("is_active", true)
      .order("reservation_date", { ascending: true });

    if (error) throw new Error(`Failed to fetch pending reservations: ${error.message}`);

    return (data || []).map((r: any) => ({
      id: r.id,
      item_id: r.item_id,
      item_code: r.inventory_items?.item_code,
      item_name: r.inventory_items?.item_name,
      qty_reserved: r.qty_reserved,
      unit: r.unit,
      reserved_by: r.reserved_by,
      reservation_date: r.reservation_date,
      expires_at: r.expires_at,
      reference_doc: r.reference_doc,
      remarks: r.remarks,
    }));
  },

  /**
   * Get all active reservations for an item
   */
  async getReservationsByItem(itemId: string): Promise<StockReservation[]> {
    const { data, error } = await supabase
      .from("stock_reservations")
      .select("*")
      .eq("item_id", itemId)
      .in("approval_status", ["PENDING", "APPROVED"])
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch reservations: ${error.message}`);
    return data || [];
  },

  /**
   * Get user's reservations
   */
  async getUserReservations(userEmail: string): Promise<ReservationWithItem[]> {
    const { data, error } = await supabase
      .from("stock_reservations")
      .select(
        `
        *,
        inventory_items(item_code, item_name, item_type)
      `,
      )
      .eq("reserved_by", userEmail)
      .eq("is_active", true)
      .order("reservation_date", { ascending: false });

    if (error) throw new Error(`Failed to fetch user reservations: ${error.message}`);

    return (data || []).map((r: any) => ({
      ...r,
      item_code: r.inventory_items?.item_code,
      item_name: r.inventory_items?.item_name,
      item_type: r.inventory_items?.item_type,
    }));
  },

  /**
   * Approve a reservation using the canonical atomic RPC
   */
  async approveReservation(reservationId: string): Promise<StockReservation> {
    const { error: rpcError } = await supabase.rpc(
      "approve_stock_reservation_atomic",
      {
        p_reservation_id: reservationId,
      }
    );

    if (rpcError) {
      throw new Error(`Failed to approve reservation: ${rpcError.message}`);
    }

    // Fetch and return the updated reservation
    const { data, error } = await supabase
      .from("stock_reservations")
      .select("*")
      .eq("id", reservationId)
      .single();

    if (error || !data) {
      throw new Error(`Approved reservation not found: ${reservationId}`);
    }

    return data as StockReservation;
  },

  /**
   * Reject a reservation
   */
  async rejectReservation(
    reservationId: string,
    rejectionReason: string,
  ): Promise<StockReservation> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (!user || userError) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("stock_reservations")
      .update({
        approval_status: "REJECTED",
        rejection_reason: rejectionReason,
        approved_by: user.email,
        approved_at: new Date().toISOString(),
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to reject reservation: ${error.message}`);
    return data as StockReservation;
  },

  /**
   * Cancel a reservation (user action before approval)
   */
  async cancelReservation(reservationId: string): Promise<StockReservation> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (!user || userError) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("stock_reservations")
      .update({
        approval_status: "CANCELLED",
        is_active: false,
        updated_by: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to cancel reservation: ${error.message}`);
    return data as StockReservation;
  },

  /**
   * Check for expired reservations and update status
   */
  async expireReservations(): Promise<number> {
    const now = new Date().toISOString();

    const { error, data } = await supabase
      .from("stock_reservations")
      .update({
        approval_status: "EXPIRED",
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .lt("expires_at", now)
      .in("approval_status", ["PENDING", "APPROVED"])
      .select();

    if (error) throw new Error(`Failed to expire reservations: ${error.message}`);
    return data?.length || 0;
  },

  /**
   * Get reservation summary for an item (total reserved qty)
   */
  async getReservationSummary(
    itemId: string,
  ): Promise<{
    total_reserved: number;
    pending: number;
    approved: number;
  }> {
    const { data, error } = await supabase
      .from("stock_reservations")
      .select("qty_reserved, approval_status")
      .eq("item_id", itemId)
      .in("approval_status", ["PENDING", "APPROVED"])
      .eq("is_active", true);

    if (error) throw new Error(`Failed to fetch reservation summary: ${error.message}`);

    const summary = {
      total_reserved: 0,
      pending: 0,
      approved: 0,
    };

    (data || []).forEach((r: any) => {
      summary.total_reserved += r.qty_reserved;
      if (r.approval_status === "PENDING") summary.pending += r.qty_reserved;
      if (r.approval_status === "APPROVED") summary.approved += r.qty_reserved;
    });

    return summary;
  },
};
