import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loomService } from "@/services/looms";

// List looms
export function useLooms(filters?: {
  status?: string;
  is_active?: boolean;
  loom_type?: string;
}) {
  return useQuery({
    queryKey: ["looms", filters],
    queryFn: () => loomService.listLooms(filters),
    staleTime: 5 * 60 * 1000,
  });
}

// Single loom
export function useLoom(id: string) {
  return useQuery({
    queryKey: ["loom", id],
    queryFn: () => loomService.getLoomById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

// Create loom
export function useCreateLoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => loomService.createLoom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["looms"] });
    },
  });
}

// Update loom status
export function useUpdateLoomStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: unknown }) =>
      loomService.updateLoomStatus(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["loom", data.id] });
      queryClient.invalidateQueries({ queryKey: ["looms"] });
    },
  });
}

// Assign job card
export function useAssignJobCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ loom_id, job_card_id }: { loom_id: string; job_card_id: string }) =>
      loomService.assignJobCard(loom_id, job_card_id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["loom", data.id] });
      queryClient.invalidateQueries({ queryKey: ["looms"] });
      queryClient.invalidateQueries({ queryKey: ["job_card", data.current_job_card_id] });
    },
  });
}

// Unassign job card
export function useUnassignJobCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (loom_id: string) => loomService.unassignJobCard(loom_id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["loom", data.id] });
      queryClient.invalidateQueries({ queryKey: ["looms"] });
    },
  });
}

// Loom utilization
export function useLoomUtilization(loom_id: string, days = 30) {
  return useQuery({
    queryKey: ["loom_utilization", loom_id, days],
    queryFn: () => loomService.getLoomUtilization(loom_id, days),
    staleTime: 10 * 60 * 1000,
    enabled: !!loom_id,
  });
}

// Schedule maintenance
export function useScheduleMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => loomService.scheduleMaintenance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_schedule"] });
    },
  });
}

// Get maintenance schedule
export function useMaintenanceSchedule(
  loom_id?: string,
  status?: string,
) {
  return useQuery({
    queryKey: ["maintenance_schedule", loom_id, status],
    queryFn: () => loomService.getMaintenanceSchedule(loom_id, status),
    staleTime: 5 * 60 * 1000,
  });
}

// Start maintenance
export function useStartMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => loomService.startMaintenance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_schedule"] });
      queryClient.invalidateQueries({ queryKey: ["looms"] });
    },
  });
}

// Complete maintenance
export function useCompleteMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => loomService.completeMaintenance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_schedule"] });
      queryClient.invalidateQueries({ queryKey: ["looms"] });
    },
  });
}

// Get blockout periods
export function useBlockoutPeriods(from_date: string, to_date: string) {
  return useQuery({
    queryKey: ["blockout_periods", from_date, to_date],
    queryFn: () => loomService.getBlockoutPeriods(from_date, to_date),
    staleTime: 5 * 60 * 1000,
    enabled: !!from_date && !!to_date,
  });
}
