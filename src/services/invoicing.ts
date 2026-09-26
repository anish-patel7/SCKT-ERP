import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES & VALIDATION
// ============================================================================

export const InvoiceCreatedSchema = z.object({
  invoice_id: z.string().uuid(),
  invoice_no: z.string(),
  order_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  total_amount: z.number().positive(),
  amount_outstanding: z.number().nonnegative(),
  status: z.string(),
  created_at: z.string().datetime(),
});

export const PaymentRecordedSchema = z.object({
  payment_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  amount_paid: z.number().positive(),
  total_amount_paid: z.number().nonnegative(),
  amount_outstanding: z.number().nonnegative(),
  invoice_status: z.string(),
  created_at: z.string().datetime(),
});

export const InvoiceSummarySchema = z.object({
  invoice_id: z.string().uuid(),
  invoice_no: z.string(),
  customer_id: z.string().uuid(),
  invoice_date: z.string().date(),
  due_date: z.string().date(),
  total_amount: z.number().nonnegative(),
  amount_paid: z.number().nonnegative(),
  amount_outstanding: z.number().nonnegative(),
  status: z.string(),
  days_outstanding: z.number().int(),
  payment_count: z.number().int(),
});

export const AgingReportSchema = z.object({
  aging_bucket: z.string(),
  invoice_count: z.number().int(),
  total_outstanding: z.number().nonnegative(),
  customer_count: z.number().int(),
});

export const OrderCompletedSchema = z.object({
  order_id: z.string().uuid(),
  order_no: z.string(),
  status: z.string(),
  customer_id: z.string().uuid(),
  total_amount: z.number().nonnegative(),
  completed_at: z.string().datetime(),
});

// STEP 3M: Invoice from shipment schema
export const InvoiceFromShipmentSchema = z.object({
  success: z.boolean(),
  invoice_id: z.string().uuid().nullable(),
  invoice_no: z.string().nullable(),
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  qty_invoiced: z.number().nonnegative(),
  total_amount: z.number().nonnegative(),
  amount_outstanding: z.number().nonnegative(),
  status: z.string().nullable(),
  message: z.string(),
});

// STEP 3N.1: Atomic Payment Recording Schema
export const PaymentAtomicSchema = z.object({
  payment_id: z.string().uuid(),
  payment_number: z.string(),
  customer_id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'CHECK', 'BANK_TRANSFER', 'CHEQUE', 'DD', 'RTGS', 'NEFT']),
  reference: z.string().optional(),
  status: z.enum(['RECEIVED', 'ALLOCATED', 'CANCELLED']),
  created_at: z.string().datetime(),
  created_by: z.string(),
});

// STEP 3N.1: Payment Allocation Schema
export const AllocationAtomicSchema = z.object({
  allocation_id: z.string().uuid(),
  payment_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  allocated_amount: z.number().positive(),
  created_at: z.string().datetime(),
  status: z.enum(['ACTIVE', 'REVERSED', 'CANCELLED']),
});

export type InvoiceCreated = z.infer<typeof InvoiceCreatedSchema>;
export type PaymentRecorded = z.infer<typeof PaymentRecordedSchema>;
export type InvoiceSummary = z.infer<typeof InvoiceSummarySchema>;
export type AgingReport = z.infer<typeof AgingReportSchema>;
export type OrderCompleted = z.infer<typeof OrderCompletedSchema>;
export type InvoiceFromShipment = z.infer<typeof InvoiceFromShipmentSchema>;
export type PaymentAtomic = z.infer<typeof PaymentAtomicSchema>;
export type AllocationAtomic = z.infer<typeof AllocationAtomicSchema>;

// ============================================================================
// SERVICE: Invoicing & Payments
// ============================================================================

