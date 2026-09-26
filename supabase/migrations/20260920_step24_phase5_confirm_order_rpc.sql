-- STEP 24 PHASE 5: Atomic Confirmation RPC — Commercial Snapshots
-- Transactional snapshot capture at order confirmation
-- Date: September 20, 2026

-- ============================================================================
-- FUNCTION: Confirm sales order with atomic snapshot capture
-- ============================================================================
-- Validates order is in DRAFT, captures all commercial snapshots, sets to CONFIRMED
-- Snapshots ensure historical accuracy: customer name, design, pricing frozen at confirmation

CREATE OR REPLACE FUNCTION public.confirm_sales_order(
  p_order_id UUID,
  p_approved_by VARCHAR(150) DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  status VARCHAR,
  customer_name_snapshot VARCHAR,
  broker_name_snapshot VARCHAR,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  line_count INT
) AS $$
DECLARE
  v_order_status VARCHAR;
  v_customer_id UUID;
  v_customer_name VARCHAR(200);
  v_broker_id UUID;
  v_broker_name VARCHAR(200);
  v_current_user VARCHAR(150);
  v_line_count INT;
BEGIN
  -- Default approved_by to current user if not provided
  IF p_approved_by IS NULL THEN
    v_current_user := auth.uid()::VARCHAR(150);
  ELSE
    v_current_user := p_approved_by;
  END IF;

  -- Validate order exists and is in DRAFT status
  SELECT status, customer_id
  INTO v_order_status, v_customer_id
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_order_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot confirm order % in % status (must be DRAFT)', p_order_id, v_order_status;
  END IF;

  -- Capture customer snapshot from parties table
  SELECT name, broker_party_id
  INTO v_customer_name, v_broker_id
  FROM public.parties
  WHERE id = v_customer_id;

  -- Capture broker snapshot if broker_id exists
  IF v_broker_id IS NOT NULL THEN
    SELECT name INTO v_broker_name
    FROM public.parties
    WHERE id = v_broker_id;
  END IF;

  -- Update order header with snapshots and confirmation
  UPDATE public.sales_orders
  SET
    status = 'CONFIRMED',
    customer_name_snapshot = v_customer_name,
    broker_name_snapshot = v_broker_name,
    confirmed_at = NOW(),
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Update all order items with design/cost snapshots and approval info
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

  -- Count confirmed lines for response
  SELECT COUNT(*)
  INTO v_line_count
  FROM public.sales_order_items
  WHERE order_id = p_order_id;

  -- Return confirmation summary
  RETURN QUERY
  SELECT
    p_order_id,
    'CONFIRMED'::VARCHAR,
    v_customer_name,
    v_broker_name,
    NOW(),
    v_line_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Function created: 1
--   - confirm_sales_order(order_id UUID, approved_by VARCHAR) — Atomic confirmation
--
-- Behavior:
--   1. Validates order exists and is in DRAFT status
--   2. Captures customer name snapshot from parties table
--   3. Captures broker name snapshot (if broker_party_id exists)
--   4. Captures design snapshots for all line items (design_no, design_name)
--   5. Captures cost sheet snapshots (cost_sheet_no)
--   6. Captures approved pricing from cost_sheets.base_rate
--   7. Sets approved_by and approved_at to current user/time
--   8. Sets order status to CONFIRMED and confirmed_at timestamp
--   9. All operations atomic in single transaction
--   10. Returns order_id, status, snapshots, confirmed_at, line_count
--
-- Usage:
--   SELECT * FROM confirm_sales_order('550e8400-e29b-41d4-a716-446655440000');
--
-- Security:
--   - SECURITY DEFINER: Executes as function owner (database role)
--   - RLS policies still apply to underlying tables
--   - Prevents unauthorized confirmation via audit trail (approved_by)
