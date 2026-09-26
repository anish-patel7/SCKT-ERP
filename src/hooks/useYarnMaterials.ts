import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { yarnsService, type Yarn } from "@/services/yarns";

export function useYarnMaterials(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ["yarn_materials", filters],
    queryFn: () =>
      yarnsService.list({
        ...(filters?.status === "Active" || filters?.status === "Inactive"
          ? { active: filters.status === "Active" }
          : {}),
        ...(filters?.search ? { search: filters.search } : {}),
      }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNextYarnCode(enabled: boolean) {
  return useQuery({
    queryKey: ["yarn_materials", "next_code"],
    queryFn: () => yarnsService.nextCode(),
    enabled,
    staleTime: 0,
  });
}

export function useYarnMaterial(id: string) {
  return useQuery({
    queryKey: ["yarn_material", id],
    queryFn: () => yarnsService.getById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

export function useCreateYarnMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => yarnsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["yarn_materials"] });
    },
  });
}

export function useUpdateYarnMaterial(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: unknown) => yarnsService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["yarn_material", id] });
      queryClient.invalidateQueries({ queryKey: ["yarn_materials"] });
    },
  });
}

export function useSetYarnMaterialStatus(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: "Active" | "Inactive") => yarnsService.setStatus(id, status === "Active"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["yarn_material", id] });
      queryClient.invalidateQueries({ queryKey: ["yarn_materials"] });
    },
  });
}

export function useDeleteYarnMaterial(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => yarnsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["yarn_materials"] });
    },
  });
}
