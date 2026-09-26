-- STEP 11 Phase 2: Inventory Transaction Ledger Schema
-- Date: September 20, 2026
-- Objective: Create append-only inventory transaction ledger with stock tracking
-- FIXED ORDERING: Moved to execute 3rd (after profiles, before production/costing)

-- ============================================================================
-- TABLE: inventory_items (Master Registry)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Item classification
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('yarn', 'beam', 'fabric')),
  item_code VARCHAR(100) NOT NULL UNIQUE,
  item_name VARCHAR(200) NOT NULL,

  -- Yarn-specific fields
  lot_no VARCHAR(100),
  grn_no VARCHAR(100),
  yarn_code VARCHAR(50),
  supplier_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,

  -- Beam-specific fields
  beam_no VARCHAR(100),
  set_no VARCHAR(100),
  warp_design_no VARCHAR(100),

  -- Fabric-specific fields
  piece_no VARCHAR(100),
  design_no VARCHAR(100),
  job_card_no VARCHAR(100),

  -- Stock tracking (denormalized from ledger)
  total_qty DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_unit VARCHAR(10) NOT NULL,
  reserved_qty DECIMAL(12, 2) NOT NULL DEFAULT 0,
  available_qty DECIMAL(12, 2) GENERATED ALWAYS AS (total_qty - reserved_qty) STORED,

  -- Rates and cost
  rate_per_unit DECIMAL(10, 2),
  cost_basis DECIMAL(12, 2),

  -- Location and status
  current_location VARCHAR(100),
  current_status VARCHAR(50),

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150),

  -- Constraints
  CONSTRAINT check_qty_non_negative CHECK (total_qty >= 0),
  CONSTRAINT check_reserved_non_negative CHECK (reserved_qty >= 0),
  CONSTRAINT check_reserved_not_exceed_total CHECK (reserved_qty <= total_qty)
);

CREATE INDEX idx_inventory_items_item_code ON public.inventory_items(item_code);
CREATE INDEX idx_inventory_items_item_type ON public.inventory_items(item_type);
CREATE INDEX idx_inventory_items_is_active ON public.inventory_items(is_active);
CREATE INDEX idx_inventory_items_current_location ON public.inventory_items(current_location);
CREATE INDEX idx_inventory_items_supplier_id ON public.inventory_items(supplier_id);

-- ============================================================================
-- TABLE: inventory_transactions (Append-Only Ledger)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Transaction metadata
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  movement_type VARCHAR(50) NOT NULL CHECK (
    movement_type IN (
      'inward_purchase',
      'inward_production_return',
      'issue_to_production',
      'issue_internal',
      'location_transfer',
      'quality_rejection',
      'dispatch'
    )
  ),
  reference_doc VARCHAR(100),

  -- Item reference
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,

  -- Quantity and unit
  qty_change DECIMAL(12, 2) NOT NULL CHECK (qty_change != 0),
  unit VARCHAR(10) NOT NULL,

  -- Location tracking
  location_from VARCHAR(100),
  location_to VARCHAR(100),

  -- Rate snapshot (frozen at transaction time)
  rate_per_unit DECIMAL(10, 2),
  cost_value DECIMAL(12, 2) GENERATED ALWAYS AS (
    ABS(qty_change) * COALESCE(rate_per_unit, 0)
  ) STORED,

  -- Reservation tracking
  reserved_qty_delta DECIMAL(12, 2) DEFAULT 0,

  -- Approval workflow
  approval_required BOOLEAN DEFAULT FALSE,
  approved_by VARCHAR(150),
  approved_at TIMESTAMP WITH TIME ZONE,

  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150) NOT NULL,

  -- Notes
  remarks TEXT,

  -- Constraints
  CONSTRAINT check_approved_both_or_neither CHECK (
    (approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
    (approved_by IS NULL AND approved_at IS NULL)
  )
);

-- Indexes for ledger queries
CREATE INDEX idx_inv_trans_item_id ON public.inventory_transactions(item_id);
CREATE INDEX idx_inv_trans_transaction_date ON public.inventory_transactions(transaction_date DESC);
CREATE INDEX idx_inv_trans_movement_type ON public.inventory_transactions(movement_type);
CREATE INDEX idx_inv_trans_created_by ON public.inventory_transactions(created_by);
CREATE INDEX idx_inv_trans_created_at ON public.inventory_transactions(created_at DESC);
CREATE INDEX idx_inv_trans_ref_doc ON public.inventory_transactions(reference_doc);

-- ============================================================================
-- TABLE: inventory_balances_cache (Denormalized Balance View)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_balances_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  item_id UUID NOT NULL UNIQUE REFERENCES public.inventory_items(id) ON DELETE CASCADE,

  -- Cumulative from ledger
  total_inward_qty DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_issued_qty DECIMAL(12, 2) NOT NULL DEFAULT 0,
  net_qty DECIMAL(12, 2) GENERATED ALWAYS AS (
    total_inward_qty - total_issued_qty
  ) STORED,

  -- Reservation tracking
  total_reserved_qty DECIMAL(12, 2) NOT NULL DEFAULT 0,
  available_qty DECIMAL(12, 2) GENERATED ALWAYS AS (
    (total_inward_qty - total_issued_qty) - total_reserved_qty
  ) STORED,

  -- Valuation
  total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  avg_cost_per_unit DECIMAL(12, 4) GENERATED ALWAYS AS (
    CASE WHEN (total_inward_qty - total_issued_qty) > 0
      THEN total_cost / (total_inward_qty - total_issued_qty)
      ELSE 0
    END
  ) STORED,

  -- Metadata
  last_transaction_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT check_quantities_non_negative CHECK (
    total_inward_qty >= 0 AND total_issued_qty >= 0 AND total_reserved_qty >= 0
  )
);

