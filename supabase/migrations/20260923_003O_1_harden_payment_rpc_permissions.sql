-- STEP 3O.1 IMPLEMENTATION: Harden Payment RPC Permissions
-- Add authentication checks, permission validation, SECURITY DEFINER, and safe search_path
-- Date: September 23, 2026

-- ============================================================================
-- PART 1: Harden create_invoice_from_order() RPC
-- Requires: auth.uid() validation, sales:update permission, SECURITY DEFINER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_invoice_from_order(
  p_order_id UUID,
  p_invoice_date DATE DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_payment_terms_days INT DEFAULT 30
)
RETURNS TABLE (
  invoice_id UUID,
  invoice_no VARCHAR,
  order_id UUID,
  customer_id UUID,
  total_amount DECIMAL,
  amount_outstanding DECIMAL,
  status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user UUID;
  v_order_status VARCHAR;
  v_customer_id UUID;
  v_subtotal_amount DECIMAL(15, 2);
  v_discount_amount DECIMAL(15, 2);
  v_tax_amount DECIMAL(15, 2);
  v_total_amount DECIMAL(15, 2);
  v_invoice_no VARCHAR(50);
  v_invoice_id UUID;
  v_invoice_date_val DATE;
  v_due_date_val DATE;
BEGIN
  -- Validate authentication
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User not authenticated';
  END IF;

  -- Validate permission to create invoices (requires sales:update)
  IF NOT public.user_has_permission(v_current_user, 'sales:update') THEN
    RAISE EXCEPTION 'Insufficient permission: sales:update required to create invoices';
  END IF;

  -- Validate order exists and is DELIVERED or SHIPPED
  SELECT status, customer_id, subtotal_amount, discount_amount, tax_amount, total_amount
  INTO v_order_status, v_customer_id, v_subtotal_amount, v_discount_amount, v_tax_amount, v_total_amount
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_order_status NOT IN ('DELIVERED', 'SHIPPED') THEN
    RAISE EXCEPTION 'Cannot invoice order in % status (must be DELIVERED or SHIPPED)', v_order_status;
  END IF;

  -- Set invoice dates
  v_invoice_date_val := COALESCE(p_invoice_date, CURRENT_DATE);
  v_due_date_val := COALESCE(p_due_date, CURRENT_DATE + (p_payment_terms_days || ' days')::INTERVAL);

  -- Generate invoice number
  v_invoice_no := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((
    SELECT COUNT(*) + 1 FROM public.sales_invoices
    WHERE invoice_date = CURRENT_DATE
  )::TEXT, 5, '0');

  -- Create invoice (use authenticated user, not parameter)
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
    v_subtotal_amount,
    v_tax_amount,
    v_total_amount,
    v_total_amount,
    'UNPAID',
    v_current_user::VARCHAR(150),
    v_current_user::VARCHAR(150)
  )
  RETURNING id INTO v_invoice_id;

  -- Update order status to INVOICED
  UPDATE public.sales_orders
  SET
    status = 'INVOICED',
    updated_at = NOW(),
    updated_by = v_current_user::VARCHAR(150)
  WHERE id = p_order_id;

  RETURN QUERY
  SELECT
    v_invoice_id,
    v_invoice_no,
    p_order_id,
    v_customer_id,
    v_total_amount,
    v_total_amount,
    'UNPAID'::VARCHAR,
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================================
-- PART 2: Harden record_payment() RPC
-- Requires: auth.uid() validation, sales:update permission, SECURITY DEFINER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_payment(
  p_invoice_id UUID,
  p_amount_paid DECIMAL(15, 2),
  p_payment_method VARCHAR(30),
  p_reference_number VARCHAR(100) DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
)
RETURNS TABLE (
  payment_id UUID,
  invoice_id UUID,
  amount_paid DECIMAL,
  total_amount_paid DECIMAL,
  amount_outstanding DECIMAL,
  invoice_status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user UUID;
  v_invoice_total DECIMAL(15, 2);
  v_current_paid DECIMAL(15, 2);
  v_new_paid DECIMAL(15, 2);
  v_new_outstanding DECIMAL(15, 2);
  v_new_status VARCHAR(20);
  v_payment_id UUID;
  v_customer_id UUID;
  v_order_id UUID;
BEGIN
  -- Validate authentication
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User not authenticated';
  END IF;

  -- Validate permission to record payments (requires sales:update)
  IF NOT public.user_has_permission(v_current_user, 'sales:update') THEN
    RAISE EXCEPTION 'Insufficient permission: sales:update required to record payments';
  END IF;

  -- Validate invoice exists
  SELECT total_amount, amount_paid, customer_id, order_id
  INTO v_invoice_total, v_current_paid, v_customer_id, v_order_id
  FROM public.sales_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice_total IS NULL THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  -- Validate payment amount
  IF p_amount_paid <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  -- Calculate new totals
  v_new_paid := v_current_paid + p_amount_paid;

  IF v_new_paid > v_invoice_total THEN
    RAISE EXCEPTION 'Payment amount exceeds invoice total. Invoice: %, Paid so far: %, New payment: %',
      v_invoice_total, v_current_paid, p_amount_paid;
  END IF;

  v_new_outstanding := v_invoice_total - v_new_paid;

  -- Determine new status
  IF v_new_outstanding = 0 THEN
    v_new_status := 'PAID';
  ELSIF v_new_paid > 0 THEN
    v_new_status := 'PARTIAL';
  ELSE
    v_new_status := 'UNPAID';
  END IF;

  -- Record payment (use authenticated user, not parameter)
  INSERT INTO public.sales_payments (
    invoice_id,
    payment_date,
    amount_paid,
    payment_method,
    reference_number,
    remarks,
    created_by
  ) VALUES (
    p_invoice_id,
    CURRENT_DATE,
    p_amount_paid,
    p_payment_method,
    p_reference_number,
    p_remarks,
    v_current_user::VARCHAR(150)
  )
  RETURNING id INTO v_payment_id;

  -- Update invoice
  UPDATE public.sales_invoices
  SET
    amount_paid = v_new_paid,
    amount_outstanding = v_new_outstanding,
    status = v_new_status,
    updated_at = NOW(),
    updated_by = v_current_user::VARCHAR(150)
  WHERE id = p_invoice_id;

  -- Update order status if fully paid
  IF v_new_status = 'PAID' THEN
    UPDATE public.sales_orders
    SET
      status = 'PAID',
      updated_at = NOW(),
      updated_by = v_current_user::VARCHAR(150)
    WHERE id = v_order_id;
  END IF;

  RETURN QUERY
  SELECT
    v_payment_id,
    p_invoice_id,
    p_amount_paid,
    v_new_paid,
    v_new_outstanding,
    v_new_status::VARCHAR,
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================================
-- PART 3: Harden get_invoice_summary() RPC (Read-Only)
-- Requires: sales:read permission (READ-ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_invoice_summary(
  p_customer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  invoice_id UUID,
  invoice_no VARCHAR,
  customer_id UUID,
  invoice_date DATE,
  due_date DATE,
  total_amount DECIMAL,
  amount_paid DECIMAL,
  amount_outstanding DECIMAL,
  status VARCHAR,
  days_outstanding INT,
  payment_count INT
) AS $$
BEGIN
  -- Validate authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User not authenticated';
  END IF;

  -- Validate permission to read sales/invoices (requires sales:read)
  IF NOT public.user_has_permission(auth.uid(), 'sales:read') THEN
    RAISE EXCEPTION 'Insufficient permission: sales:read required to view invoices';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.invoice_no,
    i.customer_id,
    i.invoice_date,
    i.due_date,
    i.total_amount,
    i.amount_paid,
    i.amount_outstanding,
    i.status,
    (CURRENT_DATE - i.due_date)::INT as days_outstanding,
    (SELECT COUNT(*) FROM public.sales_payments WHERE invoice_id = i.id)::INT as payment_count
  FROM public.sales_invoices i
  WHERE (p_customer_id IS NULL OR i.customer_id = p_customer_id)
  ORDER BY i.due_date ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================================
-- PART 4: Harden get_payment_aging_report() RPC (Read-Only)
-- Requires: sales:read permission (READ-ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_payment_aging_report(
  p_customer_id UUID DEFAULT NULL
)
RETURNS TABLE (
  aging_bucket VARCHAR,
  invoice_count INT,
  total_outstanding DECIMAL,
  customer_count INT
) AS $$
BEGIN
  -- Validate authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User not authenticated';
  END IF;

  -- Validate permission to read sales/invoices (requires sales:read)
  IF NOT public.user_has_permission(auth.uid(), 'sales:read') THEN
    RAISE EXCEPTION 'Insufficient permission: sales:read required to view reports';
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN (CURRENT_DATE - i.due_date) <= 0 THEN 'Not Yet Due'
      WHEN (CURRENT_DATE - i.due_date) <= 30 THEN '1-30 Days'
      WHEN (CURRENT_DATE - i.due_date) <= 60 THEN '31-60 Days'
      WHEN (CURRENT_DATE - i.due_date) <= 90 THEN '61-90 Days'
      ELSE '90+ Days'
    END as aging_bucket,
    COUNT(DISTINCT i.id)::INT as invoice_count,
    SUM(i.amount_outstanding) as total_outstanding,
    COUNT(DISTINCT i.customer_id)::INT as customer_count
  FROM public.sales_invoices i
  WHERE (p_customer_id IS NULL OR i.customer_id = p_customer_id)
    AND i.status IN ('UNPAID', 'PARTIAL')
  GROUP BY aging_bucket
  ORDER BY aging_bucket;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================================
-- PART 5: Revoke PUBLIC and ANON EXECUTE on Financial Mutations
-- ============================================================================
-- Prevent anonymous users and public role from executing payment functions

REVOKE EXECUTE ON FUNCTION public.create_invoice_from_order(UUID, DATE, DATE, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_invoice_from_order(UUID, DATE, DATE, INT) FROM anon;

REVOKE EXECUTE ON FUNCTION public.record_payment(UUID, DECIMAL, VARCHAR, VARCHAR, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_payment(UUID, DECIMAL, VARCHAR, VARCHAR, TEXT) FROM anon;

-- ============================================================================
-- PART 6: Grant EXECUTE to Authenticated Role (with permission checks inside RPC)
-- ============================================================================
-- Authenticated users can call functions; permission validation happens inside RPC

GRANT EXECUTE ON FUNCTION public.create_invoice_from_order(UUID, DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment(UUID, DECIMAL, VARCHAR, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_aging_report(UUID) TO authenticated;

-- ============================================================================
-- SUMMARY OF HARDENING
-- ============================================================================
-- ✓ create_invoice_from_order(): Added auth.uid() IS NOT NULL check + sales:update permission
-- ✓ record_payment(): Added auth.uid() IS NOT NULL check + sales:update permission
-- ✓ get_invoice_summary(): Added auth.uid() IS NOT NULL check + sales:read permission
-- ✓ get_payment_aging_report(): Added auth.uid() IS NOT NULL check + sales:read permission
-- ✓ All payment mutation functions: SECURITY DEFINER mode with safe search_path
-- ✓ All payment functions: Uses auth.uid() for created_by/updated_by (actor cannot spoof)
-- ✓ PUBLIC and anon roles: REVOKED EXECUTE on financial mutations
-- ✓ Authenticated role: GRANTED EXECUTE (with runtime permission validation inside RPC)
