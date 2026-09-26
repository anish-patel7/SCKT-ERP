-- STEP 3F: Fix Sales Order Status Contract
-- Date: September 22, 2026
-- Purpose: Correct DISPATCHED status to SHIPPED to comply with database constraint
--
-- Issue: create_shipment() was setting status = 'DISPATCHED'
-- Database constraint only allows: DRAFT, CONFIRMED, ALLOCATED, FULFILLED, SHIPPED, DELIVERED, INVOICED, PAID, CANCELLED
-- Solution: Replace DISPATCHED with SHIPPED (the canonical shipment status)

-- ============================================================================
-- FUNCTION: create_shipment (CORRECTED FOR STATUS)
-- From part3_dispatch_operations.sql — Fix status = 'DISPATCHED' → status = 'SHIPPED'
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

  -- Protect against shipment of cancelled orders
  IF v_order_status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Cannot create shipment for cancelled order %', p_order_id;
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

  -- Update order items: set qty_dispatched = qty_reserved
  -- This represents items that have been picked and packed
  UPDATE public.sales_order_items
  SET
    qty_dispatched = qty_reserved,
    shipment_id = v_shipment_id,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE order_id = p_order_id;

  -- Calculate total packed quantity
  SELECT COALESCE(SUM(qty_dispatched), 0)
  INTO v_total_qty
  FROM public.sales_order_items
  WHERE order_id = p_order_id;

  -- Update order status to SHIPPED (NOT DISPATCHED)
  -- FIXED: Use SHIPPED (the canonical status in database constraint)
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
-- Function fixed: create_shipment()
--   Old: status = 'DISPATCHED' (NOT in constraint, INVALID)
--   New: status = 'SHIPPED' (in constraint, VALID)
--
-- Status Contract:
--   Canonical allowed values: DRAFT, CONFIRMED, ALLOCATED, FULFILLED, SHIPPED, DELIVERED, INVOICED, PAID, CANCELLED
--   Shipment completion status: SHIPPED
--   Partial dispatch: tracked via qty_dispatched field (not status)
--
-- Data Impact: None (schema unchanged, only RPC logic corrected)
-- Backward Compatibility: Maintained (SHIPPED is semantically equivalent to intended DISPATCHED)
--
-- Business Meaning:
--   status = 'SHIPPED' means order is in transit to customer
--   qty_dispatched < qty_metre means partial fulfillment
--   qty_dispatched = qty_metre means full fulfillment
--   Can transition to DELIVERED, INVOICED, PAID
--   CANCELLED remains terminal
