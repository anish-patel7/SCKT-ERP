import { useQuery } from '@tanstack/react-query';
import {
  analyticsService,
  SalesKPIs,
  InvoiceMetrics,
  OrderMetrics,
  FulfillmentMetrics,
  OverdueInvoice,
  CreditAgingBucket,
  OrderPipeline,
  PaymentPattern,
} from '@/services/analytics';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useSalesKPIs() {
  return useQuery<SalesKPIs>({
    queryKey: ['sales_kpis'],
    queryFn: () => analyticsService.getSalesKPIs(),
    staleTime: STALE_TIME,
  });
}

export function useInvoiceMetrics() {
  return useQuery<InvoiceMetrics>({
    queryKey: ['invoice_metrics'],
    queryFn: () => analyticsService.getInvoiceMetrics(),
    staleTime: STALE_TIME,
  });
}

export function useOrderMetrics() {
  return useQuery<OrderMetrics>({
    queryKey: ['order_metrics'],
    queryFn: () => analyticsService.getOrderMetrics(),
    staleTime: STALE_TIME,
  });
}

export function useFulfillmentMetrics() {
  return useQuery<FulfillmentMetrics>({
    queryKey: ['fulfillment_metrics'],
    queryFn: () => analyticsService.getFulfillmentMetrics(),
    staleTime: STALE_TIME,
  });
}

export function useOverdueInvoices() {
  return useQuery<OverdueInvoice[]>({
    queryKey: ['overdue_invoices'],
    queryFn: () => analyticsService.getOverdueInvoices(),
    staleTime: STALE_TIME,
  });
}

export function useCreditAgingAnalysis() {
  return useQuery<CreditAgingBucket[]>({
    queryKey: ['credit_aging_analysis'],
    queryFn: () => analyticsService.getCreditAgingAnalysis(),
    staleTime: STALE_TIME,
  });
}

export function useOrderPipeline() {
  return useQuery<OrderPipeline[]>({
    queryKey: ['order_pipeline'],
    queryFn: () => analyticsService.getOrderPipeline(),
    staleTime: STALE_TIME,
  });
}

export function usePaymentPatterns() {
  return useQuery<PaymentPattern[]>({
    queryKey: ['payment_patterns'],
    queryFn: () => analyticsService.getPaymentPatterns(),
    staleTime: STALE_TIME,
  });
}

export function useCollectionPriority() {
  return useQuery<OverdueInvoice[]>({
    queryKey: ['collection_priority'],
    queryFn: () => analyticsService.getCollectionPriority(),
    staleTime: STALE_TIME,
  });
}
