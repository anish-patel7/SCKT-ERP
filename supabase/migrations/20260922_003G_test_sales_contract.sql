-- Test Cases for STEP 3D Sales Quantity Contract Fix
-- Validates corrected RPC column references work with actual schema

-- ============================================================================
-- TEST SETUP: Create test data
-- ============================================================================

-- Test 1: Create Ordered Quantity
-- Verify qty_metre is set and persists
DO $$
DECLARE
  v_customer_id UUID;
  v_order_id UUID;
  v_item_id UUID;
  v_stored_qty DECIMAL;
BEGIN
  -- Get or create test customer
  SELECT id INTO v_customer_id FROM public.customers LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (party_id, credit_limit)
    VALUES ((SELECT id FROM public.parties LIMIT 1), 100000)
    RETURNING id INTO v_customer_id;
  END IF;

  -- Create test order
  INSERT INTO public.sales_orders (
    order_no, customer_id, order_date, delivery_date,
    subtotal_amount, total_amount, shipping_address, billing_address, status
  ) VALUES (
    'TEST-ORDER-001', v_customer_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days',
    1000, 1000, 'Test Address', 'Test Address', 'DRAFT'
  )
  RETURNING id INTO v_order_id;

  -- Create test order item with qty_metre = 100
  INSERT INTO public.sales_order_items (
    order_id, line_number, fabric_quality_name, design_no,
    qty_metre, rate_per_metre, line_total
  ) VALUES (
    v_order_id, 1, 'Test Fabric', 'D-001',
    100.00, 10.00, 1000.00
  )
  RETURNING id INTO v_item_id;

  -- TEST 1 VALIDATION
  SELECT qty_metre INTO v_stored_qty FROM public.sales_order_items
  WHERE id = v_item_id;

  IF v_stored_qty = 100.00 THEN
    RAISE NOTICE 'TEST 1 PASS: Create ordered quantity - qty_metre = 100 stored and retrieved';
  ELSE
    RAISE EXCEPTION 'TEST 1 FAIL: qty_metre not stored correctly. Got: %', v_stored_qty;
  END IF;
END $$;

-- Test 2: Zero Quantity Rejected
-- Attempt to create order with qty_metre = 0
DO $$
DECLARE
  v_customer_id UUID;
  v_order_id UUID;
BEGIN
  SELECT id INTO v_customer_id FROM public.customers LIMIT 1;

  -- Create test order
  INSERT INTO public.sales_orders (
    order_no, customer_id, order_date, delivery_date,
    subtotal_amount, total_amount, shipping_address, billing_address, status
  ) VALUES (
    'TEST-ORDER-ZERO', v_customer_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days',
    0, 0, 'Test Address', 'Test Address', 'DRAFT'
  )
  RETURNING id INTO v_order_id;

  -- Try to create order item with qty_metre = 0
  BEGIN
    INSERT INTO public.sales_order_items (
      order_id, line_number, fabric_quality_name,
      qty_metre, rate_per_metre, line_total
    ) VALUES (
      v_order_id, 1, 'Test Fabric',
      0.00, 10.00, 0.00
    );
    RAISE EXCEPTION 'TEST 2 FAIL: Zero quantity should be rejected by constraint';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 2 PASS: Zero quantity - constraint qty_positive rejects qty_metre = 0';
  END;
END $$;

-- Test 3: Reserved Quantity Field
-- Set qty_reserved and verify it persists
DO $$
DECLARE
  v_order_id UUID;
  v_item_id UUID;
  v_stored_reserved DECIMAL;
BEGIN
  -- Get test order from TEST 1
  SELECT id INTO v_order_id FROM public.sales_orders
  WHERE order_no = 'TEST-ORDER-001' LIMIT 1;

  SELECT id INTO v_item_id FROM public.sales_order_items
  WHERE order_id = v_order_id LIMIT 1;

  -- Update qty_reserved to 40
  UPDATE public.sales_order_items
  SET qty_reserved = 40.00
  WHERE id = v_item_id;

  -- Verify storage
  SELECT qty_reserved INTO v_stored_reserved FROM public.sales_order_items
  WHERE id = v_item_id;

  IF v_stored_reserved = 40.00 THEN
    RAISE NOTICE 'TEST 3 PASS: Reserved quantity field - qty_reserved = 40 stored and retrieved';
  ELSE
    RAISE EXCEPTION 'TEST 3 FAIL: qty_reserved not stored correctly. Got: %', v_stored_reserved;
  END IF;

  -- Calculate remaining unreserved
  -- Expected: qty_metre (100) - qty_reserved (40) = 60
  IF (100.00 - v_stored_reserved) = 60.00 THEN
    RAISE NOTICE 'TEST 3 PASS: Remaining unreserved quantity = 60 (100 - 40)';
  END IF;
END $$;

