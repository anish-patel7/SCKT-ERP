import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  productionInspectionsService,
  type ProductionInspection,
} from "@/services/quality";

export function useProductionInspections(filters?: {
  status?: string;
  gradeFilter?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["production_inspections", filters],
    queryFn: () => productionInspectionsService.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProductionInspection(id: string) {
  return useQuery({
    queryKey: ["production_inspection", id],
    queryFn: () => productionInspectionsService.getById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

export function useCreateProductionInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => productionInspectionsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["production_inspections"],
      });
    },
  });
}

export function useUpdateProductionInspection(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: unknown) =>
      productionInspectionsService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["production_inspection", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["production_inspections"],
      });
    },
  });
}

export function useOverrideInspectionGrade(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ grade, reason }: { grade: string; reason: string }) =>
      productionInspectionsService.overrideGrade(id, grade, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["production_inspection", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["production_inspections"],
      });
    },
  });
}
