import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSales, saveSales, type SalesData } from '@/lib/sales-store';
import { salesService, type Quotation, type Order, type QuotationItem, type OrderItem } from '@/services/sales';

// ==================== BACKWARD COMPATIBILITY ====================
// Old useSales hook for existing routes (localStorage-based)
const EMPTY: SalesData = {
  customers: [],
  quotations: [],
  orders: [],
  dispatches: [],
  invoices: [],
  receipts: [],
};

export function useSales() {
  const [data, setData] = useState<SalesData>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(getSales());
    setReady(true);
  }, []);

  const update = useCallback((fn: (prev: SalesData) => SalesData) => {
    setData((prev) => {
      const next = fn(prev);
      saveSales(next);
      return next;
    });
  }, []);

  return { data, ready, update };
}

// ==================== NEW TANSTACK QUERY HOOKS ====================

// ==================== CUSTOMERS ====================

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => salesService.listCustomers(),
    staleTime: 10 * 60 * 1000,
  });
}

// ==================== QUOTATIONS ====================

export function useQuotations(filters?: { customer_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['quotations', filters],
    queryFn: () => salesService.listQuotations(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useQuotation(id: string) {
  return useQuery({
    queryKey: ['quotation', id],
    queryFn: () => salesService.getQuotationById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quotation,
      items,
    }: {
      quotation: unknown;
      items: unknown;
    }) => salesService.createQuotation(quotation, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
}

export function useUpdateQuotationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      salesService.updateQuotationStatus(id, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.setQueryData(['quotation', data.id], data);
    },
  });
}

// ==================== ORDERS ====================

export function useOrders(filters?: { customer_id?: string; status?: string; order_date?: string }) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => salesService.listOrders(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => salesService.getOrderById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      order,
      items,
    }: {
      order: unknown;
      items: unknown;
    }) => salesService.createOrder(order, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, metadata }: { id: string; status: string; metadata?: any }) =>
      salesService.updateOrderStatus(id, status, metadata),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.setQueryData(['order', data.id], data);
    },
  });
}

export function useAllocateOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      allocations,
    }: {
      orderId: string;
      allocations: { itemId: string; qty: number }[];
    }) => salesService.allocateOrderItems(orderId, allocations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useOrderProgress(orderId: string) {
  return useQuery({
    queryKey: ['order_progress', orderId],
    queryFn: () => salesService.getOrderProgress(orderId),
    staleTime: 2 * 60 * 1000,
    enabled: !!orderId,
  });
}

export function useConfirmOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => salesService.confirmOrder(orderId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.setQueryData(['order', data.id], data);
    },
  });
}

export function useShipOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => salesService.shipOrder(orderId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.setQueryData(['order', data.id], data);
    },
  });
}

export function useDeliverOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => salesService.deliverOrder(orderId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.setQueryData(['order', data.id], data);
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => salesService.cancelOrder(orderId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.setQueryData(['order', data.id], data);
    },
  });
}

// ==================== INVENTORY ALLOCATION ====================

export function useCheckInventoryAvailability(orderId: string) {
  return useQuery({
    queryKey: ['inventory_availability', orderId],
    queryFn: () => salesService.checkInventoryAvailability(orderId),
    staleTime: 1 * 60 * 1000, // 1 min
    enabled: !!orderId,
  });
}

export function useAllocateOrderInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, warehouseId }: { orderId: string; warehouseId?: string }) =>
      salesService.allocateOrderInventory(orderId, warehouseId),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order_progress', orderId] });
      queryClient.invalidateQueries({ queryKey: ['saleable_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_quality_summary'] });
    },
  });
}

// ==================== OUTSTANDING / PAYMENTS ====================

export function useSalesOutstandingInvoices(filters?: { customer_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['outstanding_invoices', filters],
    queryFn: () => salesService.listOutstandingInvoices(filters),
    staleTime: 2 * 60 * 1000,
  });
}

export function useRecordPaymentReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      invoice_id: string;
      customer_id: string;
      payment_date: string;
      amount_paid: number;
      payment_method: string;
      reference_number: string;
      remarks?: string;
    }) => salesService.recordPaymentReceipt(input),
    // Settled, not success: the payment can be recorded even if applying it to the invoice fails.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['outstanding_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payment_receipts'] });
    },
  });
}

export function usePaymentReceipts(filters?: { customer_id?: string }) {
  return useQuery({
    queryKey: ['payment_receipts', filters],
    queryFn: () => salesService.listPaymentReceipts(filters),
    staleTime: 2 * 60 * 1000,
  });
}
