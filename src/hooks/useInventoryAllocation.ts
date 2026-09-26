import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  inventoryAllocationService,
  type SaleableInventory,
  type InventoryQualitySummary,
  type AllocationResult,
} from '@/services/inventoryAllocation';

// ============================================================================
// HOOKS: Inventory Queries
// ============================================================================

export function useSaleableInventory(filters?: {
  warehouse_id?: string;
  item_type?: string;
  grade_filter?: string;
}) {
  return useQuery({
    queryKey: ['saleable_inventory', filters],
    queryFn: () => inventoryAllocationService.getSaleableInventory(filters),
    staleTime: 2 * 60 * 1000, // 2 min - inventory changes frequently
    gcTime: 5 * 60 * 1000, // 5 min
  });
}

export function useInventoryByQualityGrade(filters?: {
  warehouse_id?: string;
  item_type?: string;
}) {
  return useQuery({
    queryKey: ['inventory_quality_summary', filters],
    queryFn: () => inventoryAllocationService.getInventoryByQualityGrade(filters),
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000, // 10 min
  });
}

export function useSaleableByDesign(designNo: string, warehouseId?: string) {
  return useQuery({
    queryKey: ['saleable_by_design', designNo, warehouseId],
    queryFn: () =>
      inventoryAllocationService.getSaleableByDesign(designNo, warehouseId),
    staleTime: 2 * 60 * 1000, // 2 min
    gcTime: 5 * 60 * 1000, // 5 min
    enabled: !!designNo, // Only run if designNo is provided
  });
}

export function useInventoryAvailabilityCheck(
  designNo: string,
  qtyRequired: number,
  warehouseId?: string,
) {
  return useQuery({
    queryKey: [
      'inventory_availability_check',
      designNo,
      qtyRequired,
      warehouseId,
    ],
    queryFn: () =>
      inventoryAllocationService.hasEnoughSaleableInventory(
        designNo,
        qtyRequired,
        warehouseId,
      ),
    staleTime: 1 * 60 * 1000, // 1 min
    gcTime: 3 * 60 * 1000, // 3 min
    enabled: !!designNo && qtyRequired > 0,
  });
}

// ============================================================================
// HOOKS: Inventory Mutations
// ============================================================================

export function useAllocateInventoryForSales() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderItemId,
      designNo,
      qtyRequired,
      warehouseId,
    }: {
      orderItemId: string;
      designNo: string;
      qtyRequired: number;
      warehouseId?: string;
    }) =>
      inventoryAllocationService.allocateInventoryForSales(
        orderItemId,
        designNo,
        qtyRequired,
        warehouseId,
      ),
    onSuccess: () => {
      // Invalidate saleable inventory queries after allocation
      queryClient.invalidateQueries({ queryKey: ['saleable_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['saleable_by_design'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_quality_summary'] });
    },
  });
}

export function useBulkAllocateForOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      allocations: Array<{
        orderItemId: string;
        designNo: string;
        qtyRequired: number;
        warehouseId?: string;
      }>,
    ) => inventoryAllocationService.bulkAllocateForOrder(allocations),
    onSuccess: () => {
      // Invalidate all inventory queries after bulk allocation
      queryClient.invalidateQueries({ queryKey: ['saleable_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['saleable_by_design'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_quality_summary'] });
      queryClient.invalidateQueries({
        queryKey: ['inventory_availability_check'],
      });
    },
  });
}
