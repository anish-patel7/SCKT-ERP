import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fulfillmentService,
  type FulfillmentCreated,
  type FulfillmentItemUpdate,
  type FulfillmentShipped,
  type FulfillmentDelivered,
} from '@/services/fulfillment';

// ============================================================================
// HOOKS: Fulfillment Mutations
// ============================================================================

export function useCreateFulfillment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, warehouseId }: { orderId: string; warehouseId?: string }) =>
      fulfillmentService.createFulfillmentFromOrder(orderId, warehouseId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.order_id] });
      queryClient.invalidateQueries({ queryKey: ['fulfillments'] });
    },
  });
}

export function useUpdateFulfillmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fulfillmentItemId,
      qtyPicked,
      qtyPacked,
      qtyShipped,
      binLocation,
    }: {
      fulfillmentItemId: string;
      qtyPicked?: number;
      qtyPacked?: number;
      qtyShipped?: number;
      binLocation?: string;
    }) => {
      const updates = {
        ...(qtyPicked !== undefined && { qtyPicked }),
        ...(qtyPacked !== undefined && { qtyPacked }),
        ...(qtyShipped !== undefined && { qtyShipped }),
        ...(binLocation !== undefined && { binLocation }),
      };
      return fulfillmentService.updateFulfillmentItem(fulfillmentItemId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillments'] });
      queryClient.invalidateQueries({ queryKey: ['fulfillment_items'] });
    },
  });
}

export function useShipFulfillment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fulfillmentId,
      trackingNumber,
      carrier,
    }: {
      fulfillmentId: string;
      trackingNumber?: string;
      carrier?: string;
    }) => fulfillmentService.shipFulfillment(fulfillmentId, trackingNumber, carrier),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fulfillments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      // Invalidate inventory queries since shipped items affect available stock
      queryClient.invalidateQueries({ queryKey: ['saleable_inventory'] });
    },
  });
}

export function useDeliverFulfillment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fulfillmentId,
      deliveryRemarks,
    }: {
      fulfillmentId: string;
      deliveryRemarks?: string;
    }) => fulfillmentService.deliverFulfillment(fulfillmentId, deliveryRemarks),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fulfillments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// Alias for backward compatibility
export function useFulfillment() {
  return useCreateFulfillment();
}
