-- STEP 23: Production Fabric Quality Management (M35)
-- Migrate 4-point textile inspection from localStorage to PostgreSQL

-- Create production_inspections table (replaces quality-store.inspections)
CREATE TABLE IF NOT EXISTS public.production_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_no VARCHAR(50) NOT NULL UNIQUE,
  roll_id UUID NOT NULL,
  roll_no VARCHAR(100) NOT NULL,
  item_code VARCHAR(100) NOT NULL,
  design_no VARCHAR(100) NOT NULL,
  loom_no VARCHAR(50) NOT NULL,
  shift VARCHAR(1) NOT NULL CHECK (shift IN ('A', 'B', 'C')),
  operator_name VARCHAR(200),

  roll_length_yd DECIMAL(10, 2) NOT NULL,
  roll_width_inch DECIMAL(10, 2) NOT NULL,

  defects JSONB DEFAULT '[]'::jsonb,
  total_raw_points DECIMAL(10, 2) NOT NULL,
  capped_points DECIMAL(10, 2) NOT NULL,
  points_per_100_sq_yd DECIMAL(10, 2) NOT NULL,
  system_grade VARCHAR(20) NOT NULL CHECK (system_grade IN ('Grade A', 'Grade B', 'Grade C', 'Hold')),

  manual_grade_override VARCHAR(20) CHECK (manual_grade_override IS NULL OR manual_grade_override IN ('Grade A', 'Grade B', 'Grade C', 'Hold')),
  override_reason TEXT,

  status VARCHAR(50) NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'pending_supervisor')),
  verified_by VARCHAR(200),

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150)
);

-- Create shade_approvals table (replaces quality-store.shadeDips)
CREATE TABLE IF NOT EXISTS public.shade_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lab_dip_no VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(200) NOT NULL,
  design_no VARCHAR(100) NOT NULL,
  shade_name VARCHAR(200) NOT NULL,
  hex_color VARCHAR(10),
  delta_e_value DECIMAL(10, 2) NOT NULL,

  status VARCHAR(50) NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending_buyer', 'rejected')),
  buyer_remarks TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150)
);

-- Create lab_tests table (replaces quality-store.labTests)
CREATE TABLE IF NOT EXISTS public.lab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_no VARCHAR(50) NOT NULL UNIQUE,
  roll_no VARCHAR(100) NOT NULL,

  gsm_actual DECIMAL(10, 2) NOT NULL,
  gsm_spec DECIMAL(10, 2) NOT NULL,
  tear_strength_warp DECIMAL(10, 2),
  tear_strength_weft DECIMAL(10, 2),
  shrinkage_pct DECIMAL(10, 2),

  status VARCHAR(50) NOT NULL DEFAULT 'pass' CHECK (status IN ('pass', 'fail')),

  is_active BOOLEAN DEFAULT TRUE,
  tested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150)
);

-- Create quality_hold_records table for audit trail of holds/releases
CREATE TABLE IF NOT EXISTS public.quality_hold_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_inspection_id UUID NOT NULL,
  roll_no VARCHAR(100) NOT NULL,
  hold_reason TEXT NOT NULL,
  held_by VARCHAR(150) NOT NULL,
  held_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_by VARCHAR(150),
  released_at TIMESTAMP WITH TIME ZONE,
  release_reason TEXT,

  CONSTRAINT fk_production_inspection FOREIGN KEY (production_inspection_id)
    REFERENCES public.production_inspections(id) ON DELETE CASCADE
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_production_inspections_inspection_no ON public.production_inspections(inspection_no);
CREATE INDEX IF NOT EXISTS idx_production_inspections_roll_no ON public.production_inspections(roll_no);
CREATE INDEX IF NOT EXISTS idx_production_inspections_system_grade ON public.production_inspections(system_grade);
CREATE INDEX IF NOT EXISTS idx_production_inspections_created_by ON public.production_inspections(created_by);
CREATE INDEX IF NOT EXISTS idx_production_inspections_created_at ON public.production_inspections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_inspections_is_active ON public.production_inspections(is_active);

CREATE INDEX IF NOT EXISTS idx_shade_approvals_lab_dip_no ON public.shade_approvals(lab_dip_no);
CREATE INDEX IF NOT EXISTS idx_shade_approvals_customer_name ON public.shade_approvals(customer_name);
CREATE INDEX IF NOT EXISTS idx_shade_approvals_status ON public.shade_approvals(status);
CREATE INDEX IF NOT EXISTS idx_shade_approvals_created_at ON public.shade_approvals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_tests_test_no ON public.lab_tests(test_no);
CREATE INDEX IF NOT EXISTS idx_lab_tests_roll_no ON public.lab_tests(roll_no);
CREATE INDEX IF NOT EXISTS idx_lab_tests_status ON public.lab_tests(status);
CREATE INDEX IF NOT EXISTS idx_lab_tests_created_at ON public.lab_tests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_hold_records_production_inspection_id ON public.quality_hold_records(production_inspection_id);
CREATE INDEX IF NOT EXISTS idx_quality_hold_records_roll_no ON public.quality_hold_records(roll_no);

-- RLS Policies for production_inspections
ALTER TABLE public.production_inspections ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "admin_full_access_inspections" ON public.production_inspections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- Operator: Create own inspections, read all
CREATE POLICY "operator_create_own_inspections" ON public.production_inspections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'operator', 'manager')
    )
  );

CREATE POLICY "operator_read_inspections" ON public.production_inspections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'operator', 'manager', 'viewer')
    )
  );

-- Manager: Override grades
CREATE POLICY "manager_update_inspections" ON public.production_inspections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- RLS Policies for shade_approvals
ALTER TABLE public.shade_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_shades" ON public.shade_approvals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

CREATE POLICY "lab_manage_shades" ON public.shade_approvals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'operator', 'manager')
    )
  );

CREATE POLICY "viewer_read_shades" ON public.shade_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'operator', 'manager', 'viewer')
    )
  );

-- RLS Policies for lab_tests
ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_lab_tests" ON public.lab_tests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

CREATE POLICY "lab_manage_tests" ON public.lab_tests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'operator', 'manager')
    )
  );

CREATE POLICY "viewer_read_tests" ON public.lab_tests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'operator', 'manager', 'viewer')
    )
  );

-- RLS Policies for quality_hold_records
ALTER TABLE public.quality_hold_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_holds" ON public.quality_hold_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

CREATE POLICY "manager_manage_holds" ON public.quality_hold_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager')
    )
  );

CREATE POLICY "staff_read_holds" ON public.quality_hold_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'operator', 'manager', 'viewer')
    )
  );
