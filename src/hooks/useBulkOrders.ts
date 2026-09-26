import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bulkOrdersService } from '@/services/bulkOrders';

/**
 * Validate bulk order import before processing
 */
export function useBulkImportValidation() {
  return useMutation({
    mutationFn: (csvData: any[]) => bulkOrdersService.validateBulkImport(csvData),
    retry: false,
  });
}

/**
 * Create multiple orders atomically
 */
export function useBulkCreateOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orders: any[]) => bulkOrdersService.bulkCreateOrders(orders),
    onSuccess: () => {
      // Invalidate order list cache
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      // Invalidate bulk operation history
      queryClient.invalidateQueries({ queryKey: ['bulk_operations'] });
    },
    retry: false,
  });
}

/**
 * Bulk update order status
 */
export function useBulkStatusUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderIds, newStatus }: { orderIds: string[]; newStatus: any }) =>
      bulkOrdersService.bulkStatusUpdate(orderIds, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['bulk_operations'] });
    },
    retry: false,
  });
}

/**
 * Bulk price adjustment
 */
export function useBulkPriceAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderIds,
      adjustmentType,
      adjustmentValue,
    }: {
      orderIds: string[];
      adjustmentType: 'percentage' | 'absolute';
      adjustmentValue: number;
    }) => bulkOrdersService.bulkPriceAdjustment(orderIds, adjustmentType, adjustmentValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['bulk_operations'] });
    },
    retry: false,
  });
}

/**
 * Get bulk operation history
 */
export function useBulkOperationHistory(limit: number = 50) {
  return useQuery({
    queryKey: ['bulk_operations', limit],
    queryFn: () => bulkOrdersService.getBulkOperationHistory(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });
}

/**
 * Get single bulk operation details
 */
export function useBulkOperationDetail(operationId: string) {
  return useQuery({
    queryKey: ['bulk_operation', operationId],
    queryFn: () => bulkOrdersService.getBulkOperationDetail(operationId),
    enabled: !!operationId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,    // 5 minutes
  });
}
