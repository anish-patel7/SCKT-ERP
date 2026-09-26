import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { labTestsService, type LabTest } from "@/services/quality";

export function useLabTests(filters?: { status?: string }) {
  return useQuery({
    queryKey: ["lab_tests", filters],
    queryFn: () => labTestsService.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLabTest(id: string) {
  return useQuery({
    queryKey: ["lab_test", id],
    queryFn: () => labTestsService.getById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

export function useCreateLabTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => labTestsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["lab_tests"],
      });
    },
  });
}
