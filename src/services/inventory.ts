import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * STEP 11 Phase 3: Inventory Transaction Ledger Service
 *
 * Implements append-only ledger for inventory management:
 * - Record transactions (inward, issue, return, transfer)
 * - Validate stock availability
 * - Query balances and transaction history
 * - Enforce role-based access via RLS
 */

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export type ItemType = "yarn" | "beam" | "fabric";
export type MovementType =
  | "inward_purchase"
  | "inward_production_return"
  | "issue_to_production"
  | "issue_internal"
  | "location_transfer"
  | "quality_rejection"
  | "dispatch";
export type StockUnit = "kg" | "m" | "beam" | "roll";

export interface InventoryItem {
  id: string;
  item_type: ItemType;
  item_code: string;
  item_name: string;
  lot_no?: string | null;
  grn_no?: string | null;
  yarn_code?: string | null;
  beam_no?: string | null;
  set_no?: string | null;
  piece_no?: string | null;
  design_no?: string | null;
  job_card_no?: string | null;
  total_qty: number;
  total_unit: StockUnit;
  reserved_qty: number;
  available_qty: number;
  rate_per_unit?: number | null;
  cost_basis?: number | null;
  current_location?: string | null;
  current_status?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface InventoryTransaction {
  id: string;
  transaction_date: string;
  movement_type: MovementType;
  reference_doc?: string | null;
  item_id: string;
  qty_change: number;
  unit: StockUnit;
  location_from?: string | null;
  location_to?: string | null;
  rate_per_unit?: number | null;
  cost_value: number;
  reserved_qty_delta: number;
  approval_required: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  created_by: string;
  remarks?: string | null;
}

export interface StockBalance {
  id: string;
  item_id: string;
  total_inward_qty: number;
  total_issued_qty: number;
  net_qty: number;
  total_reserved_qty: number;
  available_qty: number;
  total_cost: number;
  avg_cost_per_unit: number;
  last_transaction_at?: string | null;
  updated_at: string;
}

// Validation Schemas
const InventoryItemSchema = z.object({
  item_type: z.enum(["yarn", "beam", "fabric"]),
  item_code: z.string().min(1).max(100),
  item_name: z.string().min(1).max(200),
  lot_no: z.string().optional(),
  grn_no: z.string().optional(),
  yarn_code: z.string().optional(),
  total_qty: z.number().nonnegative(),
  total_unit: z.enum(["kg", "m", "beam", "roll"]),
  rate_per_unit: z.number().positive().optional(),
  current_location: z.string().optional(),
});

const TransactionSchema = z.object({
  transaction_date: z.string().datetime(),
  movement_type: z.enum([
    "inward_purchase",
    "inward_production_return",
    "issue_to_production",
    "issue_internal",
    "location_transfer",
    "quality_rejection",
    "dispatch",
  ]),
  reference_doc: z.string().optional(),
  item_id: z.string().uuid(),
  qty_change: z.number().refine((n) => n !== 0, "Quantity change cannot be zero"),
  unit: z.enum(["kg", "m", "beam", "roll"]),
  location_from: z.string().optional(),
  location_to: z.string().optional(),
  rate_per_unit: z.number().positive().optional(),
  reserved_qty_delta: z.number().optional().default(0),
  remarks: z.string().optional(),
});

// ============================================================================
// ERROR TYPES
// ============================================================================

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class InsufficientStockError extends Error {
  constructor(
    itemCode: string,
    available: number,
    requested: number,
  ) {
    super(
      `Insufficient stock: ${itemCode} (available: ${available}, requested: ${requested})`,
    );
    this.name = "InsufficientStockError";
  }
}

export class NotFoundError extends Error {
  constructor(
    resource: string,
    id: string,
  ) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

// ============================================================================
// SERVICE LAYER
// ============================================================================

async function _getAuthSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

export const inventoryService = {
  // =========================================================================
  // QUERY METHODS
  // =========================================================================

  /**
   * Fetch inventory item by ID
   */
  async getItemById(itemId: string): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (error) throw new NotFoundError("Inventory Item", itemId);
    return data as InventoryItem;
  },

