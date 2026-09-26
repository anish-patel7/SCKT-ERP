-- ============================================================================
-- STEP 20 PHASE 7: Reconcile Costing Schema - Standardize Column Naming
-- ============================================================================
-- Date: September 20, 2026
-- Purpose:
--   1. Standardize cost_sheet_lines and cost_sheet_charges on cost_sheet_id (not sheet_id)
--   2. Fix data_level_permissions references to use correct column names
--   3. Ensure consistency across all costing-related tables
-- ============================================================================

-- ============================================================================
-- 1. CHECK AND RENAME sheet_id TO cost_sheet_id (if column exists)
-- ============================================================================

-- For cost_sheet_lines table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'cost_sheet_lines'
    AND column_name = 'sheet_id'
  ) THEN
    -- Drop dependencies first (indexes and constraints)
    DROP INDEX IF EXISTS idx_cost_sheet_lines_sheet_id CASCADE;
    DROP INDEX IF EXISTS idx_cost_sheet_lines_sheet_id_sequence CASCADE;

    -- Rename the column
    ALTER TABLE public.cost_sheet_lines
    RENAME COLUMN sheet_id TO cost_sheet_id;

    -- Recreate indexes with new name
    CREATE INDEX IF NOT EXISTS idx_cost_sheet_lines_cost_sheet_id
      ON public.cost_sheet_lines(cost_sheet_id);
    CREATE INDEX IF NOT EXISTS idx_cost_sheet_lines_cost_sheet_id_sequence
      ON public.cost_sheet_lines(cost_sheet_id, sequence);
  END IF;
END $$;

-- For cost_sheet_charges table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'cost_sheet_charges'
    AND column_name = 'sheet_id'
  ) THEN
    -- Drop dependencies first
    DROP INDEX IF EXISTS idx_cost_sheet_charges_sheet_id CASCADE;
    DROP INDEX IF EXISTS idx_cost_sheet_charges_sheet_id_sequence CASCADE;

    -- Rename the column
    ALTER TABLE public.cost_sheet_charges
    RENAME COLUMN sheet_id TO cost_sheet_id;

    -- Recreate indexes with new name
    CREATE INDEX IF NOT EXISTS idx_cost_sheet_charges_cost_sheet_id
      ON public.cost_sheet_charges(cost_sheet_id);
    CREATE INDEX IF NOT EXISTS idx_cost_sheet_charges_cost_sheet_id_sequence
      ON public.cost_sheet_charges(cost_sheet_id, sequence);
  END IF;
END $$;

-- ============================================================================
-- 2. ENSURE PROPER FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Check cost_sheet_lines foreign key
DO $$
BEGIN
  -- Drop old constraint if it references sheet_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'cost_sheet_lines'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%sheet_id%'
  ) THEN
    ALTER TABLE public.cost_sheet_lines
    DROP CONSTRAINT IF EXISTS fk_cost_sheet_lines_sheet_id CASCADE;
  END IF;

  -- Add correct foreign key constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'cost_sheet_lines'
    AND constraint_name = 'fk_cost_sheet_lines_cost_sheet_id'
  ) THEN
    ALTER TABLE public.cost_sheet_lines
    ADD CONSTRAINT fk_cost_sheet_lines_cost_sheet_id
    FOREIGN KEY (cost_sheet_id) REFERENCES public.cost_sheets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Check cost_sheet_charges foreign key
DO $$
BEGIN
  -- Drop old constraint if it references sheet_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'cost_sheet_charges'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%sheet_id%'
  ) THEN
    ALTER TABLE public.cost_sheet_charges
    DROP CONSTRAINT IF EXISTS fk_cost_sheet_charges_sheet_id CASCADE;
  END IF;

  -- Add correct foreign key constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'cost_sheet_charges'
    AND constraint_name = 'fk_cost_sheet_charges_cost_sheet_id'
  ) THEN
    ALTER TABLE public.cost_sheet_charges
    ADD CONSTRAINT fk_cost_sheet_charges_cost_sheet_id
    FOREIGN KEY (cost_sheet_id) REFERENCES public.cost_sheets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 3. VERIFY AND FIX REQUIRED COLUMNS IN cost_sheets TABLE
