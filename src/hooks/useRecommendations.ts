import { useQuery, useQueryClient } from '@tanstack/react-query';
import { aiRecommendationsService } from '@/services/aiRecommendations';

/**
 * Hook for inventory recommendations
 */
export function useInventoryRecommendations() {
  return useQuery({
    queryKey: ['inventory_recommendations'],
    queryFn: () => aiRecommendationsService.getInventoryRecommendations(),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

/**
 * Hook for critical inventory alerts
 */
export function useCriticalInventory() {
  const { data: recommendations, isLoading } = useInventoryRecommendations();

  return {
    criticalItems: recommendations?.filter((r) => r.urgency === 'critical') || [],
    highPriorityItems: recommendations?.filter((r) => r.urgency === 'high') || [],
    isLoading,
  };
}

/**
 * Hook for customer recommendations
 */
export function useCustomerRecommendations(customerId: string) {
  return useQuery({
    queryKey: ['customer_recommendations', customerId],
    queryFn: () => aiRecommendationsService.getCustomerRecommendations(customerId),
    enabled: !!customerId,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Hook for pricing recommendations
 */
export function usePricingRecommendations() {
  return useQuery({
    queryKey: ['pricing_recommendations'],
    queryFn: () => aiRecommendationsService.getPricingRecommendations(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Hook for high-impact pricing recommendations (revenue impact > 5%)
 */
export function useHighImpactPricingRecommendations() {
  const { data: recommendations, isLoading } = usePricingRecommendations();

  return {
    recommendations: recommendations?.filter((r) => r.expected_revenue_impact > 5) || [],
    isLoading,
  };
}

/**
 * Hook for collection recommendations
 */
export function useCollectionRecommendations() {
  return useQuery({
    queryKey: ['collection_recommendations'],
    queryFn: () => aiRecommendationsService.getCollectionRecommendations(),
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Hook for high-priority collection items (priority score > 60)
 */
export function useHighPriorityCollections() {
  const { data: recommendations, isLoading } = useCollectionRecommendations();

  return {
    highPriority: recommendations?.filter((r) => r.collection_priority_score > 60) || [],
    isLoading,
  };
}

/**
 * Hook for total outstanding amount
 */
export function useTotalOutstandingAmount() {
  const { data: recommendations } = useCollectionRecommendations();

  const total = recommendations?.reduce((sum, r) => sum + r.outstanding_amount, 0) || 0;

  return total;
}

/**
 * Hook to invalidate recommendation caches
 */
export function useInvalidateRecommendations() {
  const queryClient = useQueryClient();

  return {
    invalidateInventory: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_recommendations'] });
    },
    invalidateCustomer: (customerId: string) => {
      queryClient.invalidateQueries({ queryKey: ['customer_recommendations', customerId] });
    },
    invalidatePricing: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing_recommendations'] });
    },
    invalidateCollection: () => {
      queryClient.invalidateQueries({ queryKey: ['collection_recommendations'] });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['customer_recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['pricing_recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['collection_recommendations'] });
    },
  };
}
