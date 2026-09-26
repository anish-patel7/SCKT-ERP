-- STEP 24 PHASE 5: Immutability Enforcement & Commercial Snapshots
-- BEFORE UPDATE triggers to prevent post-confirmation modification of locked fields
-- Date: September 20, 2026

-- ============================================================================
-- FUNCTION: Validate sales_orders immutability
-- ============================================================================
-- Prevents modification of critical fields after order confirmation
-- Allows flexible fields (delivery_date, addresses, warehouse_id) to change

CREATE OR REPLACE FUNCTION public.validate_sales_order_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow ALL updates while order is in DRAFT status
  IF OLD.status = 'DRAFT' THEN
    RETURN NEW;
  END IF;

  -- For CONFIRMED and beyond, enforce immutability on critical fields
  IF OLD.status <> 'DRAFT' THEN
    -- Immutable: Customer identity
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
      RAISE EXCEPTION 'Cannot change customer on confirmed order (BR-2 audit)';
    END IF;

    -- Immutable: Customer snapshot
    IF NEW.customer_name_snapshot IS DISTINCT FROM OLD.customer_name_snapshot THEN
      RAISE EXCEPTION 'Cannot modify customer_name_snapshot (historical record)';
    END IF;

    -- Immutable: Broker snapshot
    IF NEW.broker_name_snapshot IS DISTINCT FROM OLD.broker_name_snapshot THEN
      RAISE EXCEPTION 'Cannot modify broker_name_snapshot (historical record)';
    END IF;

    -- Immutable: Credit override audit
    IF NEW.credit_override_approved IS DISTINCT FROM OLD.credit_override_approved THEN
      RAISE EXCEPTION 'Cannot change credit_override_approved after confirmation';
    END IF;
    IF NEW.credit_override_approved_by IS DISTINCT FROM OLD.credit_override_approved_by THEN
      RAISE EXCEPTION 'Cannot modify credit override audit trail';
    END IF;

    -- Flexible: Allow delivery_date changes (customer request)
    -- Flexible: Allow shipping_address changes (customer relocation)
    -- Flexible: Allow warehouse_id changes (dispatch logistics)
    -- Flexible: Allow remarks/delivery_instructions changes
  END IF;

  -- Update audit fields
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid()::VARCHAR(150);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Apply immutability validation to sales_orders
-- ============================================================================

DROP TRIGGER IF EXISTS tr_sales_orders_immutability ON public.sales_orders;
CREATE TRIGGER tr_sales_orders_immutability
BEFORE UPDATE ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_sales_order_update();

-- ============================================================================
-- FUNCTION: Validate sales_order_items immutability
-- ============================================================================
-- Prevents modification of design/pricing fields after order confirmation
-- Allows allocation/dispatch states to change

CREATE OR REPLACE FUNCTION public.validate_sales_order_item_update()
RETURNS TRIGGER AS $$
DECLARE
  v_order_status VARCHAR;
BEGIN
  -- Get parent order status
  SELECT status INTO v_order_status
  FROM public.sales_orders
  WHERE id = NEW.order_id;

  -- Allow ALL updates while parent order is in DRAFT
  IF v_order_status = 'DRAFT' THEN
    RETURN NEW;
  END IF;

  -- For CONFIRMED and beyond, enforce immutability on design/pricing fields
  IF v_order_status <> 'DRAFT' THEN
    -- Immutable: Design identity
    IF NEW.design_id IS DISTINCT FROM OLD.design_id THEN
      RAISE EXCEPTION 'Cannot change design on confirmed line item';
    END IF;

    -- Immutable: Ordered quantity
    IF NEW.qty_metre IS DISTINCT FROM OLD.qty_metre THEN
      RAISE EXCEPTION 'Cannot change ordered quantity after confirmation';
    END IF;

    -- Immutable: Rate per metre (what customer ordered/quoted)
    IF NEW.rate_per_metre IS DISTINCT FROM OLD.rate_per_metre THEN
      RAISE EXCEPTION 'Cannot change rate_per_metre after confirmation';
    END IF;

    -- Immutable: Approved sale rate snapshot
    IF NEW.approved_sale_rate IS DISTINCT FROM OLD.approved_sale_rate THEN
      RAISE EXCEPTION 'Cannot modify approved_sale_rate (pricing snapshot)';
    END IF;

    -- Immutable: Approval audit trail
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
      RAISE EXCEPTION 'Cannot modify approval audit trail';
    END IF;

    -- Flexible: Allow qty_allocated to change (manager allocates stock)
    -- Flexible: Allow qty_reserved to change (system tracks reservations)
    -- Flexible: Allow qty_dispatched, qty_shipped to change (fulfillment)
    -- Flexible: Allow inventory_item_id to change (allocation decision)
    -- Flexible: Allow stock_reservation_id to change (system management)
    -- Flexible: Allow remarks to change (line-level notes)
  END IF;

  -- Update audit fields
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid()::VARCHAR(150);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Apply immutability validation to sales_order_items
-- ============================================================================

DROP TRIGGER IF EXISTS tr_sales_order_items_immutability ON public.sales_order_items;
CREATE TRIGGER tr_sales_order_items_immutability
BEFORE UPDATE ON public.sales_order_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_sales_order_item_update();

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Functions created: 2
--   - validate_sales_order_update() — Order header immutability
--   - validate_sales_order_item_update() — Order line immutability
--
-- Triggers created: 2
--   - tr_sales_orders_immutability
--   - tr_sales_order_items_immutability
--
-- Immutable fields post-confirmation:
--   ORDER: customer_id, customer_name_snapshot, broker_name_snapshot, credit_override_*
--   LINES: design_id, qty_metre, rate_per_metre, approved_sale_rate, approved_by/at
--
-- Flexible fields post-confirmation:
--   ORDER: delivery_date, shipping_address, warehouse_id, remarks
--   LINES: qty_allocated, qty_reserved, qty_dispatched, inventory_item_id, remarks
