-- STEP 15 Phase 2-6: Production Management System
-- Creates production_orders, job_cards, looms, daily_production, maintenance, audit trail

-- ============================================================================
-- 1. PRODUCTION ORDERS (Master Table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.production_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no VARCHAR(50) NOT NULL UNIQUE,
  cost_sheet_id UUID REFERENCES public.cost_sheets(id) ON DELETE SET NULL,
  design_no VARCHAR(50) NOT NULL,
  party_id UUID REFERENCES public.parties(id) ON DELETE RESTRICT,
  quality_name VARCHAR(200) NOT NULL,
  qty_metre DECIMAL(10,2) NOT NULL,

  priority VARCHAR(20) DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  target_delivery_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED', 'JOB_CARDS_ISSUED', 'IN_PROGRESS',
                      'COMPLETED', 'ARCHIVED', 'ON_HOLD', 'CANCELLED')),

  remarks TEXT,
  issued_date DATE,
  started_date DATE,
  completed_date DATE,
  qty_completed_metre DECIMAL(10,2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150),

  CONSTRAINT qty_metre_positive CHECK (qty_metre > 0),
  CONSTRAINT qty_completed_not_negative CHECK (qty_completed_metre >= 0)
);

CREATE INDEX idx_production_orders_order_no ON public.production_orders(order_no);
CREATE INDEX idx_production_orders_status ON public.production_orders(status);
CREATE INDEX idx_production_orders_party_id ON public.production_orders(party_id);
CREATE INDEX idx_production_orders_created_by ON public.production_orders(created_by);
CREATE INDEX idx_production_orders_cost_sheet_id ON public.production_orders(cost_sheet_id);

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
-- 3. LOOMS (Machine Master)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.looms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loom_no VARCHAR(50) NOT NULL UNIQUE,
  loom_type VARCHAR(100) NOT NULL,
  panna_inch DECIMAL(5,2) NOT NULL,
  reed_size DECIMAL(5,2),
  picks_per_minute DECIMAL(7,2),

  status VARCHAR(20) DEFAULT 'IDLE'
    CHECK (status IN ('IDLE', 'RUNNING', 'MAINTENANCE', 'BLOCKED', 'DECOMMISSIONED')),

  current_job_card_id UUID REFERENCES public.job_cards(id) ON DELETE SET NULL,
  assigned_operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  is_active BOOLEAN DEFAULT TRUE,
  remarks TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150)
);

CREATE INDEX idx_looms_loom_no ON public.looms(loom_no);
CREATE INDEX idx_looms_status ON public.looms(status);
CREATE INDEX idx_looms_is_active ON public.looms(is_active);
CREATE INDEX idx_looms_current_job_card_id ON public.looms(current_job_card_id);
CREATE INDEX idx_looms_assigned_operator_id ON public.looms(assigned_operator_id);

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
-- 5. PRODUCTION AUDIT TRAIL (Workflow History)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.production_audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,

  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name VARCHAR(150),

  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT action_valid CHECK (
    action IN ('ORDER_CREATED', 'ORDER_UPDATED', 'JOB_CARDS_ISSUED',
               'JOB_ASSIGNED', 'PRODUCTION_STARTED', 'PRODUCTION_LOGGED',
               'ORDER_COMPLETED', 'ORDER_ARCHIVED', 'STATUS_CHANGED')
  )
);

CREATE INDEX idx_production_audit_order_id ON public.production_audit_trail(order_id);
CREATE INDEX idx_production_audit_action ON public.production_audit_trail(action);
CREATE INDEX idx_production_audit_timestamp ON public.production_audit_trail(timestamp);

-- ============================================================================
-- 6. LOOM MAINTENANCE (Maintenance Scheduling)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.loom_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loom_id UUID NOT NULL REFERENCES public.looms(id) ON DELETE CASCADE,

  maintenance_type VARCHAR(50) NOT NULL,
  scheduled_start DATE NOT NULL,
  scheduled_end DATE NOT NULL,
  actual_start DATE,
  actual_end DATE,

  status VARCHAR(20) DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),

  description TEXT,
  spare_parts_used JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150)
);

CREATE INDEX idx_loom_maintenance_loom_id ON public.loom_maintenance(loom_id);
CREATE INDEX idx_loom_maintenance_status ON public.loom_maintenance(status);

-- ============================================================================
-- 7. RLS POLICIES - PRODUCTION ORDERS
-- ============================================================================

ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "admin_full_access_production_orders" ON public.production_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id = 'admin'
    )
  );

-- Manager: Create, view, update
CREATE POLICY "manager_manage_production_orders" ON public.production_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- Operator: Read-only
CREATE POLICY "operator_view_production_orders" ON public.production_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

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
-- 9. RLS POLICIES - LOOMS
-- ============================================================================

ALTER TABLE public.looms ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "admin_full_access_looms" ON public.looms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id = 'admin'
    )
  );

-- Manager: View and update
CREATE POLICY "manager_manage_looms" ON public.looms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- Operator: Read-only
CREATE POLICY "operator_view_looms" ON public.looms
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

-- ============================================================================
-- 11. RLS POLICIES - PRODUCTION AUDIT TRAIL
-- ============================================================================

ALTER TABLE public.production_audit_trail ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "admin_full_access_production_audit" ON public.production_audit_trail
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id = 'admin'
    )
  );

-- Manager: View
CREATE POLICY "manager_view_production_audit" ON public.production_audit_trail
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- ============================================================================
-- 12. RLS POLICIES - LOOM MAINTENANCE
-- ============================================================================

ALTER TABLE public.loom_maintenance ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "admin_full_access_loom_maintenance" ON public.loom_maintenance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id = 'admin'
    )
  );

-- Manager: Manage maintenance
CREATE POLICY "manager_manage_loom_maintenance" ON public.loom_maintenance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- Operator: View maintenance schedule
CREATE POLICY "operator_view_loom_maintenance" ON public.loom_maintenance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );
