import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shadeApprovalsService, type ShadeApproval } from "@/services/quality";

export function useShadeApprovals(filters?: {
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["shade_approvals", filters],
    queryFn: () => shadeApprovalsService.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useShadeApproval(id: string) {
  return useQuery({
    queryKey: ["shade_approval", id],
    queryFn: () => shadeApprovalsService.getById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

export function useCreateShadeApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => shadeApprovalsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["shade_approvals"],
      });
    },
  });
}

export function useUpdateShadeApprovalStatus(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: "approved" | "pending_buyer" | "rejected") =>
      shadeApprovalsService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["shade_approval", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["shade_approvals"],
      });
    },
  });
}
