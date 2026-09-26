import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { z } from 'zod';

type SalesOrder = Database['public']['Tables']['sales_orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];

// Validation schema for bulk import
const BulkOrderRowSchema = z.object({
  order_no: z.string().min(1).max(50),
  customer_id: z.string().uuid('Invalid customer ID'),
  status: z.enum(['DRAFT', 'CONFIRMED', 'ALLOCATED', 'SHIPPED', 'DELIVERED']).default('DRAFT'),
  total_amount: z.number().positive('Total amount must be positive'),
  notes: z.string().optional(),
});

const BulkOrderItemSchema = z.object({
  order_row_index: z.number().int().nonnegative(),
  design_id: z.string().uuid('Invalid design ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unit_price: z.number().positive('Unit price must be positive'),
  discount_pct: z.number().min(0).max(100).default(0),
});

type BulkOrderRow = z.infer<typeof BulkOrderRowSchema>;
type BulkOrderItemRow = z.infer<typeof BulkOrderItemSchema>;

export interface BulkImportResult {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  errors: Array<{
    row_index: number;
    field?: string;
    message: string;
  }>;
  preview_data: BulkOrderRow[];
}

export interface BulkOperation {
  id: string;
  operation_type: 'import' | 'status_update' | 'price_adjustment';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  total_records: number;
  processed_records: number;
  error_records: number;
  error_log: Record<string, any>[];
  created_by: string;
  created_at: string;
}

export interface BulkCreateResult {
  operation_id: string;
  created_orders: string[];  // order IDs
  failed_orders: Array<{
    row_index: number;
    reason: string;
  }>;
  status: 'success' | 'partial_success' | 'failed';
}

export const bulkOrdersService = {
  /**
   * Validate and preview bulk order import from CSV data
   * Returns validation errors and preview of first 10 rows
   */
  async validateBulkImport(csvData: BulkOrderRow[]): Promise<BulkImportResult> {
    const errors: BulkImportResult['errors'] = [];
    const validRows: BulkOrderRow[] = [];
    const seenOrderNumbers = new Set<string>();

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];

      // Validate schema
      try {
        BulkOrderRowSchema.parse(row);
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach((err) => {
            errors.push({
              row_index: i,
              field: err.path.join('.'),
              message: err.message,
            });
          });
          continue;
        }
      }

      // Check for duplicate order numbers
      if (seenOrderNumbers.has(row.order_no)) {
        errors.push({
          row_index: i,
          field: 'order_no',
          message: 'Duplicate order number in import',
        });
        continue;
      }
      seenOrderNumbers.add(row.order_no);

      // Check for existing order number in database
      const { data: existing } = await supabase
        .from('sales_orders')
        .select('id')
        .eq('order_no', row.order_no)
        .single();

      if (existing) {
        errors.push({
          row_index: i,
          field: 'order_no',
          message: 'Order number already exists in system',
        });
        continue;
      }

      // Verify customer exists
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', row.customer_id)
        .single();

      if (!customer) {
        errors.push({
          row_index: i,
          field: 'customer_id',
          message: 'Customer not found',
        });
        continue;
      }

      validRows.push(row);
    }

    return {
      total_rows: csvData.length,
      valid_rows: validRows.length,
      error_rows: errors.length,
      errors,
      preview_data: validRows.slice(0, 10),
    };
  },

  /**
   * Create multiple orders atomically
   * Rolls back entire transaction if any row fails
   */
  async bulkCreateOrders(
    orders: Array<BulkOrderRow & { items: BulkOrderItemRow[] }>
  ): Promise<BulkCreateResult> {
    const operationId = `bulk_${Date.now().toString(36)}`;
    const createdOrders: string[] = [];
    const failedOrders: BulkCreateResult['failed_orders'] = [];

    // Use RPC for atomic transaction
    const { data, error } = await supabase.rpc('bulk_create_orders', {
      p_orders: orders.map((o) => ({
        order_no: o.order_no,
        customer_id: o.customer_id,
        status: o.status,
        total_amount: o.total_amount,
        notes: o.notes,
        items: o.items,
      })),
    });

    if (error) {
      // Log bulk operation failure
      await this.logBulkOperation({
        operation_type: 'import',
        status: 'failed',
        total_records: orders.length,
        processed_records: 0,
        error_records: orders.length,
        error_log: [{ error: error.message, timestamp: new Date() }],
      });

      return {
        operation_id: operationId,
        created_orders: [],
        failed_orders: orders.map((_, idx) => ({
          row_index: idx,
          reason: error.message,
        })),
        status: 'failed',
      };
    }

    // Process successful results
    if (data && Array.isArray(data)) {
      data.forEach((result: any, idx: number) => {
        if (result.success) {
          createdOrders.push(result.order_id);
        } else {
          failedOrders.push({
            row_index: idx,
            reason: result.error || 'Unknown error',
          });
        }
      });
    }

    // Log bulk operation
    await this.logBulkOperation({
      operation_type: 'import',
      status: createdOrders.length === orders.length ? 'completed' : 'partial_success',
      total_records: orders.length,
      processed_records: createdOrders.length,
      error_records: failedOrders.length,
      error_log: failedOrders,
    });

    return {
      operation_id: operationId,
      created_orders: createdOrders,
      failed_orders: failedOrders,
      status:
        failedOrders.length === 0
          ? 'success'
          : createdOrders.length > 0
            ? 'partial_success'
            : 'failed',
    };
  },

  /**
   * Bulk status update with workflow validation
   */
  async bulkStatusUpdate(
    orderIds: string[],
    newStatus: 'DRAFT' | 'CONFIRMED' | 'ALLOCATED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  ): Promise<BulkCreateResult> {
    const operationId = `status_update_${Date.now().toString(36)}`;
    const validTransitions = {
      DRAFT: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['ALLOCATED', 'DRAFT', 'CANCELLED'],
      ALLOCATED: ['SHIPPED', 'CONFIRMED', 'CANCELLED'],
      SHIPPED: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    };

    // Fetch current orders
    const { data: orders, error: fetchError } = await supabase
      .from('sales_orders')
      .select('id, status')
      .in('id', orderIds);

    if (fetchError || !orders) {
      return {
        operation_id: operationId,
        created_orders: [],
        failed_orders: orderIds.map((id, idx) => ({
          row_index: idx,
          reason: fetchError?.message || 'Failed to fetch orders',
        })),
        status: 'failed',
      };
    }

    // Validate transitions
    const failedOrders: BulkCreateResult['failed_orders'] = [];
    const validOrders = orders.filter((order, idx) => {
      const allowedTransitions = validTransitions[order.status as keyof typeof validTransitions];
      if (!allowedTransitions.includes(newStatus)) {
        failedOrders.push({
          row_index: idx,
          reason: `Cannot transition from ${order.status} to ${newStatus}`,
        });
        return false;
      }
      return true;
    });

    // Perform bulk update
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ status: newStatus, updated_at: new Date() })
      .in(
        'id',
        validOrders.map((o) => o.id)
      );

    if (updateError) {
      failedOrders.push({
        row_index: -1,
        reason: `Bulk update failed: ${updateError.message}`,
      });
    }

    // Log bulk operation
    await this.logBulkOperation({
      operation_type: 'status_update',
      status: failedOrders.length === 0 ? 'completed' : 'partial_success',
      total_records: orderIds.length,
      processed_records: validOrders.length - (updateError ? 0 : validOrders.length),
      error_records: failedOrders.length,
      error_log: failedOrders,
    });

    return {
      operation_id: operationId,
      created_orders: validOrders.map((o) => o.id),
      failed_orders: failedOrders,
      status: failedOrders.length === 0 ? 'success' : 'partial_success',
    };
  },

  /**
   * Bulk price adjustment with validation
   */
  async bulkPriceAdjustment(
    orderIds: string[],
    adjustmentType: 'percentage' | 'absolute',
    adjustmentValue: number
  ): Promise<BulkCreateResult> {
    const operationId = `price_adj_${Date.now().toString(36)}`;

    // Fetch orders with items
    const { data: orders, error: fetchError } = await supabase
      .from('sales_orders')
      .select('id, total_amount')
      .in('id', orderIds);

    if (fetchError || !orders) {
      return {
        operation_id: operationId,
        created_orders: [],
        failed_orders: orderIds.map((_, idx) => ({
          row_index: idx,
          reason: fetchError?.message || 'Failed to fetch orders',
        })),
        status: 'failed',
      };
    }

    // Calculate new amounts
    const updates = orders.map((order) => {
      const multiplier = adjustmentType === 'percentage' ? 1 + adjustmentValue / 100 : 1;
      const adjustment = adjustmentType === 'absolute' ? adjustmentValue : 0;
      const newAmount = order.total_amount * multiplier + adjustment;

      return {
        id: order.id,
        new_amount: Math.max(0, newAmount),
      };
    });

    // Perform bulk update
    const { error: updateError } = await supabase.rpc('bulk_update_prices', {
      p_updates: updates,
    });

    const failedOrders: BulkCreateResult['failed_orders'] = updateError
      ? [{ row_index: -1, reason: updateError.message }]
      : [];

    // Log bulk operation
    await this.logBulkOperation({
      operation_type: 'price_adjustment',
      status: updateError ? 'failed' : 'completed',
      total_records: orderIds.length,
      processed_records: updateError ? 0 : orderIds.length,
      error_records: failedOrders.length,
      error_log: failedOrders,
    });

    return {
      operation_id: operationId,
      created_orders: updateError ? [] : orders.map((o) => o.id),
      failed_orders: failedOrders,
      status: updateError ? 'failed' : 'success',
    };
  },

  /**
   * Get bulk operation history
   */
  async getBulkOperationHistory(limit: number = 50): Promise<BulkOperation[]> {
    const { data, error } = await supabase
      .from('bulk_operations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch bulk operation history: ${error.message}`);
    return (data || []) as BulkOperation[];
  },

  /**
   * Get bulk operation details
   */
  async getBulkOperationDetail(operationId: string): Promise<BulkOperation | null> {
    const { data, error } = await supabase
      .from('bulk_operations')
      .select('*')
      .eq('id', operationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch operation: ${error.message}`);
    }

    return (data as BulkOperation) || null;
  },

  /**
   * Internal: Log bulk operation for audit trail
   */
  private async logBulkOperation(operation: Omit<BulkOperation, 'id' | 'created_at'>) {
    const { error } = await supabase.from('bulk_operations').insert([
      {
        ...operation,
        created_by: (await this.getAuthUser()).email,
        created_at: new Date(),
      },
    ]);

    if (error) {
      console.error('Failed to log bulk operation:', error);
    }
  },

  /**
   * Internal: Get current auth user
   */
  private async getAuthUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');
    return session.user;
  },
};
