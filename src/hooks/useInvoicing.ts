import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invoicingService,
  type InvoiceCreated,
  type PaymentRecorded,
  type InvoiceSummary,
  type AgingReport,
  type PaymentAtomic,
  type AllocationAtomic,
} from '@/services/invoicing';

// ============================================================================
// HOOKS: Invoice Queries
// ============================================================================

export function useInvoiceSummary(customerId?: string) {
  return useQuery({
    queryKey: ['invoice_summary', customerId],
    queryFn: () => invoicingService.getInvoiceSummary(customerId),
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000, // 10 min
  });
}

export function usePaymentAgingReport(customerId?: string) {
  return useQuery({
    queryKey: ['payment_aging_report', customerId],
    queryFn: () => invoicingService.getPaymentAgingReport(customerId),
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000, // 10 min
  });
}

export function useOutstandingInvoices(customerId: string) {
  return useQuery({
    queryKey: ['outstanding_invoices', customerId],
    queryFn: () => invoicingService.getOutstandingInvoices(customerId),
    staleTime: 3 * 60 * 1000, // 3 min
    gcTime: 10 * 60 * 1000, // 10 min
    enabled: !!customerId,
  });
}

export function useTotalOutstanding(customerId: string) {
  return useQuery({
    queryKey: ['total_outstanding', customerId],
    queryFn: () => invoicingService.getTotalOutstanding(customerId),
    staleTime: 3 * 60 * 1000, // 3 min
    gcTime: 10 * 60 * 1000, // 10 min
    enabled: !!customerId,
  });
}

// ============================================================================
// HOOKS: Invoice Mutations
// ============================================================================

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      invoiceDate,
      dueDate,
      paymentTermsDays,
    }: {
      orderId: string;
      invoiceDate?: string;
      dueDate?: string;
      paymentTermsDays?: number;
    }) =>
      invoicingService.createInvoiceFromOrder(
        orderId,
        invoiceDate,
        dueDate,
        paymentTermsDays,
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
      queryClient.setQueryData(['invoice', data.invoice_id], data);
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      invoiceId,
      amountPaid,
      paymentMethod,
      referenceNumber,
      remarks,
    }: {
      invoiceId: string;
      amountPaid: number;
      paymentMethod: string;
      referenceNumber?: string;
      remarks?: string;
    }) =>
      invoicingService.recordPayment(
        invoiceId,
        amountPaid,
        paymentMethod,
        referenceNumber,
        remarks,
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['total_outstanding'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useCompleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      completionNotes,
    }: {
      orderId: string;
      completionNotes?: string;
    }) => invoicingService.completeOrder(orderId, completionNotes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.order_id] });
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
    },
  });
}

// STEP 3N.1: Record payment (atomic, concurrency-safe)
export function useRecordPaymentAtomic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      amount,
      method,
      reference,
      date,
      remarks,
    }: {
      customerId: string;
      amount: number;
      method: 'CASH' | 'CHECK' | 'BANK_TRANSFER' | 'CHEQUE' | 'DD' | 'RTGS' | 'NEFT';
      reference?: string;
      date?: string;
      remarks?: string;
    }) =>
      invoicingService.recordPaymentAtomic(
        customerId,
        amount,
        method,
        reference,
        date,
        remarks,
      ),
    onSuccess: (data: PaymentAtomic) => {
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['total_outstanding'] });
      queryClient.invalidateQueries({ queryKey: ['payment_aging_report'] });
      queryClient.setQueryData(['payment', data.payment_id], data);
    },
  });
}

// STEP 3N.1: Allocate payment to invoice (atomic)
export function useAllocatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      paymentId,
      invoiceId,
      amount,
    }: {
      paymentId: string;
      invoiceId: string;
      amount: number;
    }) =>
      invoicingService.allocatePaymentAtomic(
        paymentId,
        invoiceId,
        amount,
      ),
    onSuccess: (data: AllocationAtomic) => {
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['total_outstanding'] });
      queryClient.invalidateQueries({ queryKey: ['payment_aging_report'] });
      queryClient.setQueryData(['allocation', data.allocation_id], data);
    },
  });
}

// Alias for backward compatibility
export function useInvoices() {
  return useInvoiceSummary();
}
