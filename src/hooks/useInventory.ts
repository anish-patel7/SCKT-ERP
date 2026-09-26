import { useState, useCallback } from "react";

/**
 * STEP 11: Backward Compatibility Hook
 * 
 * Provides stub implementation for legacy inventory routes.
 * New ledger-based inventory hooks are in useInventoryLedger.ts.
 * 
 * Full integration happens in STEP 12: Connect Inventory UI
 */

export function useInventory() {
  const [data] = useState(() => ({
    yarn: [],
    beams: [],
    fabric: [],
  }));

  const update = useCallback(() => {
    // Stub implementation for STEP 12 integration
  }, []);

  return { data, update };
}
