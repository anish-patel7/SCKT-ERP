-- ============================================================================
-- PART 3: DISPATCH & FULFILLMENT OPERATIONS
-- Atomic operations for stock reservation confirmation and shipment
-- Date: September 21, 2026
-- ============================================================================

-- ============================================================================
-- RPC 1: Confirm Stock Reservation (Lock Allocated Stock)
-- Atomically transitions from reservation to confirmed allocation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_stock_reservation(
  p_order_id UUID,
  p_confirmed_by VARCHAR(150) DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  status VARCHAR(50),
  total_reserved DECIMAL,
  confirmed_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_total_reserved DECIMAL;
  v_line_record RECORD;
BEGIN
  -- Default confirmed_by to current user if not provided
  IF p_confirmed_by IS NULL THEN
    v_current_user := auth.uid()::VARCHAR(150);
  ELSE
    v_current_user := p_confirmed_by;
  END IF;

  -- Validate order exists and is in CONFIRMED status
  SELECT status
  INTO v_order_status
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_order_status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'Cannot confirm reservation for order % in % status (must be CONFIRMED)', p_order_id, v_order_status;
  END IF;

  -- Validate all lines have reservations
  FOR v_line_record IN
    SELECT id, reserved_quantity
    FROM public.sales_order_items
    WHERE order_id = p_order_id
    AND reserved_quantity = 0
  LOOP
    RAISE EXCEPTION 'Order line % has no reservation', v_line_record.id;
  END LOOP;

  -- Update order status to ALLOCATED (ready for picking)
  UPDATE public.sales_orders
  SET
    status = 'ALLOCATED',
    allocated_at = NOW(),
    allocated_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Calculate total reserved for response
  SELECT COALESCE(SUM(reserved_quantity), 0)
  INTO v_total_reserved
  FROM public.sales_order_items
  WHERE order_id = p_order_id;

  -- Return confirmation summary
  RETURN QUERY
  SELECT
    p_order_id,
    'ALLOCATED'::VARCHAR(50),
    v_total_reserved,
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC 2: Create Shipment (Pick & Pack Operations)
-- Atomically marks items as picked/packed and creates shipment record
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_shipment(
  p_order_id UUID,
  p_warehouse_id UUID,
  p_shipping_address TEXT,
  p_carrier_name VARCHAR(150) DEFAULT NULL,
  p_tracking_number VARCHAR(100) DEFAULT NULL,
  p_prepared_by VARCHAR(150) DEFAULT NULL
)
RETURNS TABLE (
  shipment_id UUID,
  order_id UUID,
  status VARCHAR(50),
  total_qty_packed DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_shipment_id UUID;
  v_total_qty DECIMAL;
  v_line_record RECORD;
BEGIN
  -- Default prepared_by to current user if not provided
  IF p_prepared_by IS NULL THEN
    v_current_user := auth.uid()::VARCHAR(150);
  ELSE
    v_current_user := p_prepared_by;
  END IF;

  -- Validate order exists and is in ALLOCATED status
  SELECT status
  INTO v_order_status
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_order_status <> 'ALLOCATED' THEN
    RAISE EXCEPTION 'Cannot create shipment for order % in % status (must be ALLOCATED)', p_order_id, v_order_status;
  END IF;

  -- Create shipment record
  INSERT INTO public.shipments (
    order_id,
    warehouse_id,
    status,
    shipping_address,
    carrier_name,
    tracking_number,
    created_by,
    created_at
  ) VALUES (
    p_order_id,
    p_warehouse_id,
    'PICKED',
    p_shipping_address,
    p_carrier_name,
    p_tracking_number,
    v_current_user,
    NOW()
  )
  RETURNING id INTO v_shipment_id;

  -- Update order items: set dispatched_quantity = reserved_quantity
  -- This represents items that have been picked and packed
  UPDATE public.sales_order_items
  SET
    dispatched_quantity = reserved_quantity,
    shipment_id = v_shipment_id,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE order_id = p_order_id;

  -- Calculate total packed quantity
  SELECT COALESCE(SUM(dispatched_quantity), 0)
  INTO v_total_qty
  FROM public.sales_order_items
  WHERE order_id = p_order_id;

  -- Update order status to SHIPPED
  UPDATE public.sales_orders
  SET
    status = 'DISPATCHED',
    dispatched_at = NOW(),
    dispatched_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Return shipment summary
  RETURN QUERY
  SELECT
    v_shipment_id,
    p_order_id,
    'PICKED'::VARCHAR(50),
    v_total_qty,
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC 3: Confirm Shipment In-Transit
-- Marks shipment as dispatched (in-transit to customer)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_shipment_dispatch(
  p_shipment_id UUID,
  p_carrier_name VARCHAR(150) DEFAULT NULL,
  p_tracking_number VARCHAR(100) DEFAULT NULL,
  p_dispatched_by VARCHAR(150) DEFAULT NULL
)
RETURNS TABLE (
  shipment_id UUID,
  order_id UUID,
  status VARCHAR(50),
  dispatched_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_shipment_status VARCHAR;
  v_order_id UUID;
BEGIN
  -- Default dispatched_by to current user if not provided
  IF p_dispatched_by IS NULL THEN
    v_current_user := auth.uid()::VARCHAR(150);
  ELSE
    v_current_user := p_dispatched_by;
  END IF;

  -- Validate shipment exists and is in PICKED status
  SELECT status, order_id
  INTO v_shipment_status, v_order_id
  FROM public.shipments
  WHERE id = p_shipment_id
  FOR UPDATE;

  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Shipment not found: %', p_shipment_id;
  END IF;

  IF v_shipment_status <> 'PICKED' THEN
    RAISE EXCEPTION 'Cannot dispatch shipment % in % status (must be PICKED)', p_shipment_id, v_shipment_status;
  END IF;

  -- Update shipment status to IN_TRANSIT
  UPDATE public.shipments
  SET
    status = 'IN_TRANSIT',
    carrier_name = COALESCE(p_carrier_name, carrier_name),
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    dispatched_at = NOW(),
    dispatched_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_shipment_id;

  -- Return dispatch confirmation
  RETURN QUERY
  SELECT
    p_shipment_id,
    v_order_id,
    'IN_TRANSIT'::VARCHAR(50),
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC 4: Confirm Shipment Delivery
-- Marks shipment as delivered, finalizes inventory decrement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_shipment_delivery(
  p_shipment_id UUID,
  p_delivered_by VARCHAR(150) DEFAULT NULL
)
RETURNS TABLE (
  shipment_id UUID,
  order_id UUID,
  status VARCHAR(50),
  delivered_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_shipment_status VARCHAR;
  v_order_id UUID;
  v_line_record RECORD;
BEGIN
  -- Default delivered_by to current user if not provided
  IF p_delivered_by IS NULL THEN
    v_current_user := auth.uid()::VARCHAR(150);
  ELSE
    v_current_user := p_delivered_by;
  END IF;

  -- Validate shipment exists and is IN_TRANSIT
  SELECT status, order_id
  INTO v_shipment_status, v_order_id
  FROM public.shipments
  WHERE id = p_shipment_id
  FOR UPDATE;

  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Shipment not found: %', p_shipment_id;
  END IF;

  IF v_shipment_status <> 'IN_TRANSIT' THEN
    RAISE EXCEPTION 'Cannot confirm delivery for shipment % in % status (must be IN_TRANSIT)', p_shipment_id, v_shipment_status;
  END IF;

  -- Atomically decrement inventory for dispatched items
  -- This removes items from available stock (already reserved, now actually leaving warehouse)
  FOR v_line_record IN
    SELECT inventory_item_id, dispatched_quantity
    FROM public.sales_order_items
    WHERE shipment_id = p_shipment_id
    AND dispatched_quantity > 0
  LOOP
    -- Decrement total_qty (physical stock leaves warehouse)
    UPDATE public.inventory_items
    SET
      total_qty = total_qty - v_line_record.dispatched_quantity,
      reserved_qty = reserved_qty - v_line_record.dispatched_quantity,
      updated_at = NOW()
    WHERE id = v_line_record.inventory_item_id;

    -- Create transaction ledger entry
    INSERT INTO public.inventory_transactions (
      item_id,
      movement_type,
      qty_change,
      reference_doc,
      reference_type,
      created_by,
      created_at
    ) VALUES (
      v_line_record.inventory_item_id,
      'dispatch',
      -v_line_record.dispatched_quantity,
      p_shipment_id::TEXT,
      'shipment',
      v_current_user,
      NOW()
    );
  END LOOP;

  -- Update shipment status to DELIVERED
  UPDATE public.shipments
  SET
    status = 'DELIVERED',
    delivered_at = NOW(),
    delivered_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_shipment_id;

  -- Update order status to FULFILLED
  UPDATE public.sales_orders
  SET
    status = 'DELIVERED',
    delivered_at = NOW(),
    delivered_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = v_order_id;

  -- Return delivery confirmation
  RETURN QUERY
  SELECT
    p_shipment_id,
    v_order_id,
    'DELIVERED'::VARCHAR(50),
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC 5: Generate Invoice (Financial Document)
-- Creates immutable invoice from confirmed sales order
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_invoice(
  p_order_id UUID,
  p_invoice_date DATE DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_generated_by VARCHAR(150) DEFAULT NULL
)
RETURNS TABLE (
  invoice_id UUID,
  invoice_number VARCHAR(50),
  order_id UUID,
  total_amount NUMERIC,
  status VARCHAR(50),
  generated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_invoice_id UUID;
  v_invoice_no VARCHAR(50);
  v_total_amount NUMERIC;
  v_customer_name VARCHAR(200);
  v_customer_id UUID;
BEGIN
  -- Default generated_by to current user if not provided
  IF p_generated_by IS NULL THEN
    v_current_user := auth.uid()::VARCHAR(150);
  ELSE
    v_current_user := p_generated_by;
  END IF;

  -- Validate order exists and is DISPATCHED (shipped)
  SELECT status, total_amount, customer_id, customer_name_snapshot
  INTO v_order_status, v_total_amount, v_customer_id, v_customer_name
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_order_status <> 'DISPATCHED' THEN
    RAISE EXCEPTION 'Cannot generate invoice for order % in % status (must be DISPATCHED)', p_order_id, v_order_status;
  END IF;

  -- Generate invoice number (sequential)
  v_invoice_no := 'INV-' || TO_CHAR(NOW(), 'YYYY-MM-DD-') || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 6, '0');

  -- Create invoice record
  INSERT INTO public.invoices (
    invoice_number,
    order_id,
    customer_id,
    customer_name_snapshot,
    subtotal_amount,
    tax_amount,
    total_amount,
    invoice_date,
    due_date,
    status,
    created_by,
    created_at
  ) VALUES (
    v_invoice_no,
    p_order_id,
    v_customer_id,
    v_customer_name,
    (SELECT COALESCE(SUM(line_total), 0) FROM public.sales_order_items WHERE order_id = p_order_id),
    (SELECT COALESCE((SELECT tax_amount FROM public.sales_orders WHERE id = p_order_id), 0)),
    v_total_amount,
    COALESCE(p_invoice_date, NOW()::DATE),
    COALESCE(p_due_date, (NOW() + INTERVAL '30 days')::DATE),
    'DRAFT',
    v_current_user,
    NOW()
  )
  RETURNING id INTO v_invoice_id;

  -- Update order status to INVOICED
  UPDATE public.sales_orders
  SET
    status = 'INVOICED',
    invoice_id = v_invoice_id,
    invoiced_at = NOW(),
    invoiced_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Return invoice summary
  RETURN QUERY
  SELECT
    v_invoice_id,
    v_invoice_no,
    p_order_id,
    v_total_amount,
    'DRAFT'::VARCHAR(50),
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC 6: Record Payment (AR Settlement)
-- Atomically records payment and updates order status to PAID
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_payment(
  p_invoice_id UUID,
  p_amount_paid NUMERIC,
  p_payment_method VARCHAR(50),
  p_reference_number VARCHAR(100) DEFAULT NULL,
  p_payment_date DATE DEFAULT NULL,
  p_recorded_by VARCHAR(150) DEFAULT NULL
)
RETURNS TABLE (
  payment_id UUID,
  invoice_id UUID,
  amount_paid NUMERIC,
  status VARCHAR(50),
  recorded_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_invoice_status VARCHAR;
  v_payment_id UUID;
  v_order_id UUID;
  v_invoice_total NUMERIC;
  v_paid_to_date NUMERIC;
BEGIN
  -- Default recorded_by to current user if not provided
  IF p_recorded_by IS NULL THEN
    v_current_user := auth.uid()::VARCHAR(150);
  ELSE
    v_current_user := p_recorded_by;
  END IF;

  -- Validate invoice exists and is DRAFT (not paid)
  SELECT status, order_id, total_amount
  INTO v_invoice_status, v_order_id, v_invoice_total
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice_status IS NULL THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  IF v_invoice_status NOT IN ('DRAFT', 'SENT') THEN
    RAISE EXCEPTION 'Cannot record payment for invoice % in % status', p_invoice_id, v_invoice_status;
  END IF;

  -- Validate payment amount doesn't exceed invoice total
  SELECT COALESCE(SUM(amount_paid), 0)
  INTO v_paid_to_date
  FROM public.payments
  WHERE invoice_id = p_invoice_id
  AND status NOT IN ('REVERSED', 'FAILED');

  IF (v_paid_to_date + p_amount_paid) > v_invoice_total THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds invoice total (%). Already paid: %',
      p_amount_paid, v_invoice_total, v_paid_to_date;
  END IF;

  -- Create payment record
  INSERT INTO public.payments (
    invoice_id,
    amount_paid,
    payment_method,
    reference_number,
    payment_date,
    status,
    created_by,
    created_at
  ) VALUES (
    p_invoice_id,
    p_amount_paid,
    p_payment_method,
    p_reference_number,
    COALESCE(p_payment_date, NOW()::DATE),
    'COMPLETED',
    v_current_user,
    NOW()
  )
  RETURNING id INTO v_payment_id;

  -- If full payment received, update invoice to PAID
  IF (v_paid_to_date + p_amount_paid) >= v_invoice_total THEN
    UPDATE public.invoices
    SET
      status = 'PAID',
      paid_amount = v_paid_to_date + p_amount_paid,
      paid_at = NOW(),
      updated_by = v_current_user,
      updated_at = NOW()
    WHERE id = p_invoice_id;

    -- Update order status to PAID
    UPDATE public.sales_orders
    SET
      status = 'PAID',
      paid_at = NOW(),
      paid_by = v_current_user,
      updated_by = v_current_user,
      updated_at = NOW()
    WHERE id = v_order_id;
  ELSE
    -- Partial payment - update invoice to PARTIAL
    UPDATE public.invoices
    SET
      status = 'PARTIAL',
      paid_amount = v_paid_to_date + p_amount_paid,
      updated_by = v_current_user,
      updated_at = NOW()
    WHERE id = p_invoice_id;
  END IF;

  -- Return payment summary
  RETURN QUERY
  SELECT
    v_payment_id,
    p_invoice_id,
    p_amount_paid,
    'COMPLETED'::VARCHAR(50),
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEQUENCE FOR INVOICE NUMBERING
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1000 INCREMENT BY 1;

-- ============================================================================
-- NEW TABLES FOR PART 3
-- ============================================================================

-- Shipments tracking
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouse_locations(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL DEFAULT 'PICKED' CHECK (status IN ('PICKED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED')),
  shipping_address TEXT NOT NULL,
  carrier_name VARCHAR(150),
  tracking_number VARCHAR(100),
  created_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dispatched_at TIMESTAMP WITH TIME ZONE,
  dispatched_by VARCHAR(150),
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivered_by VARCHAR(150),
  updated_by VARCHAR(150),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices (financial documents)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
  customer_name_snapshot VARCHAR(200),
  subtotal_amount NUMERIC(12, 2) NOT NULL,
  tax_amount NUMERIC(12, 2) DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL,
  paid_amount NUMERIC(12, 2) DEFAULT 0,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED')),
  created_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  updated_by VARCHAR(150),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments (AR settlement)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount_paid NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('CASH', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT_CARD', 'DIGITAL_WALLET')),
  reference_number VARCHAR(100),
  payment_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'PENDING', 'FAILED', 'REVERSED')),
  created_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(150),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_warehouse_id ON public.shipments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date);

-- ============================================================================
-- UPDATE sales_orders TABLE TO LINK NEW TABLES
-- ============================================================================

ALTER TABLE public.sales_orders
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id),
ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS allocated_by VARCHAR(150),
ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS dispatched_by VARCHAR(150),
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_by VARCHAR(150),
ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invoiced_by VARCHAR(150),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paid_by VARCHAR(150);

-- ============================================================================
-- UPDATE sales_order_items TABLE FOR DISPATCH TRACKING
-- ============================================================================

ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES public.shipments(id);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 6 Critical Atomic RPCs created for PART 3:
--
-- 1. confirm_stock_reservation() - Transitions from CONFIRMED to ALLOCATED
-- 2. create_shipment() - Creates shipment and marks items as picked/packed
-- 3. confirm_shipment_dispatch() - Transitions to IN_TRANSIT
-- 4. confirm_shipment_delivery() - Atomically decrements inventory on delivery
-- 5. generate_invoice() - Creates immutable financial document
-- 6. record_payment() - Settles AR and marks order PAID
--
-- New Tables:
-- - shipments: Tracks picking, packing, dispatch, delivery
-- - invoices: Immutable financial documents
-- - payments: AR settlement records (append-only)
--
-- All operations are atomic with SECURITY DEFINER and proper constraints
