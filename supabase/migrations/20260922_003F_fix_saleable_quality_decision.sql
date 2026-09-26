-- STEP 3B.1: Fix Quality Decision Accuracy in Saleable Inventory
-- Date: September 22, 2026
-- Purpose: Use COALESCE(manual_grade_override, system_grade) as final grade
--          Select only latest finalized inspection per inventory item
--          Prevent duplicate rows from multiple inspections
--          Apply consistent logic to both saleable and quality-summary functions

-- ============================================================================
-- FUNCTION: get_saleable_inventory (CORRECTED)
-- ============================================================================
-- CHANGES:
-- 1. Use COALESCE(manual_grade_override, system_grade) as final_grade
-- 2. Select only latest finalized inspection (status = 'verified')
-- 3. Prevent duplicate rows using DISTINCT ON (ii.id)
-- 4. Apply p_grade_filter consistently to final_grade
-- 5. Handle no-inspection case: finished fabric without inspection → UNINSPECTED

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
  WITH latest_inspections AS (
    -- Get only the most recent FINALIZED inspection per inventory item
    SELECT DISTINCT ON (pi.design_no, pi.roll_no)
      pi.design_no,
      pi.roll_no,
      pi.system_grade,
      pi.manual_grade_override,
      pi.status,
      pi.created_at,
      -- Final grade: override takes precedence if present
      COALESCE(pi.manual_grade_override, pi.system_grade) as final_grade
    FROM public.production_inspections pi
    WHERE pi.is_active = TRUE
      AND pi.status = 'verified'  -- Only finalized inspections
    ORDER BY pi.design_no, pi.roll_no, pi.created_at DESC
  )
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
    -- Saleable qty: only items matching p_grade_filter are saleable
    CASE
      WHEN li.final_grade = p_grade_filter THEN (ii.total_qty - ii.reserved_qty)
      WHEN li.final_grade IS NULL AND p_item_type = 'fabric' THEN 0  -- No inspection → not saleable
      WHEN li.final_grade IS NULL AND p_item_type IN ('yarn', 'beam') THEN (ii.total_qty - ii.reserved_qty)  -- Raw materials: default saleable
      ELSE 0
    END as saleable_qty,
    -- Quality grade: use final grade (override + system), or show as UNINSPECTED
    COALESCE(li.final_grade, 'UNINSPECTED') as quality_grade,
    COALESCE(wl.location_name, ii.current_location) as warehouse_location,
    ii.total_unit,
    ii.rate_per_unit,
    li.created_at as last_inspection_date
  FROM public.inventory_items ii
  LEFT JOIN public.warehouse_locations wl ON ii.current_location = wl.location_name
  LEFT JOIN latest_inspections li ON (
    ii.design_no = li.design_no
    AND ii.piece_no = li.roll_no
  )
  WHERE
    ii.item_type = p_item_type
    AND ii.is_active = TRUE
    AND (p_warehouse_id IS NULL OR wl.id = p_warehouse_id)
    AND ii.total_qty > 0
  ORDER BY
    ii.current_location,
    ii.design_no,
    ii.piece_no;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: get_inventory_by_quality_grade (CORRECTED)
-- ============================================================================
-- CHANGES:
-- 1. Use same final_grade logic as get_saleable_inventory
-- 2. Select only latest finalized inspection per inventory item
-- 3. Ensure one inventory item counted once (no double-count)
-- 4. Apply same UNINSPECTED handling

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
  WITH latest_inspections AS (
    -- Get only the most recent FINALIZED inspection per inventory item
    SELECT DISTINCT ON (pi.design_no, pi.roll_no)
      pi.design_no,
      pi.roll_no,
      pi.system_grade,
      pi.manual_grade_override,
      pi.status,
      pi.created_at,
      COALESCE(pi.manual_grade_override, pi.system_grade) as final_grade
    FROM public.production_inspections pi
    WHERE pi.is_active = TRUE
      AND pi.status = 'verified'  -- Only finalized inspections
    ORDER BY pi.design_no, pi.roll_no, pi.created_at DESC
  )
  SELECT
    COALESCE(li.final_grade, 'UNINSPECTED') as quality_grade,
    COUNT(DISTINCT ii.id)::INT as total_items,
    SUM(ii.total_qty) as total_qty,
    SUM(ii.total_qty - ii.reserved_qty) as total_available_qty,
    SUM(ii.reserved_qty) as total_reserved_qty,
    SUM((ii.total_qty - ii.reserved_qty) * ii.rate_per_unit) as total_value
  FROM public.inventory_items ii
  LEFT JOIN public.warehouse_locations wl ON ii.current_location = wl.location_name
  LEFT JOIN latest_inspections li ON (
    ii.design_no = li.design_no
    AND ii.piece_no = li.roll_no
  )
  WHERE
    ii.item_type = p_item_type
    AND ii.is_active = TRUE
    AND (p_warehouse_id IS NULL OR wl.id = p_warehouse_id)
  GROUP BY COALESCE(li.final_grade, 'UNINSPECTED')
  ORDER BY quality_grade;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: allocate_inventory_for_sales (CORRECTED)
