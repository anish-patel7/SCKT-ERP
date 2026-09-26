import { useQuery } from '@tanstack/react-query';
import {
  roleBasedAnalyticsService,
  AdminDashboard,
  ManagerDashboard,
  SalesExecutiveDashboard,
  CollectionDashboard,
  FinanceDashboard,
} from '@/services/roleBasedAnalytics';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useAdminDashboard() {
  return useQuery<AdminDashboard>({
    queryKey: ['admin_dashboard'],
    queryFn: () => roleBasedAnalyticsService.getAdminDashboard(),
    staleTime: STALE_TIME,
  });
}

export function useManagerDashboard(userId: string) {
  return useQuery<ManagerDashboard>({
    queryKey: ['manager_dashboard', userId],
    queryFn: () => roleBasedAnalyticsService.getManagerDashboard(userId),
    staleTime: STALE_TIME,
  });
}

export function useSalesExecutiveDashboard(userId: string) {
  return useQuery<SalesExecutiveDashboard>({
    queryKey: ['sales_exec_dashboard', userId],
    queryFn: () => roleBasedAnalyticsService.getSalesExecutiveDashboard(userId),
    staleTime: STALE_TIME,
  });
}

export function useCollectionDashboard() {
  return useQuery<CollectionDashboard>({
    queryKey: ['collection_dashboard'],
    queryFn: () => roleBasedAnalyticsService.getCollectionDashboard(),
    staleTime: STALE_TIME,
  });
}

export function useFinanceDashboard() {
  return useQuery<FinanceDashboard>({
    queryKey: ['finance_dashboard'],
    queryFn: () => roleBasedAnalyticsService.getFinanceDashboard(),
    staleTime: STALE_TIME,
  });
}
