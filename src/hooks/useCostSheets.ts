import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  costSheetsService,
  type CostSheetFull,
  type CostSheetHeader,
  CostSheetError,
  ValidationError,
} from "@/services/costSheets";

// ============================================================================
// QUERY HOOKS (READ)
// ============================================================================

/**
 * Fetch all cost sheets
 */
export function useCostSheetsList() {
  return useQuery({
    queryKey: ["cost_sheets"],
    queryFn: () => costSheetsService.list(),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/**
 * Fetch a single cost sheet by ID
 */
export function useCostSheetDetail(id?: string) {
  return useQuery({
    queryKey: ["cost_sheets", id],
    queryFn: () => {
      if (!id) throw new Error("Cost sheet ID is required");
      return costSheetsService.getById(id);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

// ============================================================================
// MUTATION HOOKS (WRITE)
// ============================================================================

/**
 * Create a new cost sheet
 */
export function useCreateCostSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => costSheetsService.create(data),
    onSuccess: (newSheet) => {
      queryClient.invalidateQueries({ queryKey: ["cost_sheets"] });
      toast.success(`Cost sheet ${newSheet.header.sheet_no} created`);
    },
    onError: (error: unknown) => {
      if (error instanceof ValidationError) {
        toast.error(`${error.field}: ${error.message}`);
      } else if (error instanceof CostSheetError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create cost sheet");
      }
    },
  });
}

/**
 * Update an existing cost sheet
 */
export function useUpdateCostSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      costSheetsService.update(id, data),
    onSuccess: (updatedSheet) => {
      queryClient.invalidateQueries({ queryKey: ["cost_sheets"] });
      queryClient.invalidateQueries({ queryKey: ["cost_sheets", updatedSheet.header.id] });
      toast.success(`Cost sheet ${updatedSheet.header.sheet_no} saved`);
    },
    onError: (error: unknown) => {
      if (error instanceof ValidationError) {
        toast.error(`${error.field}: ${error.message}`);
      } else if (error instanceof CostSheetError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to save cost sheet");
      }
    },
  });
}

/**
 * Approve a cost sheet
 */
export function useApproveCostSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => costSheetsService.approve(id),
    onSuccess: (approvedSheet) => {
      queryClient.invalidateQueries({ queryKey: ["cost_sheets"] });
      queryClient.invalidateQueries({ queryKey: ["cost_sheets", approvedSheet.header.id] });
      toast.success(`Cost sheet ${approvedSheet.header.sheet_no} approved`);
    },
    onError: (error: unknown) => {
      if (error instanceof CostSheetError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to approve cost sheet");
      }
    },
  });
}

/**
 * Create a new version of a cost sheet
 */
export function useCreateCostSheetVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (originalId: string) => costSheetsService.createVersion(originalId),
    onSuccess: (versionSheet) => {
      queryClient.invalidateQueries({ queryKey: ["cost_sheets"] });
      toast.success(`Created Version ${versionSheet.header.version} of ${versionSheet.header.sheet_no}`);
    },
    onError: (error: unknown) => {
      if (error instanceof CostSheetError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create version");
      }
    },
  });
}

/**
 * Duplicate a cost sheet
 */
export function useDuplicateCostSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ originalId, newSheetNo }: { originalId: string; newSheetNo: string }) =>
      costSheetsService.duplicate(originalId, newSheetNo),
    onSuccess: (dupSheet) => {
      queryClient.invalidateQueries({ queryKey: ["cost_sheets"] });
      toast.success(`Cost sheet duplicated as ${dupSheet.header.sheet_no}`);
    },
    onError: (error: unknown) => {
      if (error instanceof CostSheetError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to duplicate cost sheet");
      }
    },
  });
}

/**
 * Delete a cost sheet
 */
export function useDeleteCostSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => costSheetsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_sheets"] });
      toast.success("Cost sheet deleted");
    },
    onError: (error: unknown) => {
      if (error instanceof CostSheetError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to delete cost sheet");
      }
    },
  });
}

/**
 * Compute costing totals (synchronous, for real-time UI calculation)
 */
export function useComputeCostSheetTotals(
  lines: Parameters<typeof costSheetsService.computeTotals>[0],
  charges: Parameters<typeof costSheetsService.computeTotals>[1],
  params: Parameters<typeof costSheetsService.computeTotals>[2],
) {
  return costSheetsService.computeTotals(lines, charges, params);
}
