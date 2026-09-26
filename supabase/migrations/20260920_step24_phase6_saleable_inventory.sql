-- STEP 24 PHASE 6: Saleable Inventory API — Quality Gate Integration
-- Get available inventory by quality grade, warehouse, and lot
-- Date: September 20, 2026

-- ============================================================================
-- FUNCTION: Get saleable inventory with quality grade filtering
-- ============================================================================
-- Returns available inventory filtered by Grade A (saleable)
-- Deducts qty_reserved to provide net available qty
-- Warehouse-scoped and lot-aware for fulfillment operations

CREATE OR REPLACE FUNCTION public.get_saleable_inventory(
  p_warehouse_id UUID DEFAULT NULL,
  p_item_type VARCHAR(20) DEFAULT 'fabric',
  p_grade_filter VARCHAR(20) DEFAULT 'Grade A'
)
RETURNS TABLE (
  item_id UUID,
  item_code VARCHAR,
  item_name VARCHAR,
  design_no VARCHAR,
  job_card_no VARCHAR,
  piece_no VARCHAR,
  total_qty DECIMAL,
  reserved_qty DECIMAL,
  available_qty DECIMAL,
  saleable_qty DECIMAL,
  quality_grade VARCHAR,
  warehouse_location VARCHAR,
  total_unit VARCHAR,
  rate_per_unit DECIMAL,
  last_inspection_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ii.id,
    ii.item_code,
    ii.item_name,
    ii.design_no,
    ii.job_card_no,
    ii.piece_no,
    ii.total_qty,
    ii.reserved_qty,
    (ii.total_qty - ii.reserved_qty) as available_qty,
    -- Saleable qty: only Grade A inventory is saleable
    CASE
      WHEN COALESCE(pi.system_grade, 'Grade A') = p_grade_filter THEN (ii.total_qty - ii.reserved_qty)
      ELSE 0
    END as saleable_qty,
    COALESCE(pi.system_grade, 'Grade A') as quality_grade,
    COALESCE(wl.location_name, ii.current_location) as warehouse_location,
    ii.total_unit,
    ii.rate_per_unit,
    pi.created_at as last_inspection_date
  FROM public.inventory_items ii
  LEFT JOIN public.warehouse_locations wl ON ii.current_location = wl.location_name
  LEFT JOIN public.production_inspections pi ON (
    ii.design_no = pi.design_no
    AND ii.piece_no = pi.roll_no
  )
  WHERE
    ii.item_type = p_item_type
    AND ii.is_active = TRUE
    AND (p_warehouse_id IS NULL OR wl.id = p_warehouse_id)
    AND ii.total_qty > 0
  ORDER BY
    ii.current_location,
    ii.design_no,
    pi.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get quality grade distribution for inventory planning
-- ============================================================================
-- Returns inventory summary by quality grade for dashboard/reporting

CREATE OR REPLACE FUNCTION public.get_inventory_by_quality_grade(
  p_warehouse_id UUID DEFAULT NULL,
  p_item_type VARCHAR(20) DEFAULT 'fabric'
)
RETURNS TABLE (
  quality_grade VARCHAR,
  total_items INT,
  total_qty DECIMAL,
  total_available_qty DECIMAL,
  total_reserved_qty DECIMAL,
  total_value DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(pi.system_grade, 'Grade A') as quality_grade,
    COUNT(DISTINCT ii.id)::INT as total_items,
    SUM(ii.total_qty) as total_qty,
    SUM(ii.total_qty - ii.reserved_qty) as total_available_qty,
    SUM(ii.reserved_qty) as total_reserved_qty,
    SUM((ii.total_qty - ii.reserved_qty) * ii.rate_per_unit) as total_value
  FROM public.inventory_items ii
  LEFT JOIN public.warehouse_locations wl ON ii.current_location = wl.location_name
  LEFT JOIN public.production_inspections pi ON (
    ii.design_no = pi.design_no
    AND ii.piece_no = pi.roll_no
  )
  WHERE
    ii.item_type = p_item_type
    AND ii.is_active = TRUE
    AND (p_warehouse_id IS NULL OR wl.id = p_warehouse_id)
  GROUP BY COALESCE(pi.system_grade, 'Grade A')
  ORDER BY quality_grade;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Allocate inventory for sales order with quality validation
-- ============================================================================
-- Marks inventory as reserved when allocated to sales order
-- Validates sufficient Grade A saleable inventory exists

CREATE OR REPLACE FUNCTION public.allocate_inventory_for_sales(
  p_order_item_id UUID,
  p_design_no VARCHAR(100),
  p_qty_required DECIMAL(10, 2),
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  allocated_qty DECIMAL,
  inventory_item_id UUID,
  message VARCHAR
) AS $$
DECLARE
  v_saleable_qty DECIMAL(10, 2);
  v_inventory_item_id UUID;
  v_current_reserved DECIMAL(10, 2);
  v_new_reserved DECIMAL(10, 2);
BEGIN
  -- Find Grade A saleable inventory for this design
  SELECT ii.id, (ii.total_qty - ii.reserved_qty)
  INTO v_inventory_item_id, v_saleable_qty
  FROM public.inventory_items ii
  LEFT JOIN public.production_inspections pi ON (
    ii.design_no = pi.design_no
    AND ii.piece_no = pi.roll_no
  )
  WHERE
    ii.design_no = p_design_no
    AND ii.is_active = TRUE
    AND COALESCE(pi.system_grade, 'Grade A') = 'Grade A'
    AND (ii.total_qty - ii.reserved_qty) >= p_qty_required
    AND (p_warehouse_id IS NULL OR ii.current_location = (
      SELECT location_name FROM public.warehouse_locations WHERE id = p_warehouse_id
    ))
  ORDER BY ii.created_at ASC
  LIMIT 1;

  -- If no inventory found, return failure
  IF v_inventory_item_id IS NULL THEN
    RETURN QUERY SELECT
      FALSE as success,
      0 as allocated_qty,
      NULL::UUID as inventory_item_id,
      'Insufficient Grade A inventory for design: ' || p_design_no;
    RETURN;
  END IF;

  -- Update inventory reservation
  SELECT reserved_qty INTO v_current_reserved
  FROM public.inventory_items
  WHERE id = v_inventory_item_id;

  v_new_reserved := v_current_reserved + p_qty_required;

  UPDATE public.inventory_items
  SET
    reserved_qty = v_new_reserved,
    updated_at = NOW(),
    updated_by = auth.uid()::VARCHAR(150)
  WHERE id = v_inventory_item_id;

  -- Create stock reservation record if needed
  INSERT INTO public.stock_reservations (
    sales_order_item_id,
    inventory_item_id,
    qty_reserved,
    status,
    created_by,
    updated_by
  ) VALUES (
    p_order_item_id,
    v_inventory_item_id,
    p_qty_required,
    'reserved',
    auth.uid()::VARCHAR(150),
    auth.uid()::VARCHAR(150)
  );

  RETURN QUERY SELECT
    TRUE as success,
    p_qty_required as allocated_qty,
    v_inventory_item_id,
    'Successfully allocated ' || p_qty_required::TEXT || ' units from design ' || p_design_no;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Functions created: 3
--   - get_saleable_inventory() — Query Grade A inventory with warehouse/lot filtering
--   - get_inventory_by_quality_grade() — Summary by quality grade for dashboard
--   - allocate_inventory_for_sales() — Reserve inventory with validation
--
-- Saleable Inventory Rules:
--   - Only Grade A fabric counted as saleable
--   - Grade B/C flagged but NOT deducted from saleable pool (on hold pending disposition)
--   - Hold grade blocks all sales allocation
--   - Deducts qty_reserved from total_qty to provide net available
--   - Warehouse-scoped with location awareness
--   - Lot-level tracking (piece_no/job_card_no) for fulfillment
--
-- Quality Gate Integration:
--   - Joins inventory_items with production_inspections by design_no + piece_no
--   - Uses system_grade or defaults to Grade A if no inspection exists
--   - Allocation function validates Grade A status before reserve
--   - Updates inventory_items.reserved_qty and creates stock_reservations record
--
-- Usage:
--   SELECT * FROM get_saleable_inventory(NULL, 'fabric', 'Grade A');
--   SELECT * FROM get_inventory_by_quality_grade();
--   SELECT * FROM allocate_inventory_for_sales('order-item-id', 'D-001', 100.00);
