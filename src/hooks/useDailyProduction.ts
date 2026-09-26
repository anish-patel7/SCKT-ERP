import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dailyProductionService } from "@/services/dailyProduction";

// Daily production logs
export function useDailyProductionLogs(filters?: {
  job_card_id?: string;
  loom_id?: string;
  entry_date?: string;
  from_date?: string;
  to_date?: string;
}) {
  return useQuery({
    queryKey: ["daily_production_logs", filters],
    queryFn: () => dailyProductionService.getDailyProductionLogs(filters),
    staleTime: 5 * 60 * 1000,
  });
}

// Record daily production
export function useRecordDailyProduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => dailyProductionService.recordDailyProduction(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["daily_production_logs"] });
      queryClient.invalidateQueries({
        queryKey: ["job_card", data.job_card_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["order_progress"],
      });
      queryClient.invalidateQueries({
        queryKey: ["shift_summary"],
      });
    },
  });
}

// Variance analysis
export function useVarianceAnalysis(job_card_id: string) {
  return useQuery({
    queryKey: ["variance_analysis", job_card_id],
    queryFn: () => dailyProductionService.getVarianceAnalysis(job_card_id),
    staleTime: 2 * 60 * 1000,
    enabled: !!job_card_id,
  });
}

// Shift summary
export function useShiftSummary(entry_date: string) {
  return useQuery({
    queryKey: ["shift_summary", entry_date],
    queryFn: () => dailyProductionService.getShiftSummary(entry_date),
    staleTime: 5 * 60 * 1000,
    enabled: !!entry_date,
  });
}

// Yarn consumption stats
export function useYarnConsumptionStats(from_date: string, to_date: string) {
  return useQuery({
    queryKey: ["yarn_consumption_stats", from_date, to_date],
    queryFn: () => dailyProductionService.getYarnConsumptionStats(from_date, to_date),
    staleTime: 10 * 60 * 1000,
    enabled: !!from_date && !!to_date,
  });
}

// Record correction
export function useRecordProductionCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ original_id, corrected_data }: { original_id: string; corrected_data: unknown }) =>
      dailyProductionService.recordProductionCorrection(original_id, corrected_data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["daily_production_logs"] });
      queryClient.invalidateQueries({
        queryKey: ["job_card", data.job_card_id],
      });
    },
  });
}
