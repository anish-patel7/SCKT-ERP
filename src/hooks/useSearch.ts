/**
 * Advanced Search Hooks
 * Transaction search with multi-dimensional filtering
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import {
  searchService,
  type TransactionSearchFilters,
  type TransactionSearchResponse,
} from "@/services/search";

/**
 * Search transactions with filters and pagination
 */
export function useSearchTransactions(filters: TransactionSearchFilters) {
  return useQuery({
    queryKey: ["inventory_search", filters],
    queryFn: () => searchService.searchTransactions(filters),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

/**
 * Export search results to CSV
 */
export function useExportSearchResults() {
  return useMutation({
    mutationFn: async ({
      filters,
      filename,
    }: {
      filters: TransactionSearchFilters;
      filename?: string;
    }) => {
      const blob = await searchService.exportToCSV(filters, filename);

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "inventory-transactions.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return blob;
    },
  });
}

/**
 * Get list of users who created transactions
 */
export function useTransactionUsers() {
  return useQuery({
    queryKey: ["inventory_transaction_users"],
    queryFn: () => searchService.getTransactionUsers(),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/**
 * Get date range presets
 */
export function useDateRangePresets() {
  return useState(() => searchService.getDateRangePresets());
}

/**
 * Search form state management hook
 */
export function useSearchFormState() {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [movementTypes, setMovementTypes] = useState<string[]>([
    "inward_purchase",
    "inward_return",
    "issue_to_production",
    "issue_internal",
    "dispatch",
    "transfer",
    "quality_rejection",
  ]); // All selected by default
  const [itemTypes, setItemTypes] = useState<("yarn" | "beam" | "fabric")[]>([
    "yarn",
    "beam",
    "fabric",
  ]); // All selected by default
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [referenceDocQuery, setReferenceDocQuery] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [page, setPage] = useState(1);

  const toggleMovementType = useCallback((type: string) => {
    setMovementTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  const toggleItemType = useCallback(
    (type: "yarn" | "beam" | "fabric") => {
      setItemTypes((prev) =>
        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
      );
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setDateFrom(thirtyDaysAgo);
    setDateTo(today);
    setMovementTypes([
      "inward_purchase",
      "inward_return",
      "issue_to_production",
      "issue_internal",
      "dispatch",
      "transfer",
      "quality_rejection",
    ]);
    setItemTypes(["yarn", "beam", "fabric"]);
    setItemSearchQuery("");
    setReferenceDocQuery("");
    setCreatedBy("");
    setPage(1);
  }, [thirtyDaysAgo, today]);

  const applyDatePreset = useCallback((preset: { from: string; to: string }) => {
    setDateFrom(preset.from);
    setDateTo(preset.to);
    setPage(1);
  }, []);

  return {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    movementTypes,
    toggleMovementType,
    itemTypes,
    toggleItemType,
    itemSearchQuery,
    setItemSearchQuery,
    referenceDocQuery,
    setReferenceDocQuery,
    createdBy,
    setCreatedBy,
    page,
    setPage,
    resetFilters,
    applyDatePreset,

    // Get current filters as object
    getFilters: (): TransactionSearchFilters => ({
      dateFrom,
      dateTo,
      movementTypes: movementTypes.length > 0 ? movementTypes : undefined,
      itemTypes: itemTypes.length > 0 ? itemTypes : undefined,
      itemSearchQuery: itemSearchQuery || undefined,
      referenceDocQuery: referenceDocQuery || undefined,
      createdBy: createdBy || undefined,
      page,
    }),
  };
}