  /**
   * List all inventory items with optional filters
   */
  async listItems(filters?: {
    itemType?: ItemType;
    isActive?: boolean;
    location?: string;
  }): Promise<InventoryItem[]> {
    let query = supabase.from("inventory_items").select("*");

    if (filters?.itemType) {
      query = query.eq("item_type", filters.itemType);
    }
    if (filters?.isActive !== undefined) {
      query = query.eq("is_active", filters.isActive);
    }
    if (filters?.location) {
      query = query.eq("current_location", filters.location);
    }

    const { data, error } = await query;

    if (error) throw new InventoryError(`Failed to list items: ${error.message}`);
    return (data || []) as InventoryItem[];
  },

  /**
   * Get stock balance for an item
   */
  async getBalance(itemId: string): Promise<StockBalance> {
    const { data, error } = await supabase
      .from("inventory_balances_cache")
      .select("*")
      .eq("item_id", itemId)
      .single();

    if (error) {
      // Return zero balance if not found (new item)
      return {
        id: "",
        item_id: itemId,
        total_inward_qty: 0,
        total_issued_qty: 0,
        net_qty: 0,
        total_reserved_qty: 0,
        available_qty: 0,
        total_cost: 0,
        avg_cost_per_unit: 0,
        updated_at: new Date().toISOString(),
      };
    }
    return data as StockBalance;
  },

  /**
   * Get all stock balances
   */
  async listBalances(): Promise<StockBalance[]> {
    const { data, error } = await supabase
      .from("inventory_balances_cache")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw new InventoryError(`Failed to list balances: ${error.message}`);
    return (data || []) as StockBalance[];
  },

  /**
   * Get transaction history for an item
   */
  async getTransactionHistory(itemId: string, limit: number = 50): Promise<InventoryTransaction[]> {
    const { data, error } = await supabase
      .from("inventory_transactions")
      .select("*")
      .eq("item_id", itemId)
      .order("transaction_date", { ascending: false })
      .limit(limit);

    if (error) throw new InventoryError(`Failed to get history: ${error.message}`);
    return (data || []) as InventoryTransaction[];
  },

  /**
   * Check available quantity for an item
   */
  async getAvailableQuantity(itemId: string): Promise<number> {
    const balance = await this.getBalance(itemId);
    return balance.available_qty;
  },

  // =========================================================================
  // MUTATION METHODS
  // =========================================================================

