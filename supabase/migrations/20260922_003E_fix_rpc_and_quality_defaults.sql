-- STEP 3B IMPLEMENTATION: Fix RPC and Quality Grade Defaults
-- Remove TABLE dependency from RPC, establish safe quality defaults
-- Date: September 22, 2026

-- ============================================================================
-- PART 1: Update complete_quality_inspection() RPC
-- Remove INSERT into saleable_inventory TABLE (now removed in 003D)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_quality_inspection(
  p_inspection_id UUID,
  p_system_grade VARCHAR(50),
  p_override_grade VARCHAR(50) DEFAULT NULL,
  p_decision_by VARCHAR(150) DEFAULT NULL
)
RETURNS TABLE (
  inspection_id UUID,
  job_card_id UUID,
  system_grade VARCHAR(50),
  final_grade VARCHAR(50),
  saleable_qty DECIMAL,
  decision_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_job_card_id UUID;
  v_output_id UUID;
  v_item_id UUID;
  v_qty_produced DECIMAL;
  v_final_grade VARCHAR(50);
  v_saleable_qty DECIMAL;
  v_inspection_status VARCHAR;
BEGIN
  -- Default decision_by to current user if not provided
  IF p_decision_by IS NULL THEN
    v_current_user := auth.uid()::VARCHAR(150);
  ELSE
    v_current_user := p_decision_by;
  END IF;

  -- Validate inspection exists
  SELECT status, job_card_id
  INTO v_inspection_status, v_job_card_id
  FROM public.production_inspections
  WHERE id = p_inspection_id
  FOR UPDATE;

  IF v_inspection_status IS NULL THEN
    RAISE EXCEPTION 'Inspection not found: %', p_inspection_id;
  END IF;

  IF v_inspection_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot complete inspection % in % status (must be DRAFT)', p_inspection_id, v_inspection_status;
  END IF;

  -- Get job card details and output
  SELECT output_id, output_item_id
  INTO v_output_id, v_item_id
  FROM public.job_cards
  WHERE id = v_job_card_id;

  -- Get produced quantity
  SELECT qty_produced
  INTO v_qty_produced
  FROM public.production_output
  WHERE id = v_output_id;

  -- Determine final grade (override takes precedence)
  v_final_grade := COALESCE(p_override_grade, p_system_grade);

  -- Determine saleable quantity based on final grade
  -- Grade A → 100% saleable
  -- Grade B, C → 0% saleable (restricted, needs approval)
  -- Hold → 0% saleable (pending decision)
  IF v_final_grade = 'Grade A' THEN
    v_saleable_qty := v_qty_produced;
  ELSIF v_final_grade IN ('Grade B', 'Grade C', 'Hold') THEN
    v_saleable_qty := 0;
  ELSE
    v_saleable_qty := 0;
  END IF;

  -- Update inspection record with decision
  UPDATE public.production_inspections
  SET
    status = 'COMPLETED',
    system_grade = p_system_grade,
    manual_grade_override = p_override_grade,
    override_reason = CASE WHEN p_override_grade IS NOT NULL THEN 'Quality decision override' ELSE NULL END,
    decision_by = v_current_user,
    decision_at = NOW(),
    updated_at = NOW()
  WHERE id = p_inspection_id;

  -- REMOVED: INSERT INTO public.saleable_inventory (...)
  -- saleable_inventory TABLE no longer exists (removed in migration 003D)
  -- Callers use get_saleable_inventory() FUNCTION to query saleable inventory
  -- which derives saleware_qty from inventory_items + production_inspections

  -- Return decision summary
  RETURN QUERY
  SELECT
    p_inspection_id,
    v_job_card_id,
    p_system_grade,
    v_final_grade,
    v_saleable_qty,
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 2: Fix get_saleable_inventory() FUNCTION
-- Remove dangerous default that treats uninspected items as Grade A
-- ============================================================================

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
    -- FIXED: Saleable qty calculation with safer defaults
    -- For finished goods (fabric): require explicit quality inspection
    -- For raw materials (yarn): use safe defaults per category
    CASE
      WHEN p_item_type = 'fabric' THEN
        -- Finished fabric requires inspection; only Grade A is saleable
        CASE
          WHEN pi.system_grade = 'Grade A' THEN (ii.total_qty - ii.reserved_qty)
          WHEN pi.system_grade IS NOT NULL THEN 0  -- B, C, Hold are not saleable
          ELSE 0  -- NO INSPECTION → NOT SALEABLE (fixed from unsafe default)
        END
      WHEN p_item_type = 'yarn' THEN
        -- Raw yarn may not require inspection; use safe default
        CASE
          WHEN pi.system_grade = 'Grade A' THEN (ii.total_qty - ii.reserved_qty)
          WHEN pi.system_grade IS NOT NULL THEN 0
          ELSE (ii.total_qty - ii.reserved_qty)  -- Uninspected yarn can be saleable
        END
      ELSE
        -- Default: uninspected items are not saleable
        CASE
          WHEN pi.system_grade = p_grade_filter THEN (ii.total_qty - ii.reserved_qty)
          ELSE 0
        END
    END as saleable_qty,
    COALESCE(pi.system_grade, 'UNINSPECTED') as quality_grade,
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
-- PART 3: Update get_inventory_by_quality_grade() FUNCTION (consistency)
-- Also fix the quality default assumption in this function
-- ============================================================================

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
    COALESCE(pi.system_grade, 'UNINSPECTED') as quality_grade,
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
  GROUP BY COALESCE(pi.system_grade, 'UNINSPECTED')
  ORDER BY quality_grade;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- ✓ RPC complete_quality_inspection(): Removed INSERT into saleable_inventory
-- ✓ get_saleable_inventory(): Fixed quality defaults (uninspected → NOT saleable for fabric)
-- ✓ get_inventory_by_quality_grade(): Fixed to show 'UNINSPECTED' instead of defaulting
-- ✓ Audit trail preserved: All decisions recorded in production_inspections
-- ✓ Canonical source: get_saleable_inventory() FUNCTION (not mutable TABLE)