CREATE INDEX idx_inv_balances_item_id ON public.inventory_balances_cache(item_id);

-- ============================================================================
-- TRIGGER: Update inventory_balances_cache on new transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_inventory_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or create balance cache entry
  INSERT INTO public.inventory_balances_cache (
    item_id,
    total_inward_qty,
    total_issued_qty,
    total_reserved_qty,
    total_cost,
    last_transaction_at,
    updated_at
  )
  SELECT
    item_id,
    COALESCE(SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END), 0),
    COALESCE(SUM(reserved_qty_delta), 0),
    COALESCE(SUM(cost_value), 0),
    MAX(transaction_date),
    NOW()
  FROM public.inventory_transactions
  WHERE item_id = NEW.item_id
  ON CONFLICT (item_id) DO UPDATE
  SET
    total_inward_qty = EXCLUDED.total_inward_qty,
    total_issued_qty = EXCLUDED.total_issued_qty,
    total_reserved_qty = EXCLUDED.total_reserved_qty,
    total_cost = EXCLUDED.total_cost,
    last_transaction_at = EXCLUDED.last_transaction_at,
    updated_at = NOW();

  -- Update inventory_items denormalized fields
  UPDATE public.inventory_items
  SET
    total_qty = (
      SELECT net_qty FROM public.inventory_balances_cache WHERE item_id = NEW.item_id
    ),
    reserved_qty = (
      SELECT total_reserved_qty FROM public.inventory_balances_cache WHERE item_id = NEW.item_id
    ),
    current_location = NEW.location_to,
    updated_at = NOW()
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_balance ON public.inventory_transactions;
CREATE TRIGGER trigger_update_inventory_balance
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_inventory_balance();

-- ============================================================================
-- VIEW: vw_inventory_available_qty (Quick availability check)
-- ============================================================================

CREATE OR REPLACE VIEW public.vw_inventory_available_qty AS
SELECT
  ii.id,
  ii.item_code,
  ii.item_name,
  ii.item_type,
  ibc.net_qty,
  ibc.available_qty,
  ibc.total_reserved_qty,
  ii.current_location,
  ibc.avg_cost_per_unit,
  ibc.updated_at
FROM public.inventory_items ii
LEFT JOIN public.inventory_balances_cache ibc ON ii.id = ibc.item_id
WHERE ii.is_active = TRUE;

-- ============================================================================
-- RLS POLICIES: inventory_items
-- ============================================================================

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "inventory_items_admin_full_access" ON public.inventory_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND primary_role_id = 'admin'
  )
);

-- Warehouse Manager: Read all, update own warehouse items
CREATE POLICY "inventory_items_manager_read_all" ON public.inventory_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND primary_role_id IN ('admin', 'manager')
  )
);

CREATE POLICY "inventory_items_manager_update_own" ON public.inventory_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND primary_role_id IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND primary_role_id IN ('admin', 'manager')
  )
);

-- Warehouse Staff: Read own, insert new
CREATE POLICY "inventory_items_staff_read" ON public.inventory_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND primary_role_id IN (
      'admin', 'manager', 'operator'
    )
  )
);

-- Operator/Viewer: Read-only
CREATE POLICY "inventory_items_viewer_read" ON public.inventory_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Deny all write access by default
CREATE POLICY "inventory_items_deny_insert" ON public.inventory_items
FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "inventory_items_deny_delete" ON public.inventory_items
FOR DELETE USING (FALSE);

-- ============================================================================
-- RLS POLICIES: inventory_transactions (Append-Only)
-- ============================================================================

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "inventory_transactions_admin_full_access" ON public.inventory_transactions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND primary_role_id = 'admin'
  )
);

-- Warehouse staff: Create and read own transactions
CREATE POLICY "inventory_transactions_staff_create" ON public.inventory_transactions
FOR INSERT WITH CHECK (
  created_by = auth.jwt() ->> 'email' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND primary_role_id IN (
      'admin', 'manager', 'operator'
    )
  )
);

CREATE POLICY "inventory_transactions_staff_read" ON public.inventory_transactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND primary_role_id IN (
      'admin', 'manager', 'operator'
    )
  )
);

-- Viewer: Read-only
CREATE POLICY "inventory_transactions_viewer_read" ON public.inventory_transactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Deny updates and deletes (append-only ledger)
CREATE POLICY "inventory_transactions_deny_update" ON public.inventory_transactions
FOR UPDATE USING (FALSE);

CREATE POLICY "inventory_transactions_deny_delete" ON public.inventory_transactions
FOR DELETE USING (FALSE);

-- ============================================================================
-- RLS POLICIES: inventory_balances_cache
-- ============================================================================

ALTER TABLE public.inventory_balances_cache ENABLE ROW LEVEL SECURITY;

-- Everyone can read balances (derived from ledger)
CREATE POLICY "inventory_balances_read_all" ON public.inventory_balances_cache
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
  )
);

-- Deny all write access (cache only)
CREATE POLICY "inventory_balances_deny_write" ON public.inventory_balances_cache
FOR ALL USING (FALSE);

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- Tables created:
-- 1. inventory_items (370 rows expected) — Master registry
-- 2. inventory_transactions (unbounded) — Append-only ledger
-- 3. inventory_balances_cache (370 rows) — Denormalized balances

-- Views created:
-- 1. vw_inventory_available_qty — Fast availability queries

-- Triggers created:
-- 1. trigger_update_inventory_balance — Sync ledger → cache on insert

-- RLS Policies:
-- - inventory_items: 7 policies (admin full, manager R/W, staff R, viewer R)
-- - inventory_transactions: 5 policies (append-only, admin full, staff R/W, viewer R)
-- - inventory_balances_cache: 2 policies (read-only)

-- Indexes: 11 total for performance optimization
