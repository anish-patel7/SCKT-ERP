import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { unitsService } from "@/services/units";
import type { Database } from "@/integrations/supabase/types";

type Unit = Database["public"]["Tables"]["units"]["Row"];

export function useUnits(includeInactive = false) {
  return useQuery({
    queryKey: ["units", { includeInactive }],
    queryFn: () => unitsService.listUnits(includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnitById(id: string) {
  return useQuery({
    queryKey: ["units", id],
    queryFn: () => unitsService.getUnitById(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnitByCode(code: string) {
  return useQuery({
    queryKey: ["units", "code", code],
    queryFn: () => unitsService.getUnitByCode(code),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => unitsService.createUnit(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

export function useUpdateUnit(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => unitsService.updateUnit(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units", id] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

export function useSetUnitStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: "Active" | "Inactive") => unitsService.setUnitStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units", id] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

export function useSearchUnits(query: string, limit = 10) {
  return useQuery({
    queryKey: ["units", "search", query, limit],
    queryFn: () => unitsService.searchUnits(query, limit),
    staleTime: 2 * 60 * 1000,
  });
}

export function useConvertQuantity(
  quantity: number,
  fromUnitId: string,
  toUnitId: string,
) {
  return useQuery({
    queryKey: ["units", "convert", { quantity, fromUnitId, toUnitId }],
    queryFn: () => unitsService.convertQuantity(quantity, fromUnitId, toUnitId),
    staleTime: 10 * 60 * 1000,
    enabled: !!fromUnitId && !!toUnitId && quantity > 0,
  });
}