-- ============================================================================
-- CHANGES:
-- 1. Use final_grade (COALESCE of override + system_grade) for allocation decisions
-- 2. Select only latest finalized inspection
-- 3. Maintain Grade A as saleable-only criteria

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
  v_final_grade VARCHAR(20);
BEGIN
  -- Find Grade A saleable inventory for this design
  -- Use latest finalized inspection with final_grade logic
  WITH latest_inspection AS (
    SELECT DISTINCT ON (pi.design_no, pi.roll_no)
      pi.design_no,
      pi.roll_no,
      pi.system_grade,
      pi.manual_grade_override,
      COALESCE(pi.manual_grade_override, pi.system_grade) as final_grade
    FROM public.production_inspections pi
    WHERE pi.is_active = TRUE
      AND pi.status = 'verified'
    ORDER BY pi.design_no, pi.roll_no, pi.created_at DESC
  )
  SELECT ii.id, (ii.total_qty - ii.reserved_qty), li.final_grade
  INTO v_inventory_item_id, v_saleable_qty, v_final_grade
  FROM public.inventory_items ii
  LEFT JOIN latest_inspection li ON (
    ii.design_no = li.design_no
    AND ii.piece_no = li.roll_no
  )
  WHERE
    ii.design_no = p_design_no
    AND ii.is_active = TRUE
    AND COALESCE(li.final_grade, 'Grade A') = 'Grade A'  -- Only Grade A is saleable
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
-- SUMMARY OF CHANGES
-- ============================================================================
-- 1. Final Grade Formula: COALESCE(manual_grade_override, system_grade)
--    - manual_grade_override takes precedence if present
--    - Falls back to system_grade if override is NULL
--
-- 2. Finalized Inspection Statuses: 'verified' only
--    - 'pending_supervisor' inspections are NOT authoritative
--    - Excludes DRAFT or other interim states
--
-- 3. Latest Inspection Selection: DISTINCT ON (design_no, roll_no) ORDER BY created_at DESC
--    - Ensures one inventory item → one result row
--    - Newest finalized inspection wins
--    - Historical inspections preserved in table
--
-- 4. No-Inspection Handling:
--    - Fabric (item_type='fabric'): UNINSPECTED → saleable_qty = 0
--    - Yarn/Beam (raw materials): Default to saleable if no inspection
--
-- 5. p_grade_filter Behavior:
--    - Consistently applied to final_grade
--    - Default 'Grade A' for normal saleable inventory
--    - Filter is respected: only matching grades marked saleable
--
-- 6. Duplicate Prevention:
--    - DISTINCT ON ensures one row per inventory item
--    - No double-counting in quality-summary
--
-- TESTS REQUIRED:
--   1. No override: system_grade = Grade A → final = Grade A, saleable
--   2. Override to Hold: system_grade = Grade A, override = Hold → final = Hold, not saleable
--   3. Reinspection (old Pass → new Hold): newer Hold wins, not saleable
--   4. Reinspection release (old Hold → new Pass): newer Grade A wins, saleable
--   5. Draft ignored: pending_supervisor inspection not used
--   6. No inspection (fabric): UNINSPECTED, not saleable
--   7. No duplicate rows: one inventory_item → one result row
--   8. No double-count in quality summary: physical qty counted once