-- ============================================================================

-- Ensure cost_sheets has all required columns for proper functioning
-- These columns might be missing if created from old migration

ALTER TABLE public.cost_sheets
ADD COLUMN IF NOT EXISTS sheet_no VARCHAR(50) UNIQUE;

ALTER TABLE public.cost_sheets
ADD COLUMN IF NOT EXISTS design_no VARCHAR(50);

ALTER TABLE public.cost_sheets
ADD COLUMN IF NOT EXISTS party_id UUID;

ALTER TABLE public.cost_sheets
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived'));

ALTER TABLE public.cost_sheets
ADD COLUMN IF NOT EXISTS created_by VARCHAR(150);

ALTER TABLE public.cost_sheets
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);

ALTER TABLE public.cost_sheets
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.cost_sheets
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================================================
-- 4. ENSURE PROPER COSTING DETAIL COLUMNS
-- ============================================================================

-- cost_sheet_lines columns
ALTER TABLE public.cost_sheet_lines
ADD COLUMN IF NOT EXISTS sequence INT;

ALTER TABLE public.cost_sheet_lines
ADD COLUMN IF NOT EXISTS yarn_id UUID;

ALTER TABLE public.cost_sheet_lines
ADD COLUMN IF NOT EXISTS warp_weft VARCHAR(10);

ALTER TABLE public.cost_sheet_lines
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.cost_sheet_lines
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- cost_sheet_charges columns
ALTER TABLE public.cost_sheet_charges
ADD COLUMN IF NOT EXISTS sequence INT;

ALTER TABLE public.cost_sheet_charges
ADD COLUMN IF NOT EXISTS charge_name VARCHAR(150);

ALTER TABLE public.cost_sheet_charges
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.cost_sheet_charges
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================================================
-- 5. DROP AND RECREATE RLS POLICIES WITH CORRECT COLUMN REFERENCES
-- ============================================================================

-- Drop old RLS policies from the old migration if they exist
-- (to avoid conflicts with new ones created in step10)
DROP POLICY IF EXISTS "cost_sheet_lines_admin_all_access" ON public.cost_sheet_lines;
DROP POLICY IF EXISTS "cost_sheet_lines_manager_operator_access" ON public.cost_sheet_lines;
DROP POLICY IF EXISTS "cost_sheet_lines_manager_operator_insert" ON public.cost_sheet_lines;
DROP POLICY IF EXISTS "cost_sheet_lines_manager_operator_update" ON public.cost_sheet_lines;
DROP POLICY IF EXISTS "cost_sheet_lines_admin_delete" ON public.cost_sheet_lines;
DROP POLICY IF EXISTS "cost_sheet_lines_viewer_select" ON public.cost_sheet_lines;

DROP POLICY IF EXISTS "cost_sheet_charges_admin_all_access" ON public.cost_sheet_charges;
DROP POLICY IF EXISTS "cost_sheet_charges_manager_operator_access" ON public.cost_sheet_charges;
DROP POLICY IF EXISTS "cost_sheet_charges_manager_operator_insert" ON public.cost_sheet_charges;
DROP POLICY IF EXISTS "cost_sheet_charges_manager_operator_update" ON public.cost_sheet_charges;
DROP POLICY IF EXISTS "cost_sheet_charges_admin_delete" ON public.cost_sheet_charges;
DROP POLICY IF EXISTS "cost_sheet_charges_viewer_select" ON public.cost_sheet_charges;

-- ============================================================================
-- 6. ENSURE RLS IS ENABLED
-- ============================================================================
ALTER TABLE public.cost_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_sheet_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_sheet_charges ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VALIDATION
-- ============================================================================
-- Test query to verify schema is correct:
-- SELECT csl.cost_sheet_id, csl.sequence, csc.cost_sheet_id
-- FROM public.cost_sheet_lines csl
-- JOIN public.cost_sheet_charges csc ON csl.cost_sheet_id = csc.cost_sheet_id;
--
-- All column names should now be standardized on cost_sheet_id (not sheet_id)