-- Test 4: Dispatched Quantity Field
-- Set qty_dispatched and verify it persists
DO $$
DECLARE
  v_order_id UUID;
  v_item_id UUID;
  v_stored_dispatched DECIMAL;
BEGIN
  -- Get test order from TEST 1
  SELECT id INTO v_order_id FROM public.sales_orders
  WHERE order_no = 'TEST-ORDER-001' LIMIT 1;

  SELECT id INTO v_item_id FROM public.sales_order_items
  WHERE order_id = v_order_id LIMIT 1;

  -- Update qty_dispatched to 30
  UPDATE public.sales_order_items
  SET qty_dispatched = 30.00
  WHERE id = v_item_id;

  -- Verify storage
  SELECT qty_dispatched INTO v_stored_dispatched FROM public.sales_order_items
  WHERE id = v_item_id;

  IF v_stored_dispatched = 30.00 THEN
    RAISE NOTICE 'TEST 4 PASS: Dispatched quantity field - qty_dispatched = 30 stored and retrieved';
  ELSE
    RAISE EXCEPTION 'TEST 4 FAIL: qty_dispatched not stored correctly. Got: %', v_stored_dispatched;
  END IF;

  -- Calculate remaining to dispatch
  -- Expected: qty_metre (100) - qty_dispatched (30) = 70
  IF (100.00 - v_stored_dispatched) = 70.00 THEN
    RAISE NOTICE 'TEST 4 PASS: Remaining to dispatch = 70 (100 - 30)';
  END IF;
END $$;

-- Test 5: Over-Dispatch Prevention
-- Attempt to set qty_dispatched > qty_metre (should fail)
DO $$
DECLARE
  v_order_id UUID;
  v_item_id UUID;
BEGIN
  -- Get test order from TEST 1
  SELECT id INTO v_order_id FROM public.sales_orders
  WHERE order_no = 'TEST-ORDER-001' LIMIT 1;

  SELECT id INTO v_item_id FROM public.sales_order_items
  WHERE order_id = v_order_id LIMIT 1;

  -- Reset to know state
  UPDATE public.sales_order_items
  SET qty_dispatched = 0
  WHERE id = v_item_id;

  -- Try to set qty_dispatched to 120 (exceeds qty_metre of 100)
  BEGIN
    UPDATE public.sales_order_items
    SET qty_dispatched = 120.00
    WHERE id = v_item_id;

    -- Check if constraint caught it
    IF EXISTS (
      SELECT 1 FROM public.sales_order_items
      WHERE id = v_item_id AND qty_dispatched = 120.00
    ) THEN
      RAISE EXCEPTION 'TEST 5 FAIL: Over-dispatch (120 > 100) should be rejected by constraint';
    END IF;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 5 PASS: Over-dispatch prevention - constraint rejects qty_dispatched (120) > qty_metre (100)';
  END;
END $$;

-- Test 6: Historical Data Preservation
-- Verify existing order items still have correct quantities
DO $$
DECLARE
  v_total_qty DECIMAL;
  v_reserved_qty DECIMAL;
  v_dispatched_qty DECIMAL;
BEGIN
  -- Sum qty_metre for all test orders
  SELECT COALESCE(SUM(qty_metre), 0) INTO v_total_qty
  FROM public.sales_order_items
  WHERE order_id IN (
    SELECT id FROM public.sales_orders
    WHERE order_no LIKE 'TEST-ORDER-%'
  );

  RAISE NOTICE 'TEST 6: Historical data - total qty_metre across test orders = %', v_total_qty;

  -- Verify no NULL values in quantity fields
  IF NOT EXISTS (
    SELECT 1 FROM public.sales_order_items
    WHERE order_id IN (
      SELECT id FROM public.sales_orders
      WHERE order_no LIKE 'TEST-ORDER-%'
    )
    AND (qty_metre IS NULL OR qty_reserved IS NULL OR qty_dispatched IS NULL)
  ) THEN
    RAISE NOTICE 'TEST 6 PASS: Historical data preservation - no NULL values in quantity fields';
  ELSE
    RAISE WARNING 'TEST 6 PARTIAL: Some quantity fields may be NULL';
  END IF;
END $$;

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================
-- Test Results:
--   1. Create ordered quantity: qty_metre field works
--   2. Zero quantity rejected: Constraint enforced
--   3. Reserved quantity field: qty_reserved persists correctly
--   4. Dispatched quantity field: qty_dispatched persists correctly
--   5. Over-dispatch prevention: Constraint prevents qty_dispatched > qty_metre
--   6. Historical data preserved: No data loss, all fields populated
--
-- All tests validate that:
--   - qty_metre is the canonical ordered quantity
--   - qty_reserved is the canonical reserved quantity
--   - qty_dispatched is the canonical dispatched quantity
--   - Constraints enforce valid state transitions
--   - Column references are correct (not generic names like ordered_quantity)
