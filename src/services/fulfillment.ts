import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES & VALIDATION
// ============================================================================

export const FulfillmentCreatedSchema = z.object({
  fulfillment_id: z.string().uuid(),
  pick_list_no: z.string(),
  order_id: z.string().uuid(),
  fulfillment_status: z.string(),
  item_count: z.number().int(),
  created_at: z.string().datetime(),
});

export const FulfillmentItemUpdateSchema = z.object({
  fulfillment_item_id: z.string().uuid(),
  qty_to_ship: z.number().nonnegative(),
  qty_picked: z.number().nonnegative(),
  qty_packed: z.number().nonnegative(),
  qty_shipped: z.number().nonnegative(),
  fulfillment_status: z.string(),
});

export const FulfillmentShippedSchema = z.object({
  fulfillment_id: z.string().uuid(),
  pick_list_no: z.string(),
  status: z.string(),
  shipped_date: z.string().date().nullable(),
  tracking_number: z.string().nullable(),
  carrier: z.string().nullable(),
});

export const FulfillmentDeliveredSchema = z.object({
  fulfillment_id: z.string().uuid(),
  pick_list_no: z.string(),
  status: z.string(),
  delivered_date: z.string().date().nullable(),
  order_status: z.string(),
});

export type FulfillmentCreated = z.infer<typeof FulfillmentCreatedSchema>;
export type FulfillmentItemUpdate = z.infer<typeof FulfillmentItemUpdateSchema>;
export type FulfillmentShipped = z.infer<typeof FulfillmentShippedSchema>;
export type FulfillmentDelivered = z.infer<typeof FulfillmentDeliveredSchema>;

// ============================================================================
// SERVICE: Fulfillment & Dispatch
// ============================================================================

export const fulfillmentService = {
  // Create fulfillment pick list from allocated order
  async createFulfillmentFromOrder(
    orderId: string,
    warehouseId?: string,
  ): Promise<FulfillmentCreated> {
    const params = {
      p_order_id: orderId,
      p_warehouse_id: warehouseId,
    };

    const { data, error } = await supabase.rpc(
      'create_fulfillment_from_order' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to create fulfillment: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const validated = FulfillmentCreatedSchema.parse(result);
    return validated;
  },

  // Update fulfillment item quantities
  async updateFulfillmentItem(
    fulfillmentItemId: string,
    updates: {
      qtyPicked?: number;
      qtyPacked?: number;
      qtyShipped?: number;
      binLocation?: string;
    },
  ): Promise<FulfillmentItemUpdate> {
    const params = {
      p_fulfillment_item_id: fulfillmentItemId,
      p_qty_picked: updates.qtyPicked,
      p_qty_packed: updates.qtyPacked,
      p_qty_shipped: updates.qtyShipped,
      p_bin_location: updates.binLocation,
    };

    const { data, error } = await supabase.rpc(
      'update_fulfillment_item' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to update fulfillment item: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const validated = FulfillmentItemUpdateSchema.parse(result);
    return validated;
  },

  // Ship fulfillment
  async shipFulfillment(
    fulfillmentId: string,
    trackingNumber?: string,
    carrier?: string,
  ): Promise<FulfillmentShipped> {
    const params = {
      p_fulfillment_id: fulfillmentId,
      p_tracking_number: trackingNumber,
      p_carrier: carrier,
    };

    const { data, error } = await supabase.rpc(
      'ship_fulfillment' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to ship fulfillment: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const validated = FulfillmentShippedSchema.parse(result);
    return validated;
  },

  // Deliver fulfillment
  async deliverFulfillment(
    fulfillmentId: string,
    deliveryRemarks?: string,
  ): Promise<FulfillmentDelivered> {
    const params = {
      p_fulfillment_id: fulfillmentId,
      p_delivery_remarks: deliveryRemarks,
    };

    const { data, error } = await supabase.rpc(
      'deliver_fulfillment' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to deliver fulfillment: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const validated = FulfillmentDeliveredSchema.parse(result);
    return validated;
  },
};
