-- STEP 3A CORRECTION: Production Output Schema Alignment
-- Fixes column naming and missing FK to match complete_job_output() RPC expectations
-- Date: September 22, 2026

-- ============================================================================
-- RENAME COLUMNS: Align with RPC parameter expectations
-- ============================================================================

-- Rename output_qty to qty_produced (RPC line 179 inserts into qty_produced)
ALTER TABLE public.production_output
RENAME COLUMN output_qty TO qty_produced;

-- Rename output_grade to grade (RPC line 180 inserts into grade)
ALTER TABLE public.production_output
RENAME COLUMN output_grade TO grade;

-- Rename completed_by to created_by (RPC line 181 inserts into created_by, not completed_by)
ALTER TABLE public.production_output
RENAME COLUMN completed_by TO created_by;

-- ============================================================================
-- DROP COLUMN: completed_at (RPC uses created_at, not completed_at)
-- Job card tracks job completion, not output recording
-- ============================================================================

ALTER TABLE public.production_output
DROP COLUMN IF EXISTS completed_at;

-- ============================================================================
-- ADD MISSING FK: output_item_id (RPC line 178 inserts into output_item_id)
-- ============================================================================

ALTER TABLE public.production_output
ADD COLUMN IF NOT EXISTS output_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT;

-- Create index for FK query performance
CREATE INDEX IF NOT EXISTS idx_production_output_output_item_id
ON public.production_output(output_item_id);

-- ============================================================================
-- UPDATE INDEX: Reflects renamed grade column
-- ============================================================================

DROP INDEX IF EXISTS idx_production_output_output_grade;
CREATE INDEX IF NOT EXISTS idx_production_output_grade
ON public.production_output(grade);

-- ============================================================================
-- VERIFY CHECK CONSTRAINT: Now uses grade column name
-- ============================================================================

-- Drop old constraint with output_grade reference
ALTER TABLE public.production_output
DROP CONSTRAINT IF EXISTS production_output_output_grade_check;

-- Add constraint using grade column
ALTER TABLE public.production_output
ADD CONSTRAINT production_output_grade_check
CHECK (grade IN ('Grade A', 'Grade B', 'Grade C', 'Hold'));

-- ============================================================================
-- VERIFY FK CONSTRAINT: job_card_id unchanged
-- ============================================================================

-- Constraint fk_job_card remains valid (job_card_id not renamed)

-- ============================================================================
-- FINAL TABLE STRUCTURE (post-correction)
-- ============================================================================

/*
production_output:
  id UUID PK
  job_card_id UUID FK (not changed)
  output_item_id UUID FK (newly added)
  qty_produced DECIMAL(14,4) (renamed from output_qty)
  grade VARCHAR(20) (renamed from output_grade)
  created_by VARCHAR(150) (renamed from completed_by)
  created_at TIMESTAMP (unchanged)
  updated_at TIMESTAMP (unchanged)

RPC complete_job_output() INSERT expectations: ✓ All match
RPC complete_quality_inspection() SELECT expectations: ✓ All match
*/
