-- STEP 14 Phase 4: Advanced Search & Filtering
-- Add performance indexes for transaction search
-- FIXED ORDERING: Moved to execute 99th (last, after all inventory tables)

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date
  ON public.inventory_transactions(transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_movement_type
  ON public.inventory_transactions(movement_type);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_by
  ON public.inventory_transactions(created_by);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id_date
  ON public.inventory_transactions(item_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference_doc
  ON public.inventory_transactions(reference_doc);

CREATE INDEX IF NOT EXISTS idx_inventory_items_item_type
  ON public.inventory_items(item_type);

CREATE INDEX IF NOT EXISTS idx_inventory_items_item_code
  ON public.inventory_items(item_code);
