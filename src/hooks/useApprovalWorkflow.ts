/**
 * STEP 14 Phase 6: Approval Workflow Hooks
 * TanStack Query hooks for QA inspection and manager approval
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalService } from "@/services/approval";
import type {
  ApprovalQueueItem,
  QualityInspection,
  InventoryTransaction,
} from "@/services/approval";

/**
 * Get pending QA inspections
 */
export function usePendingQAInspections() {
  return useQuery({
    queryKey: ["pending_qa_inspections"],
    queryFn: () => approvalService.getPendingQAInspections(),
    staleTime: 1 * 60 * 1000, // 1 min
  });
}

/**
 * Get pending manager approvals
 */
export function usePendingManagerApprovals() {
  return useQuery({
    queryKey: ["pending_manager_approvals"],
    queryFn: () => approvalService.getPendingManagerApprovals(),
    staleTime: 1 * 60 * 1000, // 1 min
  });
}

/**
 * Get inspection details for a transaction
 */
export function useInspectionDetails(transactionId?: string) {
  return useQuery({
    queryKey: ["inspection_details", transactionId],
    queryFn: () =>
      transactionId ? approvalService.getInspectionDetails(transactionId) : null,
    enabled: !!transactionId,
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

/**
 * Get approval audit trail
 */
export function useApprovalAuditTrail(transactionId?: string) {
  return useQuery({
    queryKey: ["approval_audit_trail", transactionId],
    queryFn: () =>
      transactionId ? approvalService.getApprovalAuditTrail(transactionId) : null,
    enabled: !!transactionId,
    staleTime: 3 * 60 * 1000, // 3 min
  });
}

/**
 * Get approval statistics
 */
export function useApprovalStats() {
  return useQuery({
    queryKey: ["approval_stats"],
    queryFn: () => approvalService.getApprovalStats(),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

/**
 * Record QA inspection (QA team action)
 */
export function useRecordQAInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => approvalService.recordQAInspection(data),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["pending_qa_inspections"] });
      queryClient.invalidateQueries({ queryKey: ["pending_manager_approvals"] });
      queryClient.invalidateQueries({ queryKey: ["approval_stats"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_transactions"] });
    },
  });
}

/**
 * Approve or reject transaction (manager action)
 */
export function useApproveTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => approvalService.approveTransaction(data),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["pending_manager_approvals"] });
      queryClient.invalidateQueries({ queryKey: ["approval_stats"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_transactions"] });
    },
  });
}
