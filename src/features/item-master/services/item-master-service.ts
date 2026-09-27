/**
 * ItemMasterService — the only thing the Item Master UI talks to.
 *
 * Today: ItemMasterDemoService (in memory). Later: a SupabaseItemMasterService with the
 * same interface. Frontend validation is for data entry; the backend must validate again.
 */
import type {
  ItemInput,
  ItemMasterLookups,
  ItemRecord,
  ItemSummary,
  ItemValidationErrors,
} from "@/features/item-master/types/item-master";

export class ItemValidationError extends Error {
  constructor(public readonly errors: ItemValidationErrors) {
    super(Object.values(errors)[0] ?? "Invalid item");
    this.name = "ItemValidationError";
  }
}

export class ItemMasterUnavailableError extends Error {
  constructor() {
    super(
      "Item Master is not connected to the database yet; it runs in frontend prototype mode only.",
    );
    this.name = "ItemMasterUnavailableError";
  }
}

export interface ItemMasterService {
  /** "demo" = in-memory frontend prototype; "unavailable" = prototype disabled, no backend. */
  readonly mode: "demo" | "unavailable";
  getLookups(): Promise<ItemMasterLookups>;
  listItems(): Promise<ItemSummary[]>;
  getItem(id: string): Promise<ItemRecord | null>;
  /** Saves as DRAFT; only the identity (product name) is required. */
  saveDraft(input: ItemInput, id?: string): Promise<ItemRecord>;
  /** Saves as complete (demo-active) after full frontend validation. */
  save(input: ItemInput, id?: string): Promise<ItemRecord>;
  /** Only drafts created in this session; saved / fixture items are never hard-deleted. */
  deleteDraft(id: string): Promise<void>;
}
