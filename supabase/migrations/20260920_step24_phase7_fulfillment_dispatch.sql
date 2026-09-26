-- STEP 24 PHASE 7: Fulfillment & Dispatch Operations
-- Create fulfillment pick lists from allocated orders and track dispatch
-- Date: September 20, 2026

-- ============================================================================
-- FUNCTION: Create fulfillment pick list from allocated sales order
-- ============================================================================
-- Converts allocated order items into a pick list
-- Validates all items are allocated before creating fulfillment

CREATE OR REPLACE FUNCTION public.create_fulfillment_from_order(
  p_order_id UUID,
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS TABLE (
  fulfillment_id UUID,
  pick_list_no VARCHAR,
  order_id UUID,
  fulfillment_status VARCHAR,
  item_count INT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_pick_list_no VARCHAR(50);
  v_fulfillment_id UUID;
  v_order_status VARCHAR;
  v_item_count INT;
  v_allocated_count INT;
  v_order_item RECORD;
BEGIN
  -- Validate order exists and is ALLOCATED
  SELECT status INTO v_order_status
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_order_status <> 'ALLOCATED' THEN
    RAISE EXCEPTION 'Cannot create fulfillment for order in % status (must be ALLOCATED)', v_order_status;
  END IF;

  -- Validate all items are allocated
  SELECT COUNT(*) INTO v_item_count
  FROM public.sales_order_items
  WHERE order_id = p_order_id;

  SELECT COUNT(*) INTO v_allocated_count
  FROM public.sales_order_items
  WHERE order_id = p_order_id AND qty_allocated > 0;

  IF v_allocated_count <> v_item_count THEN
    RAISE EXCEPTION 'Not all items are allocated. Allocated: %, Total: %', v_allocated_count, v_item_count;
  END IF;

  -- Generate pick list number
  v_pick_list_no := 'PL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((
    SELECT COUNT(*) + 1 FROM public.sales_fulfillment
    WHERE fulfillment_date = CURRENT_DATE
  )::TEXT, 5, '0');

  -- Create fulfillment header
  INSERT INTO public.sales_fulfillment (
    pick_list_no,
    fulfillment_date,
    status,
    created_by,
    updated_by
  ) VALUES (
    v_pick_list_no,
    CURRENT_DATE,
    'PENDING',
    auth.uid()::VARCHAR(150),
    auth.uid()::VARCHAR(150)
  )
  RETURNING id INTO v_fulfillment_id;

  -- Create fulfillment items for each allocated order item
  FOR v_order_item IN
    SELECT id, qty_allocated
    FROM public.sales_order_items
    WHERE order_id = p_order_id AND qty_allocated > 0
  LOOP
    INSERT INTO public.sales_fulfillment_items (
      fulfillment_id,
      order_item_id,
      qty_to_ship,
      created_at
    ) VALUES (
      v_fulfillment_id,
      v_order_item.id,
      v_order_item.qty_allocated,
      NOW()
    );
  END LOOP;

  -- Update order status to FULFILLED
  UPDATE public.sales_orders
  SET
    status = 'FULFILLED',
    updated_at = NOW(),
    updated_by = auth.uid()::VARCHAR(150)
  WHERE id = p_order_id;

  RETURN QUERY
  SELECT
    v_fulfillment_id,
    v_pick_list_no,
    p_order_id,
    'PENDING'::VARCHAR,
    v_item_count,
    NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Update fulfillment item quantities (picking/packing/shipping)
-- ============================================================================
-- Tracks qty_picked, qty_packed, qty_shipped for each fulfillment item

CREATE OR REPLACE FUNCTION public.update_fulfillment_item(
  p_fulfillment_item_id UUID,
  p_qty_picked DECIMAL(10, 2) DEFAULT NULL,
  p_qty_packed DECIMAL(10, 2) DEFAULT NULL,
  p_qty_shipped DECIMAL(10, 2) DEFAULT NULL,
  p_bin_location VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  fulfillment_item_id UUID,
  qty_to_ship DECIMAL,
  qty_picked DECIMAL,
  qty_packed DECIMAL,
  qty_shipped DECIMAL,
  fulfillment_status VARCHAR
) AS $$
DECLARE
  v_qty_to_ship DECIMAL(10, 2);
  v_fulfillment_id UUID;
