-- ============================================================================
-- MIGRATION 006A: Cost sheet header fields used by the cost sheet editor
-- Date: 2026-09-26
--
-- Why: the cost sheet editor collects Costing Date, Prepared By, Unit Basis,
-- Markup % and Manual Sale Rate, and costSheetsService writes them, but
-- public.cost_sheets never had these columns. Every save failed with
-- PGRST204 "Could not find the 'costing_date' column of 'cost_sheets'".
--
-- Money/percent columns use fixed precision (never float).
-- Safe to re-run. Rollback:
--   ALTER TABLE public.cost_sheets
--     DROP CONSTRAINT IF EXISTS cost_sheets_unit_basis_check,
--     DROP COLUMN IF EXISTS costing_date, DROP COLUMN IF EXISTS prepared_by,
--     DROP COLUMN IF EXISTS unit_basis, DROP COLUMN IF EXISTS markup_pct,
--     DROP COLUMN IF EXISTS manual_sale_rate;
-- ============================================================================

ALTER TABLE public.cost_sheets
  ADD COLUMN IF NOT EXISTS costing_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS prepared_by VARCHAR(150),
  ADD COLUMN IF NOT EXISTS unit_basis TEXT NOT NULL DEFAULT 'per metre',
  ADD COLUMN IF NOT EXISTS markup_pct DECIMAL(7, 2),
  ADD COLUMN IF NOT EXISTS manual_sale_rate DECIMAL(12, 2);

ALTER TABLE public.cost_sheets DROP CONSTRAINT IF EXISTS cost_sheets_unit_basis_check;
ALTER TABLE public.cost_sheets
  ADD CONSTRAINT cost_sheets_unit_basis_check CHECK (unit_basis IN ('per metre', 'per piece'));

ALTER TABLE public.cost_sheets DROP CONSTRAINT IF EXISTS cost_sheets_markup_pct_check;
ALTER TABLE public.cost_sheets
  ADD CONSTRAINT cost_sheets_markup_pct_check CHECK (markup_pct IS NULL OR markup_pct >= 0);

ALTER TABLE public.cost_sheets DROP CONSTRAINT IF EXISTS cost_sheets_manual_sale_rate_check;
ALTER TABLE public.cost_sheets
  ADD CONSTRAINT cost_sheets_manual_sale_rate_check
  CHECK (manual_sale_rate IS NULL OR manual_sale_rate >= 0);

-- Make PostgREST pick up the new columns immediately.
NOTIFY pgrst, 'reload schema';