  /**
   * Record inward transaction (purchase, return from production)
   */
  async recordInwardTransaction(input: unknown): Promise<InventoryTransaction> {
    const session = await _getAuthSession();
    const validated = TransactionSchema.parse(input);

    // Verify movement type is inward
    if (!validated.movement_type.startsWith("inward_")) {
      throw new ValidationError("movement_type", "Must be an inward movement");
    }

    // Verify item exists
    await this.getItemById(validated.item_id);

    // Insert transaction
    const { data, error } = await supabase
      .from("inventory_transactions")
      .insert([
        {
          ...validated,
          transaction_date: validated.transaction_date || new Date().toISOString(),
          created_by: session.user.email,
          qty_change: Math.abs(validated.qty_change), // Ensure positive for inward
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ValidationError("reference_doc", "Transaction already exists");
      }
      throw new InventoryError(`Failed to record transaction: ${error.message}`);
    }

    return data as InventoryTransaction;
  },

  /**
   * Receive stock of a new item: create the inventory item (qty 0), then post the inward
   * transaction; the ledger trigger sets the item's quantity. If posting fails, the empty item is
   * removed so a retry with the same code works.
   */
  async receiveNewItem(input: {
    item: unknown;
    transaction: Omit<Record<string, unknown>, "item_id">;
  }): Promise<InventoryTransaction> {
    const session = await _getAuthSession();
    const item = InventoryItemSchema.parse(input.item);
    const itemCode = item.item_code.trim().toUpperCase();

    const { data: existing, error: lookupError } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("item_code", itemCode)
      .limit(1);
    if (lookupError) throw new InventoryError(`Failed to check item code: ${lookupError.message}`);
    if (existing && existing.length > 0) {
      throw new ValidationError(
        "item_code",
        `Item code ${itemCode} already exists. Use "Add to existing" to receive more stock.`,
      );
    }

    const { data: created, error: createError } = await supabase
      .from("inventory_items")
      .insert([
        {
          item_type: item.item_type,
          item_code: itemCode,
          item_name: item.item_name.trim(),
          lot_no: item.lot_no || null,
          grn_no: item.grn_no || null,
          yarn_code: item.yarn_code || null,
          total_qty: 0,
          total_unit: item.total_unit,
          rate_per_unit: item.rate_per_unit ?? null,
          current_location: item.current_location || null,
          is_active: true,
          created_by: session.user.email ?? null,
        },
      ])
      .select("id")
      .single();
    if (createError) {
      if (createError.code === "23505") {
        throw new ValidationError("item_code", `Item code ${itemCode} already exists`);
      }
      if (createError.code === "42501") {
        throw new InventoryError("You don't have permission to create inventory items");
      }
      throw new InventoryError(`Failed to create item: ${createError.message}`);
    }

    try {
      return await this.recordInwardTransaction({ ...input.transaction, item_id: created.id });
    } catch (err) {
      await supabase.from("inventory_items").delete().eq("id", created.id);
      throw err;
    }
  },

  /**
   * Record issue transaction (production, internal, dispatch)
   * Validates available quantity before issuing
   */
  async recordIssueTransaction(input: unknown): Promise<InventoryTransaction> {
    const session = await _getAuthSession();
    const validated = TransactionSchema.parse(input);

    // Verify movement type is issue/dispatch
    if (
      ![
        "issue_to_production",
        "issue_internal",
        "quality_rejection",
        "dispatch",
      ].includes(validated.movement_type)
    ) {
      throw new ValidationError("movement_type", "Must be an issue/dispatch movement");
    }

    // Get item and balance
    const item = await this.getItemById(validated.item_id);
    const balance = await this.getBalance(validated.item_id);

    // Validate available quantity
    const requestedQty = Math.abs(validated.qty_change);
    if (balance.available_qty < requestedQty) {
      throw new InsufficientStockError(item.item_code, balance.available_qty, requestedQty);
    }

    // Insert transaction
    const { data, error } = await supabase
      .from("inventory_transactions")
      .insert([
        {
          ...validated,
          transaction_date: validated.transaction_date || new Date().toISOString(),
          created_by: session.user.email,
          qty_change: -Math.abs(validated.qty_change), // Ensure negative for issue
        },
      ])
      .select()
      .single();

    if (error) {
      throw new InventoryError(`Failed to record issue: ${error.message}`);
    }

    return data as InventoryTransaction;
  },

  /**
   * Record return transaction (return from production)
   */
  async recordReturnTransaction(input: unknown): Promise<InventoryTransaction> {
    const session = await _getAuthSession();
    const validated = TransactionSchema.parse(input);

    if (validated.movement_type !== "inward_production_return") {
      throw new ValidationError("movement_type", "Must be a production return");
    }

    // Verify item exists
    await this.getItemById(validated.item_id);

    // Insert transaction
    const { data, error } = await supabase
      .from("inventory_transactions")
      .insert([
        {
          ...validated,
          transaction_date: validated.transaction_date || new Date().toISOString(),
          created_by: session.user.email,
          qty_change: Math.abs(validated.qty_change), // Ensure positive for return
        },
      ])
      .select()
      .single();

    if (error) {
      throw new InventoryError(`Failed to record return: ${error.message}`);
    }

    return data as InventoryTransaction;
  },

  /**
   * Record location transfer (no qty change, only location)
   */
  async recordLocationTransfer(
    itemId: string,
    locationFrom: string,
    locationTo: string,
  ): Promise<InventoryTransaction> {
    const session = await _getAuthSession();

    // Verify item exists
    await this.getItemById(itemId);

    // Insert transfer transaction (qty_change = 0 not allowed, use 0.001 for tracking)
    const { data, error } = await supabase
      .from("inventory_transactions")
      .insert([
        {
          transaction_date: new Date().toISOString(),
          movement_type: "location_transfer",
          item_id: itemId,
          qty_change: 0.001, // Minimal change for tracking
          unit: "m",
          location_from: locationFrom,
          location_to: locationTo,
          created_by: session.user.email,
          remarks: `Transfer from ${locationFrom} to ${locationTo}`,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new InventoryError(`Failed to record transfer: ${error.message}`);
    }

    return data as InventoryTransaction;
  },

  /**
   * Record reconciliation adjustment
   */
  async recordReconciliation(
    itemId: string,
    physicalQty: number,
    remarks: string,
  ): Promise<InventoryTransaction> {
    const session = await _getAuthSession();

    const item = await this.getItemById(itemId);
    const balance = await this.getBalance(itemId);

    const adjustmentQty = physicalQty - balance.net_qty;

    // Insert reconciliation transaction
    const { data, error } = await supabase
      .from("inventory_transactions")
      .insert([
        {
          transaction_date: new Date().toISOString(),
          movement_type: adjustmentQty > 0 ? "inward_purchase" : "quality_rejection",
          item_id: itemId,
          qty_change: adjustmentQty,
          unit: item.total_unit,
          created_by: session.user.email,
          remarks: `Reconciliation: ${remarks}`,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new InventoryError(`Failed to record reconciliation: ${error.message}`);
    }

    return data as InventoryTransaction;
  },

  /**
   * Approve pending inbound transaction
   */
  async approveInboundTransaction(transactionId: string): Promise<InventoryTransaction> {
    const session = await _getAuthSession();

    const { data, error } = await supabase
      .from("inventory_transactions")
      .update({
        approved_by: session.user.email,
        approved_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .select()
      .single();

    if (error) {
      throw new InventoryError(`Failed to approve transaction: ${error.message}`);
    }

    return data as InventoryTransaction;
  },

  /**
   * Record batch inward transactions (multiple items in single GRN)
   * Atomic operation: all or nothing
   */
  async recordBatchInwardTransactions(
    input: unknown,
  ): Promise<InventoryTransaction[]> {
    const session = await _getAuthSession();

    // Validate batch input
    const BatchInwardSchema = z.object({
      grn_no: z.string().min(1, "GRN number is required"),
      transaction_date: z.string().datetime().optional(),
      transactions: z
        .array(
          z.object({
            item_id: z.string().uuid("Invalid item ID"),
            qty_change: z.number().positive("Quantity must be positive"),
            unit: z.enum(["kg", "m", "beam", "roll"]),
            rate_per_unit: z.number().positive("Rate must be positive").optional(),
            location_to: z.string().min(1, "Location is required"),
            remarks: z.string().optional(),
          }),
        )
        .min(1, "At least one transaction is required")
        .max(50, "Maximum 50 items per batch"),
    });

    const validated = BatchInwardSchema.parse(input);

    // Verify all items exist and validate
    const validatedTransactions: Array<{
      item_id: string;
      qty_change: number;
      unit: "kg" | "m" | "beam" | "roll";
      rate_per_unit?: number;
      location_to: string;
      remarks?: string;
    }> = [];

    for (const tx of validated.transactions) {
      const item = await this.getItemById(tx.item_id);
      // Verify unit matches item type
      const expectedUnit =
        item.item_type === "yarn"
          ? "kg"
          : item.item_type === "beam"
            ? "beam"
            : item.item_type === "fabric"
              ? "roll"
              : "m";
      if (tx.unit !== expectedUnit) {
        throw new ValidationError(
          `transaction[${validatedTransactions.length}].unit`,
          `Expected ${expectedUnit} for ${item.item_type}`,
        );
      }
      validatedTransactions.push(tx);
    }

    // Build batch insert rows
    const rows = validatedTransactions.map((tx) => ({
      transaction_date:
        validated.transaction_date || new Date().toISOString(),
      movement_type: "inward_purchase" as const,
      item_id: tx.item_id,
      qty_change: Math.abs(tx.qty_change), // Ensure positive for inward
      unit: tx.unit,
      rate_per_unit: tx.rate_per_unit,
      location_to: tx.location_to,
      reference_doc: validated.grn_no,
      remarks: tx.remarks,
      created_by: session.user.email,
    }));

    // Insert all rows in batch (atomic)
    const { data, error } = await supabase
      .from("inventory_transactions")
      .insert(rows)
      .select();

    if (error) {
      throw new InventoryError(
        `Failed to record batch transactions: ${error.message}`,
      );
    }

    return (data || []) as InventoryTransaction[];
  },
};
