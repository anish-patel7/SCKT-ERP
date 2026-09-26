-- STEP 3B IMPLEMENTATION: Remove Competing Saleable Inventory TABLE
-- Establish get_saleable_inventory() FUNCTION as authoritative source
-- Date: September 22, 2026

-- ============================================================================
-- RATIONALE
-- ============================================================================
-- The saleable_inventory TABLE (migration 013) creates a competing source of
-- truth for saleable stock quantities. The canonical source must be:
--   inventory_items (physical qty via ledger)
--   + quality inspections (grade decision)
--   = get_saleable_inventory() FUNCTION (computed)
--
-- All values in saleable_inventory TABLE are derivable from these canonical
-- sources. Keeping the TABLE as independently-mutable stock storage violates
-- single-source-of-truth architecture.
--
-- Audit trail is preserved via:
--   inventory_transactions (append-only ledger)
--   production_inspections (quality decisions)
--   production_output (production records)
--
-- No business information is lost by removing the TABLE.
-- ============================================================================

-- ============================================================================
-- DROP saleable_inventory TABLE (migration 20260920_013)
-- ============================================================================

DROP TABLE IF EXISTS public.saleable_inventory CASCADE;

-- Cascade removes:
-- - RLS policies (admin_full_access_saleable_inventory, qa_create_saleable_inventory, etc.)
-- - Indexes (idx_saleable_inventory_*)
-- - Any foreign key references

-- ============================================================================
-- VERIFY: get_saleable_inventory() FUNCTION is canonical source
-- ============================================================================

-- FUNCTION public.get_saleable_inventory() still exists in migration step24
-- It remains the authoritative calculation of saleable inventory
--
-- Canonical flow:
--   1. job_card_id → production_order (qty_metre specified)
--   2. production completed → production_output (qty_produced, grade)
--   3. quality inspection → production_inspections (system_grade, override)
--   4. inventory receipt → inventory_items.total_qty (updated by ledger)
--   5. get_saleable_inventory() JOINs all sources and calculates:
--      - available_qty = total_qty - reserved_qty
--      - saleable_qty = (available_qty IF grade = 'Grade A', ELSE 0)
--
-- NOTE: Safe defaults are handled in migration 20260922_003E

-- ============================================================================
-- RPC complete_quality_inspection() update
-- ============================================================================

-- The RPC previously tried to INSERT into saleable_inventory TABLE.
-- This is now handled via get_saleable_inventory() computed on-the-fly.
--
-- RPC changes in migration 20260922_003E:
-- - REMOVE: INSERT INTO public.saleable_inventory (...)
-- - KEEP: UPDATE production_inspections with grade decision
-- - EFFECT: Callers query get_saleable_inventory() to see results

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✓ Removed competing TABLE
-- ✓ Preserved all canonical sources
-- ✓ Audit trail intact (ledger + inspections)
-- ✓ get_saleable_inventory() is now only authoritative source
-- ✓ No business data lost
