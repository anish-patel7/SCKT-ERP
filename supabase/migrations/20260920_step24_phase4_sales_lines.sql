-- STEP 24 PHASE 4: Sales Order Lines Enhancement
-- Add design, costing, inventory, and reservation references + quantity tracking
-- Date: September 20, 2026

-- ============================================================================
-- ALTER TABLE: sales_order_items — Add PHASE 4 columns
-- ============================================================================

ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS design_id UUID REFERENCES public.designs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS design_no_snapshot VARCHAR(50),
ADD COLUMN IF NOT EXISTS design_name_snapshot VARCHAR(200),
ADD COLUMN IF NOT EXISTS cost_sheet_id UUID REFERENCES public.cost_sheets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cost_sheet_no_snapshot VARCHAR(50),
ADD COLUMN IF NOT EXISTS qty_reserved DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS approved_sale_rate DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(150),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS stock_reservation_id UUID REFERENCES public.stock_reservations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS qty_dispatched DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);

-- ============================================================================
-- ADD CONSTRAINTS: Quantity integrity
-- ============================================================================

ALTER TABLE public.sales_order_items
ADD CONSTRAINT qty_reserved_check CHECK (qty_reserved >= 0 AND qty_reserved <= qty_metre),
ADD CONSTRAINT qty_dispatched_check CHECK (qty_dispatched >= 0 AND qty_dispatched <= qty_metre);

-- Note: Other constraints already exist in current schema:
-- - qty_positive: qty_metre > 0
-- - qty_allocated_check: qty_allocated >= 0 AND qty_allocated <= qty_metre
-- - qty_shipped_check: qty_shipped >= 0 AND qty_shipped <= qty_allocated

-- ============================================================================
-- ADD INDEXES: Performance optimization
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_order_items_design_id
  ON public.sales_order_items(design_id);

CREATE INDEX IF NOT EXISTS idx_sales_order_items_cost_sheet_id
  ON public.sales_order_items(cost_sheet_id);

CREATE INDEX IF NOT EXISTS idx_sales_order_items_inventory_item_id
  ON public.sales_order_items(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_sales_order_items_stock_reservation_id
  ON public.sales_order_items(stock_reservation_id);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Columns added: 14
--   - design_id UUID (FK to designs)
--   - design_no_snapshot VARCHAR (historical design number)
--   - design_name_snapshot VARCHAR (historical design name)
--   - cost_sheet_id UUID (FK to cost_sheets for approved pricing)
--   - cost_sheet_no_snapshot VARCHAR (historical costing reference)
--   - qty_reserved DECIMAL (allocated from stock_reservations)
--   - approved_sale_rate DECIMAL (snapshot of approved pricing)
--   - approved_by VARCHAR (audit: who approved pricing)
--   - approved_at TIMESTAMP (audit: when approved)
--   - inventory_item_id UUID (FK to inventory_items for allocation)
--   - stock_reservation_id UUID (FK to stock_reservations for tracking)
--   - qty_dispatched DECIMAL (sum of dispatch_items quantities)
--   - updated_at TIMESTAMP (for optimistic locking)
--   - updated_by VARCHAR (audit trail)
--
-- Constraints added: 2
--   - qty_reserved_check
--   - qty_dispatched_check
--
-- Indexes added: 4
--   - idx_sales_order_items_design_id
--   - idx_sales_order_items_cost_sheet_id
--   - idx_sales_order_items_inventory_item_id
--   - idx_sales_order_items_stock_reservation_id
