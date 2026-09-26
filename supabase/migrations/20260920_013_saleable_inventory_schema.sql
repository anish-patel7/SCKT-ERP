-- STEP 2C Phase 2: Saleable Inventory Table
-- Gates which inventory can be sold based on quality grade decision
-- FIXED ORDERING: Positioned at 13 (after production_inspections at 11, after production_output at 12)
-- Dependencies: production_inspections table (exists at position 11)

-- ============================================================================
-- 1. CREATE saleable_inventory TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saleable_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_inspection_id UUID NOT NULL,
  final_grade VARCHAR(20) NOT NULL CHECK (final_grade IN ('Grade A', 'Grade B', 'Grade C', 'Hold')),
  saleable_qty DECIMAL(14, 4) NOT NULL,
  available_qty DECIMAL(14, 4) NOT NULL DEFAULT 0,

  decision_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  decided_by VARCHAR(150),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_production_inspection FOREIGN KEY (production_inspection_id)
    REFERENCES public.production_inspections(id) ON DELETE CASCADE
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_saleable_inventory_production_inspection_id
  ON public.saleable_inventory(production_inspection_id);
CREATE INDEX IF NOT EXISTS idx_saleable_inventory_final_grade
  ON public.saleable_inventory(final_grade);
CREATE INDEX IF NOT EXISTS idx_saleable_inventory_available_qty
  ON public.saleable_inventory(available_qty) WHERE available_qty > 0;
CREATE INDEX IF NOT EXISTS idx_saleable_inventory_decision_at
  ON public.saleable_inventory(decision_at DESC);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.saleable_inventory ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES - saleable_inventory
-- ============================================================================

-- Admin: Full access
CREATE POLICY "admin_full_access_saleable_inventory" ON public.saleable_inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- QA/Quality: Create saleable inventory records after inspection
CREATE POLICY "qa_create_saleable_inventory" ON public.saleable_inventory
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

-- Sales: Read available inventory (Grade A only can issue)
CREATE POLICY "sales_read_saleable_inventory" ON public.saleable_inventory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator', 'viewer')
    )
  );

-- QA/Manager: Update available_qty as items are issued/returned
CREATE POLICY "qa_manager_update_saleable_inventory" ON public.saleable_inventory
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager')
    )
  );
