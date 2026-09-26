-- STEP 3I: Atomic Reservation Release & Order Cancellation
-- Date: September 22, 2026
-- Purpose: Implement atomic release of active reservations and cascade cancellation
--
-- Architecture:
--   Reservations tracked via qty_reserved fields:
--     - sales_order_items.qty_reserved (quantity allocated to this sales line)
--     - inventory_items.reserved_qty (total quantity reserved for this item)
--
--   Release means: set qty_reserved → 0 (no longer reduces saleable stock)
--   Saleable stock calculated as: total_qty - reserved_qty
--
--   Therefore: release → qty_reserved = 0 → saleable restores automatically
--
-- Two operations:
--   1. release_sales_stock_atomic() - Release single sales line
--   2. cancel_sales_order_atomic() - Cancel order + release all lines atomically

-- ============================================================================
-- FUNCTION: release_sales_stock_atomic (RELEASE SINGLE SALES LINE)
-- ============================================================================
-- Purpose: Atomically release a sales order item reservation back to inventory
--
-- Preconditions:
--   - auth.uid() is valid (authenticated user required)
--   - sales_order_item exists
--   - inventory_item exists and belongs to this sales line
--   - qty_reserved > 0 (only release if something was reserved)
--
-- Postconditions:
--   - sales_order_items.qty_reserved = 0 (no longer reserved)
--   - inventory_items.reserved_qty decreased by released amount
--   - saleable stock automatically restored (via get_saleable_inventory calculation)
--   - Audit trail: no deletion, historical qty_reserved remains visible via timestamps
--
-- Idempotency:
--   RELEASED (qty_reserved already 0) → returns success (no-op)
--   ACTIVE (qty_reserved > 0) → updates and returns success
--
-- Atomicity:
--   Both tables updated in same transaction
--   Rollback leaves no partial state

