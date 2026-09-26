import { useQuery, useQueryClient } from '@tanstack/react-query';
import { forecastingService } from '@/services/forecasting';

/**
 * Hook for demand forecasting
 */
export function useDemandForecast(productId: string) {
  return useQuery({
    queryKey: ['demand_forecast', productId],
    queryFn: () => forecastingService.forecastDemand(productId, 90),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Hook for multiple product forecasts
 */
export function useProductForecasts(productIds: string[]) {
  return useQuery({
    queryKey: ['product_forecasts', productIds.join(',')],
    queryFn: async () => {
      const forecasts = await Promise.all(
        productIds.map((id) => forecastingService.forecastDemand(id, 90)),
      );
      return forecasts;
    },
    enabled: productIds.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook for churn risk analysis
 */
export function useChurnRiskAnalysis() {
  return useQuery({
    queryKey: ['churn_risk_analysis'],
    queryFn: () => forecastingService.identifyChurnRisk(),
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook for payment default risk analysis
 */
export function usePaymentDefaultRisk() {
  return useQuery({
    queryKey: ['payment_default_risk'],
    queryFn: () => forecastingService.identifyPaymentDefaultRisk(),
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook for forecast accuracy validation
 */
export function useForecastAccuracy(productId: string) {
  return useQuery({
    queryKey: ['forecast_accuracy', productId],
    queryFn: () => forecastingService.validateForecastAccuracy(productId),
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    gcTime: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

/**
 * Hook to invalidate forecast caches
 */
export function useInvalidateForecasts() {
  const queryClient = useQueryClient();

  return {
    invalidateDemandForecast: (productId: string) => {
      queryClient.invalidateQueries({ queryKey: ['demand_forecast', productId] });
    },
    invalidateChurnRisk: () => {
      queryClient.invalidateQueries({ queryKey: ['churn_risk_analysis'] });
    },
    invalidatePaymentDefault: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_default_risk'] });
    },
    invalidateAllForecasts: () => {
      queryClient.invalidateQueries({ queryKey: ['demand_forecast'] });
      queryClient.invalidateQueries({ queryKey: ['churn_risk_analysis'] });
      queryClient.invalidateQueries({ queryKey: ['payment_default_risk'] });
    },
  };
}
