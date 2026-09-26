import { supabase } from '@/integrations/supabase/client';

// Integration with Production Module
export interface ProductionOrder {
  id: string;
  sales_order_id: string;
  status: 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string;
  actual_end?: string;
  delay_days?: number;
}

export interface ProductionCost {
  sales_order_id: string;
  material_cost: number;
  labor_cost: number;
  overhead_cost: number;
  total_actual_cost: number;
  estimated_cost: number;
  variance_pct: number;
}

// Integration with Inventory Module
export interface InventoryReservation {
  id: string;
  sales_order_id: string;
  item_id: string;
  qty_reserved: number;
  status: 'RESERVED' | 'ALLOCATED' | 'FULFILLED' | 'CANCELLED';
  reserved_at: string;
}

export interface StockAvailability {
  item_id: string;
  current_stock: number;
  available_qty: number;
  reserved_qty: number;
  can_fulfill: boolean;
}

// Integration with Quality Module
export interface QualityInspection {
  id: string;
  sales_order_id: string;
  fulfillment_id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';
  defect_count: number;
  defect_details: string;
  inspector: string;
  inspection_date: string;
}

export interface DefectAnalysis {
  sales_order_id: string;
  total_defects: number;
  defect_rate_pct: number;
  by_type: { type: string; count: number }[];
  impact_on_credit: number;
}

// Integration with Costing Module
export interface CostingAnalysis {
  sales_order_id: string;
  selling_price: number;
  material_cost: number;
  labor_cost: number;
  overhead_cost: number;
  total_cost: number;
  gross_margin: number;
  gross_margin_pct: number;
  net_margin_pct: number;
}

export interface MarginByProduct {
  product_id: string;
  product_name: string;
  units_sold: number;
  avg_selling_price: number;
  avg_cost: number;
  avg_margin_pct: number;
}

