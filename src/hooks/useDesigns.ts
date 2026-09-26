import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { designsService, DesignError, ValidationError, NotFoundError } from "@/services/designs";
import type { DesignFilter } from "@/types/design";
import { formatServiceError } from "@/lib/master-codes";

/**
 * STEP 20 PHASE 12B: Design Hooks
 * TanStack Query hooks for design operations
 */

// ============================================================================
// QUERY HOOKS
// ============================================================================

export function useDesigns(includeArchived: boolean = false) {
  return useQuery({
    queryKey: ["designs", { includeArchived }],
    queryFn: () => designsService.listDesigns(includeArchived),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDesignById(designId: string | null) {
  return useQuery({
    queryKey: ["design", designId],
    queryFn: () => (designId ? designsService.getDesignById(designId) : null),
    enabled: !!designId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDesignByNumber(designNumber: string | null) {
  return useQuery({
    queryKey: ["design", "byNumber", designNumber],
    queryFn: () =>
      designNumber ? designsService.getDesignByNumber(designNumber) : null,
    enabled: !!designNumber,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSearchDesigns(filter: DesignFilter) {
  return useQuery({
    queryKey: ["designs", "search", filter],
    queryFn: () => designsService.searchDesigns(filter),
    staleTime: 2 * 60 * 1000, // 2 minutes for search
  });
}

/** Feeder cross-reference; an empty query lists every feeder of every active design. */
export function useSearchFeederCrossReference(query: string) {
  return useQuery({
    queryKey: ["feederCrossReference", query],
    queryFn: () => designsService.searchFeederCrossReference(query),
    staleTime: 60 * 1000,
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export function useCreateDesign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => designsService.createDesign(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designs"] });
    },
  });
}

export function useUpdateDesign(designId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: unknown) => designsService.updateDesign(designId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["design", designId] });
      queryClient.invalidateQueries({ queryKey: ["designs"] });
    },
  });
}

/** Create (no id) or update a design together with its beam colour x feeder matrix. */
export function useSaveDesign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string | undefined; input: unknown }) =>
      id ? designsService.updateDesign(id, input) : designsService.createDesign(input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["designs"] });
      queryClient.invalidateQueries({ queryKey: ["design", saved.id] });
      queryClient.invalidateQueries({ queryKey: ["feederCrossReference"] });
    },
  });
}

export function useArchiveDesign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (designId: string) => designsService.archiveDesign(designId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designs"] });
    },
  });
}

export function useCloneDesign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      originalId,
      newDesignNumber,
      newDesignName,
    }: {
      originalId: string;
      newDesignNumber: string;
      newDesignName?: string;
    }) => designsService.cloneDesign(originalId, newDesignNumber, newDesignName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designs"] });
    },
  });
}

// ============================================================================
// ERROR HANDLING HELPERS
// ============================================================================

export function isDesignError(error: unknown): error is DesignError {
  return error instanceof DesignError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    return error.message;
  }
  if (error instanceof DesignError) {
    return error.message;
  }
  if (error instanceof NotFoundError) {
    return error.message;
  }
  return formatServiceError(error);
}
