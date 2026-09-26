-- STEP 3D: Fix Sales Order Quantity Contract Alignment
-- Date: September 22, 2026
-- Purpose: Fix RPC column references to match actual sales_order_items schema
--
-- Issue: RPCs were using nonexistent column names:
--   part2: ordered_quantity (should be qty_metre), reserved_quantity (should be qty_reserved)
--   part3: reserved_quantity (should be qty_reserved), dispatched_quantity (should be qty_dispatched)
--
-- Solution: Update RPCs to reference the canonical textile-quantity fields

-- ============================================================================
-- FUNCTION: confirm_stock_reservation (CORRECTED)
-- From part2_atomic_rpcs.sql — Fix ordered_quantity → qty_metre, reserved_quantity → qty_reserved
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_stock_reservation(
  p_order_id UUID
)
RETURNS TABLE (
  order_id UUID,
  status VARCHAR(50),
  total_reserved DECIMAL,
  line_count INT,
  confirmed_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_total_reserved DECIMAL;
  v_line_count INT;
  v_line_record RECORD;
BEGIN
  v_current_user := auth.uid()::VARCHAR(150);

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
    RAISE EXCEPTION 'Cannot reserve stock for order % in % status (must be CONFIRMED)', p_order_id, v_order_status;
  END IF;

  -- Update all lines with design/cost snapshots and approval info
  UPDATE public.sales_order_items
  SET
    design_no_snapshot = (
      SELECT COALESCE(d.design_no, '')
      FROM public.designs d
      WHERE d.id = design_id
    ),
    design_name_snapshot = (
      SELECT COALESCE(d.design_name, '')
      FROM public.designs d
      WHERE d.id = design_id
    ),
    cost_sheet_no_snapshot = (
      SELECT COALESCE(cs.code_number, '')
      FROM public.cost_sheets cs
      WHERE cs.id = cost_sheet_id
    ),
    approved_sale_rate = (
      SELECT COALESCE(cs.base_rate, rate_per_metre)
      FROM public.cost_sheets cs
      WHERE cs.id = cost_sheet_id
    ),
    approved_by = v_current_user,
    approved_at = NOW(),
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE order_id = p_order_id;

  -- For each confirmed line, attempt inventory reservation
  -- FIXED: Use qty_metre (not ordered_quantity), qty_reserved (not reserved_quantity)
  v_total_reserved := 0;
  FOR v_line_record IN
    SELECT id, inventory_item_id, qty_metre
    FROM public.sales_order_items
    WHERE order_id = p_order_id
  LOOP
    -- Try to reserve inventory for this line
    UPDATE public.inventory_items
    SET
      reserved_qty = reserved_qty + v_line_record.qty_metre,
      updated_at = NOW()
    WHERE id = v_line_record.inventory_item_id
    AND (total_qty - reserved_qty) >= v_line_record.qty_metre;

    IF FOUND THEN
      v_total_reserved := v_total_reserved + v_line_record.qty_metre;

      -- Update line item with reserved quantity
      -- FIXED: Use qty_reserved (not reserved_quantity)
      UPDATE public.sales_order_items
      SET
        qty_reserved = v_line_record.qty_metre,
        updated_at = NOW()
      WHERE id = v_line_record.id;
    ELSE
      -- Insufficient stock for this line - log warning but continue
      RAISE WARNING 'Insufficient stock for order line %', v_line_record.id;
    END IF;
  END LOOP;

  -- Count confirmed lines for response
  SELECT COUNT(*)
  INTO v_line_count
  FROM public.sales_order_items
  WHERE order_id = p_order_id;

  -- Return confirmation summary
  RETURN QUERY
  SELECT
    p_order_id,
    'CONFIRMED'::VARCHAR(50),
    v_total_reserved,
    v_line_count,
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: confirm_stock_reservation (dispatch version, CORRECTED)
-- From part3_dispatch_operations.sql — Fix reserved_quantity → qty_reserved
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_stock_reservation_dispatch(
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
  -- FIXED: Use qty_reserved (not reserved_quantity)
  FOR v_line_record IN
    SELECT id, qty_reserved
    FROM public.sales_order_items
    WHERE order_id = p_order_id
    AND qty_reserved = 0
  LOOP
    RAISE EXCEPTION 'Order line % has no reservation', v_line_record.id;
  END LOOP;

  -- Update order status to ALLOCATED (ready for picking)
  UPDATE public.sales_orders
  SET
    status = 'ALLOCATED',
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Calculate total reserved for response
  -- FIXED: Use qty_reserved (not reserved_quantity)
  SELECT COALESCE(SUM(qty_reserved), 0)
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
-- FUNCTION: create_shipment (CORRECTED)
-- From part3_dispatch_operations.sql — Fix reserved_quantity → qty_reserved, dispatched_quantity → qty_dispatched
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
  -- FIXED: Use qty_dispatched (not dispatched_quantity), qty_reserved (not reserved_quantity)
  UPDATE public.sales_order_items
  SET
    qty_dispatched = qty_reserved,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE order_id = p_order_id;

  -- Calculate total packed quantity
  -- FIXED: Use qty_dispatched (not dispatched_quantity)
  SELECT COALESCE(SUM(qty_dispatched), 0)
  INTO v_total_qty
  FROM public.sales_order_items
  WHERE order_id = p_order_id;

  -- Update order status to SHIPPED
  UPDATE public.sales_orders
  SET
    status = 'SHIPPED',
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
-- SUMMARY
-- ============================================================================
-- Functions fixed: 3
--   - confirm_stock_reservation() — Now uses qty_metre, qty_reserved
--   - confirm_stock_reservation_dispatch() — Now uses qty_reserved
--   - create_shipment() — Now uses qty_reserved, qty_dispatched
--
-- Column Mapping Fixed:
--   ordered_quantity → qty_metre (textile: ordered quantity in metres)
--   reserved_quantity → qty_reserved (allocated from inventory)
--   dispatched_quantity → qty_dispatched (sent to customer)
--
-- Data Impact: None (schema unchanged, only RPC logic corrected)
-- Backward Compatibility: Maintained
--
-- Quantity Field Semantics:
--   qty_metre: ordered quantity in metres (required, > 0)
--   qty_reserved: allocated from inventory (0 to qty_metre)
--   qty_dispatched: sent to customer (0 to qty_metre)
--
-- Constraints:
--   qty_metre > 0
--   qty_reserved >= 0 AND qty_reserved <= qty_metre
--   qty_dispatched >= 0 AND qty_dispatched <= qty_metre
