-- ============================================================================
-- MIGRATION 006E: Backend blockers 1-4
-- Date: 2026-09-26
-- Run after 006A-006D. Plain $$ quoting (Supabase SQL editor safe). Re-runnable.
--
-- 1. Payment / invoice RPCs checked only that the caller was signed in.
--    record_payment_atomic, allocate_payment_atomic and
--    create_invoice_from_shipment_atomic (SECURITY DEFINER, used by the app) now
--    require sales:update - the same rule create_invoice_from_order and
--    record_payment(5-arg) already apply. The legacy record_payment(6-arg) and
--    generate_invoice take a caller-supplied actor name and are not used by the
--    app: API roles lose EXECUTE on them. anon loses EXECUTE on all of them.
-- 2. Cost sheet "New Version" always failed: versions reuse the sheet number but
--    cost_sheets.sheet_no was UNIQUE. Uniqueness is now (sheet_no, version).
-- 3. Only admins could create inventory items (a deny_insert policy plus
--    admin-only access). Users with inventory:write may now create items with
--    zero stock (stock arrives only through the ledger) and delete an item that
--    has no transactions (used to roll back a failed first receipt). The
--    no-op permissive deny_insert / deny_delete policies are removed.
-- 4. parties.party_type did not exist, so the Party Master tab (Job / Purchase /
--    Sell) was never saved. Added with a check constraint; existing rows default
--    to 'Job Party' (what the screen already showed for them).
--
-- Rollback notes:
--   1. re-apply the functions from 006B / 20260923_003N_*; GRANT EXECUTE back.
--   2. ALTER TABLE cost_sheets DROP CONSTRAINT cost_sheets_sheet_no_version_key,
--      ADD CONSTRAINT cost_sheets_sheet_no_key UNIQUE (sheet_no);
--   3. DROP POLICY inventory_items_create / inventory_items_delete_unused.
--   4. ALTER TABLE parties DROP COLUMN party_type;
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Payment / invoice RPC authorization
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_payment_atomic(p_customer_id uuid, p_amount numeric, p_payment_method character varying, p_reference_number character varying DEFAULT NULL::character varying, p_payment_date date DEFAULT NULL::date, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, payment_id uuid, payment_number character varying, customer_id uuid, amount numeric, allocated_amount numeric, unallocated_amount numeric, status character varying, message character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_payment_id UUID;
  v_payment_number VARCHAR(50);
  v_payment_date_val DATE;
BEGIN
  -- 006E: payments and invoices require sales:update (not just a signed-in user).
  IF auth.uid() IS NULL OR NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update is required' USING ERRCODE = '42501';
  END IF;
  -- Validate authentication
  v_current_user := auth.uid()::VARCHAR(150);
  IF v_current_user IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_customer_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Not authenticated'::VARCHAR;
    RETURN;
  END IF;

  -- Validate customer exists
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_customer_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Customer not found'::VARCHAR;
    RETURN;
  END IF;

  -- Validate payment amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_customer_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Payment amount must be positive'::VARCHAR;
    RETURN;
  END IF;

  -- Set payment date
  v_payment_date_val := COALESCE(p_payment_date, CURRENT_DATE);

  -- Generate payment number
  v_payment_number := 'PAY-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((
    SELECT COUNT(*) + 1 FROM public.sales_payments
    WHERE DATE(created_at) = CURRENT_DATE
  )::TEXT, 5, '0');

  -- Create payment record
  INSERT INTO public.sales_payments (
    payment_number,
    customer_id,
    payment_date,
    amount_paid,
    payment_method,
    reference_number,
    remarks,
    status,
    created_by
  ) VALUES (
    v_payment_number,
    p_customer_id,
    v_payment_date_val,
    p_amount,
    p_payment_method,
    p_reference_number,
    p_remarks,
    'RECEIVED',
    v_current_user
  )
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_customer_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Failed to create payment'::VARCHAR;
    RETURN;
  END IF;

  -- Success
  RETURN QUERY SELECT
    TRUE,
    v_payment_id,
    v_payment_number,
    p_customer_id,
    p_amount,
    0::DECIMAL,
    p_amount,
    'RECEIVED'::VARCHAR,
    'Payment recorded successfully'::VARCHAR;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_customer_id, 0::DECIMAL,
    0::DECIMAL, 0::DECIMAL, NULL::VARCHAR,
    ('Error: ' || SQLERRM)::VARCHAR;
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_payment_atomic(p_payment_id uuid, p_invoice_id uuid, p_allocated_amount numeric)
 RETURNS TABLE(success boolean, allocation_id uuid, payment_id uuid, invoice_id uuid, allocated_amount numeric, payment_remaining numeric, invoice_paid numeric, invoice_outstanding numeric, invoice_status character varying, message character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  v_current_user VARCHAR(150);
  v_payment_customer_id UUID;
  v_payment_amount DECIMAL(15, 2);
  v_payment_status VARCHAR(20);  -- ← FIXED: Was missing, now declared
  v_payment_allocated_total DECIMAL(15, 2);
  v_payment_remaining DECIMAL(15, 2);
  v_invoice_customer_id UUID;
  v_invoice_total DECIMAL(15, 2);
  v_invoice_amount_paid DECIMAL(15, 2);
  v_invoice_amount_outstanding DECIMAL(15, 2);
  v_new_invoice_paid DECIMAL(15, 2);
  v_new_invoice_outstanding DECIMAL(15, 2);
  v_new_invoice_status VARCHAR(20);
  v_allocation_id UUID;
BEGIN
  -- 006E: payments and invoices require sales:update (not just a signed-in user).
  IF auth.uid() IS NULL OR NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update is required' USING ERRCODE = '42501';
  END IF;
  -- Validate authentication
  v_current_user := auth.uid()::VARCHAR(150);
  IF v_current_user IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Not authenticated'::VARCHAR;
    RETURN;
  END IF;

  -- ===== LOCK PAYMENT =====
  SELECT customer_id, amount_paid, status
  INTO v_payment_customer_id, v_payment_amount, v_payment_status
  FROM public.sales_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_payment_customer_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Payment not found'::VARCHAR;
    RETURN;
  END IF;

  -- Validate payment status
  IF v_payment_status NOT IN ('RECEIVED', 'ALLOCATED') THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, v_payment_status,
      ('Cannot allocate from payment in ' || v_payment_status || ' status')::VARCHAR;
    RETURN;
  END IF;

  -- ===== LOCK INVOICE =====
  SELECT customer_id, total_amount, amount_paid, amount_outstanding
  INTO v_invoice_customer_id, v_invoice_total, v_invoice_amount_paid, v_invoice_amount_outstanding
  FROM public.sales_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice_customer_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Invoice not found'::VARCHAR;
    RETURN;
  END IF;

  -- ===== VALIDATE ALLOCATION =====
  -- Customer consistency
  IF v_payment_customer_id != v_invoice_customer_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      'Payment customer does not match invoice customer'::VARCHAR;
    RETURN;
  END IF;

  -- Allocation amount > 0
  IF p_allocated_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      'Allocation amount must be positive'::VARCHAR;
    RETURN;
  END IF;

  -- ===== RECALCULATE PAYMENT REMAINING AFTER LOCK =====
  -- This is authoritative: must recalculate after acquiring lock
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_payment_allocated_total
  FROM public.sales_payment_allocations
  WHERE payment_id = p_payment_id AND status = 'ACTIVE';

  v_payment_remaining := v_payment_amount - v_payment_allocated_total;

  -- Validate allocation doesn't exceed payment remaining
  IF p_allocated_amount > v_payment_remaining THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      v_payment_remaining, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      ('Allocation amount ' || p_allocated_amount::VARCHAR || ' exceeds payment remaining ' || v_payment_remaining::VARCHAR)::VARCHAR;
    RETURN;
  END IF;

  -- ===== RECALCULATE INVOICE OUTSTANDING AFTER LOCK =====
  -- Must recalculate in case previous allocations were made
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_invoice_amount_paid
  FROM public.sales_payment_allocations
  WHERE invoice_id = p_invoice_id AND status = 'ACTIVE';

  v_invoice_amount_outstanding := v_invoice_total - v_invoice_amount_paid;

  -- Calculate new balances after this allocation
  v_new_invoice_paid := v_invoice_amount_paid + p_allocated_amount;
  v_new_invoice_outstanding := v_invoice_total - v_new_invoice_paid;

  -- Validate allocation doesn't over-settle invoice
  IF v_new_invoice_outstanding < 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      v_payment_remaining, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      ('Allocation would over-settle invoice. Outstanding=' || v_invoice_amount_outstanding::VARCHAR ||
      ', allocation=' || p_allocated_amount::VARCHAR)::VARCHAR;
    RETURN;
  END IF;

  -- ===== CREATE ALLOCATION RECORD =====
  INSERT INTO public.sales_payment_allocations (
    payment_id,
    invoice_id,
    allocated_amount,
    payment_customer_id,
    invoice_customer_id,
    allocated_by
  ) VALUES (
    p_payment_id,
    p_invoice_id,
    p_allocated_amount,
    v_payment_customer_id,
    v_invoice_customer_id,
    v_current_user
  )
  RETURNING id INTO v_allocation_id;

  IF v_allocation_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      v_payment_remaining, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      'Failed to create allocation'::VARCHAR;
    RETURN;
  END IF;

  -- ===== UPDATE INVOICE BALANCES =====
  -- amount_paid and amount_outstanding DERIVED from allocations, not additive
  UPDATE public.sales_invoices
  SET
    amount_paid = v_new_invoice_paid,
    amount_outstanding = v_new_invoice_outstanding,
    status = CASE
      WHEN v_new_invoice_outstanding = 0 THEN 'PAID'
      WHEN v_new_invoice_paid > 0 THEN 'PARTIAL'
      ELSE 'UNPAID'
    END,
    updated_at = NOW(),
    updated_by = v_current_user
  WHERE id = p_invoice_id;

  -- ===== UPDATE PAYMENT STATUS =====
  -- Mark as ALLOCATED if any allocation exists
  UPDATE public.sales_payments
  SET
    status = 'ALLOCATED',
    updated_at = NOW(),
    updated_by = v_current_user
  WHERE id = p_payment_id;

  -- ===== DETERMINE FINAL INVOICE STATUS =====
  IF v_new_invoice_outstanding = 0 THEN
    v_new_invoice_status := 'PAID';
  ELSIF v_new_invoice_paid > 0 THEN
    v_new_invoice_status := 'PARTIAL';
  ELSE
    v_new_invoice_status := 'UNPAID';
  END IF;

  -- ===== SUCCESS RETURN =====
  RETURN QUERY SELECT
    TRUE,
    v_allocation_id,
    p_payment_id,
    p_invoice_id,
    p_allocated_amount,
    v_payment_remaining - p_allocated_amount,
    v_new_invoice_paid,
    v_new_invoice_outstanding,
    v_new_invoice_status::VARCHAR,
    'Allocation created successfully'::VARCHAR;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
    0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR,
    ('Error: ' || SQLERRM)::VARCHAR;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invoice_from_shipment_atomic(p_order_id uuid, p_order_item_id uuid, p_invoice_qty numeric, p_invoice_date date DEFAULT NULL::date, p_due_date date DEFAULT NULL::date, p_payment_terms_days integer DEFAULT 30)
 RETURNS TABLE(success boolean, invoice_id uuid, invoice_no character varying, order_id uuid, order_item_id uuid, qty_invoiced numeric, total_amount numeric, amount_outstanding numeric, status character varying, message character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
  -- 006E: payments and invoices require sales:update (not just a signed-in user).
  IF auth.uid() IS NULL OR NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update is required' USING ERRCODE = '42501';
  END IF;
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
$$;

REVOKE EXECUTE ON FUNCTION public.record_payment_atomic(UUID, NUMERIC, VARCHAR, VARCHAR, DATE, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.allocate_payment_atomic(UUID, UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_invoice_from_shipment_atomic(UUID, UUID, NUMERIC, DATE, DATE, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_invoice_from_order(UUID, DATE, DATE, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_payment(UUID, NUMERIC, VARCHAR, VARCHAR, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_invoice_summary(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_payment_aging_report(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment_atomic(UUID, NUMERIC, VARCHAR, VARCHAR, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_payment_atomic(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_shipment_atomic(UUID, UUID, NUMERIC, DATE, DATE, INTEGER) TO authenticated;

-- Legacy overloads with a caller-supplied actor name: not callable through the API.
REVOKE EXECUTE ON FUNCTION public.record_payment(UUID, NUMERIC, VARCHAR, VARCHAR, DATE, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invoice(UUID, DATE, DATE, VARCHAR) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cost sheet versions share a sheet number
-- ---------------------------------------------------------------------------
ALTER TABLE public.cost_sheets DROP CONSTRAINT IF EXISTS cost_sheets_sheet_no_key;
ALTER TABLE public.cost_sheets DROP CONSTRAINT IF EXISTS cost_sheets_sheet_no_version_key;
ALTER TABLE public.cost_sheets
  ADD CONSTRAINT cost_sheets_sheet_no_version_key UNIQUE (sheet_no, version);

-- ---------------------------------------------------------------------------
-- 3. Inventory items: create with inventory:write
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_items_deny_insert ON public.inventory_items;
DROP POLICY IF EXISTS inventory_items_deny_delete ON public.inventory_items;
DROP POLICY IF EXISTS inventory_items_create ON public.inventory_items;
DROP POLICY IF EXISTS inventory_items_delete_unused ON public.inventory_items;

CREATE POLICY inventory_items_create ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'inventory:write')
    AND total_qty = 0
    AND reserved_qty = 0
  );

CREATE POLICY inventory_items_delete_unused ON public.inventory_items
  FOR DELETE TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'inventory:write')
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_transactions t WHERE t.item_id = inventory_items.id
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Party type
-- ---------------------------------------------------------------------------
ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS party_type TEXT NOT NULL DEFAULT 'Job Party';
ALTER TABLE public.parties DROP CONSTRAINT IF EXISTS parties_party_type_check;
ALTER TABLE public.parties
  ADD CONSTRAINT parties_party_type_check
  CHECK (party_type IN ('Job Party', 'Purchase Party', 'Sell Party'));
CREATE INDEX IF NOT EXISTS idx_parties_party_type ON public.parties (party_type);

NOTIFY pgrst, 'reload schema';
