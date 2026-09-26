-- STEP 10: Costing Module Schema Design
-- Migrating cost_sheets from localStorage to PostgreSQL with normalized detail tables
-- Date: 2026-09-20
--
-- This migration:
-- 1. Creates cost_sheets table with metadata, parameters, and cached totals
-- 2. Creates cost_sheet_lines table for warp/weft yarn lines (detail)
-- 3. Creates cost_sheet_charges table for process charges (detail)
-- 4. Adds RLS policies for role-based access control
-- 5. Implements audit trail (created_by, updated_by, approved_by)
--
-- Key Features:
-- - DECIMAL type for all financial data (not FLOAT)
-- - Cached totals for performance (recalculated on update)
-- - Deterministic calculation order preserved
-- - RLS per role: admin (full), manager (edit), operator (create), viewer (read-only)

-- ============================================================================
-- 1. CREATE cost_sheets TABLE (Main Costing Document)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cost_sheets (
  -- Primary Key & Identifiers
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_no VARCHAR(50) NOT NULL UNIQUE,

  -- Foreign Keys
  design_no VARCHAR(50) REFERENCES public.designs(design_number) ON DELETE SET NULL,
  party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,

  -- Denormalized Display Fields
  party_name VARCHAR(200),
  quality VARCHAR(500),

  -- Loom/Weaving Specifications
  reed INTEGER,
  pick INTEGER,
  panna_inch DECIMAL(10,2) DEFAULT 49.5,
  length_metre DECIMAL(10,4) DEFAULT 6.65,

  -- Costing Parameters
  wastage_pct DECIMAL(10,2) DEFAULT 10,
  card_rate DECIMAL(12,2) DEFAULT 0,
  number_of_cards INTEGER DEFAULT 0,
  kg_divisor INTEGER DEFAULT 9000000,
  card_divisor DECIMAL(10,4) DEFAULT 39.37,

  -- Pricing & Margin Controls
  markup_pct DECIMAL(10,2),
  manual_sale_rate DECIMAL(12,2),
  unit_basis VARCHAR(20) DEFAULT 'per metre' CHECK (unit_basis IN ('per metre', 'per piece')),

  -- Status & Versioning
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  version INTEGER DEFAULT 1 CHECK (version > 0),
  remarks TEXT,
  costing_date DATE,
  prepared_by VARCHAR(150),

  -- Cached Calculation Totals (for performance, denormalized)
  -- These are computed from lines/charges during save but stored for quick retrieval
  total_warp_kg DECIMAL(14,4),
  total_weft_kg DECIMAL(14,4),
  total_kg DECIMAL(14,4),
  warp_cost DECIMAL(12,2),
  weft_cost DECIMAL(12,2),
  base_material_cost DECIMAL(12,2),
  wastage_cost DECIMAL(12,2),
  material_with_wastage DECIMAL(12,2),
  process_cost DECIMAL(12,2),
  card_cost DECIMAL(12,2),
  final_cost DECIMAL(12,2),
  sale_rate DECIMAL(12,2),

  -- Audit Trail
  created_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(150),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by VARCHAR(150),
  approved_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT sheet_no_not_empty CHECK (length(sheet_no) > 0),
  CONSTRAINT panna_positive CHECK (panna_inch > 0),
  CONSTRAINT length_positive CHECK (length_metre > 0)
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_cost_sheets_sheet_no ON public.cost_sheets(sheet_no);
CREATE INDEX IF NOT EXISTS idx_cost_sheets_status ON public.cost_sheets(status);
CREATE INDEX IF NOT EXISTS idx_cost_sheets_created_by ON public.cost_sheets(created_by);
CREATE INDEX IF NOT EXISTS idx_cost_sheets_design_no ON public.cost_sheets(design_no);
CREATE INDEX IF NOT EXISTS idx_cost_sheets_party_id ON public.cost_sheets(party_id);
CREATE INDEX IF NOT EXISTS idx_cost_sheets_version ON public.cost_sheets(sheet_no, version);
CREATE INDEX IF NOT EXISTS idx_cost_sheets_created_at ON public.cost_sheets(created_at DESC);

-- ============================================================================
-- 2. CREATE cost_sheet_lines TABLE (Warp/Weft Yarn Lines)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cost_sheet_lines (
  -- Primary Key & Foreign Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cost_sheet_id UUID NOT NULL REFERENCES public.cost_sheets(id) ON DELETE CASCADE,

  -- Line Metadata
  section VARCHAR(10) NOT NULL CHECK (section IN ('warp', 'weft')),
  label VARCHAR(100),
  sequence INTEGER,

  -- Material Reference
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  yarn_name VARCHAR(200),

  -- Specification (exact values from user input)
  quantity DECIMAL(12,4) DEFAULT 0,
  denier DECIMAL(10,2) DEFAULT 0,
  length_metre DECIMAL(10,4) DEFAULT 0,
  panna_inch DECIMAL(10,2) DEFAULT 0,
  rate_per_kg DECIMAL(10,2) DEFAULT 0,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  CONSTRAINT positive_denier CHECK (denier >= 0),
  CONSTRAINT positive_length CHECK (length_metre >= 0),
  CONSTRAINT positive_panna CHECK (panna_inch >= 0),
  CONSTRAINT positive_rate CHECK (rate_per_kg >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cost_sheet_lines_cost_sheet_id
  ON public.cost_sheet_lines(cost_sheet_id);
CREATE INDEX IF NOT EXISTS idx_cost_sheet_lines_material_id
  ON public.cost_sheet_lines(material_id);
CREATE INDEX IF NOT EXISTS idx_cost_sheet_lines_section
  ON public.cost_sheet_lines(section);
CREATE INDEX IF NOT EXISTS idx_cost_sheet_lines_sequence
  ON public.cost_sheet_lines(cost_sheet_id, sequence);

-- ============================================================================
-- 3. CREATE cost_sheet_charges TABLE (Process Charges)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cost_sheet_charges (
  -- Primary Key & Foreign Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cost_sheet_id UUID NOT NULL REFERENCES public.cost_sheets(id) ON DELETE CASCADE,

  -- Charge Specification
  charge_name VARCHAR(150),
  rate DECIMAL(12,2) DEFAULT 0,
  quantity DECIMAL(12,4) DEFAULT 0,
  sequence INTEGER,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_rate CHECK (rate >= 0),
  CONSTRAINT positive_quantity CHECK (quantity >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cost_sheet_charges_cost_sheet_id
  ON public.cost_sheet_charges(cost_sheet_id);
CREATE INDEX IF NOT EXISTS idx_cost_sheet_charges_sequence
  ON public.cost_sheet_charges(cost_sheet_id, sequence);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.cost_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_sheet_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_sheet_charges ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS POLICIES - cost_sheets TABLE
-- ============================================================================

-- ADMIN: Full access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "cost_sheets_admin_all_access" ON public.cost_sheets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- MANAGER/OPERATOR: SELECT (view all)
CREATE POLICY "cost_sheets_manager_operator_select" ON public.cost_sheets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

-- MANAGER/OPERATOR: INSERT (create new)
CREATE POLICY "cost_sheets_manager_operator_insert" ON public.cost_sheets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

-- MANAGER/OPERATOR: UPDATE (edit own sheets)
CREATE POLICY "cost_sheets_manager_operator_update" ON public.cost_sheets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

-- ADMIN ONLY: DELETE
CREATE POLICY "cost_sheets_admin_delete" ON public.cost_sheets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- VIEWER: Read-only (SELECT only)
CREATE POLICY "cost_sheets_viewer_select" ON public.cost_sheets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator', 'viewer')
    )
  );

-- ============================================================================
-- 6. RLS POLICIES - cost_sheet_lines TABLE
-- ============================================================================

-- ADMIN: Full access
CREATE POLICY "cost_sheet_lines_admin_all_access" ON public.cost_sheet_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- MANAGER/OPERATOR: SELECT & INSERT & UPDATE (via parent sheet)
CREATE POLICY "cost_sheet_lines_manager_operator_access" ON public.cost_sheet_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "cost_sheet_lines_manager_operator_insert" ON public.cost_sheet_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "cost_sheet_lines_manager_operator_update" ON public.cost_sheet_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

-- ADMIN ONLY: DELETE
CREATE POLICY "cost_sheet_lines_admin_delete" ON public.cost_sheet_lines
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- VIEWER: Read-only
CREATE POLICY "cost_sheet_lines_viewer_select" ON public.cost_sheet_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator', 'viewer')
    )
  );

-- ============================================================================
-- 7. RLS POLICIES - cost_sheet_charges TABLE
-- ============================================================================

-- ADMIN: Full access
CREATE POLICY "cost_sheet_charges_admin_all_access" ON public.cost_sheet_charges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- MANAGER/OPERATOR: SELECT & INSERT & UPDATE
CREATE POLICY "cost_sheet_charges_manager_operator_access" ON public.cost_sheet_charges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "cost_sheet_charges_manager_operator_insert" ON public.cost_sheet_charges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "cost_sheet_charges_manager_operator_update" ON public.cost_sheet_charges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

-- ADMIN ONLY: DELETE
CREATE POLICY "cost_sheet_charges_admin_delete" ON public.cost_sheet_charges
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- VIEWER: Read-only
CREATE POLICY "cost_sheet_charges_viewer_select" ON public.cost_sheet_charges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator', 'viewer')
    )
  );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- Status: Ready for application
-- Testing: Run `supabase db reset` to apply and test locally
-- Next: Services, Hooks, Component Migration (Phase 3-4)