CREATE OR REPLACE FUNCTION public.release_sales_stock_atomic(
  p_order_item_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  order_item_id UUID,
  inventory_item_id UUID,
  qty_released DECIMAL,
  qty_reserved_after DECIMAL,
  message VARCHAR
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_id UUID;
  v_order_status VARCHAR;
  v_inventory_item_id UUID;
  v_qty_reserved DECIMAL;
  v_total_qty DECIMAL;
  v_qty_released DECIMAL;
  v_qty_reserved_after DECIMAL;
BEGIN
  -- Validate authentication
  v_current_user := auth.uid()::VARCHAR(150);
  IF v_current_user IS NULL THEN
    RETURN QUERY SELECT FALSE, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 'Not authenticated';
    RETURN;
  END IF;

  -- Lock and fetch sales order item
  SELECT order_id, inventory_item_id, qty_reserved
  INTO v_order_id, v_inventory_item_id, v_qty_reserved
  FROM public.sales_order_items
  WHERE id = p_order_item_id
  FOR UPDATE;

  IF v_order_id IS NULL THEN
    RETURN QUERY SELECT FALSE, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 'Sales order item not found';
    RETURN;
  END IF;

  -- Validate inventory item exists
  SELECT total_qty
  INTO v_total_qty
  FROM public.inventory_items
  WHERE id = v_inventory_item_id
  FOR UPDATE;

  IF v_total_qty IS NULL THEN
    RETURN QUERY SELECT FALSE, p_order_item_id, v_inventory_item_id, 0::DECIMAL, 0::DECIMAL, 'Inventory item not found';
    RETURN;
  END IF;

  -- Check if already released (qty_reserved = 0)
  IF v_qty_reserved = 0 OR v_qty_reserved IS NULL THEN
    RETURN QUERY SELECT TRUE, p_order_item_id, v_inventory_item_id, 0::DECIMAL, 0::DECIMAL, 'Already released or never reserved (no-op)';
    RETURN;
  END IF;

  -- Record amount to release
  v_qty_released := v_qty_reserved;

  -- Atomically update both tables
  -- 1. Decrease inventory_items.reserved_qty
  UPDATE public.inventory_items
  SET
    reserved_qty = GREATEST(0, reserved_qty - v_qty_released),  -- Prevent negative
    updated_at = NOW()
  WHERE id = v_inventory_item_id;

  -- 2. Clear sales_order_items.qty_reserved
  UPDATE public.sales_order_items
  SET
    qty_reserved = 0,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_order_item_id;

  -- Verify final state
  SELECT reserved_qty
  INTO v_qty_reserved_after
  FROM public.inventory_items
  WHERE id = v_inventory_item_id;

  -- Return success
  RETURN QUERY SELECT
    TRUE,
    p_order_item_id,
    v_inventory_item_id,
    v_qty_released,
    COALESCE(v_qty_reserved_after, 0),
    'Released ' || v_qty_released::VARCHAR || ' units, inventory now has ' || COALESCE(v_qty_reserved_after, 0)::VARCHAR || ' reserved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: cancel_sales_order_atomic (CANCEL ORDER + RELEASE ALL RESERVATIONS)
-- ============================================================================
-- Purpose: Atomically cancel a sales order and release all active reservations
--
-- Preconditions:
--   - auth.uid() is valid (authenticated user required)
--   - sales_order exists
--   - sales_order.status IN ('DRAFT', 'CONFIRMED', 'ALLOCATED')
--   - Cannot cancel FULFILLED, SHIPPED, DELIVERED, INVOICED, PAID (terminal states)
--
-- Postconditions:
--   - All ACTIVE reservations released (qty_reserved → 0)
--   - inventory_items.reserved_qty decreased for all affected items
--   - sales_orders.status = 'CANCELLED'
--   - All changes atomic (all-or-nothing)
--
-- Atomicity:
--   If any line fails: entire cancellation rolls back
--   Order and all lines updated in one transaction
--   No partial state possible
--
-- Cascade Semantics:
--   Cancel order with 3 lines:
--     Line 1: qty_reserved = 40 → release 40
--     Line 2: qty_reserved = 60 → release 60
--     Line 3: qty_reserved = 0 → no-op
--   Result: Order CANCELLED, all three lines processed

CREATE OR REPLACE FUNCTION public.cancel_sales_order_atomic(
  p_order_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  order_id UUID,
  order_status VARCHAR,
  total_released DECIMAL,
  line_count INT,
  message VARCHAR,
  cancelled_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_warehouse_id UUID;
  v_total_released DECIMAL := 0;
  v_line_count INT := 0;
  v_line_record RECORD;
  v_qty_released DECIMAL;
  v_inventory_item_id UUID;
BEGIN
  -- Validate authentication
  v_current_user := auth.uid()::VARCHAR(150);
  IF v_current_user IS NULL THEN
    RETURN QUERY SELECT FALSE, p_order_id, NULL, 0::DECIMAL, 0, 'Not authenticated', NULL;
    RETURN;
  END IF;

  -- Lock and fetch sales order
  SELECT status, warehouse_id
  INTO v_order_status, v_warehouse_id
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RETURN QUERY SELECT FALSE, p_order_id, NULL, 0::DECIMAL, 0, 'Order not found', NULL;
    RETURN;
  END IF;

  -- Validate order status allows cancellation
  -- Allowed: DRAFT, CONFIRMED, ALLOCATED
  -- Blocked: FULFILLED, SHIPPED, DELIVERED, INVOICED, PAID, CANCELLED
  IF v_order_status NOT IN ('DRAFT', 'CONFIRMED', 'ALLOCATED') THEN
    RETURN QUERY SELECT FALSE, p_order_id, v_order_status, 0::DECIMAL, 0,
      'Cannot cancel order in ' || v_order_status || ' status. Only DRAFT, CONFIRMED, ALLOCATED can be cancelled.',
      NULL;
    RETURN;
  END IF;

  -- Process each sales order item (all with qty_reserved, whether 0 or > 0)
  FOR v_line_record IN
    SELECT id, inventory_item_id, qty_reserved
    FROM public.sales_order_items
    WHERE order_id = p_order_id
    ORDER BY id
  LOOP
    v_line_count := v_line_count + 1;

    -- Skip if already released (qty_reserved = 0 or NULL)
    IF v_line_record.qty_reserved IS NULL OR v_line_record.qty_reserved = 0 THEN
      CONTINUE;
    END IF;

    -- Amount to release
    v_qty_released := v_line_record.qty_reserved;
    v_inventory_item_id := v_line_record.inventory_item_id;

    -- Lock inventory item for update
    PERFORM 1 FROM public.inventory_items
    WHERE id = v_inventory_item_id
    FOR UPDATE;

    -- Decrease inventory_items.reserved_qty
    UPDATE public.inventory_items
    SET
      reserved_qty = GREATEST(0, reserved_qty - v_qty_released),
      updated_at = NOW()
    WHERE id = v_inventory_item_id;

    -- Clear sales_order_items.qty_reserved
    UPDATE public.sales_order_items
    SET
      qty_reserved = 0,
      updated_by = v_current_user,
      updated_at = NOW()
    WHERE id = v_line_record.id;

    -- Accumulate total released
    v_total_released := v_total_released + v_qty_released;
  END LOOP;

  -- Update order status to CANCELLED (only if all line updates succeeded)
  UPDATE public.sales_orders
  SET
    status = 'CANCELLED',
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Return success
  RETURN QUERY SELECT
    TRUE,
    p_order_id,
    'CANCELLED'::VARCHAR,
    v_total_released,
    v_line_count,
    'Cancelled order and released ' || v_total_released::VARCHAR || ' units from ' || v_line_count::INT || ' lines',
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INDEXES FOR RELEASE/CANCEL OPERATIONS
-- ============================================================================

-- Efficient sales line lookup by order (for cancel operation)
CREATE INDEX IF NOT EXISTS idx_sales_order_items_qty_reserved_by_order
  ON public.sales_order_items(order_id, qty_reserved DESC)
  WHERE qty_reserved > 0;

-- Efficient order status query (for cancellation validation)
CREATE INDEX IF NOT EXISTS idx_sales_orders_status
  ON public.sales_orders(status)
  WHERE status IN ('DRAFT', 'CONFIRMED', 'ALLOCATED', 'CANCELLED');

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Release & Cancellation Implementation:
--   ✓ release_sales_stock_atomic() — Release single sales line
--   ✓ cancel_sales_order_atomic() — Cancel order + release all lines
--   ✓ Both lock rows FOR UPDATE (prevent concurrent conflicts)
--   ✓ Idempotent: released reservation stays released
--   ✓ Atomic: all-or-nothing, no partial state
--   ✓ Saleable stock restored automatically via qty_reserved subtraction
--   ✓ auth.uid() validation on function entry
--   ✓ SECURITY DEFINER with safe execution
--   ✓ Cascade: cancel order releases all active reservations
--
-- Locking Strategy: FOR UPDATE on sales_order_items and inventory_items
--   - Scope: Per sales order (order-level lock) or per item (item-level lock)
--   - Granularity: Line-level for single release, order-level for cancellation
--   - Timeout: Database default (deadlock detection)
--   - Release: Automatic at transaction end
--
-- qty_reserved Reconciliation:
--   Before release: qty_reserved = 40, saleable = 100 - 40 = 60
--   After release:  qty_reserved = 0,  saleable = 100 - 0  = 100
--
--   get_saleable_inventory() calculation (unchanged):
--   available_qty = total_qty - reserved_qty
--   saleable_qty = CASE WHEN grade='Grade A' THEN available_qty ELSE 0 END
--
--   No manual stock mutation needed. Automatic via qty_reserved field.
--
-- Cancellation Status Rules:
--   Allowed to cancel: DRAFT, CONFIRMED, ALLOCATED
--   Cannot cancel:    FULFILLED, SHIPPED, DELIVERED, INVOICED, PAID
--   Already cancelled: CANCELLED (via status constraint)
--
-- Idempotency:
--   Release twice: First succeeds (qty_reserved → 0), second is no-op
--   Cancel twice:  First succeeds (status → CANCELLED), second fails (status check)
--
-- Historical Tracking:
--   Reservation deletion: NONE (preserve audit trail)
--   Status: changed to released/cancelled (visible in updated_at timestamp)
--   Actor: auth.uid() stored in updated_by field (STEP 3E security)
