-- STEP 24 PHASE 3: Sales Order Header Enhancement
-- Add warehouse, commercial snapshots, and credit override fields
-- Date: September 20, 2026

-- ============================================================================
-- ALTER TABLE: sales_orders — Add PHASE 3 columns
-- ============================================================================

ALTER TABLE public.sales_orders
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouse_locations(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS customer_name_snapshot VARCHAR(200),
ADD COLUMN IF NOT EXISTS broker_name_snapshot VARCHAR(200),
ADD COLUMN IF NOT EXISTS credit_override_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS credit_override_reason TEXT,
ADD COLUMN IF NOT EXISTS credit_override_approved_by VARCHAR(150),
ADD COLUMN IF NOT EXISTS credit_override_approved_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- ADD CONSTRAINT: Credit override audit integrity
-- ============================================================================
-- Ensure all credit override fields are filled together or all empty

ALTER TABLE public.sales_orders
ADD CONSTRAINT credit_override_integrity CHECK (
  (credit_override_approved = TRUE AND
   credit_override_reason IS NOT NULL AND
   credit_override_approved_by IS NOT NULL AND
   credit_override_approved_at IS NOT NULL)
  OR (credit_override_approved = FALSE)
);

-- ============================================================================
-- ADD INDEXES: Performance optimization
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_orders_warehouse_id
  ON public.sales_orders(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_sales_orders_credit_override
  ON public.sales_orders(credit_override_approved);

-- ============================================================================
-- MAKE warehouse_id NOT NULL after backfill (safer constraint)
-- ============================================================================
-- Note: This assumes existing orders will be backfilled with a default warehouse
-- For now, allow NULL during migration. PHASE 7 or later will enforce NOT NULL
-- after data reconciliation.

-- ============================================================================
-- RLS UPDATES: Ensure sales_orders RLS policies account for warehouse_id
-- ============================================================================
-- Existing RLS policies inherited from parent sales_orders table still apply
-- No changes needed unless warehouse-scoped permissions are added in PHASE 7

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Columns added: 7
--   - warehouse_id UUID (dispatch location)
--   - customer_name_snapshot VARCHAR (historical customer name)
--   - broker_name_snapshot VARCHAR (historical broker reference)
--   - credit_override_approved BOOLEAN
--   - credit_override_reason TEXT
--   - credit_override_approved_by VARCHAR (audit user)
--   - credit_override_approved_at TIMESTAMP (audit timestamp)
--
-- Constraints added: 1
--   - credit_override_integrity
--
-- Indexes added: 2
--   - idx_sales_orders_warehouse_id
--   - idx_sales_orders_credit_override
