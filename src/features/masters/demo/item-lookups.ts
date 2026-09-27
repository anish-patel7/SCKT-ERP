/**
 * Item lookup rows for other prototypes (Production) — derived from the Item Master
 * fixtures so items are defined once. DEMO DATA ONLY.
 */
import {
  demoItemRecords,
  ITEM_MASTER_DEMO_LOOKUPS,
} from "@/features/item-master/demo/item-master-demo-data";

export type DemoItemLookup = { id: string; code: string; name: string; category: string };

export const DEMO_ITEM_LOOKUPS: DemoItemLookup[] = demoItemRecords()
  .filter((r) => r.recordStatus === "SAVED")
  .map((r) => ({
    id: r.id,
    code: r.code,
    name: r.basic.productName,
    category:
      ITEM_MASTER_DEMO_LOOKUPS.categories.find((c) => c.id === r.basic.categoryId)?.name ?? "—",
  }));
