import { useCallback, useMemo } from "react";
import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { accessService, hasPermission, type EffectiveAccess } from "@/services/access";

export const CURRENT_ACCESS_KEY = ["effective-access", "current"] as const;

export const currentAccessQuery = queryOptions({
  queryKey: CURRENT_ACCESS_KEY,
  queryFn: () => accessService.getCurrentAccess(),
  staleTime: 60 * 1000,
  retry: 1,
});

/** Invalidate every cached permission-derived state (sidebar, guards, user access views). */
export function invalidateAccess(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["effective-access"] });
  void queryClient.invalidateQueries({ queryKey: ["access-overview"] });
}

export type PermissionApi = {
  access: EffectiveAccess | null;
  isLoading: boolean;
  error: Error | null;
  can: (code: string) => boolean;
  canAny: (codes: readonly string[]) => boolean;
  canAll: (codes: readonly string[]) => boolean;
};

export function usePermissions(): PermissionApi {
  const { data, isLoading, error } = useQuery(currentAccessQuery);
  const access = data ?? null;

  const can = useCallback((code: string) => hasPermission(access, code), [access]);
  const canAny = useCallback(
    (codes: readonly string[]) => codes.some((c) => hasPermission(access, c)),
    [access],
  );
  const canAll = useCallback(
    (codes: readonly string[]) => codes.every((c) => hasPermission(access, c)),
    [access],
  );

  return useMemo(
    () => ({ access, isLoading, error, can, canAny, canAll }),
    [access, isLoading, error, can, canAny, canAll],
  );
}
