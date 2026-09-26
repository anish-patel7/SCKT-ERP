-- ============================================================================
-- MIGRATION 006C: Fix the inventory ledger balance trigger
-- Date: 2026-09-26
--
-- Why: every INSERT into inventory_transactions failed, so no stock receipt,
-- issue or dispatch could be recorded:
--   1. update_inventory_balance() selects item_id with SUM(...) aggregates but
--      no GROUP BY -> "column inventory_transactions.item_id must appear in the
--      GROUP BY clause".
--   2. It ran as the calling user, but inventory_balances_cache denies all
--      writes through RLS (it is maintained only by this trigger) and
--      inventory_items updates are limited to managers, so even with (1) fixed
--      the cache insert would be rejected.
--
-- Fix: same logic with GROUP BY item_id, SECURITY DEFINER with a fixed
-- search_path (documented exception: the balance cache is trigger-owned), and
-- no direct EXECUTE for API roles (triggers don't need it).
-- Plain $$ quoting for the Supabase SQL editor. Safe to re-run.
-- Rollback: re-apply the function from 20260920_003_inventory_ledger_schema.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_inventory_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Update or create balance cache entry
  INSERT INTO public.inventory_balances_cache (
    item_id,
    total_inward_qty,
    total_issued_qty,
    total_reserved_qty,
    total_cost,
    last_transaction_at,
    updated_at
  )
  SELECT
    item_id,
    COALESCE(SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END), 0),
    COALESCE(SUM(reserved_qty_delta), 0),
    COALESCE(SUM(cost_value), 0),
    MAX(transaction_date),
    NOW()
  FROM public.inventory_transactions
  WHERE item_id = NEW.item_id
  GROUP BY item_id
  ON CONFLICT (item_id) DO UPDATE
  SET
    total_inward_qty = EXCLUDED.total_inward_qty,
    total_issued_qty = EXCLUDED.total_issued_qty,
    total_reserved_qty = EXCLUDED.total_reserved_qty,
    total_cost = EXCLUDED.total_cost,
    last_transaction_at = EXCLUDED.last_transaction_at,
    updated_at = NOW();

  -- Update inventory_items denormalized fields
  UPDATE public.inventory_items
  SET
    total_qty = (
      SELECT net_qty FROM public.inventory_balances_cache WHERE item_id = NEW.item_id
    ),
    reserved_qty = (
      SELECT total_reserved_qty FROM public.inventory_balances_cache WHERE item_id = NEW.item_id
    ),
    current_location = NEW.location_to,
    updated_at = NOW()
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$;


REVOKE ALL ON FUNCTION public.update_inventory_balance() FROM PUBLIC, anon, authenticated;
