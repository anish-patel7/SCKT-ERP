import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { invoicingService, InvoiceCreated, PaymentRecorded, InvoiceSummary } from "./invoicing";

// ============================================================================
// TYPES & SCHEMAS (STEP 3L: Canonical models imported from invoicing.ts)
// ============================================================================

export const ShipmentSchema = z.object({
  id: z.string().uuid().optional(),
  order_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  status: z.enum(["PICKED", "IN_TRANSIT", "DELIVERED", "FAILED", "RETURNED"]).default("PICKED"),
  shipping_address: z.string().min(1),
  carrier_name: z.string().optional(),
  tracking_number: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Shipment = z.infer<typeof ShipmentSchema>;

// STEP 3L: Invoice and Payment types now imported from canonical invoicing.ts
export type Invoice = InvoiceCreated | InvoiceSummary;
export type PaymentRecorded_Type = PaymentRecorded;

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class DispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchError";
  }
}

export class InvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceError";
  }
}

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

// ============================================================================
// DISPATCH SERVICE
// ============================================================================

export const dispatchService = {
  // ===== RPC 1: Confirm Stock Reservation =====
  // Transition from CONFIRMED to ALLOCATED status
  async confirmStockReservation(
    orderId: string,
    confirmedBy?: string,
  ): Promise<{ total_reserved: number; confirmed_at: string }> {
    const { data, error } = await supabase.rpc("confirm_stock_reservation", {
      p_order_id: orderId,
      p_confirmed_by: confirmedBy || null,
    });

    if (error) {
      console.error("RPC error:", error);
      throw new DispatchError(`Failed to confirm stock reservation: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new DispatchError("Confirm stock reservation RPC returned no results");
    }

    const result = data[0];
    return {
      total_reserved: result.total_reserved,
      confirmed_at: result.confirmed_at,
    };
  },

  // ===== RPC 2: Create Shipment =====
  // Pick & pack items, create shipment record
  async createShipment(
    orderId: string,
    warehouseId: string,
    shippingAddress: string,
    carrierName?: string,
    trackingNumber?: string,
    preparedBy?: string,
  ): Promise<{ shipment_id: string; total_qty_packed: number; created_at: string }> {
    const { data, error } = await supabase.rpc("create_shipment", {
      p_order_id: orderId,
      p_warehouse_id: warehouseId,
      p_shipping_address: shippingAddress,
      p_carrier_name: carrierName || null,
      p_tracking_number: trackingNumber || null,
      p_prepared_by: preparedBy || null,
    });

    if (error) {
      console.error("RPC error:", error);
      throw new DispatchError(`Failed to create shipment: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new DispatchError("Create shipment RPC returned no results");
    }

    const result = data[0];
    return {
      shipment_id: result.shipment_id,
      total_qty_packed: result.total_qty_packed,
      created_at: result.created_at,
    };
  },

  // ===== RPC 3: Confirm Shipment Dispatch =====
  // Mark shipment as in-transit
  async confirmShipmentDispatch(
    shipmentId: string,
    carrierName?: string,
    trackingNumber?: string,
    dispatchedBy?: string,
  ): Promise<{ status: string; dispatched_at: string }> {
    const { data, error } = await supabase.rpc("confirm_shipment_dispatch", {
      p_shipment_id: shipmentId,
      p_carrier_name: carrierName || null,
      p_tracking_number: trackingNumber || null,
      p_dispatched_by: dispatchedBy || null,
    });

    if (error) {
      console.error("RPC error:", error);
      throw new DispatchError(`Failed to confirm shipment dispatch: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new DispatchError("Confirm shipment dispatch RPC returned no results");
    }

    const result = data[0];
    return {
      status: result.status,
      dispatched_at: result.dispatched_at,
    };
  },

  // ===== RPC 4: Confirm Shipment Delivery =====
  // Mark shipment as delivered, decrement final inventory
  async confirmShipmentDelivery(
    shipmentId: string,
    deliveredBy?: string,
  ): Promise<{ status: string; delivered_at: string }> {
    const { data, error } = await supabase.rpc("confirm_shipment_delivery", {
      p_shipment_id: shipmentId,
      p_delivered_by: deliveredBy || null,
    });

    if (error) {
      console.error("RPC error:", error);
      throw new DispatchError(`Failed to confirm shipment delivery: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new DispatchError("Confirm shipment delivery RPC returned no results");
    }

    const result = data[0];
    return {
      status: result.status,
      delivered_at: result.delivered_at,
    };
  },

  // ===== List Shipments =====
  async listShipments(filters?: { order_id?: string; status?: string }): Promise<Shipment[]> {
    let query = supabase.from("shipments").select("*").order("created_at", { ascending: false });

    if (filters?.order_id) {
      query = query.eq("order_id", filters.order_id);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Database error:", error);
      throw new DispatchError(`Failed to fetch shipments: ${error.message}`);
    }

    return (data || []) as Shipment[];
  },

  // ===== Get Shipment Details =====
  async getShipmentById(shipmentId: string): Promise<Shipment> {
    const { data, error } = await supabase
      .from("shipments")
      .select("*")
      .eq("id", shipmentId)
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new DispatchError(`Shipment not found: ${shipmentId}`);
    }

    return data as Shipment;
  },
};

// ============================================================================
// INVOICING SERVICE (STEP 3L: Delegates to canonical invoicing.ts)
// ============================================================================

// STEP 3L.1: Direct exports from canonical invoicing service
export const invoicingService_canonical = {
  createInvoiceFromOrder: invoicingService.createInvoiceFromOrder,
  getInvoiceSummary: invoicingService.getInvoiceSummary,
  getOutstandingInvoices: invoicingService.getOutstandingInvoices,
  getTotalOutstanding: invoicingService.getTotalOutstanding,
};

// ============================================================================
// PAYMENT SERVICE (STEP 3L: Delegates to canonical invoicing.ts)
// ============================================================================

// STEP 3L.1: Direct exports from canonical invoicing service
export const paymentService_canonical = {
  recordPayment: invoicingService.recordPayment,
  getPaymentAgingReport: invoicingService.getPaymentAgingReport,
};
