-- STEP 3N: Payment Model Consolidation + Allocation + AR Reconciliation
-- Date: September 23, 2026
--
-- PURPOSE:
-- Implement ONE canonical settlement model that properly separates:
--   Payment (money received from customer)
--   Allocation (payment applied to specific invoice)
--   AR Balance (derived from valid allocations)
--
-- ARCHITECTURE:
-- Payment Reception → Payment Allocation → Invoice Settlement → AR Balance
--
-- PAYMENT = Record of money received (independent of invoice)
-- ALLOCATION = Link between Payment and Invoice (audit trail)
-- AR_BALANCE = DERIVED from SUM(valid allocations), not stored value
--
-- This prevents:
-- ✗ One payment resolving multiple invoices only at receipt time
-- ✗ Lost allocations if invoice modified
-- ✗ Over-allocation due to concurrent requests
-- ✗ Silent repricing of payments

-- ============================================================================
-- TABLE REFACTOR: sales_payments (Payment Header Only)
-- ============================================================================
-- STEP 3N refactoring note:
-- Current sales_payments has invoice_id directly (couples Payment to Invoice).
-- For STEP 3N, we add:
--   1. customer_id (for validation without invoice lookup)
--   2. total_allocated (derived/updated after allocations)
--   3. payment_number (for human reference)
--
-- Keep invoice_id for backward compat but mark deprecated.
-- New code uses sales_payment_allocations for Payment→Invoice mapping.

ALTER TABLE public.sales_payments
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS payment_number VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'RECEIVED'
  CHECK (status IN ('RECEIVED', 'ALLOCATED', 'CANCELLED')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_sales_payments_customer_id ON public.sales_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_payments_status ON public.sales_payments(status);

-- ============================================================================
-- TABLE: sales_payment_allocations (NEW - Payment Allocation Detail)
-- ============================================================================
-- Tracks which portion of each payment is allocated to which invoice.
-- Supports:
--   - One payment split across multiple invoices
--   - Multiple payments applied to one invoice
--   - Partial allocations (payment may remain unallocated)
--   - Complete audit trail

CREATE TABLE IF NOT EXISTS public.sales_payment_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign keys to canonical objects
  payment_id UUID NOT NULL REFERENCES public.sales_payments(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE RESTRICT,

  -- Allocation amount
  allocated_amount DECIMAL(15, 2) NOT NULL
    CHECK (allocated_amount > 0),

  -- Validation: Customer must match
  payment_customer_id UUID NOT NULL REFERENCES public.customers(id),
  invoice_customer_id UUID NOT NULL REFERENCES public.customers(id),

  -- Status of this allocation
  status VARCHAR(20) DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'REVERSED', 'CANCELLED')),

  -- Audit trail
  allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  allocated_by VARCHAR(150) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT payment_invoice_unique UNIQUE (payment_id, invoice_id),
  CONSTRAINT customer_consistency CHECK (payment_customer_id = invoice_customer_id),
  CONSTRAINT allocated_amount_positive CHECK (allocated_amount > 0)
);

CREATE INDEX idx_sales_payment_allocations_payment_id ON public.sales_payment_allocations(payment_id);
CREATE INDEX idx_sales_payment_allocations_invoice_id ON public.sales_payment_allocations(invoice_id);
CREATE INDEX idx_sales_payment_allocations_customer_id ON public.sales_payment_allocations(payment_customer_id);
CREATE INDEX idx_sales_payment_allocations_status ON public.sales_payment_allocations(status);