export const salesIntegrationService = {
  // Production Integration
  async getProductionOrderStatus(salesOrderId: string): Promise<ProductionOrder | null> {
    const { data } = await supabase
      .from('production_orders')
      .select('*')
      .eq('sales_order_id', salesOrderId)
      .single();
    return data;
  },

  async getProductionCosts(salesOrderId: string): Promise<ProductionCost | null> {
    const { data: prodOrder } = await supabase
      .from('production_orders')
      .select('*')
      .eq('sales_order_id', salesOrderId)
      .single();

    if (!prodOrder) return null;

    const { data: costData } = await supabase
      .from('production_costs')
      .select('*')
      .eq('production_order_id', prodOrder.id)
      .single();

    if (!costData) return null;

    const total_actual_cost =
      (costData.material_cost || 0) +
      (costData.labor_cost || 0) +
      (costData.overhead_cost || 0);

    const estimated_cost = costData.estimated_cost || total_actual_cost;
    const variance_pct =
      estimated_cost > 0
        ? Math.round(((total_actual_cost - estimated_cost) / estimated_cost) * 100)
        : 0;

    return {
      sales_order_id: salesOrderId,
      material_cost: costData.material_cost || 0,
      labor_cost: costData.labor_cost || 0,
      overhead_cost: costData.overhead_cost || 0,
      total_actual_cost,
      estimated_cost,
      variance_pct,
    };
  },

  async getFulfillmentDelay(salesOrderId: string): Promise<number> {
    const { data: salesOrder } = await supabase
      .from('sales_orders')
      .select('delivery_date')
      .eq('id', salesOrderId)
      .single();

    if (!salesOrder) return 0;

    const { data: prodOrder } = await supabase
      .from('production_orders')
      .select('actual_end')
      .eq('sales_order_id', salesOrderId)
      .single();

    if (!prodOrder || !prodOrder.actual_end) return 0;

    const deliveryDate = new Date(salesOrder.delivery_date);
    const actualEnd = new Date(prodOrder.actual_end);

    return Math.max(
      0,
      Math.floor((actualEnd.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24))
    );
  },

  // Inventory Integration
  async checkStockAvailability(items: { item_id: string; qty: number }[]): Promise<StockAvailability[]> {
    const itemIds = items.map((i) => i.item_id);

    // STEP 3K.1: Fixed to use canonical schema
    // - inventory_masters → inventory_items
    // - current_stock → total_qty
    const { data: stocks } = await supabase
      .from('inventory_items')
      .select('id, total_qty')
      .in('id', itemIds);

    const { data: reservations } = await supabase
      .from('sales_order_items')
      .select('inventory_item_id, qty_reserved')
      .in('inventory_item_id', itemIds);

    return items.map((item) => {
      const stock = stocks?.find((s) => s.id === item.item_id);
      const reserved = reservations
        ?.filter((r) => r.inventory_item_id === item.item_id)
        .reduce((sum, r) => sum + (r.qty_reserved || 0), 0) || 0;

      const current_stock = stock?.total_qty || 0;
      const available_qty = current_stock - reserved;

      return {
        item_id: item.item_id,
        current_stock,
        available_qty,
        reserved_qty: reserved,
        can_fulfill: available_qty >= item.qty,
      };
    });
  },

  async reserveInventory(
    salesOrderId: string,
    items: { item_id: string; qty: number }[]
  ): Promise<InventoryReservation[]> {
    // NOTE: STEP 3K.1 — Reservation model clarification
    // Sales order reservations are handled by canonical atomic RPC:
    //   - reserve_sales_stock_atomic() (STEP 3H) — updates sales_order_items.qty_reserved
    //   - Uses stock_reservations table for tracking (STEP 3G canonical)
    //
    // This function should NOT be called directly. The canonical path uses:
    //   1. reserve_sales_stock_atomic() RPC (STEP 3H)
    //   2. release_sales_stock_atomic() RPC (STEP 3I)
    //   3. cancel_sales_order_atomic() RPC (STEP 3I)
    //   4. create_shipment_atomic() RPC (STEP 3J)
    //
    // Obsolete table 'inventory_reservations' no longer exists.
    // Use stock_reservations (canonical) for Inventory-level reservation tracking.
    // Use sales_order_items.qty_reserved for Sales-level reservation state.
    throw new Error(
      'reserveInventory() is not implemented. Use reserve_sales_stock_atomic() RPC instead (STEP 3H).'
    );
  },

  // Quality Integration
  async getQualityInspections(salesOrderId: string): Promise<QualityInspection[]> {
    const { data } = await supabase
      .from('quality_inspections')
      .select('*')
      .eq('sales_order_id', salesOrderId);

    return data || [];
  },

  async getDefectAnalysis(salesOrderId: string): Promise<DefectAnalysis> {
    const { data: inspections } = await supabase
      .from('quality_inspections')
      .select('defect_count, defect_type')
      .eq('sales_order_id', salesOrderId);

    const totalDefects = inspections?.reduce((sum, i) => sum + (i.defect_count || 0), 0) || 0;

    const { data: salesOrder } = await supabase
      .from('sales_orders')
      .select('total_qty')
      .eq('id', salesOrderId)
      .single();

    const totalQty = salesOrder?.total_qty || 1;
    const defectRatePct = Math.round((totalDefects / totalQty) * 100);

    const defectsByType = new Map<string, number>();
    inspections?.forEach((i) => {
      const current = defectsByType.get(i.defect_type) || 0;
      defectsByType.set(i.defect_type, current + (i.defect_count || 0));
    });

    const by_type = Array.from(defectsByType.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    return {
      sales_order_id: salesOrderId,
      total_defects: totalDefects,
      defect_rate_pct: defectRatePct,
      by_type,
      impact_on_credit: Math.min(totalDefects * 500, 5000), // ₹500 per defect, max ₹5000
    };
  },

  // Costing Integration
  async getCostingAnalysis(salesOrderId: string): Promise<CostingAnalysis | null> {
    const { data: salesOrder } = await supabase
      .from('sales_orders')
      .select('total_amount')
      .eq('id', salesOrderId)
      .single();

    if (!salesOrder) return null;

    const prodCosts = await this.getProductionCosts(salesOrderId);
    if (!prodCosts) return null;

    const selling_price = salesOrder.total_amount;
    const total_cost = prodCosts.total_actual_cost;
    const gross_margin = selling_price - total_cost;
    const gross_margin_pct = selling_price > 0 ? (gross_margin / selling_price) * 100 : 0;

    const overhead_factor = 0.15; // 15% overhead allocation
    const net_margin_pct = gross_margin_pct - overhead_factor * 100;

    return {
      sales_order_id: salesOrderId,
      selling_price,
      material_cost: prodCosts.material_cost,
      labor_cost: prodCosts.labor_cost,
      overhead_cost: prodCosts.overhead_cost,
      total_cost,
      gross_margin,
      gross_margin_pct: Math.round(gross_margin_pct * 100) / 100,
      net_margin_pct: Math.round(net_margin_pct * 100) / 100,
    };
  },

  async getMarginByProduct(customerId?: string): Promise<MarginByProduct[]> {
    let query = supabase
      .from('sales_orders')
      .select('id, total_amount, customer_id');

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data: orders } = await query;

    if (!orders || orders.length === 0) return [];

    const marginMap = new Map<string, MarginByProduct>();

    for (const order of orders) {
      const costs = await this.getProductionCosts(order.id);
      if (costs) {
        const margin = order.total_amount - costs.total_actual_cost;
        const margin_pct = order.total_amount > 0 ? (margin / order.total_amount) * 100 : 0;

        const existing = marginMap.get(order.id) || {
          product_id: order.id,
          product_name: `Order ${order.id.slice(0, 8)}`,
          units_sold: 1,
          avg_selling_price: order.total_amount,
          avg_cost: costs.total_actual_cost,
          avg_margin_pct: margin_pct,
        };

        marginMap.set(order.id, {
          ...existing,
          units_sold: existing.units_sold + 1,
          avg_selling_price:
            (existing.avg_selling_price * (existing.units_sold - 1) + order.total_amount) /
            existing.units_sold,
          avg_cost:
            (existing.avg_cost * (existing.units_sold - 1) + costs.total_actual_cost) /
            existing.units_sold,
        });
      }
    }

    return Array.from(marginMap.values());
  },
};