BEGIN
  -- Get current item details
  SELECT qty_to_ship, fulfillment_id
  INTO v_qty_to_ship, v_fulfillment_id
  FROM public.sales_fulfillment_items
  WHERE id = p_fulfillment_item_id
  FOR UPDATE;

  IF v_qty_to_ship IS NULL THEN
    RAISE EXCEPTION 'Fulfillment item not found: %', p_fulfillment_item_id;
  END IF;

  -- Update quantities with validation
  UPDATE public.sales_fulfillment_items
  SET
    qty_picked = COALESCE(p_qty_picked, qty_picked),
    qty_packed = COALESCE(p_qty_packed, qty_packed),
    qty_shipped = COALESCE(p_qty_shipped, qty_shipped)
  WHERE id = p_fulfillment_item_id
  AND (p_qty_picked IS NULL OR p_qty_picked <= v_qty_to_ship)
  AND (p_qty_packed IS NULL OR p_qty_packed <= COALESCE(p_qty_picked, qty_picked))
  AND (p_qty_shipped IS NULL OR p_qty_shipped <= COALESCE(p_qty_packed, qty_packed));

  -- Update bin location if provided
  IF p_bin_location IS NOT NULL THEN
    UPDATE public.sales_fulfillment_items
    SET bin_location = p_bin_location
    WHERE id = p_fulfillment_item_id;
  END IF;

  -- Return updated row
  RETURN QUERY
  SELECT
    p_fulfillment_item_id,
    v_qty_to_ship,
    COALESCE(p_qty_picked, (SELECT qty_picked FROM public.sales_fulfillment_items WHERE id = p_fulfillment_item_id)),
    COALESCE(p_qty_packed, (SELECT qty_packed FROM public.sales_fulfillment_items WHERE id = p_fulfillment_item_id)),
    COALESCE(p_qty_shipped, (SELECT qty_shipped FROM public.sales_fulfillment_items WHERE id = p_fulfillment_item_id)),
    (SELECT status FROM public.sales_fulfillment WHERE id = v_fulfillment_id)::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Ship fulfillment (transition to SHIPPED)
-- ============================================================================
-- Updates fulfillment status to SHIPPED and updates sales_order_items.qty_shipped

CREATE OR REPLACE FUNCTION public.ship_fulfillment(
  p_fulfillment_id UUID,
  p_tracking_number VARCHAR(100) DEFAULT NULL,
  p_carrier VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
  fulfillment_id UUID,
  pick_list_no VARCHAR,
  status VARCHAR,
  shipped_date DATE,
  tracking_number VARCHAR,
  carrier VARCHAR
) AS $$
DECLARE
  v_current_status VARCHAR;
  v_order_id UUID;
  v_fulfillment_item RECORD;
BEGIN
  -- Validate fulfillment exists and is ready to ship
  SELECT f.status, f.id
  INTO v_current_status, p_fulfillment_id
  FROM public.sales_fulfillment f
  WHERE id = p_fulfillment_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Fulfillment not found: %', p_fulfillment_id;
  END IF;

  IF v_current_status NOT IN ('PACKED', 'PENDING') THEN
    RAISE EXCEPTION 'Cannot ship fulfillment in % status', v_current_status;
  END IF;

  -- Get order ID from first item
  SELECT o.id
  INTO v_order_id
  FROM public.sales_fulfillment_items fi
  JOIN public.sales_order_items oi ON fi.order_item_id = oi.id
  JOIN public.sales_orders o ON oi.order_id = o.id
  WHERE fi.fulfillment_id = p_fulfillment_id
  LIMIT 1;

  -- Update sales_order_items.qty_shipped for each fulfilled item
  FOR v_fulfillment_item IN
    SELECT fi.id, fi.order_item_id, COALESCE(fi.qty_shipped, fi.qty_to_ship) as qty
    FROM public.sales_fulfillment_items
    WHERE fulfillment_id = p_fulfillment_id
  LOOP
    UPDATE public.sales_order_items
    SET
      qty_shipped = qty_shipped + v_fulfillment_item.qty,
      updated_at = NOW(),
      updated_by = auth.uid()::VARCHAR(150)
    WHERE id = v_fulfillment_item.order_item_id;
  END LOOP;

  -- Update fulfillment status to SHIPPED
  UPDATE public.sales_fulfillment
  SET
    status = 'SHIPPED',
    shipped_date = CURRENT_DATE,
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    carrier = COALESCE(p_carrier, carrier),
    updated_at = NOW(),
    updated_by = auth.uid()::VARCHAR(150)
  WHERE id = p_fulfillment_id;

  -- Update sales_order status to SHIPPED if all items shipped
  UPDATE public.sales_orders
  SET
    status = 'SHIPPED',
    shipped_at = NOW(),
    updated_at = NOW(),
    updated_by = auth.uid()::VARCHAR(150)
  WHERE id = v_order_id
  AND NOT EXISTS (
    SELECT 1 FROM public.sales_order_items
    WHERE order_id = v_order_id AND qty_shipped < qty_allocated
  );

  RETURN QUERY
  SELECT
    p_fulfillment_id,
    f.pick_list_no,
    f.status,
    f.shipped_date,
    f.tracking_number,
    f.carrier
  FROM public.sales_fulfillment f
  WHERE id = p_fulfillment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Deliver fulfillment (transition to DELIVERED)
