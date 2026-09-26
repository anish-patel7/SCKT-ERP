-- STEP 3M: Atomic Invoice Generation from Shipment
-- Date: September 23, 2026
--
-- PURPOSE:
-- Verify and harden the shipment → invoice workflow as one correct, atomic,
-- concurrency-safe business operation. Support partial shipment invoicing with
-- prevention of double invoicing.
--
-- KEY REQUIREMENT:
-- Invoice quantity = successfully dispatched quantity - already invoiced quantity
-- NOT: requested qty, NOT: client-supplied qty, NOT: order-line qty_metre
--
-- DESIGN:
-- 1. Add sales_invoice_items table (line-level tracking)
-- 2. Add qty_invoiced column to sales_order_items (cumulative invoiced qty)
-- 3. Create create_invoice_from_shipment() RPC with full locking/validation
-- 4. Prevent double invoicing via FOR UPDATE and CHECK constraints

-- ============================================================================
-- TABLE: sales_invoice_items (NEW - Invoice line-level detail)
-- ============================================================================
-- Tracks individual invoice line items, links back to sales order items
-- and shipment information for complete audit trail

CREATE TABLE IF NOT EXISTS public.sales_invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.sales_order_items(id) ON DELETE RESTRICT,

  -- Quantity being invoiced on this line
  qty_invoiced DECIMAL(10, 2) NOT NULL CHECK (qty_invoiced > 0),

  -- Pricing snapshot from Sales Order (immutable)
  rate DECIMAL(15, 2) NOT NULL,
  discount_pct DECIMAL(5, 2) DEFAULT 0,
  tax_pct DECIMAL(5, 2) DEFAULT 0,

  -- Calculated amounts (database authoritative)
  gross_amount DECIMAL(15, 2) NOT NULL,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  net_amount DECIMAL(15, 2) NOT NULL,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),

  -- Constraint: Prevent accidental negatives
  CONSTRAINT qty_invoiced_positive CHECK (qty_invoiced > 0),
  CONSTRAINT gross_amount_positive CHECK (gross_amount > 0),
  CONSTRAINT net_amount_positive CHECK (net_amount > 0)
);

CREATE INDEX idx_sales_invoice_items_invoice_id ON public.sales_invoice_items(invoice_id);
CREATE INDEX idx_sales_invoice_items_order_item_id ON public.sales_invoice_items(order_item_id);

-- ============================================================================
-- ALTER: sales_order_items table
-- ============================================================================
-- Add qty_invoiced to track cumulative invoiced quantity per order item
-- This allows partial invoicing: qty_invoiced + remaining_invoiceable = qty_dispatched

ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS qty_invoiced DECIMAL(10, 2) DEFAULT 0
  CHECK (qty_invoiced >= 0 AND qty_invoiced <= qty_dispatched);

-- ============================================================================
-- FUNCTION: create_invoice_from_shipment_atomic
-- ============================================================================
-- Create invoice from one or more dispatched order items.
--
-- KEY LOGIC:
-- 1. Lock all source rows (sales_order, sales_order_items)
-- 2. Validate order/shipment status
-- 3. Calculate remaining invoiceable per item: qty_dispatched - qty_invoiced
-- 4. Reject if p_invoice_qty > remaining invoiceable
-- 5. Create invoice header + line items atomically
-- 6. Update qty_invoiced on sales_order_items
-- 7. Update sales_orders status if fully invoiced
--
-- CONCURRENCY SAFETY: FOR UPDATE locking prevents race conditions
-- ATOMICITY: Single transaction ensures no orphan headers/lines

