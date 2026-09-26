import { useQuery } from '@tanstack/react-query';
import {
  salesIntegrationService,
  ProductionOrder,
  ProductionCost,
  StockAvailability,
  QualityInspection,
  DefectAnalysis,
  CostingAnalysis,
  MarginByProduct,
} from '@/services/salesIntegration';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useProductionOrderStatus(salesOrderId: string) {
  return useQuery<ProductionOrder | null>({
    queryKey: ['production_status', salesOrderId],
    queryFn: () => salesIntegrationService.getProductionOrderStatus(salesOrderId),
    staleTime: STALE_TIME,
  });
}

export function useProductionCosts(salesOrderId: string) {
  return useQuery<ProductionCost | null>({
    queryKey: ['production_costs', salesOrderId],
    queryFn: () => salesIntegrationService.getProductionCosts(salesOrderId),
    staleTime: STALE_TIME,
  });
}

export function useFulfillmentDelay(salesOrderId: string) {
  return useQuery<number>({
    queryKey: ['fulfillment_delay', salesOrderId],
    queryFn: () => salesIntegrationService.getFulfillmentDelay(salesOrderId),
    staleTime: STALE_TIME,
  });
}

export function useStockAvailability(items: { item_id: string; qty: number }[]) {
  return useQuery<StockAvailability[]>({
    queryKey: ['stock_availability', JSON.stringify(items)],
    queryFn: () => salesIntegrationService.checkStockAvailability(items),
    staleTime: STALE_TIME,
  });
}

export function useQualityInspections(salesOrderId: string) {
  return useQuery<QualityInspection[]>({
    queryKey: ['quality_inspections', salesOrderId],
    queryFn: () => salesIntegrationService.getQualityInspections(salesOrderId),
    staleTime: STALE_TIME,
  });
}

export function useDefectAnalysis(salesOrderId: string) {
  return useQuery<DefectAnalysis>({
    queryKey: ['defect_analysis', salesOrderId],
    queryFn: () => salesIntegrationService.getDefectAnalysis(salesOrderId),
    staleTime: STALE_TIME,
  });
}

export function useCostingAnalysis(salesOrderId: string) {
  return useQuery<CostingAnalysis | null>({
    queryKey: ['costing_analysis', salesOrderId],
    queryFn: () => salesIntegrationService.getCostingAnalysis(salesOrderId),
    staleTime: STALE_TIME,
  });
}

export function useMarginByProduct(customerId?: string) {
  return useQuery<MarginByProduct[]>({
    queryKey: ['margin_by_product', customerId || 'all'],
    queryFn: () => salesIntegrationService.getMarginByProduct(customerId),
    staleTime: STALE_TIME,
  });
}
