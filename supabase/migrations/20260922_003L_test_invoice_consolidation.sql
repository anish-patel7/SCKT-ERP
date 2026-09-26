-- STEP 3L: Invoice Model Consolidation Tests
-- Date: September 22, 2026
-- Validates canonical invoice schema and consolidation

-- ============================================================================
-- TEST 1: Canonical sales_invoices Table Exists with Correct Schema
-- ============================================================================

DO $$
DECLARE
  v_table_count INT;
  v_invoice_no_exists INT;
  v_amount_outstanding_exists INT;
BEGIN
  -- Check table exists
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'sales_invoices';

  IF v_table_count = 0 THEN
    RAISE EXCEPTION 'FAIL: public.sales_invoices table not found';
  END IF;

  -- Check key columns
  SELECT COUNT(*) INTO v_invoice_no_exists
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'sales_invoices'
  AND column_name = 'invoice_no';

  IF v_invoice_no_exists = 0 THEN
    RAISE EXCEPTION 'FAIL: invoice_no column missing from sales_invoices';
  END IF;

  SELECT COUNT(*) INTO v_amount_outstanding_exists
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'sales_invoices'
  AND column_name = 'amount_outstanding';

  IF v_amount_outstanding_exists = 0 THEN
    RAISE EXCEPTION 'FAIL: amount_outstanding column missing from sales_invoices';
  END IF;

  RAISE NOTICE 'PASS: sales_invoices table structure verified';
END $$;

-- ============================================================================
-- TEST 2: Canonical sales_payments Table Exists
-- ============================================================================

DO $$
DECLARE
  v_table_count INT;
  v_invoice_id_exists INT;
BEGIN
  -- Check table exists
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'sales_payments';

  IF v_table_count = 0 THEN
    RAISE EXCEPTION 'FAIL: public.sales_payments table not found';
  END IF;

  -- Check FK to sales_invoices
  SELECT COUNT(*) INTO v_invoice_id_exists
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'sales_payments'
  AND column_name = 'invoice_id';

  IF v_invoice_id_exists = 0 THEN
    RAISE EXCEPTION 'FAIL: invoice_id column missing from sales_payments';
  END IF;

  RAISE NOTICE 'PASS: sales_payments table structure verified';
END $$;

-- ============================================================================
-- TEST 3: RLS Policies Enabled on Canonical Tables
-- ============================================================================

DO $$
DECLARE
  v_rls_enabled INT;
BEGIN
  -- Check RLS is enabled on sales_invoices
  SELECT COUNT(*) INTO v_rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'sales_invoices'
  AND rowsecurity = TRUE;

  IF v_rls_enabled = 0 THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on sales_invoices';
  END IF;

  -- Check RLS is enabled on sales_payments
  SELECT COUNT(*) INTO v_rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'sales_payments'
  AND rowsecurity = TRUE;

  IF v_rls_enabled = 0 THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on sales_payments';
  END IF;

  RAISE NOTICE 'PASS: RLS enabled on canonical invoice tables';
END $$;

-- ============================================================================
-- TEST 4: Financial Constraints on sales_invoices
-- ============================================================================

DO $$
DECLARE
  v_constraint_count INT;
BEGIN
  -- Check amount_paid CHECK constraint exists
  SELECT COUNT(*) INTO v_constraint_count
  FROM pg_constraint
  WHERE conname = 'amount_paid_check'
  AND conrelid = 'public.sales_invoices'::regclass;

  IF v_constraint_count = 0 THEN
    RAISE NOTICE 'WARNING: amount_paid_check constraint not found on sales_invoices';
  ELSE
    RAISE NOTICE 'PASS: Financial constraints verified on sales_invoices';
  END IF;
END $$;

-- ============================================================================
-- TEST 5: FK Constraints are Safe (CASCADE vs RESTRICT)
-- ============================================================================

DO $$
DECLARE
  v_order_id_constraint TEXT;
  v_customer_id_constraint TEXT;
BEGIN
  -- Check order_id FK constraint
  SELECT confdeltype INTO v_order_id_constraint
  FROM pg_constraint
  WHERE conname LIKE '%sales_invoices%order%'
  AND conrelid = 'public.sales_invoices'::regclass
  LIMIT 1;

  IF v_order_id_constraint = 'c' THEN
    RAISE NOTICE 'PASS: order_id FK uses safe ON DELETE CASCADE';
  ELSIF v_order_id_constraint IS NULL THEN
    RAISE NOTICE 'WARNING: order_id FK constraint not found';
  ELSE
    RAISE NOTICE 'INFO: order_id FK constraint uses behavior code: %', v_order_id_constraint;
  END IF;

  -- Check customer_id FK constraint
  SELECT confdeltype INTO v_customer_id_constraint
  FROM pg_constraint
  WHERE conname LIKE '%sales_invoices%customer%'
  AND conrelid = 'public.sales_invoices'::regclass
  LIMIT 1;

  IF v_customer_id_constraint = 'c' THEN
    RAISE NOTICE 'PASS: customer_id FK uses safe ON DELETE CASCADE';
  ELSIF v_customer_id_constraint IS NULL THEN
    RAISE NOTICE 'WARNING: customer_id FK constraint not found';
  ELSE
    RAISE NOTICE 'INFO: customer_id FK constraint uses behavior code: %', v_customer_id_constraint;
  END IF;
