/**
 * Advanced Search & Filtering Service
 * Multi-dimensional transaction search with pagination and CSV export
 */

import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { InventoryError } from "./inventory";

// Types
export interface TransactionSearchResult {
  id: string;
  transaction_date: string;
  movement_type: string;
  item_id: string;
  item_code: string;
  item_name: string;
  item_type: "yarn" | "beam" | "fabric";
  qty_change: number;
  unit: string;
  reference_doc?: string;
  created_by?: string;
  remarks?: string;
  location_from?: string;
  location_to?: string;
}

export interface TransactionSearchFilters {
  dateFrom: string; // ISO format: YYYY-MM-DD
  dateTo: string; // ISO format: YYYY-MM-DD
  movementTypes?: string[]; // inward_*, issue_*, transfer, etc.
  itemTypes?: ("yarn" | "beam" | "fabric")[];
  itemSearchQuery?: string; // code, name, lot number
  referenceDocQuery?: string; // GRN, PO, SO, etc.
  createdBy?: string; // User email/ID
  page?: number; // 1-indexed
  pageSize?: number; // default 50
}

export interface TransactionSearchResponse {
  results: TransactionSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Movement type options
export const MOVEMENT_TYPES = [
  { value: "inward_purchase", label: "Inward (Purchase)" },
  { value: "inward_return", label: "Inward (Return)" },
  { value: "issue_to_production", label: "Issue (Production)" },
  { value: "issue_internal", label: "Issue (Internal)" },
  { value: "dispatch", label: "Dispatch" },
  { value: "transfer", label: "Transfer" },
  { value: "quality_rejection", label: "Quality Rejection" },
];

export const ITEM_TYPES = [
  { value: "yarn", label: "Yarn" },
  { value: "beam", label: "Beam" },
  { value: "fabric", label: "Fabric" },
];

export const searchService = {
  /**
   * Search transactions with multi-dimensional filters
   */
  async searchTransactions(
    filters: TransactionSearchFilters,
  ): Promise<TransactionSearchResponse> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabase
      .from("inventory_transactions")
      .select(
        `
        id,
        transaction_date,
        movement_type,
        item_id,
        qty_change,
        unit,
        reference_doc,
        created_by,
        remarks,
        location_from,
        location_to,
        inventory_items!inner(
          id,
          item_code,
          item_name,
          item_type,
          lot_no
        )
      `,
        { count: "exact" },
      );

    // Date range filter
    if (filters.dateFrom) {
      query = query.gte("transaction_date", `${filters.dateFrom}T00:00:00Z`);
    }
    if (filters.dateTo) {
      query = query.lte("transaction_date", `${filters.dateTo}T23:59:59Z`);
    }

    // Movement type filter
    if (filters.movementTypes && filters.movementTypes.length > 0) {
      query = query.in("movement_type", filters.movementTypes);
    }

    // Item type filter (via join)
    if (filters.itemTypes && filters.itemTypes.length > 0) {
      query = query.in("inventory_items.item_type", filters.itemTypes);
    }

    // Created by filter
    if (filters.createdBy) {
      query = query.eq("created_by", filters.createdBy);
    }

    // Execute query
    const { data, error, count } = await query
      .order("transaction_date", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new InventoryError(`Search failed: ${error.message}`);
    }

    // Post-process results for client-side filtering (item search, reference doc)
    let results = (data || []).map((tx: any) => ({
      id: tx.id,
      transaction_date: tx.transaction_date,
      movement_type: tx.movement_type,
      item_id: tx.item_id,
      item_code: tx.inventory_items[0]?.item_code || "",
      item_name: tx.inventory_items[0]?.item_name || "",
      item_type: tx.inventory_items[0]?.item_type || "yarn",
      qty_change: tx.qty_change,
      unit: tx.unit,
      reference_doc: tx.reference_doc,
      created_by: tx.created_by,
      remarks: tx.remarks,
      location_from: tx.location_from,
      location_to: tx.location_to,
    })) as TransactionSearchResult[];

    // Client-side filtering for item search (code, name, lot)
    if (filters.itemSearchQuery) {
      const q = filters.itemSearchQuery.toLowerCase();
      results = results.filter((result) =>
        result.item_code.toLowerCase().includes(q) ||
        result.item_name.toLowerCase().includes(q),
      );
    }

    // Client-side filtering for reference doc
    if (filters.referenceDocQuery) {
      const q = filters.referenceDocQuery.toLowerCase();
      results = results.filter((result) =>
        result.reference_doc?.toLowerCase().includes(q),
      );
    }

    const total = count || 0;

    return {
      results,
      total,
      page,
      pageSize,
      hasMore: offset + pageSize < total,
    };
  },

  /**
   * Export search results to CSV
   */
  async exportToCSV(
    filters: TransactionSearchFilters,
    filename: string = "inventory-transactions.csv",
  ): Promise<Blob> {
    // Fetch all results (up to 10,000)
    const allFilters = { ...filters, pageSize: 10000, page: 1 };
    const response = await this.searchTransactions(allFilters);

    // Build CSV
    const headers = [
      "Date",
      "Type",
      "Item Code",
      "Item Name",
      "Item Type",
      "Quantity",
      "Unit",
      "Reference",
      "Created By",
      "Location From",
      "Location To",
      "Remarks",
    ];

    const rows = response.results.map((tx) => [
      new Date(tx.transaction_date).toLocaleDateString(),
      this.getMovementTypeLabel(tx.movement_type),
      tx.item_code,
      tx.item_name,
      tx.item_type,
      tx.qty_change.toFixed(2),
      tx.unit,
      tx.reference_doc || "",
      tx.created_by || "",
      tx.location_from || "",
      tx.location_to || "",
      tx.remarks || "",
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) =>
            typeof cell === "string" && cell.includes(",")
              ? `"${cell}"`
              : cell,
          )
          .join(","),
      ),
    ].join("\n");

    // Return as Blob
    return new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  },

  /**
   * Get human-readable label for movement type
   */
  getMovementTypeLabel(movementType: string): string {
    const found = MOVEMENT_TYPES.find((m) => m.value === movementType);
    return found ? found.label : movementType;
  },

  /**
   * Get unique users from transaction history
   */
  async getTransactionUsers(): Promise<string[]> {
    const { data, error } = await supabase
      .from("inventory_transactions")
      .select("created_by", { count: "exact" })
      .neq("created_by", null);

    if (error) {
      throw new InventoryError(`Failed to fetch users: ${error.message}`);
    }

    // Get unique users
    const users = Array.from(
      new Set(data?.map((d: any) => d.created_by).filter(Boolean) || []),
    ) as string[];

    return users.sort();
  },

  /**
   * Get quick date range presets
   */
  getDateRangePresets(): {
    [key: string]: { from: string; to: string };
  } {
    const today = new Date();
    const from = new Date();

    return {
      today: {
        from: today.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
      },
      "this_week": {
        from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        to: today.toISOString().split("T")[0],
      },
      "this_month": {
        from: new Date(today.getFullYear(), today.getMonth(), 1)
          .toISOString()
          .split("T")[0],
        to: today.toISOString().split("T")[0],
      },
      "last_30_days": {
        from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        to: today.toISOString().split("T")[0],
      },
    };
  },
};