export const invoicingService = {
  // Create invoice from delivered order
  async createInvoiceFromOrder(
    orderId: string,
    invoiceDate?: string,
    dueDate?: string,
    paymentTermsDays?: number,
  ): Promise<InvoiceCreated> {
    const params = {
      p_order_id: orderId,
      p_invoice_date: invoiceDate,
      p_due_date: dueDate,
      p_payment_terms_days: paymentTermsDays || 30,
    };

    const { data, error } = await supabase.rpc(
      'create_invoice_from_order' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const validated = InvoiceCreatedSchema.parse(result);
    return validated;
  },

  // Record payment against invoice
  async recordPayment(
    invoiceId: string,
    amountPaid: number,
    paymentMethod: string,
    referenceNumber?: string,
    remarks?: string,
  ): Promise<PaymentRecorded> {
    const params = {
      p_invoice_id: invoiceId,
      p_amount_paid: amountPaid,
      p_payment_method: paymentMethod,
      p_reference_number: referenceNumber,
      p_remarks: remarks,
    };

    const { data, error } = await supabase.rpc(
      'record_payment' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to record payment: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const validated = PaymentRecordedSchema.parse(result);
    return validated;
  },

  // Get invoice summary with aging
  async getInvoiceSummary(customerId?: string): Promise<InvoiceSummary[]> {
    const params = {
      p_customer_id: customerId,
    };

    const { data, error } = await supabase.rpc(
      'get_invoice_summary' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch invoice summary: ${error.message}`);
    }

    const validated = z.array(InvoiceSummarySchema).parse(data || []);
    return validated;
  },

  // Get payment aging report
  async getPaymentAgingReport(customerId?: string): Promise<AgingReport[]> {
    const params = {
      p_customer_id: customerId,
    };

    const { data, error } = await supabase.rpc(
      'get_payment_aging_report' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch aging report: ${error.message}`);
    }

    const validated = z.array(AgingReportSchema).parse(data || []);
    return validated;
  },

  // Complete order (mark as paid)
  async completeOrder(orderId: string, completionNotes?: string): Promise<OrderCompleted> {
    const params = {
      p_order_id: orderId,
      p_completion_notes: completionNotes,
    };

    const { data, error } = await supabase.rpc(
      'complete_order' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to complete order: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const validated = OrderCompletedSchema.parse(result);
    return validated;
  },

  // Get outstanding invoices for customer
  async getOutstandingInvoices(customerId: string): Promise<InvoiceSummary[]> {
    const summaries = await this.getInvoiceSummary(customerId);
    return summaries.filter((inv) => inv.status !== 'PAID');
  },

  // Calculate total outstanding amount for customer
  async getTotalOutstanding(customerId: string): Promise<number> {
    const summaries = await this.getInvoiceSummary(customerId);
    return summaries.reduce((total, inv) => total + inv.amount_outstanding, 0);
  },

  // STEP 3M: Create invoice from shipment (partial invoicing support)
  async createInvoiceFromShipment(
    orderId: string,
    orderItemId: string,
    invoiceQty: number,
    invoiceDate?: string,
    dueDate?: string,
    paymentTermsDays?: number,
  ): Promise<InvoiceFromShipment> {
    const params = {
      p_order_id: orderId,
      p_order_item_id: orderItemId,
      p_invoice_qty: invoiceQty,
      p_invoice_date: invoiceDate,
      p_due_date: dueDate,
      p_payment_terms_days: paymentTermsDays || 30,
    };

    const { data, error } = await supabase.rpc(
      'create_invoice_from_shipment_atomic' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to create invoice from shipment: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const validated = InvoiceFromShipmentSchema.parse(result);

    if (!validated.success) {
      throw new Error(`Invoice creation failed: ${validated.message}`);
    }

    return validated;
  },

  // STEP 3N.1: Record payment (atomic, concurrency-safe)
  async recordPaymentAtomic(
    customerId: string,
    amount: number,
    method: 'CASH' | 'CHECK' | 'BANK_TRANSFER' | 'CHEQUE' | 'DD' | 'RTGS' | 'NEFT',
    reference?: string,
    date?: string,
    remarks?: string,
  ): Promise<PaymentAtomic> {
    const params = {
      p_customer_id: customerId,
      p_amount: amount,
      p_method: method,
      p_reference: reference,
      p_date: date || new Date().toISOString().split('T')[0],
      p_remarks: remarks,
    };

    const { data, error } = await supabase.rpc(
      'record_payment_atomic' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to record payment: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const validated = PaymentAtomicSchema.parse(result);
    return validated;
  },

  // STEP 3N.1: Allocate payment to invoice (atomic)
  async allocatePaymentAtomic(
    paymentId: string,
    invoiceId: string,
    amount: number,
  ): Promise<AllocationAtomic> {
    const params = {
      p_payment_id: paymentId,
      p_invoice_id: invoiceId,
      p_amount: amount,
    };

    const { data, error } = await supabase.rpc(
      'allocate_payment_atomic' as any,
      params,
    );

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to allocate payment: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const validated = AllocationAtomicSchema.parse(result);
    return validated;
  },
};