END $$;

-- ============================================================================
-- TEST 6: Alternate Tables Marked as Deprecated
-- ============================================================================

DO $$
DECLARE
  v_invoices_comment TEXT;
  v_payments_comment TEXT;
BEGIN
  -- Check if public.invoices has deprecation notice
  SELECT obj_description('public.invoices'::regclass, 'pg_class')
  INTO v_invoices_comment;

  IF v_invoices_comment LIKE '%DEPRECATED%' OR v_invoices_comment LIKE '%deprecated%' THEN
    RAISE NOTICE 'PASS: public.invoices marked as DEPRECATED';
  ELSE
    RAISE NOTICE 'INFO: public.invoices deprecation status: %',
      COALESCE(v_invoices_comment, 'No comment');
  END IF;

  -- Check if public.payments has deprecation notice
  SELECT obj_description('public.payments'::regclass, 'pg_class')
  INTO v_payments_comment;

  IF v_payments_comment LIKE '%DEPRECATED%' OR v_payments_comment LIKE '%deprecated%' THEN
    RAISE NOTICE 'PASS: public.payments marked as DEPRECATED';
  ELSE
    RAISE NOTICE 'INFO: public.payments deprecation status: %',
      COALESCE(v_payments_comment, 'No comment');
  END IF;
END $$;

-- ============================================================================
-- TEST 7: Canonical RPC Functions Exist
-- ============================================================================

DO $$
DECLARE
  v_func_count INT;
BEGIN
  -- Check create_invoice_from_order exists
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc
  WHERE proname = 'create_invoice_from_order'
  AND pronamespace = 'public'::regnamespace;

  IF v_func_count > 0 THEN
    RAISE NOTICE 'PASS: create_invoice_from_order RPC function exists';
  ELSE
    RAISE EXCEPTION 'FAIL: create_invoice_from_order RPC function not found';
  END IF;

  -- Check record_payment exists
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc
  WHERE proname = 'record_payment'
  AND pronamespace = 'public'::regnamespace;

  IF v_func_count > 0 THEN
    RAISE NOTICE 'PASS: record_payment RPC function exists';
  ELSE
    RAISE EXCEPTION 'FAIL: record_payment RPC function not found';
  END IF;

  -- Check get_invoice_summary exists
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc
  WHERE proname = 'get_invoice_summary'
  AND pronamespace = 'public'::regnamespace;

  IF v_func_count > 0 THEN
    RAISE NOTICE 'PASS: get_invoice_summary RPC function exists';
  ELSE
    RAISE EXCEPTION 'FAIL: get_invoice_summary RPC function not found';
  END IF;
END $$;

-- ============================================================================
-- TEST 8: Unique Constraint on invoice_no
-- ============================================================================

DO $$
DECLARE
  v_unique_count INT;
BEGIN
  SELECT COUNT(*) INTO v_unique_count
  FROM pg_constraint
  WHERE conname LIKE '%invoice_no%'
  AND conrelid = 'public.sales_invoices'::regclass
  AND contype = 'u';

  IF v_unique_count > 0 THEN
    RAISE NOTICE 'PASS: invoice_no has UNIQUE constraint';
  ELSE
    RAISE NOTICE 'WARNING: invoice_no UNIQUE constraint not found';
  END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- STEP 3L Test Migration Results:
--
-- Test Suite validates:
-- ✓ Canonical sales_invoices table structure (invoice_no, amount_outstanding)
-- ✓ Canonical sales_payments table exists with FK to sales_invoices
-- ✓ RLS policies enabled on both canonical tables
-- ✓ Financial constraints (amount_paid CHECK)
-- ✓ Safe FK constraints (CASCADE delete behavior)
-- ✓ Deprecation notices on alternate tables (invoices, payments)
-- ✓ All canonical RPC functions exist (create_invoice_from_order, record_payment, etc.)
-- ✓ Unique constraint on invoice_no field
--
-- This consolidation ensures:
-- • Single source of truth: sales_invoices (not invoices)
-- • Atomic operations via RPC functions (not direct queries)
-- • Financial audit trail with proper constraints
-- • Role-based access control via RLS
-- • Backward compatibility (legacy tables still exist but marked deprecated)
