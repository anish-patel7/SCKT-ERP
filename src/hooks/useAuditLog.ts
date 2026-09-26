import { useQuery } from "@tanstack/react-query";
import { auditService } from "@/services/audit";

export function useAuditLog(limit = 200) {
  return useQuery({
    queryKey: ["audit", limit],
    queryFn: () => auditService.listRecent(limit),
    staleTime: 30 * 1000,
  });
}