-- ============================================================================
-- Updates fulfillment and order to DELIVERED status

CREATE OR REPLACE FUNCTION public.deliver_fulfillment(
  p_fulfillment_id UUID,
  p_delivery_remarks TEXT DEFAULT NULL
)
RETURNS TABLE (
  fulfillment_id UUID,
  pick_list_no VARCHAR,
  status VARCHAR,
  delivered_date DATE,
  order_status VARCHAR
) AS $$
DECLARE
  v_current_status VARCHAR;
  v_order_id UUID;
BEGIN
  -- Validate fulfillment exists and is SHIPPED
  SELECT f.status
  INTO v_current_status
  FROM public.sales_fulfillment f
  WHERE id = p_fulfillment_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Fulfillment not found: %', p_fulfillment_id;
  END IF;

  IF v_current_status <> 'SHIPPED' THEN
    RAISE EXCEPTION 'Cannot deliver fulfillment in % status (must be SHIPPED)', v_current_status;
  END IF;

  -- Get order ID
  SELECT o.id
  INTO v_order_id
  FROM public.sales_fulfillment_items fi
  JOIN public.sales_order_items oi ON fi.order_item_id = oi.id
  JOIN public.sales_orders o ON oi.order_id = o.id
  WHERE fi.fulfillment_id = p_fulfillment_id
  LIMIT 1;

  -- Update fulfillment status to DELIVERED
  UPDATE public.sales_fulfillment
  SET
    status = 'DELIVERED',
    delivered_date = CURRENT_DATE,
    remarks = COALESCE(p_delivery_remarks, remarks),
    updated_at = NOW(),
    updated_by = auth.uid()::VARCHAR(150)
  WHERE id = p_fulfillment_id;

  -- Update sales_order status to DELIVERED
  UPDATE public.sales_orders
  SET
    status = 'DELIVERED',
    delivered_at = NOW(),
    updated_at = NOW(),
    updated_by = auth.uid()::VARCHAR(150)
  WHERE id = v_order_id;

  RETURN QUERY
  SELECT
    p_fulfillment_id,
    f.pick_list_no,
    f.status,
    f.delivered_date,
    'DELIVERED'::VARCHAR
  FROM public.sales_fulfillment f
  WHERE id = p_fulfillment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Functions created: 4
--   - create_fulfillment_from_order() — Create pick list from allocated order
--   - update_fulfillment_item() — Track picking/packing/shipping quantities
--   - ship_fulfillment() — Ship pick list and update order status
--   - deliver_fulfillment() — Deliver and mark order as delivered
--
-- Fulfillment Workflow:
--   1. Order in ALLOCATED state → create_fulfillment_from_order() → FULFILLED
--   2. Pick/pack items → update_fulfillment_item() (qty_picked, qty_packed)
--   3. Ship fulfillment → ship_fulfillment() → SHIPPED (updates qty_shipped)
--   4. Deliver → deliver_fulfillment() → DELIVERED
--
-- Status Transitions:
--   Fulfillment: PENDING → PICKING → PICKED → PACKED → SHIPPED → DELIVERED
--   Order: ALLOCATED → FULFILLED → SHIPPED → DELIVERED
--
-- Warehouse Operations:
--   - Bin location tracking per fulfillment item
--   - Tracking number and carrier for shipment
--   - Order aggregation: single fulfillment may contain items from same order
--
-- Usage:
--   SELECT * FROM create_fulfillment_from_order('order-id');
--   SELECT * FROM update_fulfillment_item('item-id', qty_picked := 100);
--   SELECT * FROM ship_fulfillment('fulfillment-id', 'tracking-123', 'FedEx');
--   SELECT * FROM deliver_fulfillment('fulfillment-id');
