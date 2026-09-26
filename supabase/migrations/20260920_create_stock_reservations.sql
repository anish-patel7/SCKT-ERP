-- STEP 14 Phase 5: Stock Reservation System
-- Create stock_reservations table for tracking reserved inventory

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL,
  qty_reserved DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  reserved_by VARCHAR(150) NOT NULL,
  reservation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approval_status VARCHAR(50) DEFAULT 'PENDING',
  approved_by VARCHAR(150),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  reference_doc VARCHAR(100),
  remarks TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150),
  CONSTRAINT fk_item FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT check_qty_positive CHECK (qty_reserved > 0),
  CONSTRAINT check_approval_status CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stock_reservations_item_id ON public.stock_reservations(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_approval_status ON public.stock_reservations(approval_status);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_reserved_by ON public.stock_reservations(reserved_by);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_reservation_date ON public.stock_reservations(reservation_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires_at ON public.stock_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_item_status ON public.stock_reservations(item_id, approval_status);

-- RLS Policies
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

-- Admin: Full access
CREATE POLICY "admin_full_access_reservations" ON public.stock_reservations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- Manager: Can view, create, and approve/reject
CREATE POLICY "manager_view_reservations" ON public.stock_reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager')
    )
  );

CREATE POLICY "manager_create_reservations" ON public.stock_reservations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager')
    )
  );

CREATE POLICY "manager_update_reservations" ON public.stock_reservations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- Operator: Can view and create own reservations
CREATE POLICY "operator_view_reservations" ON public.stock_reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "operator_create_reservations" ON public.stock_reservations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
    AND reserved_by = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Add reserved_qty column to inventory_items for tracking
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS reserved_qty DECIMAL(10, 2) DEFAULT 0;

-- Index on reserved_qty for quick lookup
CREATE INDEX IF NOT EXISTS idx_inventory_items_reserved_qty ON public.inventory_items(reserved_qty);