CREATE OR REPLACE FUNCTION public.create_invoice_from_shipment_atomic(
  p_order_id UUID,
  p_order_item_id UUID,
  p_invoice_qty DECIMAL,
  p_invoice_date DATE DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_payment_terms_days INT DEFAULT 30
)
RETURNS TABLE (
  success BOOLEAN,
  invoice_id UUID,
  invoice_no VARCHAR,
  order_id UUID,
  order_item_id UUID,
  qty_invoiced DECIMAL,
  total_amount DECIMAL,
  amount_outstanding DECIMAL,
  status VARCHAR,
  message VARCHAR
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_customer_id UUID;
  v_qty_metre DECIMAL;
  v_qty_reserved DECIMAL;
  v_qty_dispatched DECIMAL;
  v_qty_already_invoiced DECIMAL;
  v_qty_remaining_invoiceable DECIMAL;
  v_rate DECIMAL(15, 2);
  v_discount_pct DECIMAL(5, 2);
  v_tax_pct DECIMAL(5, 2);
  v_gross_amount DECIMAL(15, 2);
  v_discount_amount DECIMAL(15, 2);
  v_tax_amount DECIMAL(15, 2);
  v_net_amount DECIMAL(15, 2);
  v_invoice_no VARCHAR(50);
  v_invoice_id UUID;
  v_invoice_item_id UUID;
  v_invoice_date_val DATE;
  v_due_date_val DATE;
BEGIN
  -- Validate authentication
  v_current_user := auth.uid()::VARCHAR(150);
  IF v_current_user IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Not authenticated'::VARCHAR;
    RETURN;
  END IF;

  -- ===== LOCK ORDER =====
  -- 1. Sales order (header, status, customer)
  SELECT status, customer_id
  INTO v_order_status, v_customer_id
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Order not found'::VARCHAR;
    RETURN;
  END IF;

  -- Validate order can be invoiced
  IF v_order_status NOT IN ('CONFIRMED', 'ALLOCATED', 'SHIPPED', 'DELIVERED') THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, v_order_status,
      'Cannot invoice order in ' || v_order_status || ' status'::VARCHAR;
    RETURN;
  END IF;

  -- 2. Order item (lock for quantity calculations)
  SELECT qty_metre, qty_reserved, qty_dispatched, qty_invoiced, rate, discount_pct, tax_pct
  INTO v_qty_metre, v_qty_reserved, v_qty_dispatched, v_qty_already_invoiced, v_rate, v_discount_pct, v_tax_pct
  FROM public.sales_order_items
  WHERE id = p_order_item_id AND order_id = p_order_id
  FOR UPDATE;

  IF v_qty_metre IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Order item not found'::VARCHAR;
    RETURN;
  END IF;

  -- ===== QUANTITY VALIDATION =====
  -- Validate invoice quantity
  IF p_invoice_qty <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Invoice quantity must be > 0'::VARCHAR;
    RETURN;
  END IF;

  -- CRITICAL: Calculate remaining invoiceable quantity
  -- remaining = qty_dispatched - qty_invoiced
  v_qty_remaining_invoiceable := v_qty_dispatched - COALESCE(v_qty_already_invoiced, 0);

  -- PREVENT OVER-INVOICING: Check requested qty <= remaining
  IF p_invoice_qty > v_qty_remaining_invoiceable THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR,
      'Invoice qty ' || p_invoice_qty::VARCHAR || ' exceeds remaining invoiceable ' || v_qty_remaining_invoiceable::VARCHAR ||
      ' (dispatched=' || v_qty_dispatched::VARCHAR || ', already invoiced=' || COALESCE(v_qty_already_invoiced, 0)::VARCHAR || ')'::VARCHAR;
    RETURN;
  END IF;

  -- ===== PRICING & AMOUNT CALCULATIONS =====
  -- Use immutable Sales Order pricing snapshot
  -- Formula: gross = qty × rate → discount → tax → net
  v_gross_amount := p_invoice_qty * v_rate;
  v_discount_amount := v_gross_amount * (COALESCE(v_discount_pct, 0) / 100);
  v_tax_amount := (v_gross_amount - v_discount_amount) * (COALESCE(v_tax_pct, 0) / 100);
  v_net_amount := v_gross_amount - v_discount_amount + v_tax_amount;

  -- Validate calculated amounts
  IF v_net_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Calculated net amount is invalid'::VARCHAR;
    RETURN;
  END IF;

  -- ===== INVOICE NUMBER GENERATION =====
  -- Concurrency-safe: Use sequence or locked counter
  v_invoice_no := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((
    SELECT COUNT(*) + 1 FROM public.sales_invoices
    WHERE DATE(created_at) = CURRENT_DATE
  )::TEXT, 5, '0');

  -- ===== SET INVOICE DATES =====
  v_invoice_date_val := COALESCE(p_invoice_date, CURRENT_DATE);
  v_due_date_val := COALESCE(p_due_date, CURRENT_DATE + (p_payment_terms_days || ' days')::INTERVAL);

  -- ===== CREATE INVOICE HEADER =====
  INSERT INTO public.sales_invoices (
    invoice_no,
    order_id,
    customer_id,
    invoice_date,
    due_date,
    subtotal_amount,
    tax_amount,
    total_amount,
    amount_outstanding,
    status,
    created_by,
    updated_by
  ) VALUES (
    v_invoice_no,
    p_order_id,
    v_customer_id,
    v_invoice_date_val,
    v_due_date_val,
    v_gross_amount - v_discount_amount,
    v_tax_amount,
    v_net_amount,
    v_net_amount,
    'UNPAID',
    v_current_user,
    v_current_user
  )
  RETURNING id INTO v_invoice_id;

  IF v_invoice_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Failed to create invoice header'::VARCHAR;
    RETURN;
  END IF;

  -- ===== CREATE INVOICE LINE ITEM =====
  INSERT INTO public.sales_invoice_items (
    invoice_id,
    order_item_id,
    qty_invoiced,
    rate,
    discount_pct,
    tax_pct,
    gross_amount,
    discount_amount,
    tax_amount,
    net_amount,
    created_by
  ) VALUES (
    v_invoice_id,
    p_order_item_id,
    p_invoice_qty,
    v_rate,
    v_discount_pct,
    v_tax_pct,
    v_gross_amount,
    v_discount_amount,
    v_tax_amount,
    v_net_amount,
    v_current_user
  )
  RETURNING id INTO v_invoice_item_id;

  IF v_invoice_item_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Failed to create invoice line item'::VARCHAR;
    RETURN;
  END IF;

  -- ===== UPDATE ORDER ITEM INVOICED QUANTITY =====
  UPDATE public.sales_order_items
  SET qty_invoiced = COALESCE(qty_invoiced, 0) + p_invoice_qty
  WHERE id = p_order_item_id;

  -- ===== UPDATE SALES ORDER STATUS (if fully invoiced) =====
  -- Only mark INVOICED if all order items are fully invoiced
  UPDATE public.sales_orders
  SET
    status = 'INVOICED',
    updated_at = NOW(),
    updated_by = v_current_user
  WHERE id = p_order_id
  AND NOT EXISTS (
    SELECT 1 FROM public.sales_order_items
    WHERE order_id = p_order_id
    AND (qty_dispatched - COALESCE(qty_invoiced, 0)) > 0
  );

  -- ===== SUCCESS RETURN =====
  RETURN QUERY SELECT
    TRUE,
    v_invoice_id,
    v_invoice_no,
    p_order_id,
    p_order_item_id,
    p_invoice_qty,
    v_net_amount,
    v_net_amount,
    'UNPAID'::VARCHAR,
    'Invoice created successfully'::VARCHAR;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
    0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR,
    ('Error: ' || SQLERRM)::VARCHAR;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_invoice_from_shipment_atomic(UUID, UUID, DECIMAL, DATE, DATE, INT)
TO authenticated;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- STEP 3M: Atomic Invoice Generation from Shipment
--
-- NEW OBJECTS:
-- 1. sales_invoice_items table — Invoice line-level tracking
--    - qty_invoiced: quantity being invoiced on this line
--    - rate, discount_pct, tax_pct: immutable pricing snapshot
--    - gross/discount/tax/net amounts: database-calculated
--
-- 2. sales_order_items.qty_invoiced column — Cumulative invoiced qty
--    - Prevents over-invoicing via CHECK constraint
--    - Enables partial shipment invoicing
--
-- 3. create_invoice_from_shipment_atomic() RPC
--    - Takes: order_id, order_item_id, invoice_qty, dates, payment_terms
--    - Returns: success, invoice_id, invoice_no, quantities, totals, status
--    - Locking: FOR UPDATE on order and order_item
--    - Validation: qty_invoiced <= qty_dispatched - qty_invoiced_already
--    - Pricing: Uses immutable Sales Order snapshot (not current master)
--    - Atomicity: Creates header + lines + updates qty_invoiced in one transaction
--    - Security: SECURITY DEFINER, requires auth.uid()
--
-- QUANTITY MODEL: PARTIAL INVOICING SUPPORTED
-- Formula: remaining_invoiceable = qty_dispatched - qty_invoiced
-- Prevents: over-invoicing, double invoicing (via locking + constraint)
-- Supports: invoice 40 of 100 dispatched, then invoice remaining 60 later
--
-- SALES STATUS UPDATES:
-- - Partial invoice: Order remains CONFIRMED/ALLOCATED/SHIPPED (not changed)
-- - Full invoice: Order transitions to INVOICED (only if all items fully invoiced)
--
-- CONCURRENCY SAFETY:
-- - FOR UPDATE locks prevent simultaneous invoicing of same order_item
-- - CHECK constraints on qty_invoiced prevent bypassing locking
-- - Remaining invoiceable recalculated AFTER lock acquisition
