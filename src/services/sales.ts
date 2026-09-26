import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { inventoryAllocationService } from './inventoryAllocation';

// ============================================================================
// TYPES & VALIDATION
// ============================================================================

const RecordPaymentResultSchema = z.object({
  success: z.boolean(),
  payment_id: z.string().uuid().nullable(),
  payment_number: z.string().nullable(),
  message: z.string().nullable(),
});

const AllocatePaymentResultSchema = z.object({
  success: z.boolean(),
  message: z.string().nullable(),
});

/** RETURNS TABLE functions come back as an array of rows. */
function firstRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

export const QuotationItemSchema = z.object({
  line_number: z.number().int().positive(),
  fabric_quality_name: z.string().min(1).max(200),
  design_no: z.string().max(50).optional(),
  qty_metre: z.number().positive('Quantity must be positive'),
  rate_per_metre: z.number().positive('Rate must be positive'),
  line_total: z.number().nonnegative(),
  remarks: z.string().optional(),
});

export const SalesQuotationSchema = z.object({
  quotation_no: z.string().min(1).max(50),
  customer_id: z.string().uuid(),
  quoted_date: z.string().date(),
  valid_till: z.string().date(),
  subtotal_amount: z.number().positive(),
  discount_percent: z.number().nonnegative().max(100).default(0),
  discount_amount: z.number().nonnegative().default(0),
  tax_amount: z.number().nonnegative().default(0),
  total_amount: z.number().positive(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CLOSED']).default('DRAFT'),
  remarks: z.string().optional(),
  quoted_by: z.string().optional(),
});

export const OrderItemSchema = z.object({
  line_number: z.number().int().positive(),
  fabric_quality_name: z.string().min(1).max(200),
  // PHASE 4: Design Reference
  design_id: z.string().uuid().optional(),
  design_no: z.string().max(50).optional(),
  design_no_snapshot: z.string().max(50).optional(),
  design_name_snapshot: z.string().max(200).optional(),
  // Quantities
  qty_metre: z.number().positive(),
  qty_allocated: z.number().nonnegative().default(0),
  qty_reserved: z.number().nonnegative().default(0),
  qty_shipped: z.number().nonnegative().default(0),
  qty_dispatched: z.number().nonnegative().default(0),
  // PHASE 4: Pricing & Costing
  cost_sheet_id: z.string().uuid().optional(),
  cost_sheet_no_snapshot: z.string().max(50).optional(),
  rate_per_metre: z.number().positive(),
  approved_sale_rate: z.number().positive().optional(),
  approved_by: z.string().max(150).optional(),
  approved_at: z.string().datetime().optional(),
  line_total: z.number().nonnegative(),
  // PHASE 4: Inventory & Reservation
  inventory_item_id: z.string().uuid().optional(),
  stock_reservation_id: z.string().uuid().optional(),
  // Notes & Audit
  remarks: z.string().optional(),
  updated_at: z.string().datetime().optional(),
  updated_by: z.string().max(150).optional(),
});

export const SalesOrderSchema = z.object({
  order_no: z.string().min(1).max(50),
  quotation_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid(),
  order_date: z.string().date(),
  delivery_date: z.string().date(),
  subtotal_amount: z.number().nonnegative(),
  discount_percent: z.number().nonnegative().max(100).default(0),
  discount_amount: z.number().nonnegative().default(0),
  tax_amount: z.number().nonnegative().default(0),
  total_amount: z.number().nonnegative(),
  status: z.enum([
    'DRAFT',
    'CONFIRMED',
    'ALLOCATED',
    'FULFILLED',
    'SHIPPED',
    'DELIVERED',
    'INVOICED',
    'PAID',
    'CANCELLED',
  ]).default('DRAFT'),
  shipping_address: z.string(),
  billing_address: z.string(),
  delivery_instructions: z.string().optional(),
  remarks: z.string().optional(),
  // PHASE 3: Warehouse & Commercial Snapshots
  warehouse_id: z.string().uuid().optional(),
  customer_name_snapshot: z.string().max(200).optional(),
  broker_name_snapshot: z.string().max(200).optional(),
  // PHASE 3: Credit Override Audit (BR-2)
  credit_override_approved: z.boolean().default(false),
  credit_override_reason: z.string().optional(),
  credit_override_approved_by: z.string().max(150).optional(),
  credit_override_approved_at: z.string().datetime().optional(),
});

export type QuotationItem = z.infer<typeof QuotationItemSchema>;
export type Quotation = z.infer<typeof SalesQuotationSchema> & { id: string };
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type Order = z.infer<typeof SalesOrderSchema> & { id: string };

// ============================================================================
// SERVICE
// ============================================================================

export const salesService = {
  // ==================== QUOTATIONS ====================

  async listQuotations(filters?: { customer_id?: string; status?: string }): Promise<Quotation[]> {
    let query = supabase.from('sales_quotations').select('*').order('created_at', { ascending: false });

    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch quotations: ${error.message}`);
    }

    return data || [];
  },

  async getQuotationById(id: string): Promise<Quotation & { items: QuotationItem[] }> {
    const { data, error } = await supabase
      .from('sales_quotations')
      .select(
        `
      *,
      sales_quotation_items (*)
    `,
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Quotation not found: ${id}`);
    }

    return {
      ...data,
      items: data.sales_quotation_items || [],
    };
  },

  async createQuotation(
    quotation: unknown,
    items: unknown,
  ): Promise<Quotation & { items: QuotationItem[] }> {
    const validatedQuote = SalesQuotationSchema.parse(quotation);
    const validatedItems = z.array(QuotationItemSchema).parse(items);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Insert quotation
    const { data: quoteData, error: quoteError } = await supabase
      .from('sales_quotations')
      .insert([
        {
          ...validatedQuote,
          quoted_by: user?.email || 'system',
          created_by: user?.email || 'system',
          updated_by: user?.email || 'system',
        },
      ])
      .select()
      .single();

    if (quoteError) {
      if (quoteError.code === '23505') {
        throw new Error('Quotation number already exists');
      }
      console.error('Database error:', quoteError);
      throw new Error(`Failed to create quotation: ${quoteError.message}`);
    }

    // Insert items
    const itemsWithQuotationId = validatedItems.map((item) => ({
      ...item,
      quotation_id: quoteData.id,
    }));

    const { data: itemsData, error: itemsError } = await supabase
      .from('sales_quotation_items')
      .insert(itemsWithQuotationId)
      .select();

    if (itemsError) {
      // Rollback quotation
      await supabase.from('sales_quotations').delete().eq('id', quoteData.id);
      console.error('Database error:', itemsError);
      throw new Error(`Failed to create quotation items: ${itemsError.message}`);
    }

    return {
      ...quoteData,
      items: itemsData || [],
    };
  },

  async updateQuotationStatus(id: string, status: string): Promise<Quotation> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('sales_quotations')
      .update({
        status,
        updated_by: user?.email || 'system',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to update quotation status: ${error.message}`);
    }

    return data as Quotation;
  },

  // ==================== ORDERS ====================

  async listOrders(filters?: { customer_id?: string; status?: string; order_date?: string }): Promise<Order[]> {
    let query = supabase.from('sales_orders').select('*').order('order_date', { ascending: false });

    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    return data || [];
  },

  async getOrderById(id: string): Promise<Order & { items: OrderItem[] }> {
    const { data, error } = await supabase
      .from('sales_orders')
      .select(
        `
      *,
      sales_order_items (*)
    `,
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Order not found: ${id}`);
    }

    return {
      ...data,
      items: data.sales_order_items || [],
    };
  },

  async createOrder(
    order: unknown,
    items: unknown,
  ): Promise<Order & { items: OrderItem[] }> {
    const validatedOrder = SalesOrderSchema.parse(order);
    const validatedItems = z.array(OrderItemSchema).parse(items);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Insert order
    const { data: orderData, error: orderError } = await supabase
      .from('sales_orders')
      .insert([
        {
          ...validatedOrder,
          created_by: user?.email || 'system',
          updated_by: user?.email || 'system',
        },
      ])
      .select()
      .single();

    if (orderError) {
      if (orderError.code === '23505') {
        throw new Error('Order number already exists');
      }
      console.error('Database error:', orderError);
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    // Insert order items
    const itemsWithOrderId = validatedItems.map((item) => ({
      ...item,
      order_id: orderData.id,
    }));

    const { data: itemsData, error: itemsError } = await supabase
      .from('sales_order_items')
      .insert(itemsWithOrderId)
      .select();

    if (itemsError) {
      // Rollback order
      await supabase.from('sales_orders').delete().eq('id', orderData.id);
      console.error('Database error:', itemsError);
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    return {
      ...orderData,
      items: itemsData || [],
    };
  },

  async updateOrderStatus(id: string, status: string, metadata?: any): Promise<Order> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const updates: any = {
      status,
      updated_by: user?.email || 'system',
      updated_at: new Date().toISOString(),
    };

    if (status === 'CONFIRMED') {
      updates.confirmed_at = new Date().toISOString();
    } else if (status === 'SHIPPED') {
      updates.shipped_at = new Date().toISOString();
    } else if (status === 'DELIVERED') {
      updates.delivered_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('sales_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to update order status: ${error.message}`);
    }

    return data as Order;
  },

  async allocateOrderItems(orderId: string, allocations: { itemId: string; qty: number }[]): Promise<void> {
    const updates = allocations.map((alloc) => ({
      id: alloc.itemId,
      qty_allocated: alloc.qty,
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('sales_order_items')
        .update({ qty_allocated: update.qty_allocated })
        .eq('id', update.id);

      if (error) {
        console.error('Database error:', error);
        throw new Error(`Failed to allocate items: ${error.message}`);
      }
    }

    // Update order status to ALLOCATED
    await this.updateOrderStatus(orderId, 'ALLOCATED');
  },

  async getOrderProgress(orderId: string): Promise<{
    total_qty: number;
    qty_allocated: number;
    qty_shipped: number;
    allocation_percent: number;
    shipment_percent: number;
  }> {
    const order = await this.getOrderById(orderId);

    const totalQty = order.items.reduce((sum, item) => sum + item.qty_metre, 0);
    const allocatedQty = order.items.reduce((sum, item) => sum + item.qty_allocated, 0);
    const shippedQty = order.items.reduce((sum, item) => sum + item.qty_shipped, 0);

    return {
      total_qty: totalQty,
      qty_allocated: allocatedQty,
      qty_shipped: shippedQty,
      allocation_percent: totalQty > 0 ? (allocatedQty / totalQty) * 100 : 0,
      shipment_percent: totalQty > 0 ? (shippedQty / totalQty) * 100 : 0,
    };
  },

  async confirmOrder(orderId: string, approvedBy?: string): Promise<Order> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc('confirm_sales_order', {
      p_order_id: orderId,
      p_approved_by: approvedBy || user?.email || 'system',
    });

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to confirm order: ${error.message}`);
    }

    // Fetch full order object after confirmation
    return this.getOrderById(orderId);
  },

  async shipOrder(orderId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, 'SHIPPED');
  },

  async deliverOrder(orderId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, 'DELIVERED');
  },

  async cancelOrder(orderId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, 'CANCELLED');
  },

  // ==================== INVENTORY ALLOCATION ====================

  async checkInventoryAvailability(
    orderId: string,
  ): Promise<{ available: boolean; message: string; issues: string[] }> {
    const order = await this.getOrderById(orderId);
    const issues: string[] = [];

    for (const item of order.items) {
      if (!item.design_id) {
        issues.push(`Line item missing design reference`);
        continue;
      }

      const hasInventory = await inventoryAllocationService.hasEnoughSaleableInventory(
        item.design_no || '',
        item.qty_metre,
        order.warehouse_id,
      );

      if (!hasInventory) {
        issues.push(
          `Insufficient Grade A inventory for design ${item.design_no}: need ${item.qty_metre}, not available`,
        );
      }
    }

    return {
      available: issues.length === 0,
      message: issues.length === 0 ? 'All items have sufficient inventory' : 'Inventory shortfall',
      issues,
    };
  },

  async allocateOrderInventory(orderId: string, warehouseId?: string): Promise<void> {
    const order = await this.getOrderById(orderId);

    if (order.status !== 'CONFIRMED') {
      throw new Error('Cannot allocate inventory for non-confirmed order');
    }

    const allocations = order.items
      .filter((item) => item.design_no && item.qty_metre > 0)
      .map((item) => ({
        orderItemId: item.id || '',
        designNo: item.design_no || '',
        qtyRequired: item.qty_metre,
        warehouseId: warehouseId || order.warehouse_id,
      }));

    if (allocations.length === 0) {
      throw new Error('No items to allocate');
    }

    const results = await inventoryAllocationService.bulkAllocateForOrder(allocations);

    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      throw new Error(`Allocation failed: ${failures.map((f) => f.message).join('; ')}`);
    }

    // Update order status to ALLOCATED after successful inventory allocation
    await this.updateOrderStatus(orderId, 'ALLOCATED');
  },

  // ===== ATOMIC RPC: Confirm Sales Order with Inventory Reservation =====
  // Captures commercial snapshots and atomically reserves inventory
  async confirmSalesOrderWithReservation(
    orderId: string,
    approvedBy?: string,
  ): Promise<{ confirmed_at: string; line_count: number; reserved_qty: number }> {
    const { data, error } = await supabase.rpc('confirm_sales_order_with_reservation', {
      p_order_id: orderId,
      p_approved_by: approvedBy || null,
    });

    if (error) {
      console.error('RPC error:', error);
      throw new Error(`Failed to confirm sales order: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Confirm sales order RPC returned no results');
    }

    const result = data[0];
    return {
      confirmed_at: result.confirmed_at,
      line_count: result.line_count,
      reserved_qty: result.reserved_qty,
    };
  },

  // ==================== OUTSTANDING / PAYMENTS ====================

  async listOutstandingInvoices(filters?: { customer_id?: string; status?: string }): Promise<
    Array<{
      id: string;
      invoice_no: string;
      order_id: string;
      order_no?: string;
      customer_id: string;
      customer_name: string;
      invoice_date: string;
      due_date: string;
      total_amount: number;
      amount_paid: number;
      amount_outstanding: number;
      status: string;
    }>
  > {
    let query = supabase.from('sales_invoices').select(
      `
      id,
      invoice_no,
      order_id,
      customer_id,
      invoice_date,
      due_date,
      total_amount,
      amount_paid,
      amount_outstanding,
      status,
      customers (
        id,
        parties ( party_name )
      ),
      sales_orders (
        order_no
      )
    `,
    );

    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('invoice_date', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch outstanding invoices: ${error.message}`);
    }

    return (data || []).map((inv: any) => ({
      id: inv.id,
      invoice_no: inv.invoice_no,
      order_id: inv.order_id,
      order_no: inv.sales_orders?.order_no || '—',
      customer_id: inv.customer_id,
      customer_name: inv.customers?.parties?.party_name || '—',
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      total_amount: inv.total_amount || 0,
      amount_paid: inv.amount_paid || 0,
      amount_outstanding: inv.amount_outstanding || 0,
      status: inv.status || 'UNPAID',
    }));
  },

  /**
   * Record a payment receipt against an invoice through the atomic RPCs:
   * record_payment_atomic creates the customer payment (server-side PAY- number),
   * allocate_payment_atomic applies it to the invoice under row locks (same customer, no
   * over-allocation) and updates amount_paid / amount_outstanding / status.
   */
  async recordPaymentReceipt(input: {
    invoice_id: string;
    customer_id: string;
    payment_date: string;
    amount_paid: number;
    payment_method: string;
    reference_number: string;
    remarks?: string;
  }): Promise<{
    receipt_id: string;
    receipt_no: string;
    payment_date: string;
    amount_paid: number;
  }> {
    if (!(input.amount_paid > 0)) {
      throw new Error('Payment amount must be greater than 0');
    }
    const amount = Math.round(input.amount_paid * 100) / 100;

    // Check before recording so an unusable payment is not created; the RPC re-checks under lock.
    const { data: invoice, error: invoiceError } = await supabase
      .from('sales_invoices')
      .select('id, invoice_no, customer_id, amount_outstanding')
      .eq('id', input.invoice_id)
      .maybeSingle();
    if (invoiceError) throw new Error(`Failed to load invoice: ${invoiceError.message}`);
    if (!invoice) throw new Error('Invoice not found');
    const outstanding = Number(invoice.amount_outstanding ?? 0);
    if (amount > outstanding) {
      throw new Error(
        `Amount ₹${amount.toFixed(2)} exceeds the outstanding ₹${outstanding.toFixed(2)} on ${invoice.invoice_no}`,
      );
    }

    const recorded = await supabase.rpc('record_payment_atomic', {
      // The invoice's customer is authoritative (allocation requires the same customer).
      p_customer_id: invoice.customer_id,
      p_amount: amount,
      p_payment_method: input.payment_method,
      p_reference_number: input.reference_number,
      p_payment_date: input.payment_date,
      p_remarks: input.remarks ?? null,
    });
    if (recorded.error) throw new Error(`Failed to record payment: ${recorded.error.message}`);
    const payment = RecordPaymentResultSchema.parse(firstRow(recorded.data));
    if (!payment.success || !payment.payment_id) {
      throw new Error(`Failed to record payment: ${payment.message}`);
    }

    const allocated = await supabase.rpc('allocate_payment_atomic', {
      p_payment_id: payment.payment_id,
      p_invoice_id: input.invoice_id,
      p_allocated_amount: amount,
    });
    const allocation = allocated.error
      ? { success: false, message: allocated.error.message }
      : AllocatePaymentResultSchema.parse(firstRow(allocated.data));
    if (!allocation.success) {
      throw new Error(
        `Payment ${payment.payment_number ?? ''} was recorded but not applied to the invoice: ${allocation.message}. It remains unallocated.`,
      );
    }

    return {
      receipt_id: payment.payment_id,
      receipt_no: payment.payment_number ?? payment.payment_id,
      payment_date: input.payment_date,
      amount_paid: amount,
    };
  },

  async listPaymentReceipts(filters?: { customer_id?: string }): Promise<
    Array<{
      id: string;
      receipt_no?: string;
      payment_date: string;
      amount_paid: number;
      payment_method: string;
      reference_number: string;
      customer_name: string;
      invoice_no: string;
      broker_commission_inr?: number;
      remarks?: string;
    }>
  > {
    let query = supabase.from('sales_payments').select(
      `
      id,
      payment_date,
      amount_paid,
      payment_method,
      reference_number,
      remarks,
      payment_number,
      customer_id,
      customers ( parties ( party_name ) ),
      sales_invoices ( invoice_no )
    `,
    );

    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }

    const { data, error } = await query.order('payment_date', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch payment receipts: ${error.message}`);
    }

    return (data || []).map((payment: any, index: number) => ({
      id: payment.id,
      receipt_no: payment.payment_number || `RCP-${String(payment.id).slice(0, 8).toUpperCase()}`,
      payment_date: payment.payment_date,
      amount_paid: payment.amount_paid || 0,
      payment_method: payment.payment_method || '',
      reference_number: payment.reference_number || '',
      customer_name: payment.customers?.parties?.party_name || '—',
      invoice_no: payment.sales_invoices?.invoice_no || '—',
      broker_commission_inr: 0,
      remarks: payment.remarks || undefined,
    }));
  },
};
