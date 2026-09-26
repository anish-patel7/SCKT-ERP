-- STEP 3A CORRECTION: Job Cards Schema Alignment
-- Adds missing columns needed by issue_material_to_production() and complete_job_output() RPCs
-- Date: September 22, 2026

-- ============================================================================
-- ADD MISSING COLUMNS: Material Issuance Tracking
-- Needed by RPC issue_material_to_production() (lines 104-107)
-- ============================================================================

ALTER TABLE public.job_cards
ADD COLUMN IF NOT EXISTS material_issued_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.job_cards
ADD COLUMN IF NOT EXISTS material_issued_by VARCHAR(150);

-- ============================================================================
-- ADD MISSING COLUMNS: Job Completion Tracking
-- Needed by RPC complete_job_output() (lines 220-226)
-- ============================================================================

ALTER TABLE public.job_cards
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.job_cards
ADD COLUMN IF NOT EXISTS completed_by VARCHAR(150);

-- ============================================================================
-- ADD MISSING FK: Output Item Identification
-- Needed by RPC complete_quality_inspection() (line 293)
-- Links job card to inventory item it will produce
-- ============================================================================

ALTER TABLE public.job_cards
ADD COLUMN IF NOT EXISTS output_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL;

-- ============================================================================
-- CREATE INDEXES: For FK and frequent queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_job_cards_output_item_id
ON public.job_cards(output_item_id);

CREATE INDEX IF NOT EXISTS idx_job_cards_material_issued_at
ON public.job_cards(material_issued_at);

CREATE INDEX IF NOT EXISTS idx_job_cards_completed_at
ON public.job_cards(completed_at);

-- ============================================================================
-- FINAL TABLE ADDITIONS (post-correction)
-- ============================================================================

/*
job_cards additions:
  material_issued_at TIMESTAMP (RPC issue_material_to_production line 104)
  material_issued_by VARCHAR(150) (RPC issue_material_to_production line 105)
  completed_at TIMESTAMP (RPC complete_job_output line 223)
  completed_by VARCHAR(150) (RPC complete_job_output line 224)
  output_item_id UUID FK (RPC complete_quality_inspection line 293)

RPC issue_material_to_production() expectations: ✓ All columns available
RPC complete_job_output() expectations: ✓ All columns available
RPC complete_quality_inspection() expectations: ✓ output_item_id available
*/
