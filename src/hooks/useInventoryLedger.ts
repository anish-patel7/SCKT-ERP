import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatServiceError } from "@/lib/master-codes";
import {
  inventoryService,
  type InventoryItem,
  type InventoryTransaction,
  type StockBalance,
  InventoryError,
  ValidationError,
  InsufficientStockError,
} from "@/services/inventory";

/**
 * STEP 11 Phase 3: React Hooks for Inventory Management
 *
 * Integrates inventoryService with TanStack Query for:
 * - Server state management (caching, refetching)
 * - Optimistic updates
 * - Error handling and toast notifications
 * - Cache invalidation on mutations
 */

// ============================================================================
// QUERY HOOKS (READ)
// ============================================================================

/**
 * Fetch single inventory item
 */
export function useInventoryItem(itemId?: string) {
  return useQuery({
    queryKey: ["inventory_items", itemId],
    queryFn: () => {
      if (!itemId) throw new Error("Item ID is required");
      return inventoryService.getItemById(itemId);
    },
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/**
 * List all inventory items with optional filters
 */
export function useInventoryItems(filters?: {
  itemType?: "yarn" | "beam" | "fabric";
  isActive?: boolean;
  location?: string;
}) {
  return useQuery({
    queryKey: ["inventory_items", filters],
    queryFn: () => inventoryService.listItems(filters),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/**
 * Get stock balance for an item
 */
export function useStockBalance(itemId?: string) {
  return useQuery({
    queryKey: ["inventory_balances", itemId],
    queryFn: () => {
      if (!itemId) throw new Error("Item ID is required");
      return inventoryService.getBalance(itemId);
    },
    enabled: !!itemId,
    staleTime: 2 * 60 * 1000, // 2 min (more frequent updates for balance)
  });
}

/**
 * Get all stock balances
 */
export function useInventoryBalances() {
  return useQuery({
    queryKey: ["inventory_balances"],
    queryFn: () => inventoryService.listBalances(),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

/**
 * Get transaction history for an item
 */
export function useTransactionHistory(itemId?: string, limit: number = 50) {
  return useQuery({
    queryKey: ["inventory_transactions", itemId, limit],
    queryFn: () => {
      if (!itemId) throw new Error("Item ID is required");
      return inventoryService.getTransactionHistory(itemId, limit);
    },
    enabled: !!itemId,
    staleTime: 1 * 60 * 1000, // 1 min (transactions are immutable)
  });
}

/**
 * Check available quantity in real-time
 */
export function useAvailableQuantity(itemId?: string) {
  return useQuery({
    queryKey: ["inventory_available", itemId],
    queryFn: () => {
      if (!itemId) throw new Error("Item ID is required");
      return inventoryService.getAvailableQuantity(itemId);
    },
    enabled: !!itemId,
    staleTime: 1 * 60 * 1000, // 1 min
  });
}

// ============================================================================
// MUTATION HOOKS (WRITE)
// ============================================================================

/**
 * Record inward transaction (purchase, return)
 */
export function useRecordInwardTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => inventoryService.recordInwardTransaction(data),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_balances"] });
      queryClient.invalidateQueries({
        queryKey: ["inventory_transactions", transaction.item_id],
      });
      toast.success("Inbound transaction recorded");
    },
    onError: (error: unknown) => {
      toast.error(`Unable to record inbound: ${describeInventoryError(error)}`);
    },
  });
}

/**
 * Receive stock of a new item (creates the inventory item, then the inward transaction).
 */
export function useReceiveNewInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { item: unknown; transaction: Omit<Record<string, unknown>, "item_id"> }) =>
      inventoryService.receiveNewItem(input),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_balances"] });
      queryClient.invalidateQueries({
        queryKey: ["inventory_transactions", transaction.item_id],
      });
      toast.success("Item created and inbound transaction recorded");
    },
    onError: (error: unknown) => {
      toast.error(`Unable to record inbound: ${describeInventoryError(error)}`);
    },
  });
}

function describeInventoryError(error: unknown): string {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof InventoryError) return error.message;
  return formatServiceError(error);
}

/**
 * Record issue transaction (production, dispatch, etc.)
 */
export function useRecordIssueTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => inventoryService.recordIssueTransaction(data),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_balances"] });
      queryClient.invalidateQueries({
        queryKey: ["inventory_transactions", transaction.item_id],
      });
      toast.success("Issue transaction recorded");
    },
    onError: (error: unknown) => {
      if (error instanceof InsufficientStockError) {
        toast.error(error.message);
      } else if (error instanceof ValidationError) {
        toast.error(`${error.field}: ${error.message}`);
      } else if (error instanceof InventoryError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to record issue transaction");
      }
    },
  });
}

/**
 * Record return transaction
 */
export function useRecordReturnTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => inventoryService.recordReturnTransaction(data),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_balances"] });
      queryClient.invalidateQueries({
        queryKey: ["inventory_transactions", transaction.item_id],
      });
      toast.success("Return transaction recorded");
    },
    onError: (error: unknown) => {
      if (error instanceof ValidationError) {
        toast.error(`${error.field}: ${error.message}`);
      } else if (error instanceof InventoryError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to record return transaction");
      }
    },
  });
}

/**
 * Record location transfer
 */
export function useRecordLocationTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      locationFrom,
      locationTo,
    }: {
      itemId: string;
      locationFrom: string;
      locationTo: string;
    }) => inventoryService.recordLocationTransfer(itemId, locationFrom, locationTo),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({
        queryKey: ["inventory_transactions", transaction.item_id],
      });
      toast.success("Location transfer recorded");
    },
    onError: (error: unknown) => {
      if (error instanceof InventoryError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to record location transfer");
      }
    },
  });
}

/**
 * Record inventory reconciliation
 */
export function useRecordReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      physicalQty,
      remarks,
    }: {
      itemId: string;
      physicalQty: number;
      remarks: string;
    }) => inventoryService.recordReconciliation(itemId, physicalQty, remarks),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_balances"] });
      queryClient.invalidateQueries({
        queryKey: ["inventory_transactions", transaction.item_id],
      });
      toast.success("Reconciliation recorded");
    },
    onError: (error: unknown) => {
      if (error instanceof InventoryError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to record reconciliation");
      }
    },
  });
}

/**
 * Approve inbound transaction
 */
export function useApproveInboundTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) =>
      inventoryService.approveInboundTransaction(transactionId),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({
        queryKey: ["inventory_transactions", transaction.item_id],
      });
      toast.success("Transaction approved");
    },
    onError: (error: unknown) => {
      if (error instanceof InventoryError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to approve transaction");
      }
    },
  });
}

/**
 * Record batch inward transactions (multiple items in single GRN)
 */
export function useRecordBatchInwardTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) =>
      inventoryService.recordBatchInwardTransactions(data),
    onSuccess: (transactions) => {
      // Invalidate all affected item queries
      const itemIds = new Set(transactions.map((tx) => tx.item_id));
      itemIds.forEach((itemId) => {
        queryClient.invalidateQueries({
          queryKey: ["inventory_transactions", itemId],
        });
      });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_balances"] });
      toast.success(
        `Batch recorded: ${transactions.length} item${transactions.length > 1 ? "s" : ""}`,
      );
    },
    onError: (error: unknown) => {
      if (error instanceof ValidationError) {
        toast.error(`${error.field}: ${error.message}`);
      } else if (error instanceof InventoryError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to record batch transactions");
      }
    },
  });
}