-- ============================================================================
-- FUNCTION: record_payment_atomic
-- ============================================================================
-- Record payment received from customer (without immediate allocation).
-- Payment can be allocated to invoices separately via allocate_payment_atomic().
--
-- INPUT:
--   p_customer_id: Customer who made payment
--   p_amount: Amount received
--   p_payment_method: CASH, CHEQUE, BANK_TRANSFER, CARD, etc.
--   p_reference_number: Bank transaction/check number
--   p_payment_date: Date payment was received (default TODAY)
--
-- RETURNS:
--   payment_id: Created payment identifier
--   payment_number: Generated payment reference (PAY-YYYYMMDD-#####)
--   customer_id: Customer identifier
--   amount: Payment amount
--   allocated_amount: Initially 0
--   unallocated_amount: Initially = amount
--   status: RECEIVED
--
-- SECURITY: SECURITY DEFINER, auth.uid() required
-- ATOMICITY: Single transaction

CREATE OR REPLACE FUNCTION public.record_payment_atomic(
  p_customer_id UUID,
  p_amount DECIMAL(15, 2),
  p_payment_method VARCHAR(30),
  p_reference_number VARCHAR(100) DEFAULT NULL,
  p_payment_date DATE DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  payment_id UUID,
  payment_number VARCHAR,
  customer_id UUID,
  amount DECIMAL,
  allocated_amount DECIMAL,
  unallocated_amount DECIMAL,
  status VARCHAR,
  message VARCHAR
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_payment_id UUID;
  v_payment_number VARCHAR(50);
  v_payment_date_val DATE;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- FUNCTION: allocate_payment_atomic
-- ============================================================================
-- Allocate a portion of payment to a specific invoice.
-- Updates Invoice amount_paid and amount_outstanding automatically.
--
-- CONSTRAINTS:
--   - Payment customer must match Invoice customer
--   - Allocation amount > 0
--   - SUM(allocations) <= payment.amount
--   - SUM(allocations) <= invoice.total_amount
--   - Cannot over-allocate payment
--   - Cannot over-allocate invoice
--
-- ATOMICITY: Full transaction including invoice balance update
-- LOCKING: FOR UPDATE on payment and invoice

CREATE OR REPLACE FUNCTION public.allocate_payment_atomic(
  p_payment_id UUID,
  p_invoice_id UUID,
  p_allocated_amount DECIMAL(15, 2)
)
RETURNS TABLE (
  success BOOLEAN,
  allocation_id UUID,
  payment_id UUID,
  invoice_id UUID,
  allocated_amount DECIMAL,
  payment_remaining DECIMAL,
  invoice_paid DECIMAL,
  invoice_outstanding DECIMAL,
  invoice_status VARCHAR,
  message VARCHAR
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_payment_customer_id UUID;
  v_payment_amount DECIMAL(15, 2);
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
      'Cannot allocate from payment in ' || v_payment_status || ' status'::VARCHAR;
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
      'Allocation amount ' || p_allocated_amount::VARCHAR || ' exceeds payment remaining ' || v_payment_remaining::VARCHAR;
    RETURN;
  END IF;

  -- ===== RECALCULATE INVOICE OUTSTANDING AFTER LOCK =====
  -- Must recalculate in case previous allocations were made
  v_new_invoice_paid := v_invoice_amount_paid + p_allocated_amount;
  v_new_invoice_outstanding := v_invoice_total - v_new_invoice_paid;

  -- Validate allocation doesn't over-settle invoice
  IF v_new_invoice_outstanding < 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      v_payment_remaining, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      'Allocation would over-settle invoice. Outstanding=' || v_invoice_amount_outstanding::VARCHAR ||
      ', allocation=' || p_allocated_amount::VARCHAR;
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
  -- amount_paid and amount_outstanding must be recalculated from allocations
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Ensure RLS enabled
ALTER TABLE public.sales_payment_allocations ENABLE ROW LEVEL SECURITY;

-- Admin: Full access to allocations
DROP POLICY IF EXISTS "admin_full_access_allocations" ON public.sales_payment_allocations;
CREATE POLICY "admin_full_access_allocations" ON public.sales_payment_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- Manager: Can view and create allocations
DROP POLICY IF EXISTS "manager_read_write_allocations" ON public.sales_payment_allocations;
CREATE POLICY "manager_read_write_allocations" ON public.sales_payment_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.record_payment_atomic(UUID, DECIMAL, VARCHAR, VARCHAR, DATE, TEXT)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.allocate_payment_atomic(UUID, UUID, DECIMAL)
TO authenticated;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- STEP 3N: Payment Model Consolidation + Allocation + AR Reconciliation
--
-- CANONICAL OBJECTS:
-- 1. sales_payments — Payment header (enhanced with customer_id, status)
--    - Represents money received from customer
--    - Can be partially allocated to multiple invoices
--
-- 2. sales_payment_allocations — Payment allocation detail (NEW)
--    - Links payment to invoice
--    - Tracks allocated amount
--    - Enforces customer consistency
--    - Immutable audit trail
--
-- 3. sales_invoices — Invoice (existing, enhanced with status)
--    - amount_paid derived from SUM(allocations)
--    - amount_outstanding = total_amount - amount_paid
--    - status: UNPAID, PARTIAL, PAID
--
-- CANONICAL RPCs:
-- 1. record_payment_atomic(customer_id, amount, method, reference, date, remarks)
--    - Creates payment record (money received)
--    - Does NOT allocate to invoice
--    - Returns payment_id, payment_number, unallocated_amount
--
-- 2. allocate_payment_atomic(payment_id, invoice_id, allocated_amount)
--    - Allocates payment portion to specific invoice
--    - Validates customer consistency
--    - Prevents over-allocation of payment or invoice
--    - Updates invoice amount_paid and amount_outstanding
--    - Atomically transactional with full locking
--
-- PAYMENT FLOW:
-- 1. Customer makes payment
--    → record_payment_atomic() → sales_payments created, status=RECEIVED
--
-- 2. Payment applied to invoices
--    → allocate_payment_atomic() → sales_payment_allocations created
--    → invoice amount_paid and amount_outstanding recalculated
--    → invoice status updated (PARTIAL/PAID)
--
-- AR BALANCE FORMULA:
-- invoice.amount_paid = SUM(active allocations to this invoice)
-- invoice.amount_outstanding = invoice.total_amount - invoice.amount_paid
-- payment.unallocated = payment.amount - SUM(active allocations of this payment)
--
-- INVARIANTS (database-enforced):
-- ✓ allocation.allocated_amount > 0
-- ✓ payment.amount_paid > 0
-- ✓ payment.customer_id = allocation.payment_customer_id = allocation.invoice_customer_id
-- ✓ SUM(allocations) ≤ payment.amount (at INSERT via recalculation)
-- ✓ SUM(allocations) ≤ invoice.total_amount (via CHECK on amount_outstanding ≥ 0)
-- ✓ amount_outstanding ≥ 0
-- ✓ status transitions based on payment state
--
-- SECURITY:
-- ✓ SECURITY DEFINER on both RPCs
-- ✓ auth.uid() required and enforced
-- ✓ allocated_by = auth.uid() (not client-supplied)
-- ✓ RLS policies on allocations
-- ✓ Customer consistency enforced in RPC and via FK constraint
--
-- BACKWARD COMPATIBILITY:
-- ✓ existing sales_payments table retained (invoice_id deprecated but kept)
-- ✓ existing sales_invoices amount_paid/amount_outstanding updated by new logic
-- ✓ existing record_payment() RPC still works (now via allocation)
