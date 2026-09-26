-- STEP 24 PHASE 8: Invoicing & Payment Processing
-- Create invoices from delivered orders and track payments
-- Date: September 20, 2026

-- ============================================================================
-- FUNCTION: Create invoice from delivered sales order
-- ============================================================================
-- Generates invoice from confirmed order with amounts and terms

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

  -- Create invoice
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
    auth.uid()::VARCHAR(150),
    auth.uid()::VARCHAR(150)
  )
  RETURNING id INTO v_invoice_id;

  -- Update order status to INVOICED
  UPDATE public.sales_orders
  SET
    status = 'INVOICED',
    updated_at = NOW(),
    updated_by = auth.uid()::VARCHAR(150)
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
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Record payment against invoice
-- ============================================================================
-- Updates invoice amounts and status based on payment received

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
  v_invoice_total DECIMAL(15, 2);
  v_current_paid DECIMAL(15, 2);
  v_new_paid DECIMAL(15, 2);
  v_new_outstanding DECIMAL(15, 2);
  v_new_status VARCHAR(20);
  v_payment_id UUID;
  v_customer_id UUID;
  v_order_id UUID;
BEGIN
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

  -- Record payment
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
    auth.uid()::VARCHAR(150)
  )
  RETURNING id INTO v_payment_id;

  -- Update invoice
  UPDATE public.sales_invoices
  SET
    amount_paid = v_new_paid,
    amount_outstanding = v_new_outstanding,
    status = v_new_status,
    updated_at = NOW(),
    updated_by = auth.uid()::VARCHAR(150)
  WHERE id = p_invoice_id;

  -- Update order status if fully paid
  IF v_new_status = 'PAID' THEN
    UPDATE public.sales_orders
    SET
      status = 'PAID',
      updated_at = NOW(),
      updated_by = auth.uid()::VARCHAR(150)
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
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get invoice summary with payment status
-- ============================================================================
-- Returns invoice details with aging and payment information

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
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get payment aging report
-- ============================================================================
-- Groups unpaid invoices by aging buckets for AR management

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
  WHERE i.status IN ('UNPAID', 'PARTIAL')
    AND (p_customer_id IS NULL OR i.customer_id = p_customer_id)
  GROUP BY aging_bucket
  ORDER BY
    CASE aging_bucket
      WHEN 'Not Yet Due' THEN 0
      WHEN '1-30 Days' THEN 1
      WHEN '31-60 Days' THEN 2
      WHEN '61-90 Days' THEN 3
      WHEN '90+ Days' THEN 4
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Complete order (mark as PAID)
-- ============================================================================
-- Validates order is INVOICED and payment is complete, then marks PAID

CREATE OR REPLACE FUNCTION public.complete_order(
  p_order_id UUID,
  p_completion_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  order_no VARCHAR,
  status VARCHAR,
  customer_id UUID,
  total_amount DECIMAL,
  completed_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_order_status VARCHAR;
  v_invoice_id UUID;
  v_invoice_status VARCHAR;
BEGIN
  -- Get order status
  SELECT status
  INTO v_order_status
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Check if invoiced
  IF v_order_status NOT IN ('INVOICED', 'PAID') THEN
    RAISE EXCEPTION 'Order must be INVOICED or PAID, currently: %', v_order_status;
  END IF;

  -- Get associated invoice
  SELECT id, status
  INTO v_invoice_id, v_invoice_status
  FROM public.sales_invoices
  WHERE order_id = p_order_id
  LIMIT 1;

  IF v_invoice_id IS NOT NULL AND v_invoice_status <> 'PAID' THEN
    RAISE EXCEPTION 'Invoice not fully paid. Invoice status: %', v_invoice_status;
  END IF;

  -- Update order to PAID
  UPDATE public.sales_orders
  SET
    status = 'PAID',
    updated_at = NOW(),
    updated_by = auth.uid()::VARCHAR(150)
  WHERE id = p_order_id;

  RETURN QUERY
  SELECT
    p_order_id,
    (SELECT order_no FROM public.sales_orders WHERE id = p_order_id),
    'PAID'::VARCHAR,
    (SELECT customer_id FROM public.sales_orders WHERE id = p_order_id),
    (SELECT total_amount FROM public.sales_orders WHERE id = p_order_id),
    NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Functions created: 5
--   - create_invoice_from_order() — Generate invoice from delivered order
--   - record_payment() — Track payment with validation
--   - get_invoice_summary() — Query invoices with aging
--   - get_payment_aging_report() — AR aging analysis
--   - complete_order() — Mark order as fully paid
--
-- Invoice Workflow:
--   1. Order in DELIVERED state → create_invoice_from_order() → INVOICED
--   2. Payment received → record_payment() → PARTIAL or PAID
--   3. Full payment → order transitions to PAID
--
-- Status Transitions:
--   Invoice: UNPAID → PARTIAL → PAID
--   Order: INVOICED → PAID (when invoice paid)
--
-- Payment Features:
--   - Partial payment tracking
--   - Payment method and reference tracking
--   - Invoice aging (days overdue)
--   - Multi-currency support ready (uses DECIMAL for accuracy)
--
-- AR Management:
--   - Aging report by bucket (Not Due, 1-30, 31-60, 61-90, 90+)
--   - Invoice aging calculation
--   - Customer-specific aging view
--
-- Usage:
--   SELECT * FROM create_invoice_from_order('order-id');
--   SELECT * FROM record_payment('invoice-id', 5000, 'BANK_TRANSFER', 'CHQ-123');
--   SELECT * FROM get_invoice_summary();
--   SELECT * FROM get_payment_aging_report();
--   SELECT * FROM complete_order('order-id');
