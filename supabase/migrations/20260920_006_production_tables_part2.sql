-- STEP 15 Phase 2-6: Production Management System (PART 2)
-- Creates job_cards (WITH loom_id reference), adds circular FK to looms, creates daily_production
-- FIXED ORDERING: Now job_cards CAN reference looms (part1 created looms)

-- ============================================================================
-- 2. JOB CARDS (Atomic Generation, Append-Only References)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_no VARCHAR(50) NOT NULL UNIQUE,
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE RESTRICT,
  sequence_number INT NOT NULL,

  loom_id UUID REFERENCES public.looms(id) ON DELETE SET NULL,
  qty_metre DECIMAL(10,2) NOT NULL,

  status VARCHAR(20) DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),

  issued_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,

  feeder_notes TEXT,
  material_requirements JSONB DEFAULT '{}'::jsonb,
  remarks TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150),

  CONSTRAINT qty_metre_positive CHECK (qty_metre > 0)
);

CREATE INDEX idx_job_cards_card_no ON public.job_cards(card_no);
CREATE INDEX idx_job_cards_production_order_id ON public.job_cards(production_order_id);
CREATE INDEX idx_job_cards_loom_id ON public.job_cards(loom_id);
CREATE INDEX idx_job_cards_status ON public.job_cards(status);
CREATE INDEX idx_job_cards_created_by ON public.job_cards(created_by);

-- ============================================================================
-- ADD CIRCULAR FK: looms.current_job_card_id (NOW BOTH TABLES EXIST)
-- ============================================================================

ALTER TABLE public.looms
ADD COLUMN IF NOT EXISTS current_job_card_id UUID REFERENCES public.job_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_looms_current_job_card_id ON public.looms(current_job_card_id);

-- ============================================================================
-- 4. DAILY PRODUCTION (Append-Only Ledger)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_production (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL,
  shift VARCHAR(1) NOT NULL CHECK (shift IN ('A', 'B', 'C')),

  job_card_id UUID NOT NULL REFERENCES public.job_cards(id) ON DELETE RESTRICT,
  loom_id UUID NOT NULL REFERENCES public.looms(id) ON DELETE RESTRICT,

  metre_produced DECIMAL(10,2) NOT NULL,
  yarn_kg_used DECIMAL(10,2) NOT NULL,
  downtime_min INT DEFAULT 0,
  downtime_reason VARCHAR(255),

  quality_grade VARCHAR(10),
  remarks TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recorded_by VARCHAR(150) NOT NULL,

  CONSTRAINT metre_produced_positive CHECK (metre_produced > 0),
  CONSTRAINT yarn_kg_positive CHECK (yarn_kg_used > 0),
  CONSTRAINT downtime_non_negative CHECK (downtime_min >= 0)
);

CREATE INDEX idx_daily_production_entry_date ON public.daily_production(entry_date);
CREATE INDEX idx_daily_production_shift ON public.daily_production(shift);
CREATE INDEX idx_daily_production_job_card_id ON public.daily_production(job_card_id);
CREATE INDEX idx_daily_production_loom_id ON public.daily_production(loom_id);
CREATE INDEX idx_daily_production_recorded_by ON public.daily_production(recorded_by);
CREATE UNIQUE INDEX idx_daily_production_unique_shift
  ON public.daily_production(job_card_id, loom_id, entry_date, shift);

-- ============================================================================
-- 8. RLS POLICIES - JOB CARDS
-- ============================================================================

ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "admin_full_access_job_cards" ON public.job_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id = 'admin'
    )
  );

-- Manager: Manage job cards
CREATE POLICY "manager_manage_job_cards" ON public.job_cards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- Operator: Read-only
CREATE POLICY "operator_view_job_cards" ON public.job_cards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

-- ============================================================================
-- 10. RLS POLICIES - DAILY PRODUCTION
-- ============================================================================

ALTER TABLE public.daily_production ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "admin_full_access_daily_production" ON public.daily_production
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id = 'admin'
    )
  );

-- Manager: View
CREATE POLICY "manager_view_daily_production" ON public.daily_production
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- Operator: Create and view own entries
CREATE POLICY "operator_create_daily_production" ON public.daily_production
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "operator_view_daily_production" ON public.daily_production
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );
