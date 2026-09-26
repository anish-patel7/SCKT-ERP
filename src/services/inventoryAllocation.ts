import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES & VALIDATION
// ============================================================================

export const SaleableInventorySchema = z.object({
  item_id: z.string().uuid(),
  item_code: z.string(),
  item_name: z.string(),
  design_no: z.string().optional(),
  job_card_no: z.string().optional(),
  piece_no: z.string().optional(),
  total_qty: z.number().nonnegative(),
  reserved_qty: z.number().nonnegative(),
  available_qty: z.number().nonnegative(),
  saleable_qty: z.number().nonnegative(),
  quality_grade: z.enum(['Grade A', 'Grade B', 'Grade C', 'Hold']),
  warehouse_location: z.string(),
  total_unit: z.string(),
  rate_per_unit: z.number().positive().optional(),
  last_inspection_date: z.string().datetime().optional(),
});

export const InventoryQualitySummarySchema = z.object({
  quality_grade: z.enum(['Grade A', 'Grade B', 'Grade C', 'Hold']),
  total_items: z.number().int(),
  total_qty: z.number().nonnegative(),
  total_available_qty: z.number().nonnegative(),
  total_reserved_qty: z.number().nonnegative(),
  total_value: z.number().nonnegative(),
});

export const AllocationResultSchema = z.object({
  success: z.boolean(),
  allocated_qty: z.number().nonnegative(),
  inventory_item_id: z.string().uuid().nullable(),
  message: z.string(),
});

export type SaleableInventory = z.infer<typeof SaleableInventorySchema>;
export type InventoryQualitySummary = z.infer<typeof InventoryQualitySummarySchema>;
export type AllocationResult = z.infer<typeof AllocationResultSchema>;

// ============================================================================
// SERVICE: Inventory Allocation for Sales
// ============================================================================

export const inventoryAllocationService = {
  // Get saleable inventory filtered by grade, warehouse, item type
  async getSaleableInventory(filters?: {
    warehouse_id?: string;
    item_type?: string;
    grade_filter?: string;
  }): Promise<SaleableInventory[]> {
    const params = {
      p_warehouse_id: filters?.warehouse_id,
      p_item_type: filters?.item_type || 'fabric',
      p_grade_filter: filters?.grade_filter || 'Grade A',
    };

    const { data, error } = await supabase.rpc(
      'get_saleable_inventory' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch saleable inventory: ${error.message}`);
    }

    // Validate and return
    const validated = z.array(SaleableInventorySchema).parse(data || []);
    return validated;
  },

  // Get inventory summary grouped by quality grade
  async getInventoryByQualityGrade(filters?: {
    warehouse_id?: string;
    item_type?: string;
  }): Promise<InventoryQualitySummary[]> {
    const params = {
      p_warehouse_id: filters?.warehouse_id,
      p_item_type: filters?.item_type || 'fabric',
    };

    const { data, error } = await supabase.rpc(
      'get_inventory_by_quality_grade' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch inventory summary: ${error.message}`);
    }

    // Validate and return
    const validated = z.array(InventoryQualitySummarySchema).parse(data || []);
    return validated;
  },

  // Allocate inventory for a sales order item with quality validation
  async allocateInventoryForSales(
    orderItemId: string,
    designNo: string,
    qtyRequired: number,
    warehouseId?: string,
  ): Promise<AllocationResult> {
    const params = {
      p_order_item_id: orderItemId,
      p_design_no: designNo,
      p_qty_required: qtyRequired,
      p_warehouse_id: warehouseId,
    };

    const { data, error } = await supabase.rpc(
      'allocate_inventory_for_sales' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to allocate inventory: ${error.message}`);
    }

    // Extract first row from result (RPC returns single row as SETOF)
    const result = Array.isArray(data) ? data[0] : data;
    const validated = AllocationResultSchema.parse(result);
    return validated;
  },

  // Bulk allocate inventory for multiple order items
  async bulkAllocateForOrder(
    allocations: Array<{
      orderItemId: string;
      designNo: string;
      qtyRequired: number;
      warehouseId?: string;
    }>,
  ): Promise<AllocationResult[]> {
    const results: AllocationResult[] = [];

    for (const allocation of allocations) {
      try {
        const result = await this.allocateInventoryForSales(
          allocation.orderItemId,
          allocation.designNo,
          allocation.qtyRequired,
          allocation.warehouseId,
        );
        results.push(result);

        if (!result.success) {
          throw new Error(result.message);
        }
      } catch (error) {
        results.push({
          success: false,
          allocated_qty: 0,
          inventory_item_id: null,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  },

  // Check if sufficient saleable inventory exists for a design
  async hasEnoughSaleableInventory(
    designNo: string,
    qtyRequired: number,
    warehouseId?: string,
  ): Promise<boolean> {
    const filters = {
      item_type: 'fabric' as const,
      grade_filter: 'Grade A' as const,
      ...(warehouseId && { warehouse_id: warehouseId }),
    };
    const inventory = await this.getSaleableInventory(filters);

    const matchingItem = inventory.find((item) => item.design_no === designNo);

    if (!matchingItem) {
      return false;
    }

    return matchingItem.saleable_qty >= qtyRequired;
  },

  // Get saleable inventory for a specific design
  async getSaleableByDesign(
    designNo: string,
    warehouseId?: string,
  ): Promise<SaleableInventory | null> {
    const filters = {
      item_type: 'fabric' as const,
      grade_filter: 'Grade A' as const,
      ...(warehouseId && { warehouse_id: warehouseId }),
    };
    const inventory = await this.getSaleableInventory(filters);

    return inventory.find((item) => item.design_no === designNo) || null;
  },
};
