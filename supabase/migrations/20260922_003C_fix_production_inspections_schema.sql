-- STEP 3A CORRECTION: Production Inspections Schema Alignment
-- Adds missing columns and updates status enum to support RPC workflow
-- Date: September 22, 2026

-- ============================================================================
-- ADD MISSING FK: Job Card Link
-- Needed by RPC complete_quality_inspection() (line 278)
-- Links inspection back to originating production job
-- ============================================================================

ALTER TABLE public.production_inspections
ADD COLUMN IF NOT EXISTS job_card_id UUID REFERENCES public.job_cards(id) ON DELETE CASCADE;

-- ============================================================================
-- ADD MISSING COLUMNS: Grading Decision Tracking
-- Needed by RPC complete_quality_inspection() (lines 326-327)
-- ============================================================================

ALTER TABLE public.production_inspections
ADD COLUMN IF NOT EXISTS decision_by VARCHAR(150);

ALTER TABLE public.production_inspections
ADD COLUMN IF NOT EXISTS decision_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- UPDATE STATUS ENUM: Support RPC workflow states
-- Current: 'verified' | 'pending_supervisor'
-- RPC Expects: 'DRAFT' | 'COMPLETED' (line 288, 322)
-- Decision: Expand to support both old and new states during transition
-- ============================================================================

ALTER TABLE public.production_inspections
DROP CONSTRAINT IF EXISTS production_inspections_status_check;

ALTER TABLE public.production_inspections
ADD CONSTRAINT production_inspections_status_check
CHECK (status IN ('DRAFT', 'COMPLETED', 'verified', 'pending_supervisor'));

-- ============================================================================
-- CREATE INDEXES: For FK and decision tracking
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_production_inspections_job_card_id
ON public.production_inspections(job_card_id);

CREATE INDEX IF NOT EXISTS idx_production_inspections_decision_at
ON public.production_inspections(decision_at DESC);

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

/*
REASON FOR STATUS ENUM EXPANSION:
- Old code expected: 'verified' | 'pending_supervisor'
- RPC complete_quality_inspection() requires: 'DRAFT' | 'COMPLETED'
- Both states needed until all code migrated to RPC workflow

WORKFLOW:
1. New inspection created with status = 'DRAFT' (implicit default in RPC, line 288 checks for DRAFT)
2. Inspection examined and decision made
3. RPC complete_quality_inspection() updates status = 'COMPLETED' (line 322)
4. Result: saleable_inventory record created with final grade

FINAL TABLE ADDITIONS (post-correction):
  job_card_id UUID FK (RPC complete_quality_inspection line 278)
  decision_by VARCHAR(150) (RPC complete_quality_inspection line 326)
  decision_at TIMESTAMP (RPC complete_quality_inspection line 327)
  status supports 'DRAFT' | 'COMPLETED' (RPC expectations lines 288, 322)

RPC complete_quality_inspection() expectations: ✓ All columns available
*/
