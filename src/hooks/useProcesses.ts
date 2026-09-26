import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { processesService } from "@/services/processes";
import type { Database } from "@/integrations/supabase/types";

type Process = Database["public"]["Tables"]["processes"]["Row"];

export function useProcesses(includeInactive = false) {
  return useQuery({
    queryKey: ["processes", { includeInactive }],
    queryFn: () => processesService.listProcesses(includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProcessById(id: string) {
  return useQuery({
    queryKey: ["processes", id],
    queryFn: () => processesService.getProcessById(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProcessByCode(code: string) {
  return useQuery({
    queryKey: ["processes", "code", code],
    queryFn: () => processesService.getProcessByCode(code),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateProcess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => processesService.createProcess(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processes"] });
    },
  });
}

export function useUpdateProcess(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => processesService.updateProcess(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processes", id] });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
    },
  });
}

export function useSetProcessStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: "Active" | "Inactive") =>
      processesService.setProcessStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processes", id] });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
    },
  });
}

export function useSearchProcesses(query: string, limit = 10) {
  return useQuery({
    queryKey: ["processes", "search", query, limit],
    queryFn: () => processesService.searchProcesses(query, limit),
    staleTime: 2 * 60 * 1000,
  });
}

export function useGetCurrentRate(processId: string) {
  return useQuery({
    queryKey: ["processes", processId, "currentRate"],
    queryFn: () => processesService.getCurrentRate(processId),
    staleTime: 10 * 60 * 1000,
    enabled: !!processId,
  });
}

export function useProcessesByCategory(category: string, includeInactive = false) {
  return useQuery({
    queryKey: ["processes", "category", category, { includeInactive }],
    queryFn: () => processesService.getProcessesByCategory(category, includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}
