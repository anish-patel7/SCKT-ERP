import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsService } from "@/services/materials";
import type { Database } from "@/integrations/supabase/types";

type Material = Database["public"]["Tables"]["materials"]["Row"];

export function useMaterials(includeInactive = false) {
  const {
    data: materials,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["materials", includeInactive],
    queryFn: () => materialsService.listMaterials(includeInactive),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { materials: materials || [], error, isLoading };
}

export function useMaterialById(id: string) {
  const {
    data: material,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["material", id],
    queryFn: () => materialsService.getMaterialById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  return { material, error, isLoading };
}

export function useMaterialByCode(code: string) {
  const {
    data: material,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["material_code", code],
    queryFn: () => materialsService.getMaterialByCode(code),
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  });

  return { material, error, isLoading };
}

export function useCreateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (material: any) => materialsService.createMaterial(material),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useUpdateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      materialsService.updateMaterial(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.setQueryData(["material", data.id], data);
    },
  });
}

export function useDeactivateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => materialsService.deactivateMaterial(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.setQueryData(["material", data.id], data);
    },
  });
}

export function useSearchMaterials(query: string, enabled = true) {
  const {
    data: results,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["search_materials", query],
    queryFn: () => materialsService.searchMaterials(query),
    enabled: enabled && query.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  return { results: results || [], error, isLoading };
}

export function useGetNextMaterialCode(prefix = "Y") {
  const {
    data: code,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["next_material_code", prefix],
    queryFn: () => materialsService.getNextMaterialCode(prefix),
    staleTime: 1 * 60 * 1000,
  });

  return { code, error, isLoading };
}

export function useMaterialsByType(type: string) {
  const {
    data: materials,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["materials_by_type", type],
    queryFn: () => materialsService.getMaterialsByType(type),
    enabled: !!type,
    staleTime: 5 * 60 * 1000,
  });

  return { materials: materials || [], error, isLoading };
}

export function useMaterialRateHistory(materialId: string) {
  const {
    data: history,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["material_rate_history", materialId],
    queryFn: () => materialsService.getMaterialRateHistory(materialId),
    enabled: !!materialId,
    staleTime: 10 * 60 * 1000,
  });

  return { history: history || [], error, isLoading };
}

export function useRecordMaterialRateChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      materialId,
      newRate,
      reason,
    }: {
      materialId: string;
      newRate: number;
      reason?: string;
    }) => materialsService.recordMaterialRateChange(materialId, newRate, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["material_rate_history", variables.materialId] });
      queryClient.invalidateQueries({ queryKey: ["material", variables.materialId] });
    },
  });
}
