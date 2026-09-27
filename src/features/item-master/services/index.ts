import { isFrontendPrototypeEnabled } from "@/lib/frontend-prototype";
import { ItemMasterDemoService } from "@/features/item-master/demo/item-master-demo-service";
import {
  ItemMasterUnavailableError,
  type ItemMasterService,
} from "@/features/item-master/services/item-master-service";
import type { ItemMasterLookups } from "@/features/item-master/types/item-master";

const EMPTY_LOOKUPS: ItemMasterLookups = {
  productTypes: [],
  categories: [],
  groups: [],
  subGroups: [],
  brands: [],
  shades: [],
  designGroups: [],
  uoms: [],
  parties: [],
  yarns: [],
  warpTypes: [],
  standardBomBeams: [],
  standardBoms: [],
  productStatuses: [],
  companies: [],
  departments: [],
  processes: [],
};

/** Prototype disabled and no backend yet: nothing to list, nothing to save. */
class UnavailableItemMasterService implements ItemMasterService {
  readonly mode = "unavailable" as const;
  async getLookups() {
    return EMPTY_LOOKUPS;
  }
  async listItems() {
    return [];
  }
  async getItem() {
    return null;
  }
  async saveDraft(): Promise<never> {
    throw new ItemMasterUnavailableError();
  }
  async save(): Promise<never> {
    throw new ItemMasterUnavailableError();
  }
  async deleteDraft(): Promise<never> {
    throw new ItemMasterUnavailableError();
  }
}

let instance: ItemMasterService | null = null;

/** Swap for the Supabase implementation in the backend phase; the UI does not change. */
export function getItemMasterService(): ItemMasterService {
  instance ??= isFrontendPrototypeEnabled()
    ? new ItemMasterDemoService()
    : new UnavailableItemMasterService();
  return instance;
}
