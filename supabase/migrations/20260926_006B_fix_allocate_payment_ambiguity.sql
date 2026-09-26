-- ============================================================================
-- MIGRATION 006B: Fix allocate_payment_atomic "column reference is ambiguous"
-- Date: 2026-09-26
--
-- Why: allocate_payment_atomic RETURNS TABLE(..., allocated_amount, ...) and its
-- body sums sales_payment_allocations.allocated_amount unqualified. PL/pgSQL
-- treats the output column as a variable, so every call failed with
--   column reference "allocated_amount" is ambiguous
-- and no payment could ever be applied to an invoice.
--
-- Fix: same function body with `#variable_conflict use_column`, so bare
-- names resolve to table columns. The three validation messages built with ||
-- are now cast to VARCHAR: as text they did not match the RETURNS TABLE type,
-- so RETURN QUERY raised "structure of query does not match function result
-- type" instead of returning the validation message. Signature, SECURITY DEFINER, search_path and
-- existing grants are unchanged (CREATE OR REPLACE keeps the ACL).
-- Plain $$ quoting (the Supabase SQL editor mis-splits other dollar tags).
-- Safe to re-run. Rollback: re-apply 20260923_003N_1_payment_allocation_fixes.sql.
-- ============================================================================

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


NOTIFY pgrst, 'reload schema';
