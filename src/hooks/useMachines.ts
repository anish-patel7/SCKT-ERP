import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { machinesService } from "@/services/machines";
import type { Database } from "@/integrations/supabase/types";

type Machine = Database["public"]["Tables"]["machines"]["Row"];

export function useMachines(includeInactive = false) {
  return useQuery({
    queryKey: ["machines", { includeInactive }],
    queryFn: () => machinesService.listMachines(includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMachineById(id: string) {
  return useQuery({
    queryKey: ["machines", id],
    queryFn: () => machinesService.getMachineById(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMachineByCode(code: string) {
  return useQuery({
    queryKey: ["machines", "code", code],
    queryFn: () => machinesService.getMachineByCode(code),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => machinesService.createMachine(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
  });
}

export function useUpdateMachine(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => machinesService.updateMachine(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines", id] });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
  });
}

export function useSetMachineStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: "Active" | "Inactive") => machinesService.setMachineStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines", id] });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
  });
}

export function useSetOperationalStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: "Operational" | "Maintenance" | "Standby" | "Decommissioned") =>
      machinesService.setOperationalStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines", id] });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
  });
}

export function useSearchMachines(query: string, limit = 10) {
  return useQuery({
    queryKey: ["machines", "search", query, limit],
    queryFn: () => machinesService.searchMachines(query, limit),
    staleTime: 2 * 60 * 1000,
  });
}

export function useMachinesByProcess(processId: string, includeInactive = false) {
  return useQuery({
    queryKey: ["machines", "process", processId, { includeInactive }],
    queryFn: () => machinesService.getMachinesByProcess(processId, includeInactive),
    staleTime: 5 * 60 * 1000,
    enabled: !!processId,
  });
}

export function useMachinesByWarehouse(warehouseId: string, includeInactive = false) {
  return useQuery({
    queryKey: ["machines", "warehouse", warehouseId, { includeInactive }],
    queryFn: () => machinesService.getMachinesByWarehouse(warehouseId, includeInactive),
    staleTime: 5 * 60 * 1000,
    enabled: !!warehouseId,
  });
}

export function useMachinesByOperationalStatus(
  operationalStatus: "Operational" | "Maintenance" | "Standby" | "Decommissioned",
) {
  return useQuery({
    queryKey: ["machines", "operationalStatus", operationalStatus],
    queryFn: () => machinesService.getMachinesByOperationalStatus(operationalStatus),
    staleTime: 5 * 60 * 1000,
  });
}
