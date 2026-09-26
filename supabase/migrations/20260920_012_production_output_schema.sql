-- STEP 2C Phase 1: Production Output Table
-- Records finished production output with quality grade
-- FIXED ORDERING: Positioned at 12 (after job_cards at 6, after quality_inspections at 11)
-- Dependencies: job_cards table (exists at position 6)

-- ============================================================================
-- 1. CREATE production_output TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.production_output (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_card_id UUID NOT NULL,
  output_qty DECIMAL(14, 4) NOT NULL,
  output_grade VARCHAR(20) NOT NULL CHECK (output_grade IN ('Grade A', 'Grade B', 'Grade C', 'Hold')),

  completed_by VARCHAR(150),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_job_card FOREIGN KEY (job_card_id)
    REFERENCES public.job_cards(id) ON DELETE CASCADE
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_production_output_job_card_id ON public.production_output(job_card_id);
CREATE INDEX IF NOT EXISTS idx_production_output_output_grade ON public.production_output(output_grade);
CREATE INDEX IF NOT EXISTS idx_production_output_completed_at ON public.production_output(completed_at DESC);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.production_output ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES - production_output
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_production_output" ON public.production_output
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- Operator: Create and read own output records
CREATE POLICY "operator_create_own_output" ON public.production_output
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'operator', 'manager')
    )
  );

CREATE POLICY "operator_read_output" ON public.production_output
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'operator', 'manager', 'viewer')
    )
  );

-- Manager: Update output records
CREATE POLICY "manager_update_output" ON public.production_output
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager')
    )
  );
