-- ============================================================================
-- SCKT ERP — CONSOLIDATED FRESH PROJECT DATABASE BOOTSTRAP
-- Target Environment: BRAND-NEW Supabase Project
-- File: supabase/bootstrap/SCKT_FRESH_PROJECT.sql
--
-- DO NOT RUN ON LIVE PRODUCTION DATABASE WITH EXISTING DATA.
-- THIS IS A ONE-SHOT SETUP FOR A FRESH SUPABASE PROJECT.
--
-- Features Included:
--   - Full database schema (60+ tables, views, RPCs, RLS policies, triggers)
--   - Consolidated up to latest migrations 006A to 006E
--   - Design persistence & matrix functions (save_design)
--   - Cost sheet header fields & sheet_no + version uniqueness
--   - Payment allocation atomic RPCs with sales:update permissions
--   - Inventory ledger balance trigger & item creation permissions
--   - Parties party_type categorization
--   - RBAC system roles (admin, manager, operator, viewer) & permission catalog
--   - Auth signup profile creation trigger
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 00: PRECONDITIONS / PRIVILEGES
-- ============================================================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
-- PostgreSQL's built-in PUBLIC EXECUTE default is global, not per-schema.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;



SET LOCAL check_function_bodies = false;

-- ============================================================================
-- SECTION 01: EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 02 - 14: CORE REBUILD SCHEMA
-- ============================================================================
-- =============================================================================
-- SCKT ERP — DATABASE REBUILD (run once in Supabase: SQL Editor -> New query -> Run)
-- Generated 2026-09-25 from supabase/migrations (incl. 005A, 005B, 005C).
--
-- What it does, all inside ONE transaction (any error = nothing is changed):
--   1. Safety check: stops if any table other than roles/profiles holds data.
--   2. Replaces the old 21-table schema.sql layout with the app's schema
--      (61 tables, row-level security on every table).
--   3. Seeds roles (admin/manager/operator/viewer) and the permission catalog.
--   4. Installs the signup trigger and creates profiles for existing users.
--   5. Leaves initial Admin assignment to the deployment operator.
-- No business records are created.
-- =============================================================================



-- 1. Safety check --------------------------------------------------------------
DO $$
DECLARE
  t record;
  n bigint;
  nonempty text := '';
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
             AND tablename NOT IN ('roles', 'profiles')
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t.tablename) INTO n;
    IF n > 0 THEN
      nonempty := nonempty || t.tablename || ' (' || n || ' rows) ';
    END IF;
  END LOOP;
  IF nonempty <> '' THEN
    RAISE EXCEPTION 'Rebuild stopped: these tables contain data: %', nonempty;
  END IF;
END $$;



--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: allocate_inventory_for_sales(uuid, character varying, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.allocate_inventory_for_sales(p_order_item_id uuid, p_design_no character varying, p_qty_required numeric, p_warehouse_id uuid DEFAULT NULL::uuid) RETURNS TABLE(success boolean, allocated_qty numeric, inventory_item_id uuid, message character varying)
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
DECLARE
  v_saleable_qty DECIMAL(10, 2);
  v_inventory_item_id UUID;
  v_current_reserved DECIMAL(10, 2);
  v_new_reserved DECIMAL(10, 2);
  v_final_grade VARCHAR(20);
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.audit_profile_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_changed_fields JSONB := '{}'::jsonb;
BEGIN
  -- Track changed fields
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_changed_fields = jsonb_set(v_changed_fields, '{status}', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    v_changed_fields = jsonb_set(v_changed_fields, '{approval_status}', jsonb_build_object('from', OLD.approval_status, 'to', NEW.approval_status));
  END IF;
  IF NEW.is_locked IS DISTINCT FROM OLD.is_locked THEN
    v_changed_fields = jsonb_set(v_changed_fields, '{is_locked}', jsonb_build_object('from', OLD.is_locked, 'to', NEW.is_locked));
  END IF;

  -- Insert audit log if there were changes
  IF v_changed_fields != '{}'::jsonb THEN
    INSERT INTO public.profile_audit_log (
      profile_id, action, changed_fields, changed_by, changed_by_email, created_at
    ) VALUES (
      NEW.id, 'updated', v_changed_fields, auth.uid(), NEW.email, NOW()
    );
  END IF;

  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_sales_order_atomic(p_order_id uuid) RETURNS TABLE(success boolean, order_id uuid, order_status character varying, total_released numeric, line_count integer, message character varying, cancelled_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
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
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.complete_job_output(p_job_card_id uuid, p_output_qty numeric, p_output_grade character varying DEFAULT 'Grade A'::character varying, p_completed_by character varying DEFAULT NULL::character varying) RETURNS TABLE(job_card_id uuid, output_id uuid, output_qty numeric, grade character varying, completed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_job_status VARCHAR;
  v_output_id UUID;
  v_production_order_id UUID;
  v_item_id UUID;
  v_item_type VARCHAR(50);
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'production:update') THEN
    RAISE EXCEPTION 'Permission denied: production:update required' USING ERRCODE = '42501';
  END IF;

  -- Default completed_by to current user if not provided
  v_current_user := auth.uid()::VARCHAR(150); -- Caller actor parameter retained for compatibility only.

  -- Validate job card exists and is IN_PROGRESS
  SELECT status, production_order_id, output_item_id
  INTO v_job_status, v_production_order_id, v_item_id
  FROM public.job_cards
  WHERE id = p_job_card_id
  FOR UPDATE;

  IF v_job_status IS NULL THEN
    RAISE EXCEPTION 'Job card not found: %', p_job_card_id;
  END IF;

  IF v_job_status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Cannot complete output for job card % in % status (must be IN_PROGRESS)', p_job_card_id, v_job_status;
  END IF;

  -- Get item type from output_item_id
  SELECT item_type
  INTO v_item_type
  FROM public.inventory_items
  WHERE id = v_item_id;

  -- Create production_output record
  INSERT INTO public.production_output (
    job_card_id,
    output_item_id,
    qty_produced,
    grade,
    created_by,
    created_at
  ) VALUES (
    p_job_card_id,
    v_item_id,
    p_output_qty,
    p_output_grade,
    v_current_user,
    NOW()
  )
  RETURNING id INTO v_output_id;

  -- Create transaction ledger: add output to inventory_items
  INSERT INTO public.inventory_transactions (
    item_id,
    movement_type,
    qty_change,
    reference_doc,
    reference_type,
    created_by,
    created_at
  ) VALUES (
    v_item_id,
    'inward_production_output',
    p_output_qty,
    p_job_card_id::TEXT,
    'job_card',
    v_current_user,
    NOW()
  );

  -- Increment inventory item total_qty (output enters inventory)
  UPDATE public.inventory_items
  SET
    total_qty = total_qty + p_output_qty,
    updated_at = NOW()
  WHERE id = v_item_id;

  -- Update job card status to COMPLETED
  UPDATE public.job_cards
  SET
    status = 'COMPLETED',
    completed_at = NOW(),
    completed_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_job_card_id;

  -- Return success
  RETURN QUERY
  SELECT
    p_job_card_id,
    v_output_id,
    p_output_qty,
    p_output_grade,
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_order(p_order_id uuid, p_completion_notes text DEFAULT NULL::text) RETURNS TABLE(order_id uuid, order_no character varying, status character varying, customer_id uuid, total_amount numeric, completed_at timestamp with time zone)
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_status VARCHAR;
  v_invoice_id UUID;
  v_invoice_status VARCHAR;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Get order status
  SELECT status
  INTO v_order_status
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Check if invoiced
  IF v_order_status NOT IN ('INVOICED', 'PAID') THEN
    RAISE EXCEPTION 'Order must be INVOICED or PAID, currently: %', v_order_status;
  END IF;

  -- Get associated invoice
  SELECT id, status
  INTO v_invoice_id, v_invoice_status
  FROM public.sales_invoices
  WHERE order_id = p_order_id
  LIMIT 1;

  IF v_invoice_id IS NOT NULL AND v_invoice_status <> 'PAID' THEN
    RAISE EXCEPTION 'Invoice not fully paid. Invoice status: %', v_invoice_status;
  END IF;

  -- Update order to PAID
  UPDATE public.sales_orders
  SET
    status = 'PAID',
    updated_at = NOW(),
    updated_by = auth.uid()::VARCHAR(150)
  WHERE id = p_order_id;

  RETURN QUERY
  SELECT
    p_order_id,
    (SELECT order_no FROM public.sales_orders WHERE id = p_order_id),
    'PAID'::VARCHAR,
    (SELECT customer_id FROM public.sales_orders WHERE id = p_order_id),
    (SELECT total_amount FROM public.sales_orders WHERE id = p_order_id),
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_quality_inspection(
  p_inspection_id uuid,
  p_system_grade character varying,
  p_override_grade character varying DEFAULT NULL::character varying,
  p_decision_by character varying DEFAULT NULL::character varying
) RETURNS TABLE(inspection_id uuid, job_card_id uuid, system_grade character varying, final_grade character varying, saleable_qty numeric, decision_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_actor_id UUID;
  v_user_email VARCHAR(255);
  v_current_user VARCHAR(150);
  v_job_card_id UUID;
  v_output_id UUID;
  v_item_id UUID;
  v_qty_produced DECIMAL;
  v_final_grade VARCHAR(50);
  v_saleable_qty DECIMAL;
  v_inspection_status VARCHAR;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'quality:write') THEN
    RAISE EXCEPTION 'Permission denied: quality:write required' USING ERRCODE = '42501';
  END IF;

  -- Authenticated check
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to complete quality inspection' USING ERRCODE = '40100';
  END IF;

  -- Permission check
  IF NOT (public.user_has_permission(v_actor_id, 'quality:write') OR public.is_admin(v_actor_id)) THEN
    RAISE EXCEPTION 'Permission denied: quality:write required' USING ERRCODE = '42501';
  END IF;

  -- Authoritative actor identity strictly from auth.users / auth.uid()
  v_current_user := v_actor_id::text;

  -- Validate inspection exists
  SELECT pi.status, pi.job_card_id
  INTO v_inspection_status, v_job_card_id
  FROM public.production_inspections pi
  WHERE pi.id = p_inspection_id
  FOR UPDATE;

  IF v_inspection_status IS NULL THEN
    RAISE EXCEPTION 'Inspection not found: %', p_inspection_id USING ERRCODE = 'P0002';
  END IF;

  IF v_inspection_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot complete inspection % in % status (must be DRAFT)', p_inspection_id, v_inspection_status USING ERRCODE = '22000';
  END IF;

  -- Production outputs reference job cards; job_cards has no output_id column.
  SELECT po.id, po.output_item_id
  INTO v_output_id, v_item_id
  FROM public.production_output po
  WHERE po.job_card_id = v_job_card_id
  ORDER BY po.created_at DESC, po.id DESC
  LIMIT 1;

  -- Get produced quantity
  SELECT qty_produced
  INTO v_qty_produced
  FROM public.production_output
  WHERE id = v_output_id;

  -- Determine final grade (override takes precedence)
  v_final_grade := COALESCE(p_override_grade, p_system_grade);

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
    decision_by = v_current_user,
    decision_at = NOW(),
    updated_at = NOW()
  WHERE id = p_inspection_id;

  RETURN QUERY
  SELECT
    p_inspection_id,
    v_job_card_id,
    p_system_grade,
    v_final_grade,
    v_saleable_qty,
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_sales_order(p_order_id uuid, p_approved_by character varying DEFAULT NULL::character varying) RETURNS TABLE(order_id uuid, status character varying, customer_name_snapshot character varying, broker_name_snapshot character varying, confirmed_at timestamp with time zone, line_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_order_status VARCHAR;
  v_customer_id UUID;
  v_customer_name VARCHAR(200);
  v_broker_name VARCHAR(200);
  v_shipping_address TEXT;
  v_billing_address TEXT;
  v_actor VARCHAR(150);
  v_line_count INTEGER;
  v_confirmed_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;
  -- p_approved_by is retained for API compatibility, never used as authority.
  v_actor := auth.uid()::VARCHAR(150);

  SELECT so.status, so.customer_id, so.broker_name_snapshot,
         so.shipping_address, so.billing_address
  INTO v_order_status, v_customer_id, v_broker_name,
       v_shipping_address, v_billing_address
  FROM public.sales_orders AS so
  WHERE so.id = p_order_id
  FOR UPDATE OF so;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id USING ERRCODE = 'P0002';
  END IF;
  IF v_order_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot confirm order % in % status (must be DRAFT)',
      p_order_id, v_order_status USING ERRCODE = '22000';
  END IF;

  -- Customer IDs reference customers, whose party_id references parties.
  SELECT p.party_name
  INTO v_customer_name
  FROM public.customers AS c
  JOIN public.parties AS p ON p.id = c.party_id
  WHERE c.id = v_customer_id;
  IF NOT FOUND OR NULLIF(btrim(v_customer_name), '') IS NULL THEN
    RAISE EXCEPTION 'Customer has no valid party name for order %', p_order_id
      USING ERRCODE = '22000';
  END IF;
  IF NULLIF(btrim(v_shipping_address), '') IS NULL
     OR NULLIF(btrim(v_billing_address), '') IS NULL THEN
    RAISE EXCEPTION 'Billing and shipping addresses are required for confirmation'
      USING ERRCODE = '22000';
  END IF;

  -- Lock lines before validating and capturing their commercial snapshots.
  PERFORM soi.id FROM public.sales_order_items AS soi
  WHERE soi.order_id = p_order_id ORDER BY soi.id FOR UPDATE OF soi;
  GET DIAGNOSTICS v_line_count = ROW_COUNT;
  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'Order must have at least one line before confirmation'
      USING ERRCODE = '22000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sales_order_items AS soi
    WHERE soi.order_id = p_order_id
      AND (soi.qty_metre <= 0 OR soi.rate_per_metre <= 0
           OR NULLIF(btrim(soi.fabric_quality_name), '') IS NULL
           OR soi.qty_reserved < 0 OR soi.qty_reserved > soi.qty_metre
           OR soi.qty_dispatched < 0 OR soi.qty_dispatched > soi.qty_metre)
  ) THEN
    RAISE EXCEPTION 'Order contains invalid quantities or commercial line fields'
      USING ERRCODE = '22000';
  END IF;

  v_confirmed_at := NOW();
  -- Populate lines while the parent is DRAFT. Existing immutability triggers
  -- correctly reject these snapshot changes after the parent is CONFIRMED.
  UPDATE public.sales_order_items AS soi
  SET design_no_snapshot = COALESCE(
        (SELECT d.design_number FROM public.designs AS d WHERE d.id = soi.design_id),
        soi.design_no),
      design_name_snapshot = (
        SELECT d.design_name FROM public.designs AS d WHERE d.id = soi.design_id),
      cost_sheet_no_snapshot = (
        SELECT cs.sheet_no FROM public.cost_sheets AS cs WHERE cs.id = soi.cost_sheet_id),
      approved_sale_rate = COALESCE(
        (SELECT cs.sale_rate FROM public.cost_sheets AS cs WHERE cs.id = soi.cost_sheet_id),
        soi.rate_per_metre),
      approved_by = v_actor,
      approved_at = v_confirmed_at,
      updated_by = v_actor,
      updated_at = v_confirmed_at
  WHERE soi.order_id = p_order_id;

  -- Broker is the existing order-entered snapshot, not a party relationship.
  -- Billing/shipping and all quantities stay unchanged; no stock is reserved.
  UPDATE public.sales_orders AS so
  SET status = 'CONFIRMED',
      customer_name_snapshot = v_customer_name,
      confirmed_at = v_confirmed_at,
      updated_by = v_actor,
      updated_at = v_confirmed_at
  WHERE so.id = p_order_id;

  RETURN QUERY SELECT p_order_id, 'CONFIRMED'::VARCHAR,
    v_customer_name, v_broker_name, v_confirmed_at, v_line_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_sales_order_with_reservation(p_order_id uuid, p_approved_by character varying DEFAULT NULL::character varying) RETURNS TABLE(order_id uuid, status character varying, confirmed_at timestamp with time zone, line_count integer, reserved_qty numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
BEGIN
  -- DEPRECATED: no current hook/component calls this service method.
  -- Confirmation and canonical reservation approval remain separate actions.
  -- Keep the signature for compatibility, but reject use without side effects.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'confirm_sales_order_with_reservation is deprecated; confirm the order and use the separate reservation flow'
    USING ERRCODE = '0A000';
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_shipment_delivery(p_shipment_id uuid, p_delivered_by character varying DEFAULT NULL::character varying) RETURNS TABLE(shipment_id uuid, order_id uuid, status character varying, delivered_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_shipment_status VARCHAR;
  v_order_id UUID;
  v_line_record RECORD;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Default delivered_by to current user if not provided
  v_current_user := auth.uid()::VARCHAR(150); -- Caller actor parameter retained for compatibility only.

  -- Validate shipment exists and is IN_TRANSIT
  SELECT status, order_id
  INTO v_shipment_status, v_order_id
  FROM public.shipments
  WHERE id = p_shipment_id
  FOR UPDATE;

  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Shipment not found: %', p_shipment_id;
  END IF;

  IF v_shipment_status <> 'IN_TRANSIT' THEN
    RAISE EXCEPTION 'Cannot confirm delivery for shipment % in % status (must be IN_TRANSIT)', p_shipment_id, v_shipment_status;
  END IF;

  -- Atomically decrement inventory for dispatched items
  -- This removes items from available stock (already reserved, now actually leaving warehouse)
  FOR v_line_record IN
    SELECT inventory_item_id, dispatched_quantity
    FROM public.sales_order_items
    WHERE shipment_id = p_shipment_id
    AND dispatched_quantity > 0
  LOOP
    -- Decrement total_qty (physical stock leaves warehouse)
    UPDATE public.inventory_items
    SET
      total_qty = total_qty - v_line_record.dispatched_quantity,
      reserved_qty = reserved_qty - v_line_record.dispatched_quantity,
      updated_at = NOW()
    WHERE id = v_line_record.inventory_item_id;

    -- Create transaction ledger entry
    INSERT INTO public.inventory_transactions (
      item_id,
      movement_type,
      qty_change,
      reference_doc,
      reference_type,
      created_by,
      created_at
    ) VALUES (
      v_line_record.inventory_item_id,
      'dispatch',
      -v_line_record.dispatched_quantity,
      p_shipment_id::TEXT,
      'shipment',
      v_current_user,
      NOW()
    );
  END LOOP;

  -- Update shipment status to DELIVERED
  UPDATE public.shipments
  SET
    status = 'DELIVERED',
    delivered_at = NOW(),
    delivered_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_shipment_id;

  -- Update order status to FULFILLED
  UPDATE public.sales_orders
  SET
    status = 'DELIVERED',
    delivered_at = NOW(),
    delivered_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = v_order_id;

  -- Return delivery confirmation
  RETURN QUERY
  SELECT
    p_shipment_id,
    v_order_id,
    'DELIVERED'::VARCHAR(50),
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_shipment_dispatch(p_shipment_id uuid, p_carrier_name character varying DEFAULT NULL::character varying, p_tracking_number character varying DEFAULT NULL::character varying, p_dispatched_by character varying DEFAULT NULL::character varying) RETURNS TABLE(shipment_id uuid, order_id uuid, status character varying, dispatched_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_shipment_status VARCHAR;
  v_order_id UUID;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Default dispatched_by to current user if not provided
  v_current_user := auth.uid()::VARCHAR(150); -- Caller actor parameter retained for compatibility only.

  -- Validate shipment exists and is in PICKED status
  SELECT status, order_id
  INTO v_shipment_status, v_order_id
  FROM public.shipments
  WHERE id = p_shipment_id
  FOR UPDATE;

  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Shipment not found: %', p_shipment_id;
  END IF;

  IF v_shipment_status <> 'PICKED' THEN
    RAISE EXCEPTION 'Cannot dispatch shipment % in % status (must be PICKED)', p_shipment_id, v_shipment_status;
  END IF;

  -- Update shipment status to IN_TRANSIT
  UPDATE public.shipments
  SET
    status = 'IN_TRANSIT',
    carrier_name = COALESCE(p_carrier_name, carrier_name),
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    dispatched_at = NOW(),
    dispatched_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_shipment_id;

  -- Return dispatch confirmation
  RETURN QUERY
  SELECT
    p_shipment_id,
    v_order_id,
    'IN_TRANSIT'::VARCHAR(50),
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_stock_reservation(p_order_id uuid) RETURNS TABLE(order_id uuid, status character varying, total_reserved numeric, line_count integer, confirmed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_total_reserved DECIMAL;
  v_line_count INT;
  v_line_record RECORD;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.confirm_stock_reservation(p_order_id uuid, p_confirmed_by character varying DEFAULT NULL::character varying) RETURNS TABLE(order_id uuid, status character varying, total_reserved numeric, confirmed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_total_reserved DECIMAL;
  v_line_record RECORD;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Default confirmed_by to current user if not provided
  v_current_user := auth.uid()::VARCHAR(150); -- Caller actor parameter retained for compatibility only.

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
  FOR v_line_record IN
    SELECT id, reserved_quantity
    FROM public.sales_order_items
    WHERE order_id = p_order_id
    AND reserved_quantity = 0
  LOOP
    RAISE EXCEPTION 'Order line % has no reservation', v_line_record.id;
  END LOOP;

  -- Update order status to ALLOCATED (ready for picking)
  UPDATE public.sales_orders
  SET
    status = 'ALLOCATED',
    allocated_at = NOW(),
    allocated_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Calculate total reserved for response
  SELECT COALESCE(SUM(reserved_quantity), 0)
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
$$;

CREATE OR REPLACE FUNCTION public.confirm_stock_reservation_atomic(p_order_id uuid) RETURNS TABLE(order_id uuid, status character varying, total_reserved numeric, line_count integer, success boolean, message character varying, confirmed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_order_warehouse_id UUID;
  v_total_reserved DECIMAL := 0;
  v_line_count INT := 0;
  v_line_record RECORD;
  v_available_qty DECIMAL;
  v_quality_grade VARCHAR;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  v_current_user := auth.uid()::VARCHAR(150);

  -- Validate order exists and is in CONFIRMED status
  -- Lock order for update to prevent concurrent status changes
  SELECT status, warehouse_id
  INTO v_order_status, v_order_warehouse_id
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RETURN QUERY SELECT p_order_id, NULL, 0, 0, FALSE, 'Order not found', NOW();
    RETURN;
  END IF;

  IF v_order_status <> 'CONFIRMED' THEN
    RETURN QUERY SELECT p_order_id, v_order_status, 0, 0, FALSE,
      'Cannot reserve for order in ' || v_order_status || ' status (must be CONFIRMED)', NOW();
    RETURN;
  END IF;

  -- Process each line item
  FOR v_line_record IN
    SELECT id, inventory_item_id, qty_metre
    FROM public.sales_order_items
    WHERE order_id = p_order_id
    ORDER BY id
  LOOP
    -- Lock inventory item and recalculate availability
    SELECT total_qty, reserved_qty
    INTO v_total_reserved, v_available_qty
    FROM public.inventory_items
    WHERE id = v_line_record.inventory_item_id
    FOR UPDATE;

    IF v_total_reserved IS NULL THEN
      -- Skip items that don't exist (shouldn't happen with proper FKs)
      RAISE WARNING 'Inventory item not found: %', v_line_record.inventory_item_id;
      CONTINUE;
    END IF;

    -- Recalculate available WHILE HOLDING LOCK
    v_available_qty := v_total_reserved - v_available_qty;

    -- Check quality grade
    SELECT COALESCE(pi.system_grade, 'Grade A')
    INTO v_quality_grade
    FROM public.production_inspections pi
    WHERE pi.design_no = (SELECT design_no FROM public.inventory_items WHERE id = v_line_record.inventory_item_id)
      AND pi.roll_no = (SELECT piece_no FROM public.inventory_items WHERE id = v_line_record.inventory_item_id)
    ORDER BY pi.created_at DESC
    LIMIT 1;

    -- Only Grade A is saleable
    IF v_quality_grade <> 'Grade A' THEN
      RAISE EXCEPTION 'Insufficient saleable stock for line % (quality: %)', v_line_record.id, v_quality_grade;
    END IF;

    -- Check if sufficient stock exists
    IF v_line_record.qty_metre > v_available_qty THEN
      RAISE EXCEPTION 'Insufficient saleable stock for line % (need: %, available: %)',
        v_line_record.id, v_line_record.qty_metre, v_available_qty;
    END IF;

    -- Update inventory and line atomically (while holding lock)
    UPDATE public.inventory_items
    SET
      reserved_qty = reserved_qty + v_line_record.qty_metre,
      updated_at = NOW()
    WHERE id = v_line_record.inventory_item_id;

    UPDATE public.sales_order_items
    SET
      qty_reserved = v_line_record.qty_metre,
      updated_at = NOW()
    WHERE id = v_line_record.id;

    v_total_reserved := v_total_reserved + v_line_record.qty_metre;
    v_line_count := v_line_count + 1;
  END LOOP;

  -- Update order status to ALLOCATED (all reservations succeeded)
  UPDATE public.sales_orders
  SET
    status = 'ALLOCATED',
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Return success
  RETURN QUERY SELECT
    p_order_id,
    'ALLOCATED'::VARCHAR(50),
    v_total_reserved,
    v_line_count,
    TRUE,
    'All lines reserved successfully',
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_stock_reservation_dispatch(p_order_id uuid, p_confirmed_by character varying DEFAULT NULL::character varying) RETURNS TABLE(order_id uuid, status character varying, total_reserved numeric, confirmed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_total_reserved DECIMAL;
  v_line_record RECORD;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Default confirmed_by to current user if not provided
  v_current_user := auth.uid()::VARCHAR(150); -- Caller actor parameter retained for compatibility only.

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
$$;

CREATE OR REPLACE FUNCTION public.create_fulfillment_from_order(p_order_id uuid, p_warehouse_id uuid DEFAULT NULL::uuid) RETURNS TABLE(fulfillment_id uuid, pick_list_no character varying, order_id uuid, fulfillment_status character varying, item_count integer, created_at timestamp with time zone)
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
DECLARE
  v_pick_list_no VARCHAR(50);
  v_fulfillment_id UUID;
  v_order_status VARCHAR;
  v_item_count INT;
  v_allocated_count INT;
  v_order_item RECORD;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.create_invoice_from_order(p_order_id uuid, p_invoice_date date DEFAULT NULL::date, p_due_date date DEFAULT NULL::date, p_payment_terms_days integer DEFAULT 30) RETURNS TABLE(invoice_id uuid, invoice_no character varying, order_id uuid, customer_id uuid, total_amount numeric, amount_outstanding numeric, status character varying, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user UUID;
  v_order_status VARCHAR;
  v_customer_id UUID;
  v_subtotal_amount DECIMAL(15, 2);
  v_discount_amount DECIMAL(15, 2);
  v_tax_amount DECIMAL(15, 2);
  v_total_amount DECIMAL(15, 2);
  v_invoice_no VARCHAR(50);
  v_invoice_id UUID;
  v_invoice_date_val DATE;
  v_due_date_val DATE;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Validate authentication
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User not authenticated';
  END IF;

  -- Validate permission to create invoices (requires sales:update)
  IF NOT public.user_has_permission(v_current_user, 'sales:update') THEN
    RAISE EXCEPTION 'Insufficient permission: sales:update required to create invoices';
  END IF;

  -- Validate order exists and is DELIVERED or SHIPPED
  SELECT status, customer_id, subtotal_amount, discount_amount, tax_amount, total_amount
  INTO v_order_status, v_customer_id, v_subtotal_amount, v_discount_amount, v_tax_amount, v_total_amount
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_order_status NOT IN ('DELIVERED', 'SHIPPED') THEN
    RAISE EXCEPTION 'Cannot invoice order in % status (must be DELIVERED or SHIPPED)', v_order_status;
  END IF;

  -- Set invoice dates
  v_invoice_date_val := COALESCE(p_invoice_date, CURRENT_DATE);
  v_due_date_val := COALESCE(p_due_date, CURRENT_DATE + (p_payment_terms_days || ' days')::INTERVAL);

  -- Generate invoice number
  v_invoice_no := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((
    SELECT COUNT(*) + 1 FROM public.sales_invoices
    WHERE invoice_date = CURRENT_DATE
  )::TEXT, 5, '0');

  -- Create invoice (use authenticated user, not parameter)
  INSERT INTO public.sales_invoices (
    invoice_no,
    order_id,
    customer_id,
    invoice_date,
    due_date,
    subtotal_amount,
    tax_amount,
    total_amount,
    amount_outstanding,
    status,
    created_by,
    updated_by
  ) VALUES (
    v_invoice_no,
    p_order_id,
    v_customer_id,
    v_invoice_date_val,
    v_due_date_val,
    v_subtotal_amount,
    v_tax_amount,
    v_total_amount,
    v_total_amount,
    'UNPAID',
    v_current_user::VARCHAR(150),
    v_current_user::VARCHAR(150)
  )
  RETURNING id INTO v_invoice_id;

  -- Update order status to INVOICED
  UPDATE public.sales_orders
  SET
    status = 'INVOICED',
    updated_at = NOW(),
    updated_by = v_current_user::VARCHAR(150)
  WHERE id = p_order_id;

  RETURN QUERY
  SELECT
    v_invoice_id,
    v_invoice_no,
    p_order_id,
    v_customer_id,
    v_total_amount,
    v_total_amount,
    'UNPAID'::VARCHAR,
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_shipment(p_order_id uuid, p_warehouse_id uuid, p_shipping_address text, p_carrier_name character varying DEFAULT NULL::character varying, p_tracking_number character varying DEFAULT NULL::character varying, p_prepared_by character varying DEFAULT NULL::character varying) RETURNS TABLE(shipment_id uuid, order_id uuid, status character varying, total_qty_packed numeric, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_shipment_id UUID;
  v_total_qty DECIMAL;
  v_line_record RECORD;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Default prepared_by to current user if not provided
  v_current_user := auth.uid()::VARCHAR(150); -- Caller actor parameter retained for compatibility only.

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
$$;

CREATE OR REPLACE FUNCTION public.create_shipment_atomic(p_order_id uuid, p_order_item_id uuid, p_dispatch_qty numeric, p_warehouse_id uuid, p_shipping_address text DEFAULT NULL::text, p_carrier_name character varying DEFAULT NULL::character varying, p_tracking_number character varying DEFAULT NULL::character varying) RETURNS TABLE(success boolean, shipment_id uuid, order_item_id uuid, inventory_item_id uuid, qty_dispatched numeric, qty_dispatched_total numeric, order_status character varying, message character varying)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_qty_metre DECIMAL;
  v_qty_reserved DECIMAL;
  v_qty_dispatched_current DECIMAL;
  v_inventory_item_id UUID;
  v_total_qty DECIMAL;
  v_design_no VARCHAR;
  v_piece_no VARCHAR;
  v_quality_grade VARCHAR;
  v_shipment_id UUID;
  v_existing_shipment_id UUID;
  v_qty_dispatched_total DECIMAL;
  v_all_lines_dispatched BOOLEAN;
  v_line_count INT;
  v_fully_dispatched_count INT;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Validate authentication
  v_current_user := auth.uid()::VARCHAR(150);
  IF v_current_user IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL, 'Not authenticated';
    RETURN;
  END IF;

  -- Lock and fetch sales order
  SELECT status
  INTO v_order_status
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL, 'Order not found';
    RETURN;
  END IF;

  -- Validate order status allows dispatch
  IF v_order_status NOT IN ('CONFIRMED', 'ALLOCATED') THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL, v_order_status,
      'Cannot dispatch order in ' || v_order_status || ' status. Must be CONFIRMED or ALLOCATED.';
    RETURN;
  END IF;

  -- Lock and fetch sales order item
  SELECT qty_metre, qty_reserved, qty_dispatched, inventory_item_id
  INTO v_qty_metre, v_qty_reserved, v_qty_dispatched_current, v_inventory_item_id
  FROM public.sales_order_items
  WHERE id = p_order_item_id AND order_id = p_order_id
  FOR UPDATE;

  IF v_inventory_item_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL, NULL, 'Sales order item not found';
    RETURN;
  END IF;

  -- Validate dispatch quantity
  IF p_dispatch_qty <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, v_inventory_item_id, 0::DECIMAL, v_qty_dispatched_current,
      v_order_status, 'Dispatch quantity must be > 0';
    RETURN;
  END IF;

  -- Validate dispatch does not exceed reserved quantity
  IF p_dispatch_qty > v_qty_reserved THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, v_inventory_item_id, 0::DECIMAL, v_qty_dispatched_current,
      v_order_status, 'Dispatch qty ' || p_dispatch_qty::VARCHAR || ' exceeds reserved ' || v_qty_reserved::VARCHAR;
    RETURN;
  END IF;

  -- Validate dispatch does not exceed ordered quantity
  IF (v_qty_dispatched_current + p_dispatch_qty) > v_qty_metre THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, v_inventory_item_id, 0::DECIMAL, v_qty_dispatched_current,
      v_order_status, 'Over-dispatch: total would be ' || (v_qty_dispatched_current + p_dispatch_qty)::VARCHAR || ' > ordered ' || v_qty_metre::VARCHAR;
    RETURN;
  END IF;

  -- CRITICAL: Recheck Quality eligibility at dispatch time
  -- Fetch inventory item details for quality query
  SELECT design_no, piece_no, total_qty
  INTO v_design_no, v_piece_no, v_total_qty
  FROM public.inventory_items
  WHERE id = v_inventory_item_id
  FOR UPDATE;

  IF v_total_qty IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, v_inventory_item_id, 0::DECIMAL, v_qty_dispatched_current,
      v_order_status, 'Inventory item not found';
    RETURN;
  END IF;

  -- Recheck physical stock availability
  IF v_total_qty < p_dispatch_qty THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, v_inventory_item_id, 0::DECIMAL, v_qty_dispatched_current,
      v_order_status, 'Insufficient physical stock: ' || v_total_qty::VARCHAR || ' available, ' || p_dispatch_qty::VARCHAR || ' requested';
    RETURN;
  END IF;

  -- Get latest authoritative Quality decision
  SELECT COALESCE(pi.manual_grade_override, pi.system_grade)
  INTO v_quality_grade
  FROM public.production_inspections pi
  WHERE pi.design_no = v_design_no
    AND pi.roll_no = v_piece_no
    AND pi.status = 'verified'
    AND pi.is_active = TRUE
  ORDER BY pi.created_at DESC
  LIMIT 1;

  -- Validate Quality: HOLD or FAIL blocks dispatch
  IF v_quality_grade IS NOT NULL AND v_quality_grade NOT IN ('Grade A') THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, v_inventory_item_id, 0::DECIMAL, v_qty_dispatched_current,
      v_order_status, 'Quality check blocked dispatch: ' || COALESCE(v_quality_grade, 'UNINSPECTED') || ' (only Grade A saleable)';
    RETURN;
  END IF;

  -- If no inspection exists for finished fabric, REJECT dispatch
  -- (uninspected finished fabric is not saleable per quality rules)
  IF v_quality_grade IS NULL THEN
    -- Check if this is finished fabric (needs inspection)
    -- For now, assume unfinished items default to Grade A, finished items block on no inspection
    -- Simplified: Grade A/uninspected are acceptable; anything else blocks
    RETURN QUERY SELECT FALSE, NULL::UUID, p_order_item_id, v_inventory_item_id, 0::DECIMAL, v_qty_dispatched_current,
      v_order_status, 'Dispatch blocked: No finalized quality inspection found for finished fabric';
    RETURN;
  END IF;

  -- Create or fetch shipment header for this order
  SELECT id INTO v_existing_shipment_id
  FROM public.shipments
  WHERE order_id = p_order_id
  LIMIT 1;

  IF v_existing_shipment_id IS NULL THEN
    -- Create new shipment header
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
      'PACKED',
      p_shipping_address,
      p_carrier_name,
      p_tracking_number,
      v_current_user,
      NOW()
    )
    RETURNING id INTO v_shipment_id;
  ELSE
    v_shipment_id := v_existing_shipment_id;
  END IF;

  -- Create Inventory OUT movement
  INSERT INTO public.inventory_transactions (
    transaction_date,
    movement_type,
    reference_doc,
    item_id,
    qty_change,
    unit,
    location_from,
    location_to,
    rate_per_unit,
    created_by,
    created_at
  ) VALUES (
    NOW(),
    'dispatch',
    'SHIPMENT-' || v_shipment_id::VARCHAR,
    v_inventory_item_id,
    -p_dispatch_qty,  -- Negative for outward movement
    'm',  -- metres (textile unit)
    p_warehouse_id::VARCHAR,
    'SHIPPED',
    (SELECT rate_per_unit FROM public.inventory_items WHERE id = v_inventory_item_id),
    v_current_user,
    NOW()
  );

  -- Update physical inventory total_qty (decrement by dispatched amount)
  UPDATE public.inventory_items
  SET
    total_qty = total_qty - p_dispatch_qty,
    updated_at = NOW(),
    updated_by = v_current_user
  WHERE id = v_inventory_item_id;

  -- Update sales order item qty_dispatched
  UPDATE public.sales_order_items
  SET
    qty_dispatched = qty_dispatched + p_dispatch_qty,
    updated_at = NOW(),
    updated_by = v_current_user
  WHERE id = p_order_item_id;

  -- If dispatch qty equals reserved qty, consume the reservation
  IF p_dispatch_qty = v_qty_reserved THEN
    -- Mark reservation as consumed (update qty_reserved to 0, status to CONSUMED if tracking)
    UPDATE public.sales_order_items
    SET
      qty_reserved = 0,
      updated_at = NOW(),
      updated_by = v_current_user
    WHERE id = p_order_item_id;

    -- Also update inventory_items.reserved_qty
    UPDATE public.inventory_items
    SET
      reserved_qty = GREATEST(0, reserved_qty - p_dispatch_qty),
      updated_at = NOW(),
      updated_by = v_current_user
    WHERE id = v_inventory_item_id;
  ELSE
    -- Partial dispatch: only decrement reserved_qty by dispatched amount
    UPDATE public.inventory_items
    SET
      reserved_qty = GREATEST(0, reserved_qty - p_dispatch_qty),
      updated_at = NOW(),
      updated_by = v_current_user
    WHERE id = v_inventory_item_id;

    -- Reconcile qty_reserved from SUM of remaining active reservations
    -- For now, just subtract from current value (assuming single reservation per line)
    UPDATE public.sales_order_items
    SET
      qty_reserved = qty_reserved - p_dispatch_qty,
      updated_at = NOW(),
      updated_by = v_current_user
    WHERE id = p_order_item_id;
  END IF;

  -- Calculate total qty_dispatched for this order
  SELECT COALESCE(SUM(qty_dispatched), 0)
  INTO v_qty_dispatched_total
  FROM public.sales_order_items
  WHERE order_id = p_order_id;

  -- Check if all lines are now fully dispatched
  SELECT COUNT(*), COUNT(CASE WHEN qty_dispatched >= qty_metre THEN 1 END)
  INTO v_line_count, v_fully_dispatched_count
  FROM public.sales_order_items
  WHERE order_id = p_order_id;

  -- Update order status to SHIPPED only if all lines fully dispatched
  IF v_line_count > 0 AND v_fully_dispatched_count = v_line_count THEN
    UPDATE public.sales_orders
    SET
      status = 'SHIPPED',
      updated_by = v_current_user,
      updated_at = NOW()
    WHERE id = p_order_id;

    v_order_status := 'SHIPPED';
  ELSE
    v_order_status := 'ALLOCATED';  -- Remains ALLOCATED for partial dispatch
  END IF;

  -- Return success
  RETURN QUERY SELECT
    TRUE,
    v_shipment_id,
    p_order_item_id,
    v_inventory_item_id,
    p_dispatch_qty,
    v_qty_dispatched_total,
    v_order_status,
    'Dispatched ' || p_dispatch_qty::VARCHAR || ' units. Total dispatched: ' || v_qty_dispatched_total::VARCHAR || '. Order status: ' || v_order_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.deliver_fulfillment(p_fulfillment_id uuid, p_delivery_remarks text DEFAULT NULL::text) RETURNS TABLE(fulfillment_id uuid, pick_list_no character varying, status character varying, delivered_date date, order_status character varying)
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_status VARCHAR;
  v_order_id UUID;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.generate_invoice(p_order_id uuid, p_invoice_date date DEFAULT NULL::date, p_due_date date DEFAULT NULL::date, p_generated_by character varying DEFAULT NULL::character varying) RETURNS TABLE(invoice_id uuid, invoice_number character varying, order_id uuid, total_amount numeric, status character varying, generated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_invoice_id UUID;
  v_invoice_no VARCHAR(50);
  v_total_amount NUMERIC;
  v_customer_name VARCHAR(200);
  v_customer_id UUID;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Default generated_by to current user if not provided
  v_current_user := auth.uid()::VARCHAR(150); -- Caller actor parameter retained for compatibility only.

  -- Validate order exists and is DISPATCHED (shipped)
  SELECT status, total_amount, customer_id, customer_name_snapshot
  INTO v_order_status, v_total_amount, v_customer_id, v_customer_name
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_order_status <> 'DISPATCHED' THEN
    RAISE EXCEPTION 'Cannot generate invoice for order % in % status (must be DISPATCHED)', p_order_id, v_order_status;
  END IF;

  -- Generate invoice number (sequential)
  v_invoice_no := 'INV-' || TO_CHAR(NOW(), 'YYYY-MM-DD-') || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 6, '0');

  -- Create invoice record
  INSERT INTO public.invoices (
    invoice_number,
    order_id,
    customer_id,
    customer_name_snapshot,
    subtotal_amount,
    tax_amount,
    total_amount,
    invoice_date,
    due_date,
    status,
    created_by,
    created_at
  ) VALUES (
    v_invoice_no,
    p_order_id,
    v_customer_id,
    v_customer_name,
    (SELECT COALESCE(SUM(line_total), 0) FROM public.sales_order_items WHERE order_id = p_order_id),
    (SELECT COALESCE((SELECT tax_amount FROM public.sales_orders WHERE id = p_order_id), 0)),
    v_total_amount,
    COALESCE(p_invoice_date, NOW()::DATE),
    COALESCE(p_due_date, (NOW() + INTERVAL '30 days')::DATE),
    'DRAFT',
    v_current_user,
    NOW()
  )
  RETURNING id INTO v_invoice_id;

  -- Update order status to INVOICED
  UPDATE public.sales_orders
  SET
    status = 'INVOICED',
    invoice_id = v_invoice_id,
    invoiced_at = NOW(),
    invoiced_by = v_current_user,
    updated_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Return invoice summary
  RETURN QUERY
  SELECT
    v_invoice_id,
    v_invoice_no,
    p_order_id,
    v_total_amount,
    'DRAFT'::VARCHAR(50),
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_inventory_by_quality_grade(p_warehouse_id uuid DEFAULT NULL::uuid, p_item_type character varying DEFAULT 'fabric'::character varying) RETURNS TABLE(quality_grade character varying, total_items integer, total_qty numeric, total_available_qty numeric, total_reserved_qty numeric, total_value numeric)
    LANGUAGE plpgsql STABLE
    SET search_path = public, pg_temp
AS $$
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'inventory:read') THEN
    RAISE EXCEPTION 'Permission denied: inventory:read required' USING ERRCODE = '42501';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.get_invoice_summary(p_customer_id uuid DEFAULT NULL::uuid) RETURNS TABLE(invoice_id uuid, invoice_no character varying, customer_id uuid, invoice_date date, due_date date, total_amount numeric, amount_paid numeric, amount_outstanding numeric, status character varying, days_outstanding integer, payment_count integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:read') THEN
    RAISE EXCEPTION 'Permission denied: sales:read required' USING ERRCODE = '42501';
  END IF;

  -- Validate authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User not authenticated';
  END IF;

  -- Validate permission to read sales/invoices (requires sales:read)
  IF NOT public.user_has_permission(auth.uid(), 'sales:read') THEN
    RAISE EXCEPTION 'Insufficient permission: sales:read required to view invoices';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.invoice_no,
    i.customer_id,
    i.invoice_date,
    i.due_date,
    i.total_amount,
    i.amount_paid,
    i.amount_outstanding,
    i.status,
    (CURRENT_DATE - i.due_date)::INT as days_outstanding,
    (SELECT COUNT(*) FROM public.sales_payments WHERE invoice_id = i.id)::INT as payment_count
  FROM public.sales_invoices i
  WHERE (p_customer_id IS NULL OR i.customer_id = p_customer_id)
  ORDER BY i.due_date ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_payment_aging_report(p_customer_id uuid DEFAULT NULL::uuid) RETURNS TABLE(aging_bucket character varying, invoice_count integer, total_outstanding numeric, customer_count integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:read') THEN
    RAISE EXCEPTION 'Permission denied: sales:read required' USING ERRCODE = '42501';
  END IF;

  -- Validate authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User not authenticated';
  END IF;

  -- Validate permission to read sales/invoices (requires sales:read)
  IF NOT public.user_has_permission(auth.uid(), 'sales:read') THEN
    RAISE EXCEPTION 'Insufficient permission: sales:read required to view reports';
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN (CURRENT_DATE - i.due_date) <= 0 THEN 'Not Yet Due'
      WHEN (CURRENT_DATE - i.due_date) <= 30 THEN '1-30 Days'
      WHEN (CURRENT_DATE - i.due_date) <= 60 THEN '31-60 Days'
      WHEN (CURRENT_DATE - i.due_date) <= 90 THEN '61-90 Days'
      ELSE '90+ Days'
    END as aging_bucket,
    COUNT(DISTINCT i.id)::INT as invoice_count,
    SUM(i.amount_outstanding) as total_outstanding,
    COUNT(DISTINCT i.customer_id)::INT as customer_count
  FROM public.sales_invoices i
  WHERE (p_customer_id IS NULL OR i.customer_id = p_customer_id)
    AND i.status IN ('UNPAID', 'PARTIAL')
  GROUP BY aging_bucket
  ORDER BY aging_bucket;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_saleable_inventory(p_warehouse_id uuid DEFAULT NULL::uuid, p_item_type character varying DEFAULT 'fabric'::character varying, p_grade_filter character varying DEFAULT 'Grade A'::character varying) RETURNS TABLE(item_id uuid, item_code character varying, item_name character varying, design_no character varying, job_card_no character varying, piece_no character varying, total_qty numeric, reserved_qty numeric, available_qty numeric, saleable_qty numeric, quality_grade character varying, warehouse_location character varying, total_unit character varying, rate_per_unit numeric, last_inspection_date timestamp with time zone)
    LANGUAGE plpgsql STABLE
    SET search_path = public, pg_temp
AS $$
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'inventory:read') THEN
    RAISE EXCEPTION 'Permission denied: inventory:read required' USING ERRCODE = '42501';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.get_user_effective_permissions(_user_id uuid) RETURNS TABLE(permission_id uuid, permission_code character varying, module character varying, action character varying)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
  SELECT DISTINCT p.id, p.permission_code, p.module, p.action
  FROM public.permissions p
  WHERE p.is_active IS DISTINCT FROM FALSE
    AND (
      public.is_admin(_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.rbac_user_role_ids(_user_id) r(role_id)
        JOIN public.role_permissions rp ON rp.role_id = r.role_id
        WHERE rp.permission_id = p.id
      )
    )
  ORDER BY p.module, p.action;
$$;

CREATE OR REPLACE FUNCTION public.get_user_primary_role_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
  SELECT COALESCE(
    (SELECT m.role_id
       FROM public.user_roles_mapping m
       JOIN public.rbac_user_role_ids(_user_id) r(role_id) ON r.role_id = m.role_id
      WHERE m.user_id = _user_id AND m.is_primary
      LIMIT 1),
    (SELECT r.role_id FROM public.rbac_user_role_ids(_user_id) r(role_id) LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
  SELECT rd.role_code::text
  FROM public.role_definitions rd
  WHERE rd.id = public.get_user_primary_role_id(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
BEGIN
  -- auth.uid() is NULL for service-role / SQL editor / internal triggers.
  IF auth.uid() IS NULL OR public.user_has_permission(auth.uid(), 'user_management:write') THEN
    RETURN NEW;
  END IF;

  IF NEW.primary_role_id IS DISTINCT FROM OLD.primary_role_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR (to_jsonb(NEW) -> 'approval_status') IS DISTINCT FROM (to_jsonb(OLD) -> 'approval_status')
     OR (to_jsonb(NEW) -> 'approved_by') IS DISTINCT FROM (to_jsonb(OLD) -> 'approved_by')
     OR (to_jsonb(NEW) -> 'approved_at') IS DISTINCT FROM (to_jsonb(OLD) -> 'approved_at')
     OR (to_jsonb(NEW) -> 'is_locked') IS DISTINCT FROM (to_jsonb(OLD) -> 'is_locked')
     OR (to_jsonb(NEW) -> 'additional_role_ids') IS DISTINCT FROM (to_jsonb(OLD) -> 'additional_role_ids')
     OR (to_jsonb(NEW) -> 'creation_method') IS DISTINCT FROM (to_jsonb(OLD) -> 'creation_method')
  THEN
    RAISE EXCEPTION 'Not allowed to change role, status or approval fields of a profile'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  display text := COALESCE(
    NULLIF(meta ->> 'full_name', ''),
    NULLIF(meta ->> 'display_name', ''),
    NULLIF(trim(concat_ws(' ', meta ->> 'first_name', meta ->> 'last_name')), ''),
    NEW.email
  );
  col text;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, display)
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(public.profiles.email, EXCLUDED.email),
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  -- Optional name columns added by later migrations.
  FOREACH col IN ARRAY ARRAY['first_name', 'last_name', 'display_name']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = col
    ) AND meta ? col THEN
      EXECUTE format(
        'UPDATE public.profiles SET %I = COALESCE(%I, $1) WHERE id = $2',
        col,
        col
      ) USING meta ->> col, NEW.id;
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block account creation; the app reports a missing profile to the user.
  RAISE WARNING 'handle_new_user: profile not created for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_preferences() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id, preferred_language)
  VALUES (NEW.id, 'en')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_rbac() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, primary_role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'viewer'  -- Default new users to 'viewer' role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    primary_role_id = COALESCE(public.profiles.primary_role_id, 'viewer')
  ;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$SELECT EXISTS (SELECT 1 FROM public.rbac_user_role_ids(_user_id) r(role_id) JOIN public.role_definitions rd ON rd.id = r.role_id WHERE rd.role_code = _role::text)$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rbac_user_role_ids(_user_id) r(role_id)
    JOIN public.role_definitions rd ON rd.id = r.role_id
    WHERE rd.role_code = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.issue_material_to_production(p_job_card_id uuid, p_inventory_item_id uuid, p_qty_to_issue numeric, p_issued_by character varying DEFAULT NULL::character varying) RETURNS TABLE(job_card_id uuid, item_id uuid, qty_issued numeric, available_after numeric, transaction_id uuid, issued_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_total_qty DECIMAL;
  v_available_qty DECIMAL;
  v_reserved_qty DECIMAL;
  v_transaction_id UUID;
  v_rate_per_unit DECIMAL;
  v_job_status VARCHAR;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'production:update') THEN
    RAISE EXCEPTION 'Permission denied: production:update required' USING ERRCODE = '42501';
  END IF;

  -- Default issued_by to current user if not provided
  v_current_user := auth.uid()::VARCHAR(150); -- Caller actor parameter retained for compatibility only.

  -- Validate job card exists and is in IN_PROGRESS status
  SELECT status
  INTO v_job_status
  FROM public.job_cards
  WHERE id = p_job_card_id
  FOR UPDATE;

  IF v_job_status IS NULL THEN
    RAISE EXCEPTION 'Job card not found: %', p_job_card_id;
  END IF;

  IF v_job_status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Cannot issue material to job card % in % status (must be IN_PROGRESS)', p_job_card_id, v_job_status;
  END IF;

  -- Lock and validate inventory item exists with sufficient stock
  SELECT total_qty, available_qty, reserved_qty, rate_per_unit
  INTO v_total_qty, v_available_qty, v_reserved_qty, v_rate_per_unit
  FROM public.inventory_items
  WHERE id = p_inventory_item_id
  FOR UPDATE;

  IF v_total_qty IS NULL THEN
    RAISE EXCEPTION 'Inventory item not found: %', p_inventory_item_id;
  END IF;

  IF v_available_qty < p_qty_to_issue THEN
    RAISE EXCEPTION 'Insufficient available stock. Available: %, Requested: %', v_available_qty, p_qty_to_issue;
  END IF;

  -- Decrement total_qty (atomic via constraint: available = total - reserved)
  UPDATE public.inventory_items
  SET
    total_qty = total_qty - p_qty_to_issue,
    updated_at = NOW()
  WHERE id = p_inventory_item_id;

  -- Create transaction ledger entry (append-only)
  INSERT INTO public.inventory_transactions (
    item_id,
    movement_type,
    qty_change,
    rate_per_unit,
    reference_doc,
    reference_type,
    created_by,
    created_at
  ) VALUES (
    p_inventory_item_id,
    'issue_to_production',
    -p_qty_to_issue,
    v_rate_per_unit,
    p_job_card_id::TEXT,
    'job_card',
    v_current_user,
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- Update job card with material issuance timestamp
  UPDATE public.job_cards
  SET
    material_issued_at = NOW(),
    material_issued_by = v_current_user,
    updated_at = NOW()
  WHERE id = p_job_card_id;

  -- Return success with updated inventory state
  RETURN QUERY
  SELECT
    p_job_card_id,
    p_inventory_item_id,
    p_qty_to_issue,
    v_available_qty - p_qty_to_issue,
    v_transaction_id,
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.rbac_user_role_ids(_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
  WITH profile AS (
    SELECT p.primary_role_id, p.status FROM public.profiles p WHERE p.id = _user_id
  ),
  blocked AS (
    SELECT EXISTS (
      SELECT 1 FROM profile WHERE status IS NOT NULL AND status <> 'ACTIVE'
    ) AS is_blocked
  ),
  explicit AS (
    SELECT m.role_id
    FROM public.user_roles_mapping m
    JOIN public.role_definitions rd ON rd.id = m.role_id
    WHERE m.user_id = _user_id
      AND m.is_active IS DISTINCT FROM FALSE
      AND rd.is_active IS DISTINCT FROM FALSE
  ),
  has_assignment AS (
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles_mapping m
      WHERE m.user_id = _user_id AND m.is_active IS DISTINCT FROM FALSE
    ) AS any_row
  )
  SELECT role_id FROM explicit, blocked WHERE NOT blocked.is_blocked
  UNION
  SELECT rd.id
  FROM profile
  JOIN public.role_definitions rd ON rd.role_code = lower(trim(profile.primary_role_id))
  CROSS JOIN blocked
  CROSS JOIN has_assignment
  WHERE NOT blocked.is_blocked
    AND NOT has_assignment.any_row
    AND rd.is_active IS DISTINCT FROM FALSE
$$;

CREATE OR REPLACE FUNCTION public.record_payment(p_invoice_id uuid, p_amount_paid numeric, p_payment_method character varying, p_reference_number character varying DEFAULT NULL::character varying, p_remarks text DEFAULT NULL::text) RETURNS TABLE(payment_id uuid, invoice_id uuid, amount_paid numeric, total_amount_paid numeric, amount_outstanding numeric, invoice_status character varying, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user UUID;
  v_invoice_total DECIMAL(15, 2);
  v_current_paid DECIMAL(15, 2);
  v_new_paid DECIMAL(15, 2);
  v_new_outstanding DECIMAL(15, 2);
  v_new_status VARCHAR(20);
  v_payment_id UUID;
  v_customer_id UUID;
  v_order_id UUID;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Validate authentication
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User not authenticated';
  END IF;

  -- Validate permission to record payments (requires sales:update)
  IF NOT public.user_has_permission(v_current_user, 'sales:update') THEN
    RAISE EXCEPTION 'Insufficient permission: sales:update required to record payments';
  END IF;

  -- Validate invoice exists
  SELECT total_amount, amount_paid, customer_id, order_id
  INTO v_invoice_total, v_current_paid, v_customer_id, v_order_id
  FROM public.sales_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice_total IS NULL THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  -- Validate payment amount
  IF p_amount_paid <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  -- Calculate new totals
  v_new_paid := v_current_paid + p_amount_paid;

  IF v_new_paid > v_invoice_total THEN
    RAISE EXCEPTION 'Payment amount exceeds invoice total. Invoice: %, Paid so far: %, New payment: %',
      v_invoice_total, v_current_paid, p_amount_paid;
  END IF;

  v_new_outstanding := v_invoice_total - v_new_paid;

  -- Determine new status
  IF v_new_outstanding = 0 THEN
    v_new_status := 'PAID';
  ELSIF v_new_paid > 0 THEN
    v_new_status := 'PARTIAL';
  ELSE
    v_new_status := 'UNPAID';
  END IF;

  -- Record payment (use authenticated user, not parameter)
  INSERT INTO public.sales_payments (
    invoice_id,
    payment_date,
    amount_paid,
    payment_method,
    reference_number,
    remarks,
    created_by
  ) VALUES (
    p_invoice_id,
    CURRENT_DATE,
    p_amount_paid,
    p_payment_method,
    p_reference_number,
    p_remarks,
    v_current_user::VARCHAR(150)
  )
  RETURNING id INTO v_payment_id;

  -- Update invoice
  UPDATE public.sales_invoices
  SET
    amount_paid = v_new_paid,
    amount_outstanding = v_new_outstanding,
    status = v_new_status,
    updated_at = NOW(),
    updated_by = v_current_user::VARCHAR(150)
  WHERE id = p_invoice_id;

  -- Update order status if fully paid
  IF v_new_status = 'PAID' THEN
    UPDATE public.sales_orders
    SET
      status = 'PAID',
      updated_at = NOW(),
      updated_by = v_current_user::VARCHAR(150)
    WHERE id = v_order_id;
  END IF;

  RETURN QUERY
  SELECT
    v_payment_id,
    p_invoice_id,
    p_amount_paid,
    v_new_paid,
    v_new_outstanding,
    v_new_status::VARCHAR,
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment(p_invoice_id uuid, p_amount_paid numeric, p_payment_method character varying, p_reference_number character varying DEFAULT NULL::character varying, p_payment_date date DEFAULT NULL::date, p_recorded_by character varying DEFAULT NULL::character varying) RETURNS TABLE(payment_id uuid, invoice_id uuid, amount_paid numeric, status character varying, recorded_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_invoice_status VARCHAR;
  v_payment_id UUID;
  v_order_id UUID;
  v_invoice_total NUMERIC;
  v_paid_to_date NUMERIC;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Default recorded_by to current user if not provided
  v_current_user := auth.uid()::VARCHAR(150); -- Caller actor parameter retained for compatibility only.

  -- Validate invoice exists and is DRAFT (not paid)
  SELECT status, order_id, total_amount
  INTO v_invoice_status, v_order_id, v_invoice_total
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice_status IS NULL THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  IF v_invoice_status NOT IN ('DRAFT', 'SENT') THEN
    RAISE EXCEPTION 'Cannot record payment for invoice % in % status', p_invoice_id, v_invoice_status;
  END IF;

  -- Validate payment amount doesn't exceed invoice total
  SELECT COALESCE(SUM(amount_paid), 0)
  INTO v_paid_to_date
  FROM public.payments
  WHERE invoice_id = p_invoice_id
  AND status NOT IN ('REVERSED', 'FAILED');

  IF (v_paid_to_date + p_amount_paid) > v_invoice_total THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds invoice total (%). Already paid: %',
      p_amount_paid, v_invoice_total, v_paid_to_date;
  END IF;

  -- Create payment record
  INSERT INTO public.payments (
    invoice_id,
    amount_paid,
    payment_method,
    reference_number,
    payment_date,
    status,
    created_by,
    created_at
  ) VALUES (
    p_invoice_id,
    p_amount_paid,
    p_payment_method,
    p_reference_number,
    COALESCE(p_payment_date, NOW()::DATE),
    'COMPLETED',
    v_current_user,
    NOW()
  )
  RETURNING id INTO v_payment_id;

  -- If full payment received, update invoice to PAID
  IF (v_paid_to_date + p_amount_paid) >= v_invoice_total THEN
    UPDATE public.invoices
    SET
      status = 'PAID',
      paid_amount = v_paid_to_date + p_amount_paid,
      paid_at = NOW(),
      updated_by = v_current_user,
      updated_at = NOW()
    WHERE id = p_invoice_id;

    -- Update order status to PAID
    UPDATE public.sales_orders
    SET
      status = 'PAID',
      paid_at = NOW(),
      paid_by = v_current_user,
      updated_by = v_current_user,
      updated_at = NOW()
    WHERE id = v_order_id;
  ELSE
    -- Partial payment - update invoice to PARTIAL
    UPDATE public.invoices
    SET
      status = 'PARTIAL',
      paid_amount = v_paid_to_date + p_amount_paid,
      updated_by = v_current_user,
      updated_at = NOW()
    WHERE id = p_invoice_id;
  END IF;

  -- Return payment summary
  RETURN QUERY
  SELECT
    v_payment_id,
    p_invoice_id,
    p_amount_paid,
    'COMPLETED'::VARCHAR(50),
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.release_sales_stock_atomic(p_order_item_id uuid) RETURNS TABLE(success boolean, order_item_id uuid, inventory_item_id uuid, qty_released numeric, qty_reserved_after numeric, message character varying)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
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
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.reserve_sales_stock_atomic(p_order_id uuid, p_order_item_id uuid, p_requested_qty numeric) RETURNS TABLE(success boolean, order_item_id uuid, inventory_item_id uuid, reserved_qty numeric, available_after_reserve numeric, message character varying)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_order_warehouse_id UUID;
  v_inventory_item_id UUID;
  v_current_qty_reserved DECIMAL;
  v_total_qty DECIMAL;
  v_current_reserved_qty DECIMAL;
  v_available_qty DECIMAL;
  v_quality_grade VARCHAR;
  v_saleable_qty DECIMAL;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- Validate authentication
  v_current_user := auth.uid()::VARCHAR(150);
  IF v_current_user IS NULL THEN
    RETURN QUERY SELECT FALSE, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 'Not authenticated';
    RETURN;
  END IF;

  -- Validate sales order exists and is in CONFIRMED status
  SELECT status, warehouse_id
  INTO v_order_status, v_order_warehouse_id
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RETURN QUERY SELECT FALSE, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 'Order not found';
    RETURN;
  END IF;

  IF v_order_status NOT IN ('CONFIRMED', 'ALLOCATED') THEN
    RETURN QUERY SELECT FALSE, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL,
      'Cannot reserve for order in ' || v_order_status || ' status (must be CONFIRMED or ALLOCATED)';
    RETURN;
  END IF;

  -- Validate requested quantity
  IF p_requested_qty <= 0 THEN
    RETURN QUERY SELECT FALSE, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 'Requested quantity must be > 0';
    RETURN;
  END IF;

  -- Get sales order item and validate it belongs to this order
  SELECT inventory_item_id, qty_reserved
  INTO v_inventory_item_id, v_current_qty_reserved
  FROM public.sales_order_items
  WHERE id = p_order_item_id AND order_id = p_order_id
  FOR UPDATE;

  IF v_inventory_item_id IS NULL THEN
    RETURN QUERY SELECT FALSE, p_order_item_id, NULL::UUID, 0::DECIMAL, 0::DECIMAL, 'Sales order item not found';
    RETURN;
  END IF;

  -- CRITICAL: Lock inventory item BEFORE availability check
  -- This prevents other transactions from modifying stock while we calculate availability
  SELECT total_qty, reserved_qty
  INTO v_total_qty, v_current_reserved_qty
  FROM public.inventory_items
  WHERE id = v_inventory_item_id
  FOR UPDATE;

  IF v_total_qty IS NULL THEN
    RETURN QUERY SELECT FALSE, p_order_item_id, v_inventory_item_id, 0::DECIMAL, 0::DECIMAL, 'Inventory item not found';
    RETURN;
  END IF;

  -- Validate inventory item is in warehouse expected by sales order
  -- (Implicit: current_location matches warehouse_id, or warehouse_id validation)

  -- Recalculate saleable availability WHILE HOLDING LOCK
  -- This is the authoritative check - cannot be invalidated between check and update
  v_available_qty := v_total_qty - v_current_reserved_qty;

  -- Get quality grade for this inventory item
  -- (Must be Grade A to be saleable - from STEP 3B quality logic)
  SELECT COALESCE(pi.system_grade, 'Grade A')
  INTO v_quality_grade
  FROM public.production_inspections pi
  WHERE pi.design_no = (SELECT design_no FROM public.inventory_items WHERE id = v_inventory_item_id)
    AND pi.roll_no = (SELECT piece_no FROM public.inventory_items WHERE id = v_inventory_item_id)
  ORDER BY pi.created_at DESC
  LIMIT 1;

  -- Determine saleable quantity based on quality grade
  v_saleable_qty := CASE
    WHEN v_quality_grade = 'Grade A' THEN v_available_qty
    ELSE 0
  END;

  -- Check if sufficient saleable stock exists
  IF p_requested_qty > v_saleable_qty THEN
    RETURN QUERY SELECT FALSE, p_order_item_id, v_inventory_item_id, 0::DECIMAL, v_saleable_qty,
      'Insufficient saleable stock. Available: ' || v_saleable_qty::VARCHAR || ', Requested: ' || p_requested_qty::VARCHAR;
    RETURN;
  END IF;

  -- ATOMIC: Update both inventory_items.reserved_qty and sales_order_items.qty_reserved
  -- Both updates occur in same transaction while lock is held
  UPDATE public.inventory_items
  SET
    reserved_qty = reserved_qty + p_requested_qty,
    updated_at = NOW()
  WHERE id = v_inventory_item_id;

  UPDATE public.sales_order_items
  SET
    qty_reserved = p_requested_qty,
    updated_at = NOW()
  WHERE id = p_order_item_id;

  -- Return success
  RETURN QUERY SELECT
    TRUE,
    p_order_item_id,
    v_inventory_item_id,
    p_requested_qty,
    (v_saleable_qty - p_requested_qty),
    'Reservation successful';
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_payment_sequence_if_needed() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_last_reset DATE;
BEGIN
  -- Check if we need to reset the sequence for a new day
  -- This is handled implicitly by the payment numbering logic
  -- which uses CURRENT_DATE as part of the number format
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ship_fulfillment(p_fulfillment_id uuid, p_tracking_number character varying DEFAULT NULL::character varying, p_carrier character varying DEFAULT NULL::character varying) RETURNS TABLE(fulfillment_id uuid, pick_list_no character varying, status character varying, shipped_date date, tracking_number character varying, carrier character varying)
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_status VARCHAR;
  v_order_id UUID;
  v_fulfillment_item RECORD;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.update_fulfillment_item(p_fulfillment_item_id uuid, p_qty_picked numeric DEFAULT NULL::numeric, p_qty_packed numeric DEFAULT NULL::numeric, p_qty_shipped numeric DEFAULT NULL::numeric, p_bin_location character varying DEFAULT NULL::character varying) RETURNS TABLE(fulfillment_item_id uuid, qty_to_ship numeric, qty_picked numeric, qty_packed numeric, qty_shipped numeric, fulfillment_status character varying)
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
DECLARE
  v_qty_to_ship DECIMAL(10, 2);
  v_fulfillment_id UUID;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_user_preferences_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission_code character varying) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
  SELECT public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.rbac_user_role_ids(_user_id) r(role_id)
      JOIN public.role_permissions rp ON rp.role_id = r.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE p.permission_code = _permission_code
        AND p.is_active IS DISTINCT FROM FALSE
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission_v2(_user_id uuid, _permission_code character varying) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
  SELECT public.user_has_permission(_user_id, _permission_code);
$$;

CREATE OR REPLACE FUNCTION public.user_owns_record(_user_id uuid, _record_owner_id uuid) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT _user_id = _record_owner_id;
$$;

CREATE OR REPLACE FUNCTION public.validate_sales_order_item_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.validate_sales_order_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.update_inventory_balance() RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
BEGIN
  -- Update or create balance cache entry
  INSERT INTO public.inventory_balances_cache (
    item_id,
    total_inward_qty,
    total_issued_qty,
    total_reserved_qty,
    total_cost,
    last_transaction_at,
    updated_at
  )
  SELECT
    item_id,
    COALESCE(SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END), 0),
    COALESCE(SUM(reserved_qty_delta), 0),
    COALESCE(SUM(cost_value), 0),
    MAX(transaction_date),
    NOW()
  FROM public.inventory_transactions
  WHERE item_id = NEW.item_id
  GROUP BY item_id
  ON CONFLICT (item_id) DO UPDATE
  SET
    total_inward_qty = EXCLUDED.total_inward_qty,
    total_issued_qty = EXCLUDED.total_issued_qty,
    total_reserved_qty = EXCLUDED.total_reserved_qty,
    total_cost = EXCLUDED.total_cost,
    last_transaction_at = EXCLUDED.last_transaction_at,
    updated_at = NOW();

  -- Update inventory_items denormalized fields
  UPDATE public.inventory_items
  SET
    total_qty = (
      SELECT net_qty FROM public.inventory_balances_cache WHERE item_id = NEW.item_id
    ),
    reserved_qty = (
      SELECT total_reserved_qty FROM public.inventory_balances_cache WHERE item_id = NEW.item_id
    ),
    current_location = NEW.location_to,
    updated_at = NOW()
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_design(
  p_design_id UUID,
  p_design JSONB,
  p_beam_colours JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID := p_design_id;
  v_colour JSONB;
  v_colour_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(trim(p_design ->> 'design_number'), '') = '' THEN
    RAISE EXCEPTION 'Design number is required' USING ERRCODE = '23514';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.designs (
      design_number, design_name, dn, dn_code, reed, pick, cards, patti,
      total_dc, total_cut, work, blue_apt, description, remarks, image,
      created_by, updated_by
    ) VALUES (
      upper(trim(p_design ->> 'design_number')),
      NULLIF(trim(p_design ->> 'design_name'), ''),
      NULLIF(p_design ->> 'dn', ''),
      NULLIF(p_design ->> 'dn_code', ''),
      (p_design ->> 'reed')::NUMERIC,
      (p_design ->> 'pick')::NUMERIC,
      (p_design ->> 'cards')::NUMERIC,
      (p_design ->> 'patti')::NUMERIC,
      (p_design ->> 'total_dc')::NUMERIC,
      (p_design ->> 'total_cut')::NUMERIC,
      NULLIF(p_design ->> 'work', ''),
      NULLIF(p_design ->> 'blue_apt', ''),
      NULLIF(p_design ->> 'description', ''),
      NULLIF(p_design ->> 'remarks', ''),
      NULLIF(p_design ->> 'image', ''),
      auth.uid(),
      auth.uid()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.designs SET
      design_number = upper(trim(p_design ->> 'design_number')),
      design_name = NULLIF(trim(p_design ->> 'design_name'), ''),
      dn = NULLIF(p_design ->> 'dn', ''),
      dn_code = NULLIF(p_design ->> 'dn_code', ''),
      reed = (p_design ->> 'reed')::NUMERIC,
      pick = (p_design ->> 'pick')::NUMERIC,
      cards = (p_design ->> 'cards')::NUMERIC,
      patti = (p_design ->> 'patti')::NUMERIC,
      total_dc = (p_design ->> 'total_dc')::NUMERIC,
      total_cut = (p_design ->> 'total_cut')::NUMERIC,
      work = NULLIF(p_design ->> 'work', ''),
      blue_apt = NULLIF(p_design ->> 'blue_apt', ''),
      description = NULLIF(p_design ->> 'description', ''),
      remarks = NULLIF(p_design ->> 'remarks', ''),
      image = NULLIF(p_design ->> 'image', ''),
      updated_by = auth.uid(),
      updated_at = NOW()
    WHERE id = v_id AND archived_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Design not found, archived, or you do not have permission to edit it'
        USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.beam_colours WHERE design_id = v_id;
  END IF;

  FOR v_colour IN SELECT value FROM jsonb_array_elements(COALESCE(p_beam_colours, '[]'::JSONB))
  LOOP
    INSERT INTO public.beam_colours (design_id, beam_colour, display_order)
    VALUES (
      v_id,
      trim(v_colour ->> 'beam_colour'),
      COALESCE((v_colour ->> 'display_order')::INTEGER, 1)
    )
    RETURNING id INTO v_colour_id;

    INSERT INTO public.feeders (
      beam_colour_id, feeder_number, color_name, old_number, pick, card, display_order
    )
    SELECT
      v_colour_id,
      f ->> 'feeder_number',
      COALESCE(f ->> 'color_name', ''),
      NULLIF(f ->> 'old_number', ''),
      (f ->> 'pick')::NUMERIC,
      (f ->> 'card')::NUMERIC,
      COALESCE((f ->> 'display_order')::INTEGER, 1)
    FROM jsonb_array_elements(COALESCE(v_colour -> 'feeders', '[]'::JSONB)) AS f;
  END LOOP;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment_atomic(p_customer_id uuid, p_amount numeric, p_payment_method character varying, p_reference_number character varying DEFAULT NULL::character varying, p_payment_date date DEFAULT NULL::date, p_remarks text DEFAULT NULL::text) RETURNS TABLE(success boolean, payment_id uuid, payment_number character varying, customer_id uuid, amount numeric, allocated_amount numeric, unallocated_amount numeric, status character varying, message character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_payment_id UUID;
  v_payment_number VARCHAR(50);
  v_payment_date_val DATE;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- 006E: payments and invoices require sales:update (not just a signed-in user).
  IF auth.uid() IS NULL OR NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update is required' USING ERRCODE = '42501';
  END IF;
  -- Validate authentication
  v_current_user := auth.uid()::VARCHAR(150);
  IF v_current_user IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_customer_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Not authenticated'::VARCHAR;
    RETURN;
  END IF;

  -- Validate customer exists
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_customer_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Customer not found'::VARCHAR;
    RETURN;
  END IF;

  -- Validate payment amount
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_customer_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Payment amount must be positive'::VARCHAR;
    RETURN;
  END IF;

  -- Set payment date
  v_payment_date_val := COALESCE(p_payment_date, CURRENT_DATE);

  -- Generate payment number
  v_payment_number := 'PAY-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((
    SELECT COUNT(*) + 1 FROM public.sales_payments
    WHERE DATE(created_at) = CURRENT_DATE
  )::TEXT, 5, '0');

  -- Create payment record
  INSERT INTO public.sales_payments (
    payment_number,
    customer_id,
    payment_date,
    amount_paid,
    payment_method,
    reference_number,
    remarks,
    status,
    created_by
  ) VALUES (
    v_payment_number,
    p_customer_id,
    v_payment_date_val,
    p_amount,
    p_payment_method,
    p_reference_number,
    p_remarks,
    'RECEIVED',
    v_current_user
  )
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_customer_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Failed to create payment'::VARCHAR;
    RETURN;
  END IF;

  -- Success
  RETURN QUERY SELECT
    TRUE,
    v_payment_id,
    v_payment_number,
    p_customer_id,
    p_amount,
    0::DECIMAL,
    p_amount,
    'RECEIVED'::VARCHAR,
    'Payment recorded successfully'::VARCHAR;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_customer_id, 0::DECIMAL,
    0::DECIMAL, 0::DECIMAL, NULL::VARCHAR,
    ('Error: ' || SQLERRM)::VARCHAR;
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_payment_atomic(p_payment_id uuid, p_invoice_id uuid, p_allocated_amount numeric) RETURNS TABLE(success boolean, allocation_id uuid, payment_id uuid, invoice_id uuid, allocated_amount numeric, payment_remaining numeric, invoice_paid numeric, invoice_outstanding numeric, invoice_status character varying, message character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_current_user VARCHAR(150);
  v_payment_customer_id UUID;
  v_payment_amount DECIMAL(15, 2);
  v_payment_status VARCHAR(20);  -- ← FIXED: Was missing, now declared
  v_payment_allocated_total DECIMAL(15, 2);
  v_payment_remaining DECIMAL(15, 2);
  v_invoice_customer_id UUID;
  v_invoice_total DECIMAL(15, 2);
  v_invoice_amount_paid DECIMAL(15, 2);
  v_invoice_amount_outstanding DECIMAL(15, 2);
  v_new_invoice_paid DECIMAL(15, 2);
  v_new_invoice_outstanding DECIMAL(15, 2);
  v_new_invoice_status VARCHAR(20);
  v_allocation_id UUID;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- 006E: payments and invoices require sales:update (not just a signed-in user).
  IF auth.uid() IS NULL OR NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update is required' USING ERRCODE = '42501';
  END IF;
  -- Validate authentication
  v_current_user := auth.uid()::VARCHAR(150);
  IF v_current_user IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Not authenticated'::VARCHAR;
    RETURN;
  END IF;

  -- ===== LOCK PAYMENT =====
  SELECT customer_id, amount_paid, status
  INTO v_payment_customer_id, v_payment_amount, v_payment_status
  FROM public.sales_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_payment_customer_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Payment not found'::VARCHAR;
    RETURN;
  END IF;

  -- Validate payment status
  IF v_payment_status NOT IN ('RECEIVED', 'ALLOCATED') THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, v_payment_status,
      ('Cannot allocate from payment in ' || v_payment_status || ' status')::VARCHAR;
    RETURN;
  END IF;

  -- ===== LOCK INVOICE =====
  SELECT customer_id, total_amount, amount_paid, amount_outstanding
  INTO v_invoice_customer_id, v_invoice_total, v_invoice_amount_paid, v_invoice_amount_outstanding
  FROM public.sales_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice_customer_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Invoice not found'::VARCHAR;
    RETURN;
  END IF;

  -- ===== VALIDATE ALLOCATION =====
  -- Customer consistency
  IF v_payment_customer_id != v_invoice_customer_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      'Payment customer does not match invoice customer'::VARCHAR;
    RETURN;
  END IF;

  -- Allocation amount > 0
  IF p_allocated_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      0::DECIMAL, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      'Allocation amount must be positive'::VARCHAR;
    RETURN;
  END IF;

  -- ===== RECALCULATE PAYMENT REMAINING AFTER LOCK =====
  -- This is authoritative: must recalculate after acquiring lock
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_payment_allocated_total
  FROM public.sales_payment_allocations
  WHERE payment_id = p_payment_id AND status = 'ACTIVE';

  v_payment_remaining := v_payment_amount - v_payment_allocated_total;

  -- Validate allocation doesn't exceed payment remaining
  IF p_allocated_amount > v_payment_remaining THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      v_payment_remaining, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      ('Allocation amount ' || p_allocated_amount::VARCHAR || ' exceeds payment remaining ' || v_payment_remaining::VARCHAR)::VARCHAR;
    RETURN;
  END IF;

  -- ===== RECALCULATE INVOICE OUTSTANDING AFTER LOCK =====
  -- Must recalculate in case previous allocations were made
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_invoice_amount_paid
  FROM public.sales_payment_allocations
  WHERE invoice_id = p_invoice_id AND status = 'ACTIVE';

  v_invoice_amount_outstanding := v_invoice_total - v_invoice_amount_paid;

  -- Calculate new balances after this allocation
  v_new_invoice_paid := v_invoice_amount_paid + p_allocated_amount;
  v_new_invoice_outstanding := v_invoice_total - v_new_invoice_paid;

  -- Validate allocation doesn't over-settle invoice
  IF v_new_invoice_outstanding < 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      v_payment_remaining, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      ('Allocation would over-settle invoice. Outstanding=' || v_invoice_amount_outstanding::VARCHAR ||
      ', allocation=' || p_allocated_amount::VARCHAR)::VARCHAR;
    RETURN;
  END IF;

  -- ===== CREATE ALLOCATION RECORD =====
  INSERT INTO public.sales_payment_allocations (
    payment_id,
    invoice_id,
    allocated_amount,
    payment_customer_id,
    invoice_customer_id,
    allocated_by
  ) VALUES (
    p_payment_id,
    p_invoice_id,
    p_allocated_amount,
    v_payment_customer_id,
    v_invoice_customer_id,
    v_current_user
  )
  RETURNING id INTO v_allocation_id;

  IF v_allocation_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
      v_payment_remaining, v_invoice_amount_paid, v_invoice_amount_outstanding, NULL::VARCHAR,
      'Failed to create allocation'::VARCHAR;
    RETURN;
  END IF;

  -- ===== UPDATE INVOICE BALANCES =====
  -- amount_paid and amount_outstanding DERIVED from allocations, not additive
  UPDATE public.sales_invoices
  SET
    amount_paid = v_new_invoice_paid,
    amount_outstanding = v_new_invoice_outstanding,
    status = CASE
      WHEN v_new_invoice_outstanding = 0 THEN 'PAID'
      WHEN v_new_invoice_paid > 0 THEN 'PARTIAL'
      ELSE 'UNPAID'
    END,
    updated_at = NOW(),
    updated_by = v_current_user
  WHERE id = p_invoice_id;

  -- ===== UPDATE PAYMENT STATUS =====
  -- Mark as ALLOCATED if any allocation exists
  UPDATE public.sales_payments
  SET
    status = 'ALLOCATED',
    updated_at = NOW(),
    updated_by = v_current_user
  WHERE id = p_payment_id;

  -- ===== DETERMINE FINAL INVOICE STATUS =====
  IF v_new_invoice_outstanding = 0 THEN
    v_new_invoice_status := 'PAID';
  ELSIF v_new_invoice_paid > 0 THEN
    v_new_invoice_status := 'PARTIAL';
  ELSE
    v_new_invoice_status := 'UNPAID';
  END IF;

  -- ===== SUCCESS RETURN =====
  RETURN QUERY SELECT
    TRUE,
    v_allocation_id,
    p_payment_id,
    p_invoice_id,
    p_allocated_amount,
    v_payment_remaining - p_allocated_amount,
    v_new_invoice_paid,
    v_new_invoice_outstanding,
    v_new_invoice_status::VARCHAR,
    'Allocation created successfully'::VARCHAR;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, p_payment_id, p_invoice_id, 0::DECIMAL,
    0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR,
    ('Error: ' || SQLERRM)::VARCHAR;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invoice_from_shipment_atomic(p_order_id uuid, p_order_item_id uuid, p_invoice_qty numeric, p_invoice_date date DEFAULT NULL::date, p_due_date date DEFAULT NULL::date, p_payment_terms_days integer DEFAULT 30) RETURNS TABLE(success boolean, invoice_id uuid, invoice_no character varying, order_id uuid, order_item_id uuid, qty_invoiced numeric, total_amount numeric, amount_outstanding numeric, status character varying, message character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_user VARCHAR(150);
  v_order_status VARCHAR;
  v_customer_id UUID;
  v_qty_metre DECIMAL;
  v_qty_reserved DECIMAL;
  v_qty_dispatched DECIMAL;
  v_qty_already_invoiced DECIMAL;
  v_qty_remaining_invoiceable DECIMAL;
  v_rate DECIMAL(15, 2);
  v_discount_pct DECIMAL(5, 2);
  v_tax_pct DECIMAL(5, 2);
  v_gross_amount DECIMAL(15, 2);
  v_discount_amount DECIMAL(15, 2);
  v_tax_amount DECIMAL(15, 2);
  v_net_amount DECIMAL(15, 2);
  v_invoice_no VARCHAR(50);
  v_invoice_id UUID;
  v_invoice_item_id UUID;
  v_invoice_date_val DATE;
  v_due_date_val DATE;
BEGIN
  -- Authenticate and authorize before any business reads, locks or writes.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update required' USING ERRCODE = '42501';
  END IF;

  -- 006E: payments and invoices require sales:update (not just a signed-in user).
  IF auth.uid() IS NULL OR NOT public.user_has_permission(auth.uid(), 'sales:update') THEN
    RAISE EXCEPTION 'Permission denied: sales:update is required' USING ERRCODE = '42501';
  END IF;
  -- Validate authentication
  v_current_user := auth.uid()::VARCHAR(150);
  IF v_current_user IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Not authenticated'::VARCHAR;
    RETURN;
  END IF;

  -- ===== LOCK ORDER =====
  -- 1. Sales order (header, status, customer)
  SELECT status, customer_id
  INTO v_order_status, v_customer_id
  FROM public.sales_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_status IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Order not found'::VARCHAR;
    RETURN;
  END IF;

  -- Validate order can be invoiced
  IF v_order_status NOT IN ('CONFIRMED', 'ALLOCATED', 'SHIPPED', 'DELIVERED') THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, v_order_status,
      'Cannot invoice order in ' || v_order_status || ' status'::VARCHAR;
    RETURN;
  END IF;

  -- 2. Order item (lock for quantity calculations)
  SELECT qty_metre, qty_reserved, qty_dispatched, qty_invoiced, rate, discount_pct, tax_pct
  INTO v_qty_metre, v_qty_reserved, v_qty_dispatched, v_qty_already_invoiced, v_rate, v_discount_pct, v_tax_pct
  FROM public.sales_order_items
  WHERE id = p_order_item_id AND order_id = p_order_id
  FOR UPDATE;

  IF v_qty_metre IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Order item not found'::VARCHAR;
    RETURN;
  END IF;

  -- ===== QUANTITY VALIDATION =====
  -- Validate invoice quantity
  IF p_invoice_qty <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Invoice quantity must be > 0'::VARCHAR;
    RETURN;
  END IF;

  -- CRITICAL: Calculate remaining invoiceable quantity
  -- remaining = qty_dispatched - qty_invoiced
  v_qty_remaining_invoiceable := v_qty_dispatched - COALESCE(v_qty_already_invoiced, 0);

  -- PREVENT OVER-INVOICING: Check requested qty <= remaining
  IF p_invoice_qty > v_qty_remaining_invoiceable THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR,
      'Invoice qty ' || p_invoice_qty::VARCHAR || ' exceeds remaining invoiceable ' || v_qty_remaining_invoiceable::VARCHAR ||
      ' (dispatched=' || v_qty_dispatched::VARCHAR || ', already invoiced=' || COALESCE(v_qty_already_invoiced, 0)::VARCHAR || ')'::VARCHAR;
    RETURN;
  END IF;

  -- ===== PRICING & AMOUNT CALCULATIONS =====
  -- Use immutable Sales Order pricing snapshot
  -- Formula: gross = qty × rate → discount → tax → net
  v_gross_amount := p_invoice_qty * v_rate;
  v_discount_amount := v_gross_amount * (COALESCE(v_discount_pct, 0) / 100);
  v_tax_amount := (v_gross_amount - v_discount_amount) * (COALESCE(v_tax_pct, 0) / 100);
  v_net_amount := v_gross_amount - v_discount_amount + v_tax_amount;

  -- Validate calculated amounts
  IF v_net_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Calculated net amount is invalid'::VARCHAR;
    RETURN;
  END IF;

  -- ===== INVOICE NUMBER GENERATION =====
  -- Concurrency-safe: Use sequence or locked counter
  v_invoice_no := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((
    SELECT COUNT(*) + 1 FROM public.sales_invoices
    WHERE DATE(created_at) = CURRENT_DATE
  )::TEXT, 5, '0');

  -- ===== SET INVOICE DATES =====
  v_invoice_date_val := COALESCE(p_invoice_date, CURRENT_DATE);
  v_due_date_val := COALESCE(p_due_date, CURRENT_DATE + (p_payment_terms_days || ' days')::INTERVAL);

  -- ===== CREATE INVOICE HEADER =====
  INSERT INTO public.sales_invoices (
    invoice_no,
    order_id,
    customer_id,
    invoice_date,
    due_date,
    subtotal_amount,
    tax_amount,
    total_amount,
    amount_outstanding,
    status,
    created_by,
    updated_by
  ) VALUES (
    v_invoice_no,
    p_order_id,
    v_customer_id,
    v_invoice_date_val,
    v_due_date_val,
    v_gross_amount - v_discount_amount,
    v_tax_amount,
    v_net_amount,
    v_net_amount,
    'UNPAID',
    v_current_user,
    v_current_user
  )
  RETURNING id INTO v_invoice_id;

  IF v_invoice_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Failed to create invoice header'::VARCHAR;
    RETURN;
  END IF;

  -- ===== CREATE INVOICE LINE ITEM =====
  INSERT INTO public.sales_invoice_items (
    invoice_id,
    order_item_id,
    qty_invoiced,
    rate,
    discount_pct,
    tax_pct,
    gross_amount,
    discount_amount,
    tax_amount,
    net_amount,
    created_by
  ) VALUES (
    v_invoice_id,
    p_order_item_id,
    p_invoice_qty,
    v_rate,
    v_discount_pct,
    v_tax_pct,
    v_gross_amount,
    v_discount_amount,
    v_tax_amount,
    v_net_amount,
    v_current_user
  )
  RETURNING id INTO v_invoice_item_id;

  IF v_invoice_item_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
      0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR, 'Failed to create invoice line item'::VARCHAR;
    RETURN;
  END IF;

  -- ===== UPDATE ORDER ITEM INVOICED QUANTITY =====
  UPDATE public.sales_order_items
  SET qty_invoiced = COALESCE(qty_invoiced, 0) + p_invoice_qty
  WHERE id = p_order_item_id;

  -- ===== UPDATE SALES ORDER STATUS (if fully invoiced) =====
  -- Only mark INVOICED if all order items are fully invoiced
  UPDATE public.sales_orders
  SET
    status = 'INVOICED',
    updated_at = NOW(),
    updated_by = v_current_user
  WHERE id = p_order_id
  AND NOT EXISTS (
    SELECT 1 FROM public.sales_order_items
    WHERE order_id = p_order_id
    AND (qty_dispatched - COALESCE(qty_invoiced, 0)) > 0
  );

  -- ===== SUCCESS RETURN =====
  RETURN QUERY SELECT
    TRUE,
    v_invoice_id,
    v_invoice_no,
    p_order_id,
    p_order_item_id,
    p_invoice_qty,
    v_net_amount,
    v_net_amount,
    'UNPAID'::VARCHAR,
    'Invoice created successfully'::VARCHAR;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR, p_order_id, p_order_item_id,
    0::DECIMAL, 0::DECIMAL, 0::DECIMAL, NULL::VARCHAR,
    ('Error: ' || SQLERRM)::VARCHAR;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_stock_reservation_atomic(
  p_reservation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid UUID;
  v_actor_email TEXT;
  v_reservation RECORD;
  v_item RECORD;
  v_available_qty NUMERIC;
  v_new_reserved_qty NUMERIC;
BEGIN
  -- 1. Authenticate caller
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '40100';
  END IF;

  -- 2. Authorization check
  IF NOT (
    public.is_admin(v_caller_uid) OR 
    public.user_has_permission(v_caller_uid, 'inventory:write') OR 
    public.user_has_permission(v_caller_uid, 'sales:update')
  ) THEN
    RAISE EXCEPTION 'Permission denied to approve stock reservation' USING ERRCODE = '42501';
  END IF;

  -- Retrieve actor email safely
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_caller_uid;
  IF v_actor_email IS NULL THEN
    v_actor_email := v_caller_uid::text;
  END IF;

  -- 3. Lock reservation row
  SELECT * INTO v_reservation 
  FROM public.stock_reservations 
  WHERE id = p_reservation_id 
  FOR UPDATE;

  IF v_reservation IS NULL OR v_reservation.id IS NULL THEN
    RAISE EXCEPTION 'Reservation % not found', p_reservation_id USING ERRCODE = 'P0002';
  END IF;

  -- If already approved, return idempotent success
  IF v_reservation.approval_status = 'APPROVED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_approved', true,
      'reservation_id', p_reservation_id,
      'status', 'APPROVED'
    );
  END IF;

  IF v_reservation.approval_status IN ('REJECTED', 'EXPIRED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Cannot approve reservation in % status', v_reservation.approval_status USING ERRCODE = '22000';
  END IF;

  -- 4. Lock inventory item row
  SELECT * INTO v_item 
  FROM public.inventory_items 
  WHERE id = v_reservation.item_id 
  FOR UPDATE;

  IF v_item IS NULL OR v_item.id IS NULL THEN
    RAISE EXCEPTION 'Inventory item % not found', v_reservation.item_id USING ERRCODE = 'P0002';
  END IF;

  -- 5. Calculate available stock safely
  v_available_qty := COALESCE(v_item.total_qty, 0) - COALESCE(v_item.reserved_qty, 0);

  IF v_available_qty < v_reservation.qty_reserved THEN
    RAISE EXCEPTION 'Insufficient stock available (% requested, % available)', 
      v_reservation.qty_reserved, v_available_qty USING ERRCODE = '22000';
  END IF;

  -- 6. Update reservation status
  UPDATE public.stock_reservations
  SET approval_status = 'APPROVED',
      approved_by = v_actor_email,
      approved_at = NOW(),
      updated_by = v_actor_email,
      updated_at = NOW()
  WHERE id = p_reservation_id;

  -- 7. Increment reserved quantity atomically
  v_new_reserved_qty := COALESCE(v_item.reserved_qty, 0) + v_reservation.qty_reserved;

  UPDATE public.inventory_items
  SET reserved_qty = v_new_reserved_qty,
      updated_at = NOW(),
      updated_by = v_actor_email
  WHERE id = v_reservation.item_id;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'item_id', v_reservation.item_id,
    'approved_qty', v_reservation.qty_reserved,
    'new_reserved_qty', v_new_reserved_qty,
    'status', 'APPROVED'
  );
END;
$$;




--
-- Name: allocate_payment_atomic(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

-- Superseded implementation omitted; final definition below.


--
-- Name: audit_profile_change(); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: cancel_sales_order_atomic(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: complete_job_output(uuid, numeric, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: complete_order(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: complete_quality_inspection(uuid, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: confirm_sales_order(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: confirm_sales_order_with_reservation(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: confirm_shipment_delivery(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: confirm_shipment_dispatch(uuid, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: confirm_stock_reservation(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: confirm_stock_reservation(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: confirm_stock_reservation_atomic(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: confirm_stock_reservation_dispatch(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: create_fulfillment_from_order(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: create_invoice_from_order(uuid, date, date, integer); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: create_invoice_from_shipment_atomic(uuid, uuid, numeric, date, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

-- Superseded implementation omitted; final definition below.


--
-- Name: create_shipment(uuid, uuid, text, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: create_shipment_atomic(uuid, uuid, numeric, uuid, text, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: deliver_fulfillment(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: generate_invoice(uuid, date, date, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: get_inventory_by_quality_grade(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: get_invoice_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: get_payment_aging_report(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: get_saleable_inventory(uuid, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: get_user_effective_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: get_user_primary_role_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: guard_profile_privileged_columns(); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: handle_new_user_preferences(); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: handle_new_user_rbac(); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: has_role(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: issue_material_to_production(uuid, uuid, numeric, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: rbac_user_role_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: record_payment(uuid, numeric, character varying, character varying, text); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: record_payment(uuid, numeric, character varying, character varying, date, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: record_payment_atomic(uuid, numeric, character varying, character varying, date, text); Type: FUNCTION; Schema: public; Owner: -
--

-- Superseded implementation omitted; final definition below.


--
-- Name: release_sales_stock_atomic(uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: reserve_sales_stock_atomic(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: reset_payment_sequence_if_needed(); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: ship_fulfillment(uuid, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: update_fulfillment_item(uuid, numeric, numeric, numeric, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: update_inventory_balance(); Type: FUNCTION; Schema: public; Owner: -
--

-- Superseded implementation omitted; final definition below.


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: update_user_preferences_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: user_has_permission(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: user_has_permission_v2(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: user_owns_record(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: validate_sales_order_item_update(); Type: FUNCTION; Schema: public; Owner: -
--




--
-- Name: validate_sales_order_update(); Type: FUNCTION; Schema: public; Owner: -
--




SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: approval_workflow; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_workflow (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    step_number integer NOT NULL,
    step_name character varying(100) NOT NULL,
    status character varying(50) NOT NULL,
    assigned_to character varying(150),
    completed_by character varying(150),
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_step_status CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'COMPLETED'::character varying, 'REJECTED'::character varying, 'SKIPPED'::character varying])::text[])))
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity text NOT NULL,
    entity_id text,
    action text NOT NULL,
    details text,
    actor_id uuid,
    actor_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: beam_colours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beam_colours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    design_id uuid NOT NULL,
    beam_colour text NOT NULL,
    display_order integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    color_code text NOT NULL,
    color_name text NOT NULL,
    color_hex text,
    description text,
    color_type text DEFAULT 'General'::text,
    is_active boolean DEFAULT true,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT color_code_not_empty CHECK ((length(color_code) > 0)),
    CONSTRAINT color_name_not_empty CHECK ((length(color_name) > 0))
);


--
-- Name: cost_sheet_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_sheet_charges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cost_sheet_id uuid NOT NULL,
    sequence integer DEFAULT 1 NOT NULL,
    charge_name text NOT NULL,
    rate numeric(19,6) DEFAULT 0 NOT NULL,
    quantity numeric(19,6) DEFAULT 0 NOT NULL,
    amount numeric(19,6) DEFAULT 0 NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cost_sheet_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_sheet_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cost_sheet_id uuid NOT NULL,
    section text NOT NULL,
    sequence integer DEFAULT 1 NOT NULL,
    label text,
    material_id uuid,
    yarn_name text,
    quantity numeric(12,4) DEFAULT 0 NOT NULL,
    denier numeric(12,4) DEFAULT 0 NOT NULL,
    length_metre numeric(14,4) DEFAULT 0 NOT NULL,
    panna_inch numeric(10,4) DEFAULT 0 NOT NULL,
    rate_per_kg numeric(19,6) DEFAULT 0 NOT NULL,
    calculated_kg numeric(19,6) DEFAULT 0 NOT NULL,
    cost numeric(19,6) DEFAULT 0 NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    yarn_id uuid,
    warp_weft character varying(10),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cost_sheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_sheets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sheet_no text NOT NULL,
    design_no text,
    party_id uuid,
    party_name text,
    quality text,
    reed numeric(12,4),
    pick numeric(12,4),
    panna_inch numeric(10,4),
    length_metre numeric(14,4),
    wastage_pct numeric(7,4) DEFAULT 10 NOT NULL,
    card_rate numeric(19,6) DEFAULT 0 NOT NULL,
    number_of_cards numeric(19,6) DEFAULT 0 NOT NULL,
    kg_divisor numeric(19,6) DEFAULT 9000000 NOT NULL,
    card_divisor numeric(19,6) DEFAULT 39.37 NOT NULL,
    warp_cost numeric(19,6) DEFAULT 0 NOT NULL,
    weft_cost numeric(19,6) DEFAULT 0 NOT NULL,
    total_kg numeric(19,6) DEFAULT 0 NOT NULL,
    wastage_cost numeric(19,6) DEFAULT 0 NOT NULL,
    process_cost numeric(19,6) DEFAULT 0 NOT NULL,
    card_cost numeric(19,6) DEFAULT 0 NOT NULL,
    final_cost numeric(19,6) DEFAULT 0 NOT NULL,
    sale_rate numeric(19,6) DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    remarks text,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by character varying(150)
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    party_id uuid NOT NULL,
    credit_limit numeric(15,2) DEFAULT 0,
    current_credit_used numeric(15,2) DEFAULT 0,
    payment_terms_days integer DEFAULT 30,
    default_shipping_address text,
    contact_person character varying(150),
    phone character varying(20),
    email character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150)
);


--
-- Name: daily_production; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_production (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date NOT NULL,
    shift character varying(1) NOT NULL,
    job_card_id uuid NOT NULL,
    loom_id uuid NOT NULL,
    metre_produced numeric(10,2) NOT NULL,
    yarn_kg_used numeric(10,2) NOT NULL,
    downtime_min integer DEFAULT 0,
    downtime_reason character varying(255),
    quality_grade character varying(10),
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    recorded_by character varying(150) NOT NULL,
    CONSTRAINT daily_production_shift_check CHECK (((shift)::text = ANY ((ARRAY['A'::character varying, 'B'::character varying, 'C'::character varying])::text[]))),
    CONSTRAINT downtime_non_negative CHECK ((downtime_min >= 0)),
    CONSTRAINT metre_produced_positive CHECK ((metre_produced > (0)::numeric)),
    CONSTRAINT yarn_kg_positive CHECK ((yarn_kg_used > (0)::numeric))
);


--
-- Name: designs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    design_number text NOT NULL,
    design_name text,
    dn text,
    dn_code text,
    reed numeric(12,4),
    pick numeric(12,4),
    cards numeric(12,4),
    patti numeric(12,4),
    total_dc numeric(12,4),
    total_cut numeric(12,4),
    work text,
    blue_apt text,
    description text,
    remarks text,
    image text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: feeders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feeders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    beam_colour_id uuid NOT NULL,
    color_name text NOT NULL,
    old_number text,
    display_order integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_balances_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_balances_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    total_inward_qty numeric(12,2) DEFAULT 0 NOT NULL,
    total_issued_qty numeric(12,2) DEFAULT 0 NOT NULL,
    net_qty numeric(12,2) GENERATED ALWAYS AS ((total_inward_qty - total_issued_qty)) STORED,
    total_reserved_qty numeric(12,2) DEFAULT 0 NOT NULL,
    available_qty numeric(12,2) GENERATED ALWAYS AS (((total_inward_qty - total_issued_qty) - total_reserved_qty)) STORED,
    total_cost numeric(12,2) DEFAULT 0 NOT NULL,
    avg_cost_per_unit numeric(12,4) GENERATED ALWAYS AS (
CASE
    WHEN ((total_inward_qty - total_issued_qty) > (0)::numeric) THEN (total_cost / (total_inward_qty - total_issued_qty))
    ELSE (0)::numeric
END) STORED,
    last_transaction_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_quantities_non_negative CHECK (((total_inward_qty >= (0)::numeric) AND (total_issued_qty >= (0)::numeric) AND (total_reserved_qty >= (0)::numeric)))
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_type character varying(20) NOT NULL,
    item_code character varying(100) NOT NULL,
    item_name character varying(200) NOT NULL,
    lot_no character varying(100),
    grn_no character varying(100),
    yarn_code character varying(50),
    supplier_id uuid,
    beam_no character varying(100),
    set_no character varying(100),
    warp_design_no character varying(100),
    piece_no character varying(100),
    design_no character varying(100),
    job_card_no character varying(100),
    total_qty numeric(12,2) DEFAULT 0 NOT NULL,
    total_unit character varying(10) NOT NULL,
    reserved_qty numeric(12,2) DEFAULT 0 NOT NULL,
    available_qty numeric(12,2) GENERATED ALWAYS AS ((total_qty - reserved_qty)) STORED,
    rate_per_unit numeric(10,2),
    cost_basis numeric(12,2),
    current_location character varying(100),
    current_status character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    CONSTRAINT check_qty_non_negative CHECK ((total_qty >= (0)::numeric)),
    CONSTRAINT check_reserved_non_negative CHECK ((reserved_qty >= (0)::numeric)),
    CONSTRAINT check_reserved_not_exceed_total CHECK ((reserved_qty <= total_qty)),
    CONSTRAINT inventory_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['yarn'::character varying, 'beam'::character varying, 'fabric'::character varying])::text[])))
);


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_date timestamp with time zone NOT NULL,
    movement_type character varying(50) NOT NULL,
    reference_doc character varying(100),
    item_id uuid NOT NULL,
    qty_change numeric(12,2) NOT NULL,
    unit character varying(10) NOT NULL,
    location_from character varying(100),
    location_to character varying(100),
    rate_per_unit numeric(10,2),
    cost_value numeric(12,2) GENERATED ALWAYS AS ((abs(qty_change) * COALESCE(rate_per_unit, (0)::numeric))) STORED,
    reserved_qty_delta numeric(12,2) DEFAULT 0,
    approval_required boolean DEFAULT false,
    approved_by character varying(150),
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by character varying(150) NOT NULL,
    remarks text,
    approval_status character varying(50) DEFAULT 'PENDING'::character varying,
    quality_grade character varying(50),
    quality_remarks text,
    inspected_by character varying(150),
    inspected_at timestamp with time zone,
    rejection_reason text,
    rejection_qty numeric(10,2) DEFAULT 0,
    CONSTRAINT check_approval_status CHECK (((approval_status)::text = ANY ((ARRAY['PENDING'::character varying, 'QA_INSPECTED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'PARTIAL_REJECT'::character varying])::text[]))) NO INHERIT,
    CONSTRAINT check_approved_both_or_neither CHECK ((((approved_by IS NOT NULL) AND (approved_at IS NOT NULL)) OR ((approved_by IS NULL) AND (approved_at IS NULL)))),
    CONSTRAINT check_quality_grade CHECK (((quality_grade IS NULL) OR ((quality_grade)::text = ANY ((ARRAY['A'::character varying, 'B'::character varying, 'C'::character varying, 'REJECTED'::character varying])::text[])))) NO INHERIT,
    CONSTRAINT inventory_transactions_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['inward_purchase'::character varying, 'inward_production_return'::character varying, 'issue_to_production'::character varying, 'issue_internal'::character varying, 'location_transfer'::character varying, 'quality_rejection'::character varying, 'dispatch'::character varying])::text[]))),
    CONSTRAINT inventory_transactions_qty_change_check CHECK ((qty_change <> (0)::numeric))
);


--
-- Name: invoice_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number character varying(50) NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    customer_name_snapshot character varying(200),
    subtotal_amount numeric(12,2) NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    status character varying(50) DEFAULT 'DRAFT'::character varying NOT NULL,
    created_by character varying(150),
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone,
    updated_by character varying(150),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invoices_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SENT'::character varying, 'PARTIAL'::character varying, 'PAID'::character varying, 'OVERDUE'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: TABLE invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.invoices IS 'DEPRECATED (STEP 3L): Use public.sales_invoices instead. This table is legacy from part3_dispatch_operations.sql and should not be used for new code. Access invoicing via invoicing.ts service.';


--
-- Name: job_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    card_no character varying(50) NOT NULL,
    production_order_id uuid NOT NULL,
    sequence_number integer NOT NULL,
    loom_id uuid,
    qty_metre numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'OPEN'::character varying,
    issued_date timestamp with time zone DEFAULT now(),
    started_date timestamp with time zone,
    completed_date timestamp with time zone,
    feeder_notes text,
    material_requirements jsonb DEFAULT '{}'::jsonb,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    material_issued_at timestamp with time zone,
    material_issued_by character varying(150),
    completed_at timestamp with time zone,
    completed_by character varying(150),
    output_item_id uuid,
    CONSTRAINT job_cards_status_check CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'ASSIGNED'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'ARCHIVED'::character varying])::text[]))),
    CONSTRAINT qty_metre_positive CHECK ((qty_metre > (0)::numeric))
);


--
-- Name: lab_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_no character varying(50) NOT NULL,
    roll_no character varying(100) NOT NULL,
    gsm_actual numeric(10,2) NOT NULL,
    gsm_spec numeric(10,2) NOT NULL,
    tear_strength_warp numeric(10,2),
    tear_strength_weft numeric(10,2),
    shrinkage_pct numeric(10,2),
    status character varying(50) DEFAULT 'pass'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    tested_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    CONSTRAINT lab_tests_status_check CHECK (((status)::text = ANY ((ARRAY['pass'::character varying, 'fail'::character varying])::text[])))
);


--
-- Name: loom_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loom_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loom_id uuid NOT NULL,
    maintenance_type character varying(50) NOT NULL,
    scheduled_start date NOT NULL,
    scheduled_end date NOT NULL,
    actual_start date,
    actual_end date,
    status character varying(20) DEFAULT 'SCHEDULED'::character varying,
    description text,
    spare_parts_used jsonb,
    created_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    CONSTRAINT loom_maintenance_status_check CHECK (((status)::text = ANY ((ARRAY['SCHEDULED'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: looms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.looms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loom_no character varying(50) NOT NULL,
    loom_type character varying(100) NOT NULL,
    panna_inch numeric(5,2) NOT NULL,
    reed_size numeric(5,2),
    picks_per_minute numeric(7,2),
    status character varying(20) DEFAULT 'IDLE'::character varying,
    assigned_operator_id uuid,
    is_active boolean DEFAULT true,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    current_job_card_id uuid,
    CONSTRAINT looms_status_check CHECK (((status)::text = ANY ((ARRAY['IDLE'::character varying, 'RUNNING'::character varying, 'MAINTENANCE'::character varying, 'BLOCKED'::character varying, 'DECOMMISSIONED'::character varying])::text[])))
);


--
-- Name: machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_code text NOT NULL,
    machine_name text NOT NULL,
    description text,
    machine_type text,
    process_id uuid,
    warehouse_id uuid,
    specifications jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    status text DEFAULT 'Active'::text,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT machine_code_not_empty CHECK ((length(machine_code) > 0)),
    CONSTRAINT machine_name_not_empty CHECK ((length(machine_name) > 0))
);


--
-- Name: masters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.masters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    master_type text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: material_rate_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_rate_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_id uuid NOT NULL,
    rate_per_kg numeric(19,6) NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    composition text,
    denier numeric(12,4),
    rate_per_kg numeric(19,6) DEFAULT 0 NOT NULL,
    uom text DEFAULT 'KG'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: parties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    party_code text NOT NULL,
    party_name text NOT NULL,
    office_name text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    area text,
    city text NOT NULL,
    district text,
    state text NOT NULL,
    pin_code text NOT NULL,
    country text DEFAULT 'India'::text,
    contact_person text,
    designation text,
    mobile text,
    alternate_mobile text,
    email text,
    whatsapp_number text,
    gstin text,
    pan text,
    job_work_applicable text DEFAULT 'Yes'::text,
    job_work_remarks text,
    remarks text,
    status text DEFAULT 'Active'::text,
    transaction_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid
);


--
-- Name: party_sub_parties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_sub_parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    party_id uuid NOT NULL,
    sub_party_code text NOT NULL,
    sub_party_name text NOT NULL,
    party_type text DEFAULT 'Job Party'::text NOT NULL,
    location_type text DEFAULT 'Branch Office'::text,
    location_type_other text,
    address_line1 text NOT NULL,
    address_line2 text,
    area text,
    city text NOT NULL,
    district text,
    state text NOT NULL,
    pin_code text,
    country text DEFAULT 'India'::text,
    gstin text,
    pan text,
    contact_person text,
    mobile text,
    alternate_mobile text,
    phone text,
    email text,
    alternate_email text,
    billing_address text,
    shipping_address text,
    delivery_address text,
    is_default boolean DEFAULT false,
    status text DEFAULT 'Active'::text,
    remarks text,
    internal_notes text,
    transaction_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT address_line1_not_empty CHECK ((length(address_line1) > 0)),
    CONSTRAINT city_not_empty CHECK ((length(city) > 0)),
    CONSTRAINT sub_party_code_not_empty CHECK ((length(sub_party_code) > 0)),
    CONSTRAINT sub_party_name_not_empty CHECK ((length(sub_party_name) > 0))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    amount_paid numeric(12,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    reference_number character varying(100),
    payment_date date NOT NULL,
    status character varying(50) DEFAULT 'COMPLETED'::character varying NOT NULL,
    created_by character varying(150),
    created_at timestamp with time zone DEFAULT now(),
    updated_by character varying(150),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payments_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['CASH'::character varying, 'CHEQUE'::character varying, 'BANK_TRANSFER'::character varying, 'CREDIT_CARD'::character varying, 'DIGITAL_WALLET'::character varying])::text[]))),
    CONSTRAINT payments_status_check CHECK (((status)::text = ANY ((ARRAY['COMPLETED'::character varying, 'PENDING'::character varying, 'FAILED'::character varying, 'REVERSED'::character varying])::text[])))
);


--
-- Name: TABLE payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payments IS 'DEPRECATED (STEP 3L): Use public.sales_payments instead. This table is legacy from part3_dispatch_operations.sql and should not be used for new code. Use invoicing.ts recordPayment() service method.';


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    permission_code character varying(100) NOT NULL,
    permission_name character varying(150) NOT NULL,
    description text,
    module character varying(50) NOT NULL,
    action character varying(20) NOT NULL,
    is_system boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: process_rate_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.process_rate_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    process_id uuid NOT NULL,
    default_rate numeric(19,6) NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: processes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    process_code text NOT NULL,
    process_name text NOT NULL,
    description text,
    process_category text,
    default_rate numeric(19,6) DEFAULT 0,
    unit_of_rate text DEFAULT 'per_kg'::text,
    processing_time_hours numeric(10,2),
    is_active boolean DEFAULT true,
    is_outsourced boolean DEFAULT false,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT process_code_not_empty CHECK ((length(process_code) > 0)),
    CONSTRAINT process_name_not_empty CHECK ((length(process_name) > 0))
);


--
-- Name: production_audit_trail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_audit_trail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    actor_id uuid,
    actor_name character varying(150),
    details jsonb,
    "timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT action_valid CHECK (((action)::text = ANY ((ARRAY['ORDER_CREATED'::character varying, 'ORDER_UPDATED'::character varying, 'JOB_CARDS_ISSUED'::character varying, 'JOB_ASSIGNED'::character varying, 'PRODUCTION_STARTED'::character varying, 'PRODUCTION_LOGGED'::character varying, 'ORDER_COMPLETED'::character varying, 'ORDER_ARCHIVED'::character varying, 'STATUS_CHANGED'::character varying])::text[])))
);


--
-- Name: production_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inspection_no character varying(50) NOT NULL,
    roll_id uuid,
    roll_no character varying(100) NOT NULL,
    item_code character varying(100) NOT NULL,
    design_no character varying(100) NOT NULL,
    loom_no character varying(50) NOT NULL,
    shift character varying(1) NOT NULL,
    operator_name character varying(200),
    roll_length_yd numeric(10,2) NOT NULL,
    roll_width_inch numeric(10,2) NOT NULL,
    defects jsonb DEFAULT '[]'::jsonb,
    total_raw_points numeric(10,2) NOT NULL,
    capped_points numeric(10,2) NOT NULL,
    points_per_100_sq_yd numeric(10,2) NOT NULL,
    system_grade character varying(20) NOT NULL,
    manual_grade_override character varying(20),
    override_reason text,
    status character varying(50) DEFAULT 'verified'::character varying NOT NULL,
    verified_by character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    job_card_id uuid,
    decision_by character varying(150),
    decision_at timestamp with time zone,
    CONSTRAINT production_inspections_manual_grade_override_check CHECK (((manual_grade_override IS NULL) OR ((manual_grade_override)::text = ANY ((ARRAY['Grade A'::character varying, 'Grade B'::character varying, 'Grade C'::character varying, 'Hold'::character varying])::text[])))),
    CONSTRAINT production_inspections_shift_check CHECK (((shift)::text = ANY ((ARRAY['A'::character varying, 'B'::character varying, 'C'::character varying])::text[]))),
    CONSTRAINT production_inspections_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'COMPLETED'::character varying, 'verified'::character varying, 'pending_supervisor'::character varying])::text[]))),
    CONSTRAINT production_inspections_system_grade_check CHECK (((system_grade)::text = ANY ((ARRAY['Grade A'::character varying, 'Grade B'::character varying, 'Grade C'::character varying, 'Hold'::character varying])::text[])))
);


--
-- Name: production_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_no character varying(50) NOT NULL,
    cost_sheet_id uuid,
    design_no character varying(50) NOT NULL,
    party_id uuid,
    quality_name character varying(200) NOT NULL,
    qty_metre numeric(10,2) NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying,
    target_delivery_date date NOT NULL,
    status character varying(30) DEFAULT 'PLANNED'::character varying,
    remarks text,
    issued_date date,
    started_date date,
    completed_date date,
    qty_completed_metre numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    CONSTRAINT production_orders_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT production_orders_status_check CHECK (((status)::text = ANY ((ARRAY['PLANNED'::character varying, 'JOB_CARDS_ISSUED'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'ARCHIVED'::character varying, 'ON_HOLD'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT qty_completed_not_negative CHECK ((qty_completed_metre >= (0)::numeric)),
    CONSTRAINT qty_metre_positive CHECK ((qty_metre > (0)::numeric))
);


--
-- Name: production_output; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_output (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_card_id uuid NOT NULL,
    qty_produced numeric(14,4) NOT NULL,
    grade character varying(20) NOT NULL,
    created_by character varying(150),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    output_item_id uuid NOT NULL,
    CONSTRAINT production_output_grade_check CHECK (((grade)::text = ANY ((ARRAY['Grade A'::character varying, 'Grade B'::character varying, 'Grade C'::character varying, 'Hold'::character varying])::text[])))
);


--
-- Name: profile_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    changed_fields jsonb DEFAULT '{}'::jsonb,
    changed_by uuid,
    changed_by_email character varying(255),
    change_reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    display_name character varying(200),
    mobile character varying(20),
    employee_id character varying(50),
    department character varying(100),
    designation character varying(100),
    primary_role_id character varying(50) DEFAULT 'viewer'::character varying NOT NULL,
    additional_role_ids text[] DEFAULT ARRAY[]::text[],
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    last_login timestamp with time zone,
    failed_login_attempts integer DEFAULT 0,
    is_locked boolean DEFAULT false,
    approval_status character varying(30) DEFAULT 'ADMIN_APPROVED'::character varying,
    creation_method character varying(30) DEFAULT 'ADMIN_CREATED'::character varying,
    approved_by character varying(150),
    approved_at timestamp with time zone,
    require_password_change boolean DEFAULT false,
    CONSTRAINT check_primary_role_id CHECK (((primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying, 'viewer'::character varying])::text[]))),
    CONSTRAINT profiles_approval_status_check CHECK (((approval_status)::text = ANY ((ARRAY['ADMIN_APPROVED'::character varying, 'PENDING_APPROVAL'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT profiles_creation_method_check CHECK (((creation_method)::text = ANY ((ARRAY['ADMIN_CREATED'::character varying, 'REGISTRATION_REQUEST'::character varying])::text[]))),
    CONSTRAINT profiles_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'SUSPENDED'::character varying, 'LOCKED'::character varying])::text[])))
);


--
-- Name: quality_hold_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_hold_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    production_inspection_id uuid NOT NULL,
    roll_no character varying(100) NOT NULL,
    hold_reason text NOT NULL,
    held_by character varying(150) NOT NULL,
    held_at timestamp with time zone DEFAULT now(),
    released_by character varying(150),
    released_at timestamp with time zone,
    release_reason text
);


--
-- Name: quality_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    inspection_date timestamp with time zone DEFAULT now(),
    inspected_by character varying(150) NOT NULL,
    quality_grade character varying(50) NOT NULL,
    remarks text,
    defects_found jsonb DEFAULT '[]'::jsonb,
    sample_size integer,
    defect_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_quality_grade CHECK (((quality_grade)::text = ANY ((ARRAY['A'::character varying, 'B'::character varying, 'C'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: role_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_code character varying(50) NOT NULL,
    role_name character varying(100) NOT NULL,
    description text,
    display_order integer DEFAULT 0,
    is_system boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sales_audit_trail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_audit_trail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    quotation_id uuid,
    action character varying(50) NOT NULL,
    actor_id uuid,
    actor_name character varying(150),
    details jsonb,
    "timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT action_valid CHECK (((action)::text = ANY ((ARRAY['QUOTATION_CREATED'::character varying, 'QUOTATION_SENT'::character varying, 'QUOTATION_ACCEPTED'::character varying, 'ORDER_CREATED'::character varying, 'ORDER_CONFIRMED'::character varying, 'ORDER_ALLOCATED'::character varying, 'FULFILLMENT_CREATED'::character varying, 'ORDER_SHIPPED'::character varying, 'ORDER_DELIVERED'::character varying, 'INVOICE_CREATED'::character varying, 'PAYMENT_RECORDED'::character varying, 'STATUS_CHANGED'::character varying])::text[])))
);


--
-- Name: sales_fulfillment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_fulfillment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pick_list_no character varying(50) NOT NULL,
    fulfillment_date date NOT NULL,
    shipped_date date,
    delivered_date date,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    tracking_number character varying(100),
    carrier character varying(100),
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    CONSTRAINT sales_fulfillment_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PICKING'::character varying, 'PICKED'::character varying, 'PACKED'::character varying, 'SHIPPED'::character varying, 'DELIVERED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: sales_fulfillment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_fulfillment_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fulfillment_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    qty_to_ship numeric(10,2) NOT NULL,
    qty_picked numeric(10,2) DEFAULT 0,
    qty_packed numeric(10,2) DEFAULT 0,
    qty_shipped numeric(10,2) DEFAULT 0,
    bin_location character varying(50),
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT qty_positive CHECK ((qty_to_ship > (0)::numeric))
);


--
-- Name: sales_invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    qty_invoiced numeric(10,2) NOT NULL,
    rate numeric(15,2) NOT NULL,
    discount_pct numeric(5,2) DEFAULT 0,
    tax_pct numeric(5,2) DEFAULT 0,
    gross_amount numeric(15,2) NOT NULL,
    discount_amount numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    net_amount numeric(15,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    CONSTRAINT gross_amount_positive CHECK ((gross_amount > (0)::numeric)),
    CONSTRAINT net_amount_positive CHECK ((net_amount > (0)::numeric)),
    CONSTRAINT qty_invoiced_positive CHECK ((qty_invoiced > (0)::numeric)),
    CONSTRAINT sales_invoice_items_qty_invoiced_check CHECK ((qty_invoiced > (0)::numeric))
);


--
-- Name: sales_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_no character varying(50) NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    subtotal_amount numeric(15,2) NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) NOT NULL,
    amount_paid numeric(15,2) DEFAULT 0,
    amount_outstanding numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'UNPAID'::character varying,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    CONSTRAINT amount_paid_check CHECK (((amount_paid >= (0)::numeric) AND (amount_paid <= total_amount))),
    CONSTRAINT sales_invoices_status_check CHECK (((status)::text = ANY ((ARRAY['UNPAID'::character varying, 'PARTIAL'::character varying, 'PAID'::character varying, 'OVERDUE'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: TABLE sales_invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sales_invoices IS 'CANONICAL (STEP 3L): Primary invoice table for all invoicing operations. Use via invoicing.ts service which calls canonical RPC functions (create_invoice_from_order, record_payment, get_invoice_summary, complete_order).';


--
-- Name: sales_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    line_number integer NOT NULL,
    fabric_quality_name character varying(200) NOT NULL,
    design_no character varying(50),
    qty_metre numeric(10,2) NOT NULL,
    qty_allocated numeric(10,2) DEFAULT 0,
    qty_shipped numeric(10,2) DEFAULT 0,
    rate_per_metre numeric(10,2) NOT NULL,
    line_total numeric(15,2) NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    design_id uuid,
    design_no_snapshot character varying(50),
    design_name_snapshot character varying(200),
    cost_sheet_id uuid,
    cost_sheet_no_snapshot character varying(50),
    qty_reserved numeric(10,2) DEFAULT 0,
    approved_sale_rate numeric(12,2),
    approved_by character varying(150),
    approved_at timestamp with time zone,
    inventory_item_id uuid,
    stock_reservation_id uuid,
    qty_dispatched numeric(10,2) DEFAULT 0,
    updated_at timestamp with time zone,
    updated_by character varying(150),
    shipment_id uuid,
    qty_invoiced numeric(10,2) DEFAULT 0,
    CONSTRAINT qty_allocated_check CHECK (((qty_allocated >= (0)::numeric) AND (qty_allocated <= qty_metre))),
    CONSTRAINT qty_dispatched_check CHECK (((qty_dispatched >= (0)::numeric) AND (qty_dispatched <= qty_metre))),
    CONSTRAINT qty_positive CHECK ((qty_metre > (0)::numeric)),
    CONSTRAINT qty_reserved_check CHECK (((qty_reserved >= (0)::numeric) AND (qty_reserved <= qty_metre))),
    CONSTRAINT qty_shipped_check CHECK (((qty_shipped >= (0)::numeric) AND (qty_shipped <= qty_allocated))),
    CONSTRAINT sales_order_items_check CHECK (((qty_invoiced >= (0)::numeric) AND (qty_invoiced <= qty_dispatched)))
);


--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_no character varying(50) NOT NULL,
    quotation_id uuid,
    customer_id uuid NOT NULL,
    order_date date NOT NULL,
    delivery_date date NOT NULL,
    subtotal_amount numeric(15,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) NOT NULL,
    status character varying(30) DEFAULT 'DRAFT'::character varying,
    shipping_address text NOT NULL,
    billing_address text NOT NULL,
    delivery_instructions text,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    confirmed_at timestamp with time zone,
    shipped_at timestamp with time zone,
    delivered_at timestamp with time zone,
    warehouse_id uuid,
    customer_name_snapshot character varying(200),
    broker_name_snapshot character varying(200),
    credit_override_approved boolean DEFAULT false,
    credit_override_reason text,
    credit_override_approved_by character varying(150),
    credit_override_approved_at timestamp with time zone,
    invoice_id uuid,
    allocated_at timestamp with time zone,
    allocated_by character varying(150),
    dispatched_at timestamp with time zone,
    dispatched_by character varying(150),
    delivered_by character varying(150),
    invoiced_at timestamp with time zone,
    invoiced_by character varying(150),
    paid_at timestamp with time zone,
    paid_by character varying(150),
    CONSTRAINT credit_override_integrity CHECK ((((credit_override_approved = true) AND (credit_override_reason IS NOT NULL) AND (credit_override_approved_by IS NOT NULL) AND (credit_override_approved_at IS NOT NULL)) OR (credit_override_approved = false))),
    CONSTRAINT sales_orders_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'CONFIRMED'::character varying, 'ALLOCATED'::character varying, 'FULFILLED'::character varying, 'SHIPPED'::character varying, 'DELIVERED'::character varying, 'INVOICED'::character varying, 'PAID'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT total_amount_check CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: sales_payment_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_payment_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    allocated_amount numeric(15,2) NOT NULL,
    payment_customer_id uuid NOT NULL,
    invoice_customer_id uuid NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    allocated_at timestamp with time zone DEFAULT now(),
    allocated_by character varying(150) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT allocated_amount_positive CHECK ((allocated_amount > (0)::numeric)),
    CONSTRAINT customer_consistency CHECK ((payment_customer_id = invoice_customer_id)),
    CONSTRAINT sales_payment_allocations_allocated_amount_check CHECK ((allocated_amount > (0)::numeric)),
    CONSTRAINT sales_payment_allocations_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'REVERSED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: sales_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid,
    payment_date date NOT NULL,
    amount_paid numeric(15,2) NOT NULL,
    payment_method character varying(30),
    reference_number character varying(100),
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    customer_id uuid,
    payment_number character varying(50),
    status character varying(20) DEFAULT 'RECEIVED'::character varying,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by character varying(150),
    CONSTRAINT amount_positive CHECK ((amount_paid > (0)::numeric)),
    CONSTRAINT sales_payments_status_check CHECK (((status)::text = ANY ((ARRAY['RECEIVED'::character varying, 'ALLOCATED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: TABLE sales_payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sales_payments IS 'CANONICAL (STEP 3L): Primary payment records table. Use via invoicing.ts service.';


--
-- Name: sales_quotation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_quotation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    line_number integer NOT NULL,
    fabric_quality_name character varying(200) NOT NULL,
    design_no character varying(50),
    qty_metre numeric(10,2) NOT NULL,
    rate_per_metre numeric(10,2) NOT NULL,
    line_total numeric(15,2) NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT qty_positive CHECK ((qty_metre > (0)::numeric)),
    CONSTRAINT rate_positive CHECK ((rate_per_metre > (0)::numeric))
);


--
-- Name: sales_quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_no character varying(50) NOT NULL,
    customer_id uuid NOT NULL,
    quoted_date date NOT NULL,
    valid_till date NOT NULL,
    subtotal_amount numeric(15,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    remarks text,
    quoted_by character varying(150),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    CONSTRAINT sales_quotations_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SENT'::character varying, 'ACCEPTED'::character varying, 'REJECTED'::character varying, 'EXPIRED'::character varying, 'CLOSED'::character varying])::text[]))),
    CONSTRAINT total_amount_check CHECK ((total_amount > (0)::numeric))
);


--
-- Name: seq_payment_number_daily; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_payment_number_daily
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shade_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shade_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lab_dip_no character varying(50) NOT NULL,
    customer_name character varying(200) NOT NULL,
    design_no character varying(100) NOT NULL,
    shade_name character varying(200) NOT NULL,
    hex_color character varying(10),
    delta_e_value numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'approved'::character varying NOT NULL,
    buyer_remarks text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    CONSTRAINT shade_approvals_status_check CHECK (((status)::text = ANY ((ARRAY['approved'::character varying, 'pending_buyer'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    status character varying(50) DEFAULT 'PICKED'::character varying NOT NULL,
    shipping_address text NOT NULL,
    carrier_name character varying(150),
    tracking_number character varying(100),
    created_by character varying(150),
    created_at timestamp with time zone DEFAULT now(),
    dispatched_at timestamp with time zone,
    dispatched_by character varying(150),
    delivered_at timestamp with time zone,
    delivered_by character varying(150),
    updated_by character varying(150),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT shipments_status_check CHECK (((status)::text = ANY ((ARRAY['PICKED'::character varying, 'IN_TRANSIT'::character varying, 'DELIVERED'::character varying, 'FAILED'::character varying, 'RETURNED'::character varying])::text[])))
);


--
-- Name: stock_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    qty_reserved numeric(10,2) NOT NULL,
    unit character varying(50) NOT NULL,
    reserved_by character varying(150) NOT NULL,
    reservation_date timestamp with time zone DEFAULT now(),
    approval_status character varying(50) DEFAULT 'PENDING'::character varying,
    approved_by character varying(150),
    approved_at timestamp with time zone,
    rejection_reason text,
    expires_at timestamp with time zone,
    reference_doc character varying(100),
    remarks text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    CONSTRAINT check_approval_status CHECK (((approval_status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'EXPIRED'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT check_qty_positive CHECK ((qty_reserved > (0)::numeric))
);


--
-- Name: supported_languages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supported_languages (
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    native_name character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_code text NOT NULL,
    unit_name text NOT NULL,
    description text,
    measurement_type text NOT NULL,
    base_unit text,
    conversion_factor numeric(19,6) DEFAULT 1,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT unit_code_not_empty CHECK ((length(unit_code) > 0)),
    CONSTRAINT unit_name_not_empty CHECK ((length(unit_name) > 0))
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    preferred_language character varying(10) DEFAULT 'en'::character varying,
    theme character varying(20) DEFAULT 'light'::character varying,
    card_zoom_level numeric(3,2) DEFAULT 1.0,
    sidebar_collapsed boolean DEFAULT false,
    sidebar_position character varying(20) DEFAULT 'left'::character varying,
    notification_enabled boolean DEFAULT true,
    notification_sound boolean DEFAULT false,
    dashboard_layout character varying(50) DEFAULT 'grid'::character varying,
    dashboard_columns integer DEFAULT 3,
    favorite_modules text[] DEFAULT ARRAY[]::text[],
    items_per_page integer DEFAULT 25,
    default_sort_column character varying(100),
    default_sort_direction character varying(10) DEFAULT 'asc'::character varying,
    keyboard_shortcuts_enabled boolean DEFAULT true,
    auto_refresh_enabled boolean DEFAULT false,
    auto_refresh_interval integer DEFAULT 300,
    export_format character varying(20) DEFAULT 'csv'::character varying,
    custom_settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_preferences_card_zoom_level_check CHECK (((card_zoom_level >= 0.6) AND (card_zoom_level <= 2.2))),
    CONSTRAINT user_preferences_dashboard_columns_check CHECK (((dashboard_columns >= 1) AND (dashboard_columns <= 6))),
    CONSTRAINT user_preferences_dashboard_layout_check CHECK (((dashboard_layout)::text = ANY ((ARRAY['grid'::character varying, 'list'::character varying, 'compact'::character varying])::text[]))),
    CONSTRAINT user_preferences_default_sort_direction_check CHECK (((default_sort_direction)::text = ANY ((ARRAY['asc'::character varying, 'desc'::character varying])::text[]))),
    CONSTRAINT user_preferences_export_format_check CHECK (((export_format)::text = ANY ((ARRAY['csv'::character varying, 'excel'::character varying, 'pdf'::character varying])::text[]))),
    CONSTRAINT user_preferences_items_per_page_check CHECK (((items_per_page >= 10) AND (items_per_page <= 100))),
    CONSTRAINT user_preferences_preferred_language_check CHECK (((preferred_language)::text = ANY ((ARRAY['en'::character varying, 'es'::character varying, 'fr'::character varying, 'de'::character varying, 'hi'::character varying, 'gu'::character varying, 'ta'::character varying, 'te'::character varying, 'mr'::character varying, 'ml'::character varying])::text[]))),
    CONSTRAINT user_preferences_sidebar_position_check CHECK (((sidebar_position)::text = ANY ((ARRAY['left'::character varying, 'right'::character varying])::text[]))),
    CONSTRAINT user_preferences_theme_check CHECK (((theme)::text = ANY ((ARRAY['light'::character varying, 'dark'::character varying, 'auto'::character varying])::text[]))),
    CONSTRAINT valid_modules CHECK ((custom_settings IS NOT NULL))
);


--
-- Name: user_roles_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles_mapping (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: vw_inventory_available_qty; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_inventory_available_qty WITH (security_invoker = true) AS
 SELECT ii.id,
    ii.item_code,
    ii.item_name,
    ii.item_type,
    ibc.net_qty,
    ibc.available_qty,
    ibc.total_reserved_qty,
    ii.current_location,
    ibc.avg_cost_per_unit,
    ibc.updated_at
   FROM (public.inventory_items ii
     LEFT JOIN public.inventory_balances_cache ibc ON ((ii.id = ibc.item_id)))
  WHERE (ii.is_active = true);


--
-- Name: warehouse_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    zone_id uuid NOT NULL,
    capacity_kg numeric(14,4) DEFAULT 0,
    capacity_metres numeric(14,4) DEFAULT 0,
    current_qty_kg numeric(14,4) DEFAULT 0,
    current_qty_metres numeric(14,4) DEFAULT 0,
    is_active boolean DEFAULT true,
    coordinates jsonb DEFAULT '{"x": 0, "y": 0}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    CONSTRAINT warehouse_locations_code_not_empty CHECK ((length((code)::text) > 0)),
    CONSTRAINT warehouse_locations_coordinates_valid CHECK ((((coordinates ->> 'x'::text) IS NOT NULL) AND ((coordinates ->> 'y'::text) IS NOT NULL))),
    CONSTRAINT warehouse_locations_name_not_empty CHECK ((length((name)::text) > 0))
);


--
-- Name: warehouse_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color_code character varying(7) DEFAULT '#6366F1'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(150),
    updated_by character varying(150),
    CONSTRAINT warehouse_zones_color_code_valid CHECK (((color_code)::text ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT warehouse_zones_name_not_empty CHECK ((length((name)::text) > 0))
);


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_code text NOT NULL,
    warehouse_name text NOT NULL,
    warehouse_type text NOT NULL,
    warehouse_type_other text,
    address_line1 text,
    address_line2 text,
    area text,
    city text,
    district text,
    state text,
    pin_code text,
    country text DEFAULT 'India'::text,
    contact_person text,
    mobile text,
    email text,
    total_capacity_kg numeric(14,4),
    total_capacity_metres numeric(14,4),
    remarks text,
    is_active boolean DEFAULT true,
    status text DEFAULT 'Active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT warehouse_code_not_empty CHECK ((length(warehouse_code) > 0)),
    CONSTRAINT warehouse_name_not_empty CHECK ((length(warehouse_name) > 0))
);


--
-- Name: approval_workflow approval_workflow_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflow
    ADD CONSTRAINT approval_workflow_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: beam_colours beam_colours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beam_colours
    ADD CONSTRAINT beam_colours_pkey PRIMARY KEY (id);


--
-- Name: colors colors_color_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_color_code_key UNIQUE (color_code);


--
-- Name: colors colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_pkey PRIMARY KEY (id);


--
-- Name: cost_sheet_charges cost_sheet_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_sheet_charges
    ADD CONSTRAINT cost_sheet_charges_pkey PRIMARY KEY (id);


--
-- Name: cost_sheet_lines cost_sheet_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_sheet_lines
    ADD CONSTRAINT cost_sheet_lines_pkey PRIMARY KEY (id);


--
-- Name: cost_sheets cost_sheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_sheets
    ADD CONSTRAINT cost_sheets_pkey PRIMARY KEY (id);


--
-- Name: cost_sheets cost_sheets_sheet_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_sheets
    ADD CONSTRAINT cost_sheets_sheet_no_key UNIQUE (sheet_no);


--
-- Name: customers customers_party_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_party_id_key UNIQUE (party_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: daily_production daily_production_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production
    ADD CONSTRAINT daily_production_pkey PRIMARY KEY (id);


--
-- Name: designs designs_design_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_design_number_key UNIQUE (design_number);


--
-- Name: designs designs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_pkey PRIMARY KEY (id);


--
-- Name: feeders feeders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feeders
    ADD CONSTRAINT feeders_pkey PRIMARY KEY (id);


--
-- Name: inventory_balances_cache inventory_balances_cache_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_balances_cache
    ADD CONSTRAINT inventory_balances_cache_item_id_key UNIQUE (item_id);


--
-- Name: inventory_balances_cache inventory_balances_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_balances_cache
    ADD CONSTRAINT inventory_balances_cache_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_item_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_item_code_key UNIQUE (item_code);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: job_cards job_cards_card_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_cards
    ADD CONSTRAINT job_cards_card_no_key UNIQUE (card_no);


--
-- Name: job_cards job_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_cards
    ADD CONSTRAINT job_cards_pkey PRIMARY KEY (id);


--
-- Name: lab_tests lab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_pkey PRIMARY KEY (id);


--
-- Name: lab_tests lab_tests_test_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_test_no_key UNIQUE (test_no);


--
-- Name: loom_maintenance loom_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loom_maintenance
    ADD CONSTRAINT loom_maintenance_pkey PRIMARY KEY (id);


--
-- Name: looms looms_loom_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.looms
    ADD CONSTRAINT looms_loom_no_key UNIQUE (loom_no);


--
-- Name: looms looms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.looms
    ADD CONSTRAINT looms_pkey PRIMARY KEY (id);


--
-- Name: machines machines_machine_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_machine_code_key UNIQUE (machine_code);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: masters masters_master_type_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.masters
    ADD CONSTRAINT masters_master_type_code_key UNIQUE (master_type, code);


--
-- Name: masters masters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.masters
    ADD CONSTRAINT masters_pkey PRIMARY KEY (id);


--
-- Name: material_rate_history material_rate_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_rate_history
    ADD CONSTRAINT material_rate_history_pkey PRIMARY KEY (id);


--
-- Name: materials materials_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_code_key UNIQUE (code);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: parties parties_party_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_party_code_key UNIQUE (party_code);


--
-- Name: parties parties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_pkey PRIMARY KEY (id);


--
-- Name: party_sub_parties party_sub_parties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_sub_parties
    ADD CONSTRAINT party_sub_parties_pkey PRIMARY KEY (id);


--
-- Name: party_sub_parties party_sub_parties_sub_party_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_sub_parties
    ADD CONSTRAINT party_sub_parties_sub_party_code_key UNIQUE (sub_party_code);


--
-- Name: sales_payment_allocations payment_invoice_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payment_allocations
    ADD CONSTRAINT payment_invoice_unique UNIQUE (payment_id, invoice_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_permission_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_permission_code_key UNIQUE (permission_code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: process_rate_history process_rate_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_rate_history
    ADD CONSTRAINT process_rate_history_pkey PRIMARY KEY (id);


--
-- Name: processes processes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processes
    ADD CONSTRAINT processes_pkey PRIMARY KEY (id);


--
-- Name: processes processes_process_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processes
    ADD CONSTRAINT processes_process_code_key UNIQUE (process_code);


--
-- Name: production_audit_trail production_audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_audit_trail
    ADD CONSTRAINT production_audit_trail_pkey PRIMARY KEY (id);


--
-- Name: production_inspections production_inspections_inspection_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_inspections
    ADD CONSTRAINT production_inspections_inspection_no_key UNIQUE (inspection_no);


--
-- Name: production_inspections production_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_inspections
    ADD CONSTRAINT production_inspections_pkey PRIMARY KEY (id);


--
-- Name: production_orders production_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_order_no_key UNIQUE (order_no);


--
-- Name: production_orders production_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_pkey PRIMARY KEY (id);


--
-- Name: production_output production_output_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_output
    ADD CONSTRAINT production_output_pkey PRIMARY KEY (id);


--
-- Name: profile_audit_log profile_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_audit_log
    ADD CONSTRAINT profile_audit_log_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_employee_id_key UNIQUE (employee_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: quality_hold_records quality_hold_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_hold_records
    ADD CONSTRAINT quality_hold_records_pkey PRIMARY KEY (id);


--
-- Name: quality_inspections quality_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_pkey PRIMARY KEY (id);


--
-- Name: role_definitions role_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_definitions
    ADD CONSTRAINT role_definitions_pkey PRIMARY KEY (id);


--
-- Name: role_definitions role_definitions_role_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_definitions
    ADD CONSTRAINT role_definitions_role_code_key UNIQUE (role_code);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: sales_audit_trail sales_audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_audit_trail
    ADD CONSTRAINT sales_audit_trail_pkey PRIMARY KEY (id);


--
-- Name: sales_fulfillment_items sales_fulfillment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_fulfillment_items
    ADD CONSTRAINT sales_fulfillment_items_pkey PRIMARY KEY (id);


--
-- Name: sales_fulfillment sales_fulfillment_pick_list_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_fulfillment
    ADD CONSTRAINT sales_fulfillment_pick_list_no_key UNIQUE (pick_list_no);


--
-- Name: sales_fulfillment sales_fulfillment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_fulfillment
    ADD CONSTRAINT sales_fulfillment_pkey PRIMARY KEY (id);


--
-- Name: sales_invoice_items sales_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: sales_invoices sales_invoices_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_invoice_no_key UNIQUE (invoice_no);


--
-- Name: sales_invoices sales_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_pkey PRIMARY KEY (id);


--
-- Name: sales_order_items sales_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_order_no_key UNIQUE (order_no);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: sales_payment_allocations sales_payment_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payment_allocations
    ADD CONSTRAINT sales_payment_allocations_pkey PRIMARY KEY (id);


--
-- Name: sales_payments sales_payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payments
    ADD CONSTRAINT sales_payments_payment_number_key UNIQUE (payment_number);


--
-- Name: sales_payments sales_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payments
    ADD CONSTRAINT sales_payments_pkey PRIMARY KEY (id);


--
-- Name: sales_quotation_items sales_quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_pkey PRIMARY KEY (id);


--
-- Name: sales_quotations sales_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_pkey PRIMARY KEY (id);


--
-- Name: sales_quotations sales_quotations_quotation_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_quotation_no_key UNIQUE (quotation_no);


--
-- Name: shade_approvals shade_approvals_lab_dip_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shade_approvals
    ADD CONSTRAINT shade_approvals_lab_dip_no_key UNIQUE (lab_dip_no);


--
-- Name: shade_approvals shade_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shade_approvals
    ADD CONSTRAINT shade_approvals_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: stock_reservations stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_pkey PRIMARY KEY (id);


--
-- Name: supported_languages supported_languages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supported_languages
    ADD CONSTRAINT supported_languages_pkey PRIMARY KEY (code);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: units units_unit_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_unit_code_key UNIQUE (unit_code);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_roles_mapping user_roles_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles_mapping
    ADD CONSTRAINT user_roles_mapping_pkey PRIMARY KEY (id);


--
-- Name: user_roles_mapping user_roles_mapping_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles_mapping
    ADD CONSTRAINT user_roles_mapping_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: warehouse_locations warehouse_locations_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_locations
    ADD CONSTRAINT warehouse_locations_code_key UNIQUE (code);


--
-- Name: warehouse_locations warehouse_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_locations
    ADD CONSTRAINT warehouse_locations_pkey PRIMARY KEY (id);


--
-- Name: warehouse_zones warehouse_zones_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_zones
    ADD CONSTRAINT warehouse_zones_name_key UNIQUE (name);


--
-- Name: warehouse_zones warehouse_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_zones
    ADD CONSTRAINT warehouse_zones_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_warehouse_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_warehouse_code_key UNIQUE (warehouse_code);


--
-- Name: idx_approval_workflow_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_workflow_status ON public.approval_workflow USING btree (status);


--
-- Name: idx_approval_workflow_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_workflow_transaction_id ON public.approval_workflow USING btree (transaction_id);


--
-- Name: idx_beam_colours_design; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beam_colours_design ON public.beam_colours USING btree (design_id);


--
-- Name: idx_colors_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colors_code ON public.colors USING btree (color_code);


--
-- Name: idx_colors_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colors_is_active ON public.colors USING btree (is_active);


--
-- Name: idx_colors_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colors_type ON public.colors USING btree (color_type);


--
-- Name: idx_cost_sheet_charges_cost_sheet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheet_charges_cost_sheet_id ON public.cost_sheet_charges USING btree (cost_sheet_id);


--
-- Name: idx_cost_sheet_charges_cost_sheet_id_sequence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheet_charges_cost_sheet_id_sequence ON public.cost_sheet_charges USING btree (cost_sheet_id, sequence);


--
-- Name: idx_cost_sheet_charges_sequence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheet_charges_sequence ON public.cost_sheet_charges USING btree (cost_sheet_id, sequence);


--
-- Name: idx_cost_sheet_lines_cost_sheet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheet_lines_cost_sheet_id ON public.cost_sheet_lines USING btree (cost_sheet_id);


--
-- Name: idx_cost_sheet_lines_cost_sheet_id_sequence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheet_lines_cost_sheet_id_sequence ON public.cost_sheet_lines USING btree (cost_sheet_id, sequence);


--
-- Name: idx_cost_sheet_lines_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheet_lines_material_id ON public.cost_sheet_lines USING btree (material_id);


--
-- Name: idx_cost_sheet_lines_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheet_lines_section ON public.cost_sheet_lines USING btree (section);


--
-- Name: idx_cost_sheet_lines_sequence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheet_lines_sequence ON public.cost_sheet_lines USING btree (cost_sheet_id, sequence);


--
-- Name: idx_cost_sheets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheets_created_at ON public.cost_sheets USING btree (created_at DESC);


--
-- Name: idx_cost_sheets_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheets_created_by ON public.cost_sheets USING btree (created_by);


--
-- Name: idx_cost_sheets_design_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheets_design_no ON public.cost_sheets USING btree (design_no);


--
-- Name: idx_cost_sheets_party_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheets_party_id ON public.cost_sheets USING btree (party_id);


--
-- Name: idx_cost_sheets_sheet_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheets_sheet_no ON public.cost_sheets USING btree (sheet_no);


--
-- Name: idx_cost_sheets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheets_status ON public.cost_sheets USING btree (status);


--
-- Name: idx_cost_sheets_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_sheets_version ON public.cost_sheets USING btree (sheet_no, version);


--
-- Name: idx_customers_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_is_active ON public.customers USING btree (is_active);


--
-- Name: idx_customers_party_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_party_id ON public.customers USING btree (party_id);


--
-- Name: idx_daily_production_entry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_production_entry_date ON public.daily_production USING btree (entry_date);


--
-- Name: idx_daily_production_job_card_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_production_job_card_id ON public.daily_production USING btree (job_card_id);


--
-- Name: idx_daily_production_loom_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_production_loom_id ON public.daily_production USING btree (loom_id);


--
-- Name: idx_daily_production_recorded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_production_recorded_by ON public.daily_production USING btree (recorded_by);


--
-- Name: idx_daily_production_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_production_shift ON public.daily_production USING btree (shift);


--
-- Name: idx_daily_production_unique_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_daily_production_unique_shift ON public.daily_production USING btree (job_card_id, loom_id, entry_date, shift);


--
-- Name: idx_designs_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designs_created_by ON public.designs USING btree (created_by);


--
-- Name: idx_designs_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designs_number ON public.designs USING btree (design_number);


--
-- Name: idx_designs_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designs_updated_by ON public.designs USING btree (updated_by);


--
-- Name: idx_feeders_beam; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feeders_beam ON public.feeders USING btree (beam_colour_id);


--
-- Name: idx_feeders_color; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feeders_color ON public.feeders USING btree (color_name);


--
-- Name: idx_feeders_old_num; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feeders_old_num ON public.feeders USING btree (old_number);


--
-- Name: idx_inv_balances_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_balances_item_id ON public.inventory_balances_cache USING btree (item_id);


--
-- Name: idx_inv_trans_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_trans_created_at ON public.inventory_transactions USING btree (created_at DESC);


--
-- Name: idx_inv_trans_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_trans_created_by ON public.inventory_transactions USING btree (created_by);


--
-- Name: idx_inv_trans_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_trans_item_id ON public.inventory_transactions USING btree (item_id);


--
-- Name: idx_inv_trans_movement_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_trans_movement_type ON public.inventory_transactions USING btree (movement_type);


--
-- Name: idx_inv_trans_ref_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_trans_ref_doc ON public.inventory_transactions USING btree (reference_doc);


--
-- Name: idx_inv_trans_transaction_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_trans_transaction_date ON public.inventory_transactions USING btree (transaction_date DESC);


--
-- Name: idx_inventory_items_current_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_current_location ON public.inventory_items USING btree (current_location);


--
-- Name: idx_inventory_items_id_reserved_qty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_id_reserved_qty ON public.inventory_items USING btree (id, reserved_qty, total_qty);


--
-- Name: idx_inventory_items_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_is_active ON public.inventory_items USING btree (is_active);


--
-- Name: idx_inventory_items_item_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_item_code ON public.inventory_items USING btree (item_code);


--
-- Name: idx_inventory_items_item_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_item_type ON public.inventory_items USING btree (item_type);


--
-- Name: idx_inventory_items_reserved_qty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_reserved_qty ON public.inventory_items USING btree (reserved_qty);


--
-- Name: idx_inventory_items_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_supplier_id ON public.inventory_items USING btree (supplier_id);


--
-- Name: idx_inventory_transactions_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_approval_status ON public.inventory_transactions USING btree (approval_status);


--
-- Name: idx_inventory_transactions_approved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_approved_by ON public.inventory_transactions USING btree (approved_by);


--
-- Name: idx_inventory_transactions_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_created_by ON public.inventory_transactions USING btree (created_by);


--
-- Name: idx_inventory_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_date ON public.inventory_transactions USING btree (transaction_date DESC);


--
-- Name: idx_inventory_transactions_dispatch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_dispatch ON public.inventory_transactions USING btree (movement_type) WHERE ((movement_type)::text = 'dispatch'::text);


--
-- Name: idx_inventory_transactions_inspected_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_inspected_by ON public.inventory_transactions USING btree (inspected_by);


--
-- Name: idx_inventory_transactions_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_item_id ON public.inventory_transactions USING btree (item_id);


--
-- Name: idx_inventory_transactions_item_id_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_item_id_date ON public.inventory_transactions USING btree (item_id, transaction_date DESC);


--
-- Name: idx_inventory_transactions_movement_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_movement_type ON public.inventory_transactions USING btree (movement_type);


--
-- Name: idx_inventory_transactions_quality_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_quality_grade ON public.inventory_transactions USING btree (quality_grade);


--
-- Name: idx_inventory_transactions_reference_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_reference_doc ON public.inventory_transactions USING btree (reference_doc);


--
-- Name: idx_invoices_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_invoice_number ON public.invoices USING btree (invoice_number);


--
-- Name: idx_invoices_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_order_id ON public.invoices USING btree (order_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_job_cards_card_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_cards_card_no ON public.job_cards USING btree (card_no);


--
-- Name: idx_job_cards_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_cards_completed_at ON public.job_cards USING btree (completed_at);


--
-- Name: idx_job_cards_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_cards_created_by ON public.job_cards USING btree (created_by);


--
-- Name: idx_job_cards_loom_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_cards_loom_id ON public.job_cards USING btree (loom_id);


--
-- Name: idx_job_cards_material_issued_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_cards_material_issued_at ON public.job_cards USING btree (material_issued_at);


--
-- Name: idx_job_cards_output_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_cards_output_item_id ON public.job_cards USING btree (output_item_id);


--
-- Name: idx_job_cards_production_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_cards_production_order_id ON public.job_cards USING btree (production_order_id);


--
-- Name: idx_job_cards_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_cards_status ON public.job_cards USING btree (status);


--
-- Name: idx_lab_tests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_tests_created_at ON public.lab_tests USING btree (created_at DESC);


--
-- Name: idx_lab_tests_roll_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_tests_roll_no ON public.lab_tests USING btree (roll_no);


--
-- Name: idx_lab_tests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_tests_status ON public.lab_tests USING btree (status);


--
-- Name: idx_lab_tests_test_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_tests_test_no ON public.lab_tests USING btree (test_no);


--
-- Name: idx_loom_maintenance_loom_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loom_maintenance_loom_id ON public.loom_maintenance USING btree (loom_id);


--
-- Name: idx_loom_maintenance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loom_maintenance_status ON public.loom_maintenance USING btree (status);


--
-- Name: idx_looms_assigned_operator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_looms_assigned_operator_id ON public.looms USING btree (assigned_operator_id);


--
-- Name: idx_looms_current_job_card_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_looms_current_job_card_id ON public.looms USING btree (current_job_card_id);


--
-- Name: idx_looms_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_looms_is_active ON public.looms USING btree (is_active);


--
-- Name: idx_looms_loom_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_looms_loom_no ON public.looms USING btree (loom_no);


--
-- Name: idx_looms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_looms_status ON public.looms USING btree (status);


--
-- Name: idx_machines_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machines_code ON public.machines USING btree (machine_code);


--
-- Name: idx_machines_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machines_is_active ON public.machines USING btree (is_active);


--
-- Name: idx_machines_process_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machines_process_id ON public.machines USING btree (process_id);


--
-- Name: idx_machines_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machines_status ON public.machines USING btree (status);


--
-- Name: idx_machines_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machines_type ON public.machines USING btree (machine_type);


--
-- Name: idx_machines_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machines_warehouse_id ON public.machines USING btree (warehouse_id);


--
-- Name: idx_masters_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_masters_created_by ON public.masters USING btree (created_by);


--
-- Name: idx_masters_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_masters_updated_by ON public.masters USING btree (updated_by);


--
-- Name: idx_materials_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_created_by ON public.materials USING btree (created_by);


--
-- Name: idx_materials_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_updated_by ON public.materials USING btree (updated_by);


--
-- Name: idx_parties_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parties_city ON public.parties USING btree (city);


--
-- Name: idx_parties_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parties_code ON public.parties USING btree (party_code);


--
-- Name: idx_parties_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parties_created_by ON public.parties USING btree (created_by);


--
-- Name: idx_parties_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parties_name ON public.parties USING btree (party_name);


--
-- Name: idx_parties_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parties_status ON public.parties USING btree (status);


--
-- Name: idx_parties_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parties_updated_by ON public.parties USING btree (updated_by);


--
-- Name: idx_party_sub_parties_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_sub_parties_code ON public.party_sub_parties USING btree (sub_party_code);


--
-- Name: idx_party_sub_parties_is_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_sub_parties_is_default ON public.party_sub_parties USING btree (is_default);


--
-- Name: idx_party_sub_parties_party_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_sub_parties_party_id ON public.party_sub_parties USING btree (party_id);


--
-- Name: idx_party_sub_parties_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_sub_parties_status ON public.party_sub_parties USING btree (status);


--
-- Name: idx_payments_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice_id ON public.payments USING btree (invoice_id);


--
-- Name: idx_payments_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_payment_date ON public.payments USING btree (payment_date);


--
-- Name: idx_permissions_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_code ON public.permissions USING btree (permission_code);


--
-- Name: idx_permissions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_module ON public.permissions USING btree (module);


--
-- Name: idx_process_rate_history_process_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_process_rate_history_process_id ON public.process_rate_history USING btree (process_id);


--
-- Name: idx_processes_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processes_category ON public.processes USING btree (process_category);


--
-- Name: idx_processes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processes_code ON public.processes USING btree (process_code);


--
-- Name: idx_processes_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processes_is_active ON public.processes USING btree (is_active);


--
-- Name: idx_processes_is_outsourced; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processes_is_outsourced ON public.processes USING btree (is_outsourced);


--
-- Name: idx_production_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_audit_action ON public.production_audit_trail USING btree (action);


--
-- Name: idx_production_audit_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_audit_order_id ON public.production_audit_trail USING btree (order_id);


--
-- Name: idx_production_audit_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_audit_timestamp ON public.production_audit_trail USING btree ("timestamp");


--
-- Name: idx_production_inspections_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inspections_created_at ON public.production_inspections USING btree (created_at DESC);


--
-- Name: idx_production_inspections_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inspections_created_by ON public.production_inspections USING btree (created_by);


--
-- Name: idx_production_inspections_decision_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inspections_decision_at ON public.production_inspections USING btree (decision_at DESC);


--
-- Name: idx_production_inspections_design_roll; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inspections_design_roll ON public.production_inspections USING btree (design_no, roll_no, created_at DESC);


--
-- Name: idx_production_inspections_inspection_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inspections_inspection_no ON public.production_inspections USING btree (inspection_no);


--
-- Name: idx_production_inspections_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inspections_is_active ON public.production_inspections USING btree (is_active);


--
-- Name: idx_production_inspections_job_card; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inspections_job_card ON public.production_inspections USING btree (job_card_id);


--
-- Name: idx_production_inspections_job_card_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inspections_job_card_id ON public.production_inspections USING btree (job_card_id);


--
-- Name: idx_production_inspections_roll_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inspections_roll_no ON public.production_inspections USING btree (roll_no);


--
-- Name: idx_production_inspections_system_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inspections_system_grade ON public.production_inspections USING btree (system_grade);


--
-- Name: idx_production_orders_cost_sheet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_orders_cost_sheet_id ON public.production_orders USING btree (cost_sheet_id);


--
-- Name: idx_production_orders_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_orders_created_by ON public.production_orders USING btree (created_by);


--
-- Name: idx_production_orders_order_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_orders_order_no ON public.production_orders USING btree (order_no);


--
-- Name: idx_production_orders_party_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_orders_party_id ON public.production_orders USING btree (party_id);


--
-- Name: idx_production_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_orders_status ON public.production_orders USING btree (status);


--
-- Name: idx_production_output_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_output_grade ON public.production_output USING btree (grade);


--
-- Name: idx_production_output_job_card; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_output_job_card ON public.production_output USING btree (job_card_id);


--
-- Name: idx_production_output_job_card_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_output_job_card_id ON public.production_output USING btree (job_card_id);


--
-- Name: idx_production_output_output_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_output_output_item_id ON public.production_output USING btree (output_item_id);


--
-- Name: idx_profiles_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_approval_status ON public.profiles USING btree (approval_status);


--
-- Name: idx_profiles_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_created_at ON public.profiles USING btree (created_at);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);


--
-- Name: idx_profiles_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_employee_id ON public.profiles USING btree (employee_id);


--
-- Name: idx_profiles_primary_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_primary_role_id ON public.profiles USING btree (primary_role_id);


--
-- Name: idx_profiles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_status ON public.profiles USING btree (status);


--
-- Name: idx_quality_hold_records_production_inspection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_hold_records_production_inspection_id ON public.quality_hold_records USING btree (production_inspection_id);


--
-- Name: idx_quality_hold_records_roll_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_hold_records_roll_no ON public.quality_hold_records USING btree (roll_no);


--
-- Name: idx_quality_inspections_inspected_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_inspections_inspected_by ON public.quality_inspections USING btree (inspected_by);


--
-- Name: idx_quality_inspections_quality_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_inspections_quality_grade ON public.quality_inspections USING btree (quality_grade);


--
-- Name: idx_quality_inspections_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_inspections_transaction_id ON public.quality_inspections USING btree (transaction_id);


--
-- Name: idx_role_definitions_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_definitions_code ON public.role_definitions USING btree (role_code);


--
-- Name: idx_role_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);


--
-- Name: idx_sales_audit_trail_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_audit_trail_order_id ON public.sales_audit_trail USING btree (order_id);


--
-- Name: idx_sales_audit_trail_quotation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_audit_trail_quotation_id ON public.sales_audit_trail USING btree (quotation_id);


--
-- Name: idx_sales_audit_trail_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_audit_trail_timestamp ON public.sales_audit_trail USING btree ("timestamp");


--
-- Name: idx_sales_fulfillment_items_fulfillment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_fulfillment_items_fulfillment_id ON public.sales_fulfillment_items USING btree (fulfillment_id);


--
-- Name: idx_sales_fulfillment_pick_list_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_fulfillment_pick_list_no ON public.sales_fulfillment USING btree (pick_list_no);


--
-- Name: idx_sales_fulfillment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_fulfillment_status ON public.sales_fulfillment USING btree (status);


--
-- Name: idx_sales_invoice_items_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_invoice_items_invoice_id ON public.sales_invoice_items USING btree (invoice_id);


--
-- Name: idx_sales_invoice_items_order_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_invoice_items_order_item_id ON public.sales_invoice_items USING btree (order_item_id);


--
-- Name: idx_sales_invoices_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_invoices_customer_id ON public.sales_invoices USING btree (customer_id);


--
-- Name: idx_sales_invoices_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_invoices_due_date ON public.sales_invoices USING btree (due_date);


--
-- Name: idx_sales_invoices_invoice_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_invoices_invoice_no ON public.sales_invoices USING btree (invoice_no);


--
-- Name: idx_sales_invoices_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_invoices_order_id ON public.sales_invoices USING btree (order_id);


--
-- Name: idx_sales_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_invoices_status ON public.sales_invoices USING btree (status);


--
-- Name: idx_sales_order_items_cost_sheet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_cost_sheet_id ON public.sales_order_items USING btree (cost_sheet_id);


--
-- Name: idx_sales_order_items_design_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_design_id ON public.sales_order_items USING btree (design_id);


--
-- Name: idx_sales_order_items_inventory_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_inventory_item_id ON public.sales_order_items USING btree (inventory_item_id);


--
-- Name: idx_sales_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_order_id ON public.sales_order_items USING btree (order_id);


--
-- Name: idx_sales_order_items_order_id_qty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_order_id_qty ON public.sales_order_items USING btree (order_id, qty_reserved, qty_metre);


--
-- Name: idx_sales_order_items_qty_reserved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_qty_reserved ON public.sales_order_items USING btree (order_id, qty_reserved DESC);


--
-- Name: idx_sales_order_items_qty_reserved_by_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_qty_reserved_by_order ON public.sales_order_items USING btree (order_id, qty_reserved DESC) WHERE (qty_reserved > (0)::numeric);


--
-- Name: idx_sales_order_items_stock_reservation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_stock_reservation_id ON public.sales_order_items USING btree (stock_reservation_id);


--
-- Name: idx_sales_order_items_warehouse_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_warehouse_status ON public.sales_order_items USING btree (order_id, qty_reserved) WHERE (qty_reserved > (0)::numeric);


--
-- Name: idx_sales_orders_credit_override; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_credit_override ON public.sales_orders USING btree (credit_override_approved);


--
-- Name: idx_sales_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_customer_id ON public.sales_orders USING btree (customer_id);


--
-- Name: idx_sales_orders_delivery_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_delivery_date ON public.sales_orders USING btree (delivery_date);


--
-- Name: idx_sales_orders_order_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_order_date ON public.sales_orders USING btree (order_date);


--
-- Name: idx_sales_orders_order_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_order_no ON public.sales_orders USING btree (order_no);


--
-- Name: idx_sales_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_status ON public.sales_orders USING btree (status);


--
-- Name: idx_sales_orders_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_warehouse_id ON public.sales_orders USING btree (warehouse_id);


--
-- Name: idx_sales_payment_allocations_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_payment_allocations_customer_id ON public.sales_payment_allocations USING btree (payment_customer_id);


--
-- Name: idx_sales_payment_allocations_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_payment_allocations_invoice_id ON public.sales_payment_allocations USING btree (invoice_id);


--
-- Name: idx_sales_payment_allocations_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_payment_allocations_payment_id ON public.sales_payment_allocations USING btree (payment_id);


--
-- Name: idx_sales_payment_allocations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_payment_allocations_status ON public.sales_payment_allocations USING btree (status);


--
-- Name: idx_sales_payments_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_payments_customer_id ON public.sales_payments USING btree (customer_id);


--
-- Name: idx_sales_payments_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_payments_invoice_id ON public.sales_payments USING btree (invoice_id);


--
-- Name: idx_sales_payments_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_payments_payment_date ON public.sales_payments USING btree (payment_date);


--
-- Name: idx_sales_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_payments_status ON public.sales_payments USING btree (status);


--
-- Name: idx_sales_quotation_items_quotation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_quotation_items_quotation_id ON public.sales_quotation_items USING btree (quotation_id);


--
-- Name: idx_sales_quotations_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_quotations_customer_id ON public.sales_quotations USING btree (customer_id);


--
-- Name: idx_sales_quotations_quotation_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_quotations_quotation_no ON public.sales_quotations USING btree (quotation_no);


--
-- Name: idx_sales_quotations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_quotations_status ON public.sales_quotations USING btree (status);


--
-- Name: idx_shade_approvals_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shade_approvals_created_at ON public.shade_approvals USING btree (created_at DESC);


--
-- Name: idx_shade_approvals_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shade_approvals_customer_name ON public.shade_approvals USING btree (customer_name);


--
-- Name: idx_shade_approvals_lab_dip_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shade_approvals_lab_dip_no ON public.shade_approvals USING btree (lab_dip_no);


--
-- Name: idx_shade_approvals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shade_approvals_status ON public.shade_approvals USING btree (status);


--
-- Name: idx_shipments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_order_id ON public.shipments USING btree (order_id);


--
-- Name: idx_shipments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_status ON public.shipments USING btree (status);


--
-- Name: idx_shipments_warehouse_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_warehouse_id ON public.shipments USING btree (warehouse_id);


--
-- Name: idx_stock_reservations_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reservations_approval_status ON public.stock_reservations USING btree (approval_status);


--
-- Name: idx_stock_reservations_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reservations_expires_at ON public.stock_reservations USING btree (expires_at);


--
-- Name: idx_stock_reservations_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reservations_item_id ON public.stock_reservations USING btree (item_id);


--
-- Name: idx_stock_reservations_item_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reservations_item_status ON public.stock_reservations USING btree (item_id, approval_status);


--
-- Name: idx_stock_reservations_reservation_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reservations_reservation_date ON public.stock_reservations USING btree (reservation_date DESC);


--
-- Name: idx_stock_reservations_reserved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reservations_reserved_by ON public.stock_reservations USING btree (reserved_by);


--
-- Name: idx_units_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_code ON public.units USING btree (unit_code);


--
-- Name: idx_units_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_is_active ON public.units USING btree (is_active);


--
-- Name: idx_units_is_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_is_default ON public.units USING btree (is_default);


--
-- Name: idx_units_measurement_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_measurement_type ON public.units USING btree (measurement_type);


--
-- Name: idx_user_preferences_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_preferences_created_at ON public.user_preferences USING btree (created_at);


--
-- Name: idx_user_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_preferences_user_id ON public.user_preferences USING btree (user_id);


--
-- Name: idx_user_roles_mapping_is_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_mapping_is_primary ON public.user_roles_mapping USING btree (is_primary);


--
-- Name: idx_user_roles_mapping_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_mapping_role_id ON public.user_roles_mapping USING btree (role_id);


--
-- Name: idx_user_roles_mapping_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_mapping_user_id ON public.user_roles_mapping USING btree (user_id);


--
-- Name: idx_warehouse_locations_capacity_check; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_locations_capacity_check ON public.warehouse_locations USING btree (capacity_kg, current_qty_kg);


--
-- Name: idx_warehouse_locations_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_locations_code ON public.warehouse_locations USING btree (code);


--
-- Name: idx_warehouse_locations_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_locations_is_active ON public.warehouse_locations USING btree (is_active);


--
-- Name: idx_warehouse_locations_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_locations_zone_id ON public.warehouse_locations USING btree (zone_id);


--
-- Name: idx_warehouse_zones_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_zones_is_active ON public.warehouse_zones USING btree (is_active);


--
-- Name: idx_warehouses_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_code ON public.warehouses USING btree (warehouse_code);


--
-- Name: idx_warehouses_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_is_active ON public.warehouses USING btree (is_active);


--
-- Name: idx_warehouses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_status ON public.warehouses USING btree (status);


--
-- Name: idx_warehouses_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouses_type ON public.warehouses USING btree (warehouse_type);


--
-- Name: colors colors_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER colors_updated BEFORE UPDATE ON public.colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cost_sheets cost_sheets_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cost_sheets_updated BEFORE UPDATE ON public.cost_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machines machines_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER machines_updated BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: masters masters_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER masters_updated BEFORE UPDATE ON public.masters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: materials materials_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER materials_updated BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles on_profile_created_preferences; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_created_preferences AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_preferences();


--
-- Name: party_sub_parties party_sub_parties_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER party_sub_parties_updated BEFORE UPDATE ON public.party_sub_parties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: processes processes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER processes_updated BEFORE UPDATE ON public.processes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales_order_items tr_sales_order_items_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_sales_order_items_immutability BEFORE UPDATE ON public.sales_order_items FOR EACH ROW EXECUTE FUNCTION public.validate_sales_order_item_update();


--
-- Name: sales_orders tr_sales_orders_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_sales_orders_immutability BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.validate_sales_order_update();


--
-- Name: profiles trg_guard_profile_privileged_columns; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_profile_privileged_columns BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();


--
-- Name: profiles trigger_audit_profile_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_audit_profile_change AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_profile_change();


--
-- Name: inventory_transactions trigger_update_inventory_balance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_inventory_balance AFTER INSERT ON public.inventory_transactions FOR EACH ROW EXECUTE FUNCTION public.update_inventory_balance();


--
-- Name: units units_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER units_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_preferences update_user_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_timestamp();


--
-- Name: warehouses warehouses_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER warehouses_updated BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: beam_colours beam_colours_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beam_colours
    ADD CONSTRAINT beam_colours_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.designs(id) ON DELETE CASCADE;


--
-- Name: cost_sheet_charges cost_sheet_charges_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_sheet_charges
    ADD CONSTRAINT cost_sheet_charges_sheet_id_fkey FOREIGN KEY (cost_sheet_id) REFERENCES public.cost_sheets(id) ON DELETE CASCADE;


--
-- Name: cost_sheet_lines cost_sheet_lines_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_sheet_lines
    ADD CONSTRAINT cost_sheet_lines_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: cost_sheet_lines cost_sheet_lines_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_sheet_lines
    ADD CONSTRAINT cost_sheet_lines_sheet_id_fkey FOREIGN KEY (cost_sheet_id) REFERENCES public.cost_sheets(id) ON DELETE CASCADE;


--
-- Name: cost_sheets cost_sheets_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_sheets
    ADD CONSTRAINT cost_sheets_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.masters(id);


--
-- Name: customers customers_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id) ON DELETE CASCADE;


--
-- Name: daily_production daily_production_job_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production
    ADD CONSTRAINT daily_production_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE RESTRICT;


--
-- Name: daily_production daily_production_loom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production
    ADD CONSTRAINT daily_production_loom_id_fkey FOREIGN KEY (loom_id) REFERENCES public.looms(id) ON DELETE RESTRICT;


--
-- Name: designs designs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: designs designs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: feeders feeders_beam_colour_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feeders
    ADD CONSTRAINT feeders_beam_colour_id_fkey FOREIGN KEY (beam_colour_id) REFERENCES public.beam_colours(id) ON DELETE CASCADE;


--
-- Name: cost_sheet_charges fk_cost_sheet_charges_cost_sheet_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_sheet_charges
    ADD CONSTRAINT fk_cost_sheet_charges_cost_sheet_id FOREIGN KEY (cost_sheet_id) REFERENCES public.cost_sheets(id) ON DELETE CASCADE;


--
-- Name: cost_sheet_lines fk_cost_sheet_lines_cost_sheet_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_sheet_lines
    ADD CONSTRAINT fk_cost_sheet_lines_cost_sheet_id FOREIGN KEY (cost_sheet_id) REFERENCES public.cost_sheets(id) ON DELETE CASCADE;


--
-- Name: stock_reservations fk_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT fk_item FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: production_output fk_job_card; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_output
    ADD CONSTRAINT fk_job_card FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE CASCADE;


--
-- Name: quality_hold_records fk_production_inspection; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_hold_records
    ADD CONSTRAINT fk_production_inspection FOREIGN KEY (production_inspection_id) REFERENCES public.production_inspections(id) ON DELETE CASCADE;


--
-- Name: profiles fk_profiles_auth_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT fk_profiles_auth_user FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: approval_workflow fk_transaction; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflow
    ADD CONSTRAINT fk_transaction FOREIGN KEY (transaction_id) REFERENCES public.inventory_transactions(id) ON DELETE CASCADE;


--
-- Name: quality_inspections fk_transaction; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT fk_transaction FOREIGN KEY (transaction_id) REFERENCES public.inventory_transactions(id) ON DELETE CASCADE;


--
-- Name: inventory_balances_cache inventory_balances_cache_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_balances_cache
    ADD CONSTRAINT inventory_balances_cache_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.parties(id) ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.parties(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE RESTRICT;


--
-- Name: job_cards job_cards_loom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_cards
    ADD CONSTRAINT job_cards_loom_id_fkey FOREIGN KEY (loom_id) REFERENCES public.looms(id) ON DELETE SET NULL;


--
-- Name: job_cards job_cards_output_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_cards
    ADD CONSTRAINT job_cards_output_item_id_fkey FOREIGN KEY (output_item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;


--
-- Name: job_cards job_cards_production_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_cards
    ADD CONSTRAINT job_cards_production_order_id_fkey FOREIGN KEY (production_order_id) REFERENCES public.production_orders(id) ON DELETE RESTRICT;


--
-- Name: loom_maintenance loom_maintenance_loom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loom_maintenance
    ADD CONSTRAINT loom_maintenance_loom_id_fkey FOREIGN KEY (loom_id) REFERENCES public.looms(id) ON DELETE CASCADE;


--
-- Name: looms looms_assigned_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.looms
    ADD CONSTRAINT looms_assigned_operator_id_fkey FOREIGN KEY (assigned_operator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: looms looms_current_job_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.looms
    ADD CONSTRAINT looms_current_job_card_id_fkey FOREIGN KEY (current_job_card_id) REFERENCES public.job_cards(id) ON DELETE SET NULL;


--
-- Name: machines machines_process_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_process_id_fkey FOREIGN KEY (process_id) REFERENCES public.processes(id) ON DELETE SET NULL;


--
-- Name: machines machines_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: masters masters_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.masters
    ADD CONSTRAINT masters_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: masters masters_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.masters
    ADD CONSTRAINT masters_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: material_rate_history material_rate_history_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_rate_history
    ADD CONSTRAINT material_rate_history_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: materials materials_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: materials materials_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: party_sub_parties party_sub_parties_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_sub_parties
    ADD CONSTRAINT party_sub_parties_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id) ON DELETE CASCADE;


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;


--
-- Name: process_rate_history process_rate_history_process_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_rate_history
    ADD CONSTRAINT process_rate_history_process_id_fkey FOREIGN KEY (process_id) REFERENCES public.processes(id) ON DELETE CASCADE;


--
-- Name: production_audit_trail production_audit_trail_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_audit_trail
    ADD CONSTRAINT production_audit_trail_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: production_audit_trail production_audit_trail_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_audit_trail
    ADD CONSTRAINT production_audit_trail_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.production_orders(id) ON DELETE CASCADE;


--
-- Name: production_inspections production_inspections_job_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_inspections
    ADD CONSTRAINT production_inspections_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.job_cards(id) ON DELETE CASCADE;


--
-- Name: production_orders production_orders_cost_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_cost_sheet_id_fkey FOREIGN KEY (cost_sheet_id) REFERENCES public.cost_sheets(id) ON DELETE SET NULL;


--
-- Name: production_orders production_orders_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id) ON DELETE RESTRICT;


--
-- Name: production_output production_output_output_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_output
    ADD CONSTRAINT production_output_output_item_id_fkey FOREIGN KEY (output_item_id) REFERENCES public.inventory_items(id) ON DELETE RESTRICT;


--
-- Name: profile_audit_log profile_audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_audit_log
    ADD CONSTRAINT profile_audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profile_audit_log profile_audit_log_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_audit_log
    ADD CONSTRAINT profile_audit_log_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role_definitions(id) ON DELETE CASCADE;


--
-- Name: sales_audit_trail sales_audit_trail_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_audit_trail
    ADD CONSTRAINT sales_audit_trail_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: sales_audit_trail sales_audit_trail_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_audit_trail
    ADD CONSTRAINT sales_audit_trail_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE;


--
-- Name: sales_audit_trail sales_audit_trail_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_audit_trail
    ADD CONSTRAINT sales_audit_trail_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.sales_quotations(id) ON DELETE CASCADE;


--
-- Name: sales_fulfillment_items sales_fulfillment_items_fulfillment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_fulfillment_items
    ADD CONSTRAINT sales_fulfillment_items_fulfillment_id_fkey FOREIGN KEY (fulfillment_id) REFERENCES public.sales_fulfillment(id) ON DELETE CASCADE;


--
-- Name: sales_fulfillment_items sales_fulfillment_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_fulfillment_items
    ADD CONSTRAINT sales_fulfillment_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.sales_order_items(id) ON DELETE CASCADE;


--
-- Name: sales_invoice_items sales_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON DELETE CASCADE;


--
-- Name: sales_invoice_items sales_invoice_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.sales_order_items(id) ON DELETE RESTRICT;


--
-- Name: sales_invoices sales_invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: sales_invoices sales_invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE;


--
-- Name: sales_order_items sales_order_items_cost_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_cost_sheet_id_fkey FOREIGN KEY (cost_sheet_id) REFERENCES public.cost_sheets(id) ON DELETE SET NULL;


--
-- Name: sales_order_items sales_order_items_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.designs(id) ON DELETE SET NULL;


--
-- Name: sales_order_items sales_order_items_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;


--
-- Name: sales_order_items sales_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE;


--
-- Name: sales_order_items sales_order_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- Name: sales_order_items sales_order_items_stock_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_stock_reservation_id_fkey FOREIGN KEY (stock_reservation_id) REFERENCES public.stock_reservations(id) ON DELETE SET NULL;


--
-- Name: sales_orders sales_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: sales_orders sales_orders_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: sales_orders sales_orders_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.sales_quotations(id) ON DELETE SET NULL;


--
-- Name: sales_orders sales_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse_locations(id) ON DELETE RESTRICT;


--
-- Name: sales_payment_allocations sales_payment_allocations_invoice_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payment_allocations
    ADD CONSTRAINT sales_payment_allocations_invoice_customer_id_fkey FOREIGN KEY (invoice_customer_id) REFERENCES public.customers(id);


--
-- Name: sales_payment_allocations sales_payment_allocations_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payment_allocations
    ADD CONSTRAINT sales_payment_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON DELETE RESTRICT;


--
-- Name: sales_payment_allocations sales_payment_allocations_payment_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payment_allocations
    ADD CONSTRAINT sales_payment_allocations_payment_customer_id_fkey FOREIGN KEY (payment_customer_id) REFERENCES public.customers(id);


--
-- Name: sales_payment_allocations sales_payment_allocations_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payment_allocations
    ADD CONSTRAINT sales_payment_allocations_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.sales_payments(id) ON DELETE RESTRICT;


--
-- Name: sales_payments sales_payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payments
    ADD CONSTRAINT sales_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: sales_payments sales_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_payments
    ADD CONSTRAINT sales_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON DELETE CASCADE;


--
-- Name: sales_quotation_items sales_quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.sales_quotations(id) ON DELETE CASCADE;


--
-- Name: sales_quotations sales_quotations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: shipments shipments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE RESTRICT;


--
-- Name: shipments shipments_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse_locations(id) ON DELETE RESTRICT;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles_mapping user_roles_mapping_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles_mapping
    ADD CONSTRAINT user_roles_mapping_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role_definitions(id) ON DELETE CASCADE;


--
-- Name: user_roles_mapping user_roles_mapping_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles_mapping
    ADD CONSTRAINT user_roles_mapping_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: warehouse_locations warehouse_locations_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_locations
    ADD CONSTRAINT warehouse_locations_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.warehouse_zones(id) ON DELETE CASCADE;


--
-- Name: sales_payment_allocations admin_all_allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_allocations ON public.sales_payment_allocations USING (((( SELECT profiles.primary_role_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))::text = 'admin'::text));


--
-- Name: sales_payments admin_all_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_payments ON public.sales_payments USING (((( SELECT profiles.primary_role_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))::text = 'admin'::text));


--
-- Name: sales_payment_allocations admin_full_access_allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_allocations ON public.sales_payment_allocations USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: customers admin_full_access_customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_customers ON public.customers USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: daily_production admin_full_access_daily_production; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_daily_production ON public.daily_production USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: quality_hold_records admin_full_access_holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_holds ON public.quality_hold_records USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: production_inspections admin_full_access_inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_inspections ON public.production_inspections USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: quality_inspections admin_full_access_inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_inspections ON public.quality_inspections USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: job_cards admin_full_access_job_cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_job_cards ON public.job_cards USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: lab_tests admin_full_access_lab_tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_lab_tests ON public.lab_tests USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: loom_maintenance admin_full_access_loom_maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_loom_maintenance ON public.loom_maintenance USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: looms admin_full_access_looms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_looms ON public.looms USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: production_audit_trail admin_full_access_production_audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_production_audit ON public.production_audit_trail USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: production_orders admin_full_access_production_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_production_orders ON public.production_orders USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: production_output admin_full_access_production_output; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_production_output ON public.production_output USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: stock_reservations admin_full_access_reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_reservations ON public.stock_reservations USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: sales_fulfillment admin_full_access_sales_fulfillment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_sales_fulfillment ON public.sales_fulfillment USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: sales_invoices admin_full_access_sales_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_sales_invoices ON public.sales_invoices USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: sales_orders admin_full_access_sales_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_orders_read ON public.sales_orders
  FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'sales:read'));

CREATE POLICY sales_orders_insert ON public.sales_orders
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'sales:create'));

CREATE POLICY sales_orders_update ON public.sales_orders
  FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'sales:update'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'sales:update'));

CREATE POLICY sales_orders_rollback_empty_header ON public.sales_orders
  FOR DELETE TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'sales:create')
    AND sales_orders.status IN ('DRAFT', 'CONFIRMED')
    AND sales_orders.confirmed_at IS NULL
    AND (
      sales_orders.created_by = auth.uid()::text
      OR sales_orders.created_by = (auth.jwt() ->> 'email')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.sales_order_items AS soi
      WHERE soi.order_id = sales_orders.id
    )
  );


--
-- Name: sales_payments admin_full_access_sales_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_sales_payments ON public.sales_payments USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: sales_quotations admin_full_access_sales_quotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_sales_quotations ON public.sales_quotations USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: shade_approvals admin_full_access_shades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_shades ON public.shade_approvals USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: approval_workflow admin_full_access_workflow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access_workflow ON public.approval_workflow USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: user_preferences admin_read_all_preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_read_all_preferences ON public.user_preferences FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: approval_workflow; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_workflow ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_audit_log audit_log_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_admin_write ON public.profile_audit_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::text));


--
-- Name: profile_audit_log audit_log_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_select_admin ON public.profile_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::text));


--
-- Name: profile_audit_log audit_log_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_select_own ON public.profile_audit_log FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.id = profile_audit_log.profile_id)))));


--
-- Name: audit_log audit_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_read ON public.audit_log FOR SELECT TO authenticated USING (true);


--
-- Name: beam_colours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beam_colours ENABLE ROW LEVEL SECURITY;

--
-- Name: beam_colours beam_colours_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY beam_colours_all ON public.beam_colours TO authenticated USING (true) WITH CHECK (true);


--
-- Name: beam_colours beam_colours_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY beam_colours_select ON public.beam_colours FOR SELECT TO authenticated USING (true);


--
-- Name: colors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;

--
-- Name: colors colors_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colors_select ON public.colors FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:read') OR public.is_admin(auth.uid()));
CREATE POLICY colors_insert ON public.colors FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:create') OR public.is_admin(auth.uid()));
CREATE POLICY colors_update ON public.colors FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()))
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()));
CREATE POLICY colors_delete ON public.colors FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:delete') OR public.is_admin(auth.uid()));


--
-- Name: cost_sheet_charges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cost_sheet_charges ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_sheet_charges cost_sheet_charges_admin_all_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_charges_admin_all_access ON public.cost_sheet_charges USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: cost_sheet_charges cost_sheet_charges_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_charges_admin_delete ON public.cost_sheet_charges FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: cost_sheet_charges cost_sheet_charges_manager_operator_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_charges_manager_operator_access ON public.cost_sheet_charges FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: cost_sheet_charges cost_sheet_charges_manager_operator_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_charges_manager_operator_insert ON public.cost_sheet_charges FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: cost_sheet_charges cost_sheet_charges_manager_operator_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_charges_manager_operator_update ON public.cost_sheet_charges FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: cost_sheet_charges cost_sheet_charges_viewer_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_charges_viewer_select ON public.cost_sheet_charges FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying, 'viewer'::character varying])::text[]))))));


--
-- Name: cost_sheet_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cost_sheet_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_sheet_lines cost_sheet_lines_admin_all_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_lines_admin_all_access ON public.cost_sheet_lines USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: cost_sheet_lines cost_sheet_lines_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_lines_admin_delete ON public.cost_sheet_lines FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: cost_sheet_lines cost_sheet_lines_manager_operator_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_lines_manager_operator_access ON public.cost_sheet_lines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: cost_sheet_lines cost_sheet_lines_manager_operator_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_lines_manager_operator_insert ON public.cost_sheet_lines FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: cost_sheet_lines cost_sheet_lines_manager_operator_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_lines_manager_operator_update ON public.cost_sheet_lines FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: cost_sheet_lines cost_sheet_lines_viewer_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheet_lines_viewer_select ON public.cost_sheet_lines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying, 'viewer'::character varying])::text[]))))));


--
-- Name: cost_sheets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cost_sheets ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_sheets cost_sheets_admin_all_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheets_admin_all_access ON public.cost_sheets USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: cost_sheets cost_sheets_admin_delete; Type: POLICY; Schema: public; Owner: -
--

-- Cost Sheet header deletion is not exposed in V1; no client DELETE policy.


--
-- Name: cost_sheets cost_sheets_manager_operator_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheets_manager_operator_insert ON public.cost_sheets FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: cost_sheets cost_sheets_manager_operator_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheets_manager_operator_select ON public.cost_sheets FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: cost_sheets cost_sheets_manager_operator_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheets_manager_operator_update ON public.cost_sheets FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: cost_sheets cost_sheets_viewer_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_sheets_viewer_select ON public.cost_sheets FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying, 'viewer'::character varying])::text[]))))));


--
-- Name: cost_sheets cs_approve; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cs_approve ON public.cost_sheets FOR UPDATE TO authenticated USING ((public.user_has_permission(auth.uid(), 'cost_sheet:approve'::character varying) AND (status = 'draft'::text))) WITH CHECK ((public.user_has_permission(auth.uid(), 'cost_sheet:approve'::character varying) AND (status = ANY (ARRAY['draft'::text, 'approved'::text]))));


--
-- Name: cost_sheets cs_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cs_create ON public.cost_sheets FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'cost_sheet:create'::character varying) AND ((created_by IS NULL) OR (created_by = auth.uid())) AND (status = 'draft'::text)));


--
-- Name: cost_sheets cs_delete; Type: POLICY; Schema: public; Owner: -
--

-- Cost Sheet header deletion is not exposed in V1; no client DELETE policy.


--
-- Name: cost_sheets cs_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cs_read ON public.cost_sheets FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'cost_sheet:read'::character varying));


--
-- Name: cost_sheets cs_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cs_update_admin ON public.cost_sheets FOR UPDATE TO authenticated USING ((public.is_admin(auth.uid()) AND (status = 'approved'::text))) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: cost_sheets cs_update_draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cs_update_draft ON public.cost_sheets FOR UPDATE TO authenticated USING ((public.user_has_permission(auth.uid(), 'cost_sheet:update'::character varying) AND (created_by = auth.uid()) AND (status = 'draft'::text))) WITH CHECK ((public.user_has_permission(auth.uid(), 'cost_sheet:update'::character varying) AND (created_by = auth.uid()) AND (status = 'draft'::text)));


--
-- Name: cost_sheet_charges csc_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY csc_delete ON public.cost_sheet_charges FOR DELETE TO authenticated USING ((public.user_has_permission(auth.uid(), 'cost_sheet:update'::character varying) AND (EXISTS ( SELECT 1
   FROM public.cost_sheets cs
  WHERE ((cs.id = cost_sheet_charges.cost_sheet_id) AND (cs.created_by = auth.uid()) AND (cs.status = 'draft'::text))))));


--
-- Name: cost_sheet_charges csc_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY csc_insert ON public.cost_sheet_charges FOR INSERT TO authenticated WITH CHECK (((public.user_has_permission(auth.uid(), 'cost_sheet:create'::character varying) OR public.user_has_permission(auth.uid(), 'cost_sheet:update'::character varying)) AND (EXISTS ( SELECT 1
   FROM public.cost_sheets cs
  WHERE ((cs.id = cost_sheet_charges.cost_sheet_id) AND (cs.created_by = auth.uid()) AND (cs.status = 'draft'::text))))));


--
-- Name: cost_sheet_charges csc_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY csc_read ON public.cost_sheet_charges FOR SELECT TO authenticated USING ((public.user_has_permission(auth.uid(), 'cost_sheet:read'::character varying) AND (EXISTS ( SELECT 1
   FROM public.cost_sheets cs
  WHERE (cs.id = cost_sheet_charges.cost_sheet_id)))));


--
-- Name: cost_sheet_charges csc_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY csc_update ON public.cost_sheet_charges FOR UPDATE TO authenticated USING ((public.user_has_permission(auth.uid(), 'cost_sheet:update'::character varying) AND (EXISTS ( SELECT 1
   FROM public.cost_sheets cs
  WHERE ((cs.id = cost_sheet_charges.cost_sheet_id) AND (cs.created_by = auth.uid()) AND (cs.status = 'draft'::text)))))) WITH CHECK ((public.user_has_permission(auth.uid(), 'cost_sheet:update'::character varying) AND (EXISTS ( SELECT 1
   FROM public.cost_sheets cs
  WHERE ((cs.id = cost_sheet_charges.cost_sheet_id) AND (cs.created_by = auth.uid()) AND (cs.status = 'draft'::text))))));


--
-- Name: cost_sheet_lines csl_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY csl_delete ON public.cost_sheet_lines FOR DELETE TO authenticated USING ((public.user_has_permission(auth.uid(), 'cost_sheet:update'::character varying) AND (EXISTS ( SELECT 1
   FROM public.cost_sheets cs
  WHERE ((cs.id = cost_sheet_lines.cost_sheet_id) AND (cs.created_by = auth.uid()) AND (cs.status = 'draft'::text))))));


--
-- Name: cost_sheet_lines csl_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY csl_insert ON public.cost_sheet_lines FOR INSERT TO authenticated WITH CHECK (((public.user_has_permission(auth.uid(), 'cost_sheet:create'::character varying) OR public.user_has_permission(auth.uid(), 'cost_sheet:update'::character varying)) AND (EXISTS ( SELECT 1
   FROM public.cost_sheets cs
  WHERE ((cs.id = cost_sheet_lines.cost_sheet_id) AND (cs.created_by = auth.uid()) AND (cs.status = 'draft'::text))))));


--
-- Name: cost_sheet_lines csl_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY csl_read ON public.cost_sheet_lines FOR SELECT TO authenticated USING ((public.user_has_permission(auth.uid(), 'cost_sheet:read'::character varying) AND (EXISTS ( SELECT 1
   FROM public.cost_sheets cs
  WHERE (cs.id = cost_sheet_lines.cost_sheet_id)))));


--
-- Name: cost_sheet_lines csl_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY csl_update ON public.cost_sheet_lines FOR UPDATE TO authenticated USING ((public.user_has_permission(auth.uid(), 'cost_sheet:update'::character varying) AND (EXISTS ( SELECT 1
   FROM public.cost_sheets cs
  WHERE ((cs.id = cost_sheet_lines.cost_sheet_id) AND (cs.created_by = auth.uid()) AND (cs.status = 'draft'::text)))))) WITH CHECK ((public.user_has_permission(auth.uid(), 'cost_sheet:update'::character varying) AND (EXISTS ( SELECT 1
   FROM public.cost_sheets cs
  WHERE ((cs.id = cost_sheet_lines.cost_sheet_id) AND (cs.created_by = auth.uid()) AND (cs.status = 'draft'::text))))));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_production; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_production ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_payment_allocations deny_allocations_default; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_allocations_default ON public.sales_payment_allocations USING (false);


--
-- Name: user_preferences deny_delete_preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_delete_preferences ON public.user_preferences FOR DELETE USING (false);


--
-- Name: user_preferences deny_insert_preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_insert_preferences ON public.user_preferences FOR INSERT WITH CHECK (false);


--
-- Name: sales_payments deny_payments_default; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_payments_default ON public.sales_payments USING (false);


--
-- Name: designs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;

--
-- Name: designs designs_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designs_create ON public.designs FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'design:create'::character varying) AND ((created_by IS NULL) OR (created_by = auth.uid()))));


--
-- Name: designs designs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designs_delete ON public.designs FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'design:delete'::character varying));


--
-- Name: designs designs_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designs_read ON public.designs FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'design:read'::character varying));


--
-- Name: designs designs_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designs_update_own ON public.designs FOR UPDATE TO authenticated USING ((public.user_has_permission(auth.uid(), 'design:update'::character varying) AND ((created_by = auth.uid()) OR public.is_admin(auth.uid())))) WITH CHECK ((public.user_has_permission(auth.uid(), 'design:update'::character varying) AND ((created_by = auth.uid()) OR public.is_admin(auth.uid()))));


--
-- Name: feeders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feeders ENABLE ROW LEVEL SECURITY;

--
-- Name: feeders feeders_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feeders_all ON public.feeders TO authenticated USING (true) WITH CHECK (true);


--
-- Name: feeders feeders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feeders_select ON public.feeders FOR SELECT TO authenticated USING (true);


--
-- Name: inventory_balances_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_balances_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_balances_cache inventory_balances_deny_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_balances_deny_write ON public.inventory_balances_cache USING (false);


--
-- Name: inventory_balances_cache inventory_balances_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_balances_read_all ON public.inventory_balances_cache FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items inventory_items_admin_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_admin_full_access ON public.inventory_items USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.primary_role_id)::text = 'admin'::text)))));


--
-- Name: inventory_items inventory_items_deny_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_deny_delete ON public.inventory_items FOR DELETE USING (false);


--
-- Name: inventory_items inventory_items_deny_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_deny_insert ON public.inventory_items FOR INSERT WITH CHECK (false);


--
-- Name: inventory_items inventory_items_manager_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_manager_read_all ON public.inventory_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: inventory_items inventory_items_manager_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_manager_update_own ON public.inventory_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: inventory_items inventory_items_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_staff_read ON public.inventory_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: inventory_items inventory_items_viewer_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_viewer_read ON public.inventory_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: inventory_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_transactions inventory_transactions_admin_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transactions_admin_full_access ON public.inventory_transactions USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.primary_role_id)::text = 'admin'::text)))));


--
-- Name: inventory_transactions inventory_transactions_deny_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transactions_deny_delete ON public.inventory_transactions FOR DELETE USING (false);


--
-- Name: inventory_transactions inventory_transactions_deny_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transactions_deny_update ON public.inventory_transactions FOR UPDATE USING (false);


--
-- Name: inventory_transactions inventory_transactions_staff_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transactions_staff_create ON public.inventory_transactions FOR INSERT WITH CHECK ((((created_by)::text = (auth.jwt() ->> 'email'::text)) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[])))))));


--
-- Name: inventory_transactions inventory_transactions_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transactions_staff_read ON public.inventory_transactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: inventory_transactions inventory_transactions_viewer_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_transactions_viewer_read ON public.inventory_transactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices invoices_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_delete ON public.invoices FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: invoices invoices_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_insert ON public.invoices FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'sales:create'::character varying) OR public.user_has_permission(auth.uid(), 'sales:update'::character varying)));


--
-- Name: invoices invoices_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_read ON public.invoices FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:read'::character varying));


--
-- Name: invoices invoices_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_update ON public.invoices FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying)) WITH CHECK (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: job_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: shade_approvals lab_manage_shades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_manage_shades ON public.shade_approvals USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: lab_tests lab_manage_tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_manage_tests ON public.lab_tests USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: lab_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouse_locations locations_admin_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locations_admin_full_access ON public.warehouse_locations USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: warehouse_locations locations_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locations_read_all ON public.warehouse_locations FOR SELECT USING ((is_active = true));


--
-- Name: loom_maintenance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loom_maintenance ENABLE ROW LEVEL SECURITY;

--
-- Name: looms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.looms ENABLE ROW LEVEL SECURITY;

--
-- Name: machines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

--
-- Name: machines machines_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY machines_delete ON public.machines FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: machines machines_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY machines_insert ON public.machines FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: machines machines_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY machines_read ON public.machines FOR SELECT TO authenticated USING (true);


--
-- Name: machines machines_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY machines_update ON public.machines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: stock_reservations manager_create_reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_create_reservations ON public.stock_reservations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: quality_hold_records manager_manage_holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_manage_holds ON public.quality_hold_records USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: job_cards manager_manage_job_cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_manage_job_cards ON public.job_cards FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: loom_maintenance manager_manage_loom_maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_manage_loom_maintenance ON public.loom_maintenance FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: looms manager_manage_looms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_manage_looms ON public.looms FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: production_orders manager_manage_production_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_manage_production_orders ON public.production_orders FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: sales_payment_allocations manager_read_write_allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_read_write_allocations ON public.sales_payment_allocations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: sales_payments manager_read_write_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_read_write_payments ON public.sales_payments USING (((( SELECT profiles.primary_role_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])));


--
-- Name: sales_invoices manager_read_write_sales_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_read_write_sales_invoices ON public.sales_invoices FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: sales_payments manager_read_write_sales_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_read_write_sales_payments ON public.sales_payments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: production_inspections manager_update_inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_update_inspections ON public.production_inspections FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: production_output manager_update_output; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_update_output ON public.production_output FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: stock_reservations manager_update_reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_update_reservations ON public.stock_reservations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: customers manager_view_customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_view_customers ON public.customers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: daily_production manager_view_daily_production; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_view_daily_production ON public.daily_production FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: quality_inspections manager_view_inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_view_inspections ON public.quality_inspections FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'role-qa'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: production_audit_trail manager_view_production_audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_view_production_audit ON public.production_audit_trail FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: stock_reservations manager_view_reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_view_reservations ON public.stock_reservations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: sales_invoices manager_view_sales_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_view_sales_invoices ON public.sales_invoices FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: sales_orders manager_view_sales_orders; Type: POLICY; Schema: public; Owner: -
--




--
-- Name: masters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.masters ENABLE ROW LEVEL SECURITY;

--
-- Name: masters masters_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY masters_create ON public.masters FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'masters.generic:create'::character varying) AND ((created_by IS NULL) OR (created_by = auth.uid()))));


--
-- Name: masters masters_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY masters_delete ON public.masters FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'masters.generic:delete'::character varying));


--
-- Name: masters masters_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY masters_read ON public.masters FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'masters.generic:read'::character varying));


--
-- Name: masters masters_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY masters_update_own ON public.masters FOR UPDATE TO authenticated USING ((public.user_has_permission(auth.uid(), 'masters.generic:update'::character varying) AND ((created_by = auth.uid()) OR public.is_admin(auth.uid())))) WITH CHECK ((public.user_has_permission(auth.uid(), 'masters.generic:update'::character varying) AND ((created_by = auth.uid()) OR public.is_admin(auth.uid()))));


--
-- Name: material_rate_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_rate_history ENABLE ROW LEVEL SECURITY;

--
-- Name: materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

--
-- Name: materials materials_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_create ON public.materials FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'masters.yarn:create'::character varying) AND ((created_by IS NULL) OR (created_by = auth.uid()))));


--
-- Name: materials materials_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_delete ON public.materials FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'masters.yarn:delete'::character varying));


--
-- Name: materials materials_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_read ON public.materials FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'masters.yarn:read'::character varying));


--
-- Name: materials materials_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_update_own ON public.materials FOR UPDATE TO authenticated USING ((public.user_has_permission(auth.uid(), 'masters.yarn:update'::character varying) AND ((created_by = auth.uid()) OR public.is_admin(auth.uid())))) WITH CHECK ((public.user_has_permission(auth.uid(), 'masters.yarn:update'::character varying) AND ((created_by = auth.uid()) OR public.is_admin(auth.uid()))));


--
-- Name: material_rate_history mrh_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrh_insert ON public.material_rate_history FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: material_rate_history mrh_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrh_read ON public.material_rate_history FOR SELECT TO authenticated USING (true);


--
-- Name: daily_production operator_create_daily_production; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_create_daily_production ON public.daily_production FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: sales_fulfillment operator_create_fulfillment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_create_fulfillment ON public.sales_fulfillment FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: production_inspections operator_create_own_inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_create_own_inspections ON public.production_inspections FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: production_output operator_create_own_output; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_create_own_output ON public.production_output FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: stock_reservations operator_create_reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_create_reservations ON public.stock_reservations FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))) AND ((reserved_by)::text = ( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))));


--
-- Name: sales_payment_allocations operator_read_allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_read_allocations ON public.sales_payment_allocations FOR SELECT USING (((( SELECT profiles.primary_role_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[])));


--
-- Name: production_inspections operator_read_inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_read_inspections ON public.production_inspections FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'manager'::character varying, 'viewer'::character varying])::text[]))))));


--
-- Name: production_output operator_read_output; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_read_output ON public.production_output FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'manager'::character varying, 'viewer'::character varying])::text[]))))));


--
-- Name: sales_payments operator_read_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_read_payments ON public.sales_payments FOR SELECT USING (((( SELECT profiles.primary_role_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[])));


--
-- Name: sales_invoices operator_read_sales_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_read_sales_invoices ON public.sales_invoices FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: sales_payments operator_read_sales_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_read_sales_payments ON public.sales_payments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: sales_payments operator_record_payment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_record_payment ON public.sales_payments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: daily_production operator_view_daily_production; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_view_daily_production ON public.daily_production FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: sales_fulfillment operator_view_fulfillment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_view_fulfillment ON public.sales_fulfillment FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: job_cards operator_view_job_cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_view_job_cards ON public.job_cards FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: loom_maintenance operator_view_loom_maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_view_loom_maintenance ON public.loom_maintenance FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: looms operator_view_looms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_view_looms ON public.looms FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: production_orders operator_view_production_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_view_production_orders ON public.production_orders FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: stock_reservations operator_view_reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operator_view_reservations ON public.stock_reservations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'operator'::character varying])::text[]))))));


--
-- Name: parties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

--
-- Name: parties parties_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parties_create ON public.parties FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'masters.party:create'::character varying) AND ((created_by IS NULL) OR (created_by = auth.uid()))));


--
-- Name: parties parties_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parties_delete ON public.parties FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'masters.party:delete'::character varying));


--
-- Name: parties parties_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parties_read ON public.parties FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'masters.party:read'::character varying));


--
-- Name: parties parties_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parties_update_own ON public.parties FOR UPDATE TO authenticated USING ((public.user_has_permission(auth.uid(), 'masters.party:update'::character varying) AND ((created_by = auth.uid()) OR public.is_admin(auth.uid())))) WITH CHECK ((public.user_has_permission(auth.uid(), 'masters.party:update'::character varying) AND ((created_by = auth.uid()) OR public.is_admin(auth.uid()))));


--
-- Name: party_sub_parties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party_sub_parties ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payments payments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_delete ON public.payments FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: payments payments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'sales:create'::character varying) OR public.user_has_permission(auth.uid(), 'sales:update'::character varying)));


--
-- Name: payments payments_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:read'::character varying));


--
-- Name: payments payments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_update ON public.payments FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying)) WITH CHECK (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions permissions_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_select_all ON public.permissions FOR SELECT TO authenticated USING (true);


--
-- Name: process_rate_history prh_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prh_insert ON public.process_rate_history FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: process_rate_history prh_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prh_read ON public.process_rate_history FOR SELECT TO authenticated USING (true);


--
-- Name: process_rate_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.process_rate_history ENABLE ROW LEVEL SECURITY;

--
-- Name: processes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

--
-- Name: processes processes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processes_select ON public.processes FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:read') OR public.is_admin(auth.uid()));
CREATE POLICY processes_insert ON public.processes FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:create') OR public.is_admin(auth.uid()));
CREATE POLICY processes_update ON public.processes FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()));
CREATE POLICY processes_delete ON public.processes FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:delete') OR public.is_admin(auth.uid()));


--
-- Name: production_audit_trail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_audit_trail ENABLE ROW LEVEL SECURITY;

--
-- Name: production_inspections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_inspections ENABLE ROW LEVEL SECURITY;

--
-- Name: production_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: production_output; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_output ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_delete_managed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_delete_managed ON public.profiles FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'user_management:write'::character varying));


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.user_has_permission(auth.uid(), 'user_management:read'::character varying)));


--
-- Name: profiles profiles_update_managed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_managed ON public.profiles FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'user_management:write'::character varying)) WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'::character varying));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: quality_inspections qa_manage_inspections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qa_manage_inspections ON public.quality_inspections USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'role-qa'::character varying])::text[]))))));


--
-- Name: quality_hold_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_hold_records ENABLE ROW LEVEL SECURITY;

--
-- Name: quality_inspections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;

--
-- Name: role_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: role_definitions role_defs_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_defs_manage ON public.role_definitions FOR INSERT TO authenticated WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'::character varying));


--
-- Name: role_definitions role_defs_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_defs_select_all ON public.role_definitions FOR SELECT TO authenticated USING (true);


--
-- Name: role_definitions role_defs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_defs_update ON public.role_definitions FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'user_management:write'::character varying)) WITH CHECK ((public.user_has_permission(auth.uid(), 'user_management:write'::character varying) AND (NOT (((role_code)::text = 'admin'::text) AND (is_active IS FALSE)))));


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions role_perms_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_perms_delete ON public.role_permissions FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'user_management:write'::character varying));


--
-- Name: role_permissions role_perms_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_perms_insert ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'::character varying));


--
-- Name: role_permissions role_perms_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_perms_select_all ON public.role_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: role_permissions role_perms_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_perms_update ON public.role_permissions FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'user_management:write'::character varying)) WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'::character varying));


--
-- Name: sales_audit_trail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_audit_trail ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_audit_trail sales_audit_trail_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_audit_trail_insert ON public.sales_audit_trail FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'sales:create'::character varying) OR public.user_has_permission(auth.uid(), 'sales:update'::character varying)));


--
-- Name: sales_audit_trail sales_audit_trail_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_audit_trail_read ON public.sales_audit_trail FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:read'::character varying));


--
-- Name: sales_fulfillment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_fulfillment ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_fulfillment_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_fulfillment_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_fulfillment_items sales_fulfillment_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_fulfillment_items_delete ON public.sales_fulfillment_items FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: sales_fulfillment_items sales_fulfillment_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_fulfillment_items_insert ON public.sales_fulfillment_items FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'sales:create'::character varying) OR public.user_has_permission(auth.uid(), 'sales:update'::character varying)));


--
-- Name: sales_fulfillment_items sales_fulfillment_items_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_fulfillment_items_read ON public.sales_fulfillment_items FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:read'::character varying));


--
-- Name: sales_fulfillment_items sales_fulfillment_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_fulfillment_items_update ON public.sales_fulfillment_items FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying)) WITH CHECK (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: sales_invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_invoice_items sales_invoice_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_invoice_items_delete ON public.sales_invoice_items FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: sales_invoice_items sales_invoice_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_invoice_items_insert ON public.sales_invoice_items FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'sales:create'::character varying) OR public.user_has_permission(auth.uid(), 'sales:update'::character varying)));


--
-- Name: sales_invoice_items sales_invoice_items_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_invoice_items_read ON public.sales_invoice_items FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:read'::character varying));


--
-- Name: sales_invoice_items sales_invoice_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_invoice_items_update ON public.sales_invoice_items FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying)) WITH CHECK (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: sales_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_order_items sales_order_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_order_items_delete ON public.sales_order_items FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: sales_order_items sales_order_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_order_items_insert ON public.sales_order_items FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'sales:create'::character varying) OR public.user_has_permission(auth.uid(), 'sales:update'::character varying)));


--
-- Name: sales_order_items sales_order_items_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_order_items_read ON public.sales_order_items FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:read'::character varying));


--
-- Name: sales_order_items sales_order_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_order_items_update ON public.sales_order_items FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying)) WITH CHECK (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: sales_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_payment_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_payment_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_quotation_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_quotation_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_quotation_items sales_quotation_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_quotation_items_delete ON public.sales_quotation_items FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: sales_quotation_items sales_quotation_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_quotation_items_insert ON public.sales_quotation_items FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'sales:create'::character varying) OR public.user_has_permission(auth.uid(), 'sales:update'::character varying)));


--
-- Name: sales_quotation_items sales_quotation_items_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_quotation_items_read ON public.sales_quotation_items FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:read'::character varying));


--
-- Name: sales_quotation_items sales_quotation_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_quotation_items_update ON public.sales_quotation_items FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying)) WITH CHECK (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: sales_quotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_quotations ENABLE ROW LEVEL SECURITY;

--
-- Name: shade_approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shade_approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: shipments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

--
-- Name: shipments shipments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipments_delete ON public.shipments FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: shipments shipments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipments_insert ON public.shipments FOR INSERT TO authenticated WITH CHECK ((public.user_has_permission(auth.uid(), 'sales:create'::character varying) OR public.user_has_permission(auth.uid(), 'sales:update'::character varying)));


--
-- Name: shipments shipments_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipments_read ON public.shipments FOR SELECT TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:read'::character varying));


--
-- Name: shipments shipments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipments_update ON public.shipments FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'sales:update'::character varying)) WITH CHECK (public.user_has_permission(auth.uid(), 'sales:update'::character varying));


--
-- Name: quality_hold_records staff_read_holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_read_holds ON public.quality_hold_records FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'manager'::character varying, 'viewer'::character varying])::text[]))))));


--
-- Name: approval_workflow staff_update_workflow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_update_workflow ON public.approval_workflow FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'role-qa'::character varying])::text[]))))));


--
-- Name: approval_workflow staff_view_workflow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_view_workflow ON public.approval_workflow FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'role-qa'::character varying])::text[]))))));


--
-- Name: stock_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: party_sub_parties sub_parties_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_parties_delete ON public.party_sub_parties FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: party_sub_parties sub_parties_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_parties_insert ON public.party_sub_parties FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: party_sub_parties sub_parties_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_parties_read ON public.party_sub_parties FOR SELECT TO authenticated USING (true);


--
-- Name: party_sub_parties sub_parties_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_parties_update ON public.party_sub_parties FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: supported_languages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supported_languages ENABLE ROW LEVEL SECURITY;

--
-- Name: supported_languages supported_languages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY supported_languages_read ON public.supported_languages FOR SELECT TO authenticated USING (true);


--
-- Name: units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

--
-- Name: units units_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_select ON public.units FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:read') OR public.is_admin(auth.uid()));
CREATE POLICY units_insert ON public.units FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:create') OR public.is_admin(auth.uid()));
CREATE POLICY units_update ON public.units FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()));
CREATE POLICY units_delete ON public.units FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:delete') OR public.is_admin(auth.uid()));


--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles_mapping user_roles_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_delete ON public.user_roles_mapping FOR DELETE TO authenticated USING (public.user_has_permission(auth.uid(), 'user_management:write'::character varying));


--
-- Name: user_roles_mapping user_roles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_insert ON public.user_roles_mapping FOR INSERT TO authenticated WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'::character varying));


--
-- Name: user_roles_mapping; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles_mapping ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles_mapping user_roles_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select_all ON public.user_roles_mapping FOR SELECT TO authenticated USING (true);


--
-- Name: user_roles_mapping user_roles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_update ON public.user_roles_mapping FOR UPDATE TO authenticated USING (public.user_has_permission(auth.uid(), 'user_management:write'::character varying)) WITH CHECK (public.user_has_permission(auth.uid(), 'user_management:write'::character varying));


--
-- Name: user_preferences users_read_own_preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_read_own_preferences ON public.user_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_preferences users_update_own_preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_own_preferences ON public.user_preferences FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: sales_payment_allocations viewer_read_allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY viewer_read_allocations ON public.sales_payment_allocations FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: shade_approvals viewer_read_shades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY viewer_read_shades ON public.shade_approvals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'manager'::character varying, 'viewer'::character varying])::text[]))))));


--
-- Name: lab_tests viewer_read_tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY viewer_read_tests ON public.lab_tests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = ANY ((ARRAY['admin'::character varying, 'operator'::character varying, 'manager'::character varying, 'viewer'::character varying])::text[]))))));


--
-- Name: warehouse_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouse_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warehouse_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouses warehouses_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY warehouses_select ON public.warehouses FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:read') OR public.user_has_permission(auth.uid(), 'inventory:read') OR public.is_admin(auth.uid()));
CREATE POLICY warehouses_insert ON public.warehouses FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:create') OR public.is_admin(auth.uid()));
CREATE POLICY warehouses_update ON public.warehouses FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()))
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()));
CREATE POLICY warehouses_delete ON public.warehouses FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:delete') OR public.is_admin(auth.uid()));


--
-- Name: warehouse_zones zones_admin_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zones_admin_full_access ON public.warehouse_zones USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_role_id)::text = 'admin'::text)))));


--
-- Name: warehouse_zones zones_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zones_read_all ON public.warehouse_zones FOR SELECT USING ((is_active = true));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION allocate_inventory_for_sales(p_order_item_id uuid, p_design_no character varying, p_qty_required numeric, p_warehouse_id uuid); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.allocate_inventory_for_sales(p_order_item_id uuid, p_design_no character varying, p_qty_required numeric, p_warehouse_id uuid) TO service_role;


--
-- Name: FUNCTION allocate_payment_atomic(p_payment_id uuid, p_invoice_id uuid, p_allocated_amount numeric); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.allocate_payment_atomic(p_payment_id uuid, p_invoice_id uuid, p_allocated_amount numeric) TO service_role;


--
-- Name: FUNCTION audit_profile_change(); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.audit_profile_change() TO service_role;


--
-- Name: FUNCTION cancel_sales_order_atomic(p_order_id uuid); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.cancel_sales_order_atomic(p_order_id uuid) TO service_role;


--
-- Name: FUNCTION complete_job_output(p_job_card_id uuid, p_output_qty numeric, p_output_grade character varying, p_completed_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.complete_job_output(p_job_card_id uuid, p_output_qty numeric, p_output_grade character varying, p_completed_by character varying) TO service_role;


--
-- Name: FUNCTION complete_order(p_order_id uuid, p_completion_notes text); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.complete_order(p_order_id uuid, p_completion_notes text) TO service_role;


--
-- Name: FUNCTION complete_quality_inspection(p_inspection_id uuid, p_system_grade character varying, p_override_grade character varying, p_decision_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.complete_quality_inspection(p_inspection_id uuid, p_system_grade character varying, p_override_grade character varying, p_decision_by character varying) TO service_role;


--
-- Name: FUNCTION confirm_sales_order(p_order_id uuid, p_approved_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.confirm_sales_order(p_order_id uuid, p_approved_by character varying) TO service_role;


--
-- Name: FUNCTION confirm_sales_order_with_reservation(p_order_id uuid, p_approved_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.confirm_sales_order_with_reservation(p_order_id uuid, p_approved_by character varying) TO service_role;


--
-- Name: FUNCTION confirm_shipment_delivery(p_shipment_id uuid, p_delivered_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.confirm_shipment_delivery(p_shipment_id uuid, p_delivered_by character varying) TO service_role;


--
-- Name: FUNCTION confirm_shipment_dispatch(p_shipment_id uuid, p_carrier_name character varying, p_tracking_number character varying, p_dispatched_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.confirm_shipment_dispatch(p_shipment_id uuid, p_carrier_name character varying, p_tracking_number character varying, p_dispatched_by character varying) TO service_role;


--
-- Name: FUNCTION confirm_stock_reservation(p_order_id uuid); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.confirm_stock_reservation(p_order_id uuid) TO service_role;


--
-- Name: FUNCTION confirm_stock_reservation(p_order_id uuid, p_confirmed_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.confirm_stock_reservation(p_order_id uuid, p_confirmed_by character varying) TO service_role;


--
-- Name: FUNCTION confirm_stock_reservation_atomic(p_order_id uuid); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.confirm_stock_reservation_atomic(p_order_id uuid) TO service_role;


--
-- Name: FUNCTION confirm_stock_reservation_dispatch(p_order_id uuid, p_confirmed_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.confirm_stock_reservation_dispatch(p_order_id uuid, p_confirmed_by character varying) TO service_role;


--
-- Name: FUNCTION create_fulfillment_from_order(p_order_id uuid, p_warehouse_id uuid); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.create_fulfillment_from_order(p_order_id uuid, p_warehouse_id uuid) TO service_role;


--
-- Name: FUNCTION create_invoice_from_order(p_order_id uuid, p_invoice_date date, p_due_date date, p_payment_terms_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_invoice_from_order(p_order_id uuid, p_invoice_date date, p_due_date date, p_payment_terms_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_invoice_from_order(p_order_id uuid, p_invoice_date date, p_due_date date, p_payment_terms_days integer) TO service_role;


--
-- Name: FUNCTION create_invoice_from_shipment_atomic(p_order_id uuid, p_order_item_id uuid, p_invoice_qty numeric, p_invoice_date date, p_due_date date, p_payment_terms_days integer); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.create_invoice_from_shipment_atomic(p_order_id uuid, p_order_item_id uuid, p_invoice_qty numeric, p_invoice_date date, p_due_date date, p_payment_terms_days integer) TO service_role;


--
-- Name: FUNCTION create_shipment(p_order_id uuid, p_warehouse_id uuid, p_shipping_address text, p_carrier_name character varying, p_tracking_number character varying, p_prepared_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.create_shipment(p_order_id uuid, p_warehouse_id uuid, p_shipping_address text, p_carrier_name character varying, p_tracking_number character varying, p_prepared_by character varying) TO service_role;


--
-- Name: FUNCTION create_shipment_atomic(p_order_id uuid, p_order_item_id uuid, p_dispatch_qty numeric, p_warehouse_id uuid, p_shipping_address text, p_carrier_name character varying, p_tracking_number character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.create_shipment_atomic(p_order_id uuid, p_order_item_id uuid, p_dispatch_qty numeric, p_warehouse_id uuid, p_shipping_address text, p_carrier_name character varying, p_tracking_number character varying) TO service_role;


--
-- Name: FUNCTION deliver_fulfillment(p_fulfillment_id uuid, p_delivery_remarks text); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.deliver_fulfillment(p_fulfillment_id uuid, p_delivery_remarks text) TO service_role;


--
-- Name: FUNCTION generate_invoice(p_order_id uuid, p_invoice_date date, p_due_date date, p_generated_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.generate_invoice(p_order_id uuid, p_invoice_date date, p_due_date date, p_generated_by character varying) TO service_role;


--
-- Name: FUNCTION get_inventory_by_quality_grade(p_warehouse_id uuid, p_item_type character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.get_inventory_by_quality_grade(p_warehouse_id uuid, p_item_type character varying) TO service_role;


--
-- Name: FUNCTION get_invoice_summary(p_customer_id uuid); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.get_invoice_summary(p_customer_id uuid) TO service_role;


--
-- Name: FUNCTION get_payment_aging_report(p_customer_id uuid); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.get_payment_aging_report(p_customer_id uuid) TO service_role;


--
-- Name: FUNCTION get_saleable_inventory(p_warehouse_id uuid, p_item_type character varying, p_grade_filter character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.get_saleable_inventory(p_warehouse_id uuid, p_item_type character varying, p_grade_filter character varying) TO service_role;


--
-- Name: FUNCTION get_user_effective_permissions(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_effective_permissions(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_effective_permissions(_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_primary_role_id(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_primary_role_id(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_primary_role_id(_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_role(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_role(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_role(_user_id uuid) TO service_role;


--
-- Name: FUNCTION guard_profile_privileged_columns(); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.guard_profile_privileged_columns() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_new_user_preferences(); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.handle_new_user_preferences() TO service_role;


--
-- Name: FUNCTION handle_new_user_rbac(); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.handle_new_user_rbac() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role text); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role text) TO service_role;


--
-- Name: FUNCTION is_admin(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin(_user_id uuid) TO service_role;


--
-- Name: FUNCTION issue_material_to_production(p_job_card_id uuid, p_inventory_item_id uuid, p_qty_to_issue numeric, p_issued_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.issue_material_to_production(p_job_card_id uuid, p_inventory_item_id uuid, p_qty_to_issue numeric, p_issued_by character varying) TO service_role;


--
-- Name: FUNCTION rbac_user_role_ids(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rbac_user_role_ids(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rbac_user_role_ids(_user_id uuid) TO service_role;


--
-- Name: FUNCTION record_payment(p_invoice_id uuid, p_amount_paid numeric, p_payment_method character varying, p_reference_number character varying, p_remarks text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_payment(p_invoice_id uuid, p_amount_paid numeric, p_payment_method character varying, p_reference_number character varying, p_remarks text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_payment(p_invoice_id uuid, p_amount_paid numeric, p_payment_method character varying, p_reference_number character varying, p_remarks text) TO service_role;


--
-- Name: FUNCTION record_payment(p_invoice_id uuid, p_amount_paid numeric, p_payment_method character varying, p_reference_number character varying, p_payment_date date, p_recorded_by character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.record_payment(p_invoice_id uuid, p_amount_paid numeric, p_payment_method character varying, p_reference_number character varying, p_payment_date date, p_recorded_by character varying) TO service_role;


--
-- Name: FUNCTION record_payment_atomic(p_customer_id uuid, p_amount numeric, p_payment_method character varying, p_reference_number character varying, p_payment_date date, p_remarks text); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.record_payment_atomic(p_customer_id uuid, p_amount numeric, p_payment_method character varying, p_reference_number character varying, p_payment_date date, p_remarks text) TO service_role;


--
-- Name: FUNCTION release_sales_stock_atomic(p_order_item_id uuid); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.release_sales_stock_atomic(p_order_item_id uuid) TO service_role;


--
-- Name: FUNCTION reserve_sales_stock_atomic(p_order_id uuid, p_order_item_id uuid, p_requested_qty numeric); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.reserve_sales_stock_atomic(p_order_id uuid, p_order_item_id uuid, p_requested_qty numeric) TO service_role;


--
-- Name: FUNCTION reset_payment_sequence_if_needed(); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.reset_payment_sequence_if_needed() TO service_role;


--
-- Name: FUNCTION ship_fulfillment(p_fulfillment_id uuid, p_tracking_number character varying, p_carrier character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.ship_fulfillment(p_fulfillment_id uuid, p_tracking_number character varying, p_carrier character varying) TO service_role;


--
-- Name: FUNCTION update_fulfillment_item(p_fulfillment_item_id uuid, p_qty_picked numeric, p_qty_packed numeric, p_qty_shipped numeric, p_bin_location character varying); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.update_fulfillment_item(p_fulfillment_item_id uuid, p_qty_picked numeric, p_qty_packed numeric, p_qty_shipped numeric, p_bin_location character varying) TO service_role;


--
-- Name: FUNCTION update_inventory_balance(); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.update_inventory_balance() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION update_user_preferences_timestamp(); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.update_user_preferences_timestamp() TO service_role;


--
-- Name: FUNCTION user_has_permission(_user_id uuid, _permission_code character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.user_has_permission(_user_id uuid, _permission_code character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION public.user_has_permission(_user_id uuid, _permission_code character varying) TO service_role;


--
-- Name: FUNCTION user_has_permission_v2(_user_id uuid, _permission_code character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.user_has_permission_v2(_user_id uuid, _permission_code character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION public.user_has_permission_v2(_user_id uuid, _permission_code character varying) TO service_role;


--
-- Name: FUNCTION user_owns_record(_user_id uuid, _record_owner_id uuid); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.user_owns_record(_user_id uuid, _record_owner_id uuid) TO service_role;


--
-- Name: FUNCTION validate_sales_order_item_update(); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.validate_sales_order_item_update() TO service_role;


--
-- Name: FUNCTION validate_sales_order_update(); Type: ACL; Schema: public; Owner: -
--


GRANT ALL ON FUNCTION public.validate_sales_order_update() TO service_role;


--
-- Name: TABLE approval_workflow; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.approval_workflow TO authenticated;
GRANT ALL ON TABLE public.approval_workflow TO service_role;


--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_log TO authenticated;
GRANT ALL ON TABLE public.audit_log TO service_role;


--
-- Name: TABLE beam_colours; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.beam_colours TO authenticated;
GRANT ALL ON TABLE public.beam_colours TO service_role;


--
-- Name: TABLE colors; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.colors TO authenticated;
GRANT ALL ON TABLE public.colors TO service_role;


--
-- Name: TABLE cost_sheet_charges; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cost_sheet_charges TO authenticated;
GRANT ALL ON TABLE public.cost_sheet_charges TO service_role;


--
-- Name: TABLE cost_sheet_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cost_sheet_lines TO authenticated;
GRANT ALL ON TABLE public.cost_sheet_lines TO service_role;


--
-- Name: TABLE cost_sheets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cost_sheets TO authenticated;
GRANT ALL ON TABLE public.cost_sheets TO service_role;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- Name: TABLE daily_production; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_production TO authenticated;
GRANT ALL ON TABLE public.daily_production TO service_role;


--
-- Name: TABLE designs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.designs TO authenticated;
GRANT ALL ON TABLE public.designs TO service_role;


--
-- Name: TABLE feeders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feeders TO authenticated;
GRANT ALL ON TABLE public.feeders TO service_role;


--
-- Name: TABLE inventory_balances_cache; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_balances_cache TO authenticated;
GRANT ALL ON TABLE public.inventory_balances_cache TO service_role;


--
-- Name: TABLE inventory_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_items TO authenticated;
GRANT ALL ON TABLE public.inventory_items TO service_role;


--
-- Name: TABLE inventory_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_transactions TO authenticated;
GRANT ALL ON TABLE public.inventory_transactions TO service_role;


--
-- Name: SEQUENCE invoice_number_seq; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE, SELECT ON SEQUENCE public.invoice_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.invoice_number_seq TO service_role;


--
-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoices TO service_role;


--
-- Name: TABLE job_cards; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_cards TO authenticated;
GRANT ALL ON TABLE public.job_cards TO service_role;


--
-- Name: TABLE lab_tests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_tests TO authenticated;
GRANT ALL ON TABLE public.lab_tests TO service_role;


--
-- Name: TABLE loom_maintenance; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loom_maintenance TO authenticated;
GRANT ALL ON TABLE public.loom_maintenance TO service_role;


--
-- Name: TABLE looms; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.looms TO authenticated;
GRANT ALL ON TABLE public.looms TO service_role;


--
-- Name: TABLE machines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.machines TO authenticated;
GRANT ALL ON TABLE public.machines TO service_role;


--
-- Name: TABLE masters; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.masters TO authenticated;
GRANT ALL ON TABLE public.masters TO service_role;


--
-- Name: TABLE material_rate_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.material_rate_history TO authenticated;
GRANT ALL ON TABLE public.material_rate_history TO service_role;


--
-- Name: TABLE materials; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.materials TO authenticated;
GRANT ALL ON TABLE public.materials TO service_role;


--
-- Name: TABLE parties; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.parties TO authenticated;
GRANT ALL ON TABLE public.parties TO service_role;


--
-- Name: TABLE party_sub_parties; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.party_sub_parties TO authenticated;
GRANT ALL ON TABLE public.party_sub_parties TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.permissions TO authenticated;
GRANT ALL ON TABLE public.permissions TO service_role;


--
-- Name: TABLE process_rate_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.process_rate_history TO authenticated;
GRANT ALL ON TABLE public.process_rate_history TO service_role;


--
-- Name: TABLE processes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.processes TO authenticated;
GRANT ALL ON TABLE public.processes TO service_role;


--
-- Name: TABLE production_audit_trail; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.production_audit_trail TO authenticated;
GRANT ALL ON TABLE public.production_audit_trail TO service_role;


--
-- Name: TABLE production_inspections; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.production_inspections TO authenticated;
GRANT ALL ON TABLE public.production_inspections TO service_role;


--
-- Name: TABLE production_orders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.production_orders TO authenticated;
GRANT ALL ON TABLE public.production_orders TO service_role;


--
-- Name: TABLE production_output; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.production_output TO authenticated;
GRANT ALL ON TABLE public.production_output TO service_role;


--
-- Name: TABLE profile_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_audit_log TO authenticated;
GRANT ALL ON TABLE public.profile_audit_log TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE quality_hold_records; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quality_hold_records TO authenticated;
GRANT ALL ON TABLE public.quality_hold_records TO service_role;


--
-- Name: TABLE quality_inspections; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quality_inspections TO authenticated;
GRANT ALL ON TABLE public.quality_inspections TO service_role;


--
-- Name: TABLE role_definitions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.role_definitions TO authenticated;
GRANT ALL ON TABLE public.role_definitions TO service_role;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.role_permissions TO authenticated;
GRANT ALL ON TABLE public.role_permissions TO service_role;


--
-- Name: TABLE sales_audit_trail; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_audit_trail TO authenticated;
GRANT ALL ON TABLE public.sales_audit_trail TO service_role;


--
-- Name: TABLE sales_fulfillment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_fulfillment TO authenticated;
GRANT ALL ON TABLE public.sales_fulfillment TO service_role;


--
-- Name: TABLE sales_fulfillment_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_fulfillment_items TO authenticated;
GRANT ALL ON TABLE public.sales_fulfillment_items TO service_role;


--
-- Name: TABLE sales_invoice_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_invoice_items TO authenticated;
GRANT ALL ON TABLE public.sales_invoice_items TO service_role;


--
-- Name: TABLE sales_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_invoices TO authenticated;
GRANT ALL ON TABLE public.sales_invoices TO service_role;


--
-- Name: TABLE sales_order_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_order_items TO authenticated;
GRANT ALL ON TABLE public.sales_order_items TO service_role;


--
-- Name: TABLE sales_orders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_orders TO authenticated;
GRANT ALL ON TABLE public.sales_orders TO service_role;


--
-- Name: TABLE sales_payment_allocations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_payment_allocations TO authenticated;
GRANT ALL ON TABLE public.sales_payment_allocations TO service_role;


--
-- Name: TABLE sales_payments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_payments TO authenticated;
GRANT ALL ON TABLE public.sales_payments TO service_role;


--
-- Name: TABLE sales_quotation_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_quotation_items TO authenticated;
GRANT ALL ON TABLE public.sales_quotation_items TO service_role;


--
-- Name: TABLE sales_quotations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_quotations TO authenticated;
GRANT ALL ON TABLE public.sales_quotations TO service_role;


--
-- Name: SEQUENCE seq_payment_number_daily; Type: ACL; Schema: public; Owner: -
--

GRANT USAGE, SELECT ON SEQUENCE public.seq_payment_number_daily TO authenticated;
GRANT ALL ON SEQUENCE public.seq_payment_number_daily TO service_role;


--
-- Name: TABLE shade_approvals; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shade_approvals TO authenticated;
GRANT ALL ON TABLE public.shade_approvals TO service_role;


--
-- Name: TABLE shipments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shipments TO authenticated;
GRANT ALL ON TABLE public.shipments TO service_role;


--
-- Name: TABLE stock_reservations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stock_reservations TO authenticated;
GRANT ALL ON TABLE public.stock_reservations TO service_role;


--
-- Name: TABLE supported_languages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.supported_languages TO authenticated;
GRANT ALL ON TABLE public.supported_languages TO service_role;


--
-- Name: TABLE units; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.units TO authenticated;
GRANT ALL ON TABLE public.units TO service_role;


--
-- Name: TABLE user_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_preferences TO authenticated;
GRANT ALL ON TABLE public.user_preferences TO service_role;


--
-- Name: TABLE user_roles_mapping; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles_mapping TO authenticated;
GRANT ALL ON TABLE public.user_roles_mapping TO service_role;


--
-- Name: TABLE vw_inventory_available_qty; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vw_inventory_available_qty TO authenticated;
GRANT ALL ON TABLE public.vw_inventory_available_qty TO service_role;


--
-- Name: TABLE warehouse_locations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.warehouse_locations TO authenticated;
GRANT ALL ON TABLE public.warehouse_locations TO service_role;


--
-- Name: TABLE warehouse_zones; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.warehouse_zones TO authenticated;
GRANT ALL ON TABLE public.warehouse_zones TO service_role;


--
-- Name: TABLE warehouses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.warehouses TO authenticated;
GRANT ALL ON TABLE public.warehouses TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--


ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--


ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--


ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--




-- 3. Roles and permission catalog (generated) -------------------------------------
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('99a8779a-55d5-4f22-9b02-4495bd1c9c8d', 'yarn_master:read', 'Read Yarn Masters', NULL, 'yarn_master', 'read', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('a1a403f9-151e-4def-8ba1-646947a28601', 'yarn_master:create', 'Create Yarn Masters', NULL, 'yarn_master', 'create', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('61ab02c7-5454-4837-b56e-d7ea6e401369', 'yarn_master:update', 'Update Yarn Masters', NULL, 'yarn_master', 'update', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('d113c310-ab8b-440b-b815-a7f1d34d6039', 'yarn_master:delete', 'Delete Yarn Masters', NULL, 'yarn_master', 'delete', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('146230cc-f8fd-4faa-885a-7fcbedffe1d6', 'cost_sheet:read', 'Read Cost Sheets', NULL, 'cost_sheet', 'read', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('b23c1984-cb5c-4714-aa26-4318aa794627', 'cost_sheet:create', 'Create Cost Sheets', NULL, 'cost_sheet', 'create', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('6ccd3449-87e6-4f77-bf1f-d3e5c711049c', 'cost_sheet:update', 'Update Cost Sheets', NULL, 'cost_sheet', 'update', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('81e6f9e3-8cad-422a-834d-0f1b04846178', 'cost_sheet:approve', 'Approve Cost Sheets', NULL, 'cost_sheet', 'approve', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('16e3d446-e867-4210-a341-4717789ec553', 'inventory:read', 'Read Inventory', NULL, 'inventory', 'read', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('9b45d5ed-741b-4233-8369-5f2caac1e591', 'inventory:write', 'Write Inventory Transactions', NULL, 'inventory', 'write', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('eab056ca-373c-4052-b445-1e1d19aadda3', 'production:read', 'Read Production Orders', NULL, 'production', 'read', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('88fa661e-b386-4065-b5b1-4c54cdea90e4', 'production:create', 'Create Production Orders', NULL, 'production', 'create', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('2823a55d-a0bf-4088-a871-5c3b385dd96e', 'production:update', 'Update Production Orders', NULL, 'production', 'update', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('c03b79d1-593d-4d76-81bd-736a34f68930', 'quality:read', 'Read Quality Inspections', NULL, 'quality', 'read', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('e0fce02e-6ab6-4645-adcb-06f60917d963', 'quality:write', 'Write Quality Inspections', NULL, 'quality', 'write', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('2c79eaa5-3d55-4300-83a8-7869786016f1', 'sales:read', 'Read Sales Orders', NULL, 'sales', 'read', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('2c637995-3759-441e-834d-b8646857eb57', 'sales:create', 'Create Sales Orders', NULL, 'sales', 'create', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('99b213ec-6782-4fc0-bbd5-a2055a981c40', 'sales:update', 'Update Sales Orders', NULL, 'sales', 'update', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('d96c477e-714e-4aa6-97fa-6a8d807c33e9', 'user_management:read', 'Read User Management', NULL, 'user_management', 'read', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('92680b40-e88f-4d6a-bd4e-f48851645e27', 'user_management:write', 'Write User Management', NULL, 'user_management', 'write', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('ff81a71e-5989-4782-b15f-1ac316c89a03', 'reports:read', 'Read Reports', NULL, 'reports', 'read', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('562cff51-32f0-461b-8e1b-a03109ce062a', 'audit:read', 'Read Audit Logs', NULL, 'audit', 'read', true, true, '2026-09-24 06:35:56.268972+00', '2026-09-24 06:35:56.268972+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('7682e352-fb82-4751-8319-e35728accd1d', 'masters.yarn:read', 'Read Yarn Masters', NULL, 'masters.yarn', 'read', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('4411bafa-3d18-4cc4-a569-823b79bcd258', 'masters.yarn:create', 'Create Yarn Masters', NULL, 'masters.yarn', 'create', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('3113b7b3-3ad6-4555-b105-2f180e591aca', 'masters.yarn:update', 'Update Yarn Masters', NULL, 'masters.yarn', 'update', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('0c5241d2-4f99-4501-a6bb-0a1685f3b27a', 'masters.yarn:delete', 'Delete Yarn Masters', NULL, 'masters.yarn', 'delete', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('e3ee3935-54a9-4a01-b083-f4204a467dd3', 'masters.generic:read', 'Read Generic Masters', NULL, 'masters.generic', 'read', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('fbce4dde-aa68-4d80-936d-612f4d592ee9', 'masters.generic:create', 'Create Generic Masters', NULL, 'masters.generic', 'create', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('43d0db4b-f448-43b0-9417-8e19ab0886c4', 'masters.generic:update', 'Update Generic Masters', NULL, 'masters.generic', 'update', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('e507952f-5c59-4c0b-a123-379877c3c539', 'masters.generic:delete', 'Delete Generic Masters', NULL, 'masters.generic', 'delete', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('07ccf0ba-f81e-4205-bd7d-d5d8609b9ac1', 'masters.party:read', 'Read Parties', NULL, 'masters.party', 'read', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('6be99af7-c4ca-4ed0-bded-18b3488e60b3', 'masters.party:create', 'Create Parties', NULL, 'masters.party', 'create', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('2ea3706b-95ea-4410-885f-31cab95e62b2', 'masters.party:update', 'Update Parties', NULL, 'masters.party', 'update', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('89b97fa8-9bba-4c6f-b2a7-4acb81253a0b', 'masters.party:delete', 'Delete Parties', NULL, 'masters.party', 'delete', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('3d8c8adf-6513-4f58-9b32-89eda5d629e5', 'design:read', 'Read Designs', NULL, 'design', 'read', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('43f715ff-0653-4187-b1f7-2ed0e598abf2', 'design:create', 'Create Designs', NULL, 'design', 'create', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('32ffa7d7-d2a3-42ef-b744-cd2f9cd00568', 'design:update', 'Update Designs', NULL, 'design', 'update', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');
INSERT INTO public.permissions (id, permission_code, permission_name, description, module, action, is_system, is_active, created_at, updated_at) VALUES ('ec35ecbe-47bd-4870-8760-c429ad8d5212', 'design:delete', 'Delete Designs', NULL, 'design', 'delete', true, true, '2026-09-24 06:35:56.324793+00', '2026-09-24 06:35:56.324793+00');


--
-- Data for Name: role_definitions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role_definitions (id, role_code, role_name, description, display_order, is_system, is_active, created_at, updated_at) VALUES ('c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'admin', 'Administrator', 'Full system access, user management, configuration', 1, true, true, '2026-09-24 06:35:56.263451+00', '2026-09-24 06:35:56.263451+00');
INSERT INTO public.role_definitions (id, role_code, role_name, description, display_order, is_system, is_active, created_at, updated_at) VALUES ('2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', 'manager', 'Manager', 'Department head, can approve/reject operations, view reports', 2, true, true, '2026-09-24 06:35:56.263451+00', '2026-09-24 06:35:56.263451+00');
INSERT INTO public.role_definitions (id, role_code, role_name, description, display_order, is_system, is_active, created_at, updated_at) VALUES ('ab97a9b7-2cd6-4335-9aae-55335215eb81', 'operator', 'Operator', 'Day-to-day operations, can create and edit entries', 3, true, true, '2026-09-24 06:35:56.263451+00', '2026-09-24 06:35:56.263451+00');
INSERT INTO public.role_definitions (id, role_code, role_name, description, display_order, is_system, is_active, created_at, updated_at) VALUES ('04132c14-a49f-479d-a4b2-e21fe5530d17', 'viewer', 'Viewer', 'Read-only access to data', 4, true, true, '2026-09-24 06:35:56.263451+00', '2026-09-24 06:35:56.263451+00');


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('5eaa5c44-b33b-4fd0-acb1-7d968f5eadca', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '99a8779a-55d5-4f22-9b02-4495bd1c9c8d', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('2ff71883-3c64-4d47-9cc3-845b2dd11332', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'a1a403f9-151e-4def-8ba1-646947a28601', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('da070742-64e7-48df-9b0b-e1c6423a7960', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '61ab02c7-5454-4837-b56e-d7ea6e401369', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('1c27b718-0a01-4a54-a074-4137461458da', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'd113c310-ab8b-440b-b815-a7f1d34d6039', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('9a318d6a-ffb9-4572-8a79-4400acda4288', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '146230cc-f8fd-4faa-885a-7fcbedffe1d6', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('a1b667ec-7e18-43e8-9465-adf450c7ce7e', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'b23c1984-cb5c-4714-aa26-4318aa794627', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('d0d679f4-8a8f-44ab-82be-7648b38fc2cf', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '6ccd3449-87e6-4f77-bf1f-d3e5c711049c', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('4cbd41fc-b219-4097-b748-91320e539023', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '81e6f9e3-8cad-422a-834d-0f1b04846178', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('134b11cb-2280-4179-8ad6-cd750174be07', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '16e3d446-e867-4210-a341-4717789ec553', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('448be309-9330-4460-9455-bf28873b8f80', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '9b45d5ed-741b-4233-8369-5f2caac1e591', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('7c8e4292-b619-40ab-ba7f-1da55b850c67', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'eab056ca-373c-4052-b445-1e1d19aadda3', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('27f62562-484f-44da-b0e8-f02e6e9aff22', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '88fa661e-b386-4065-b5b1-4c54cdea90e4', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('47e6d6b7-dcb0-48be-8579-63f24039e7a5', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '2823a55d-a0bf-4088-a871-5c3b385dd96e', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('7b588e81-b120-4996-adf8-363eb52e404b', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'c03b79d1-593d-4d76-81bd-736a34f68930', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('8521bddb-9e6c-4137-a136-a707f6823a6d', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'e0fce02e-6ab6-4645-adcb-06f60917d963', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('4f1bcc87-4c75-4d2f-91a8-7b520ca04d43', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '2c79eaa5-3d55-4300-83a8-7869786016f1', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('32a351f3-8596-4923-8c4a-b0e8cb3217f9', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '2c637995-3759-441e-834d-b8646857eb57', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('d057bf26-f126-4293-9771-06241ac3e1ea', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '99b213ec-6782-4fc0-bbd5-a2055a981c40', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('5abf4657-8473-4531-868d-b994f7f08f45', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'd96c477e-714e-4aa6-97fa-6a8d807c33e9', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('a3ba9329-d975-4d66-9ef0-f5bdf33076a4', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '92680b40-e88f-4d6a-bd4e-f48851645e27', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('8e760df7-58c2-4dbb-a190-032b628119bb', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'ff81a71e-5989-4782-b15f-1ac316c89a03', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('9533b369-f812-43be-b4a9-eb87ee29c300', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '562cff51-32f0-461b-8e1b-a03109ce062a', '2026-09-24 06:35:56.274038+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('9eef3cef-7ac8-4592-b5d0-e4f5bbd22c61', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '99a8779a-55d5-4f22-9b02-4495bd1c9c8d', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('c46f4a35-7124-4c0d-a464-05647d60f4f3', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', 'a1a403f9-151e-4def-8ba1-646947a28601', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('9a096e29-f7c4-45e9-b5a5-b03fe26c00af', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '61ab02c7-5454-4837-b56e-d7ea6e401369', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('844390fb-e3d4-4b65-9566-d8dbbe2d95d5', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '146230cc-f8fd-4faa-885a-7fcbedffe1d6', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('f2372730-15bd-470f-9b33-f4f04172b982', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', 'b23c1984-cb5c-4714-aa26-4318aa794627', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('28844128-8e31-4b80-84da-aaa781a0589a', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '6ccd3449-87e6-4f77-bf1f-d3e5c711049c', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('ebf30ea5-38a5-467c-a5e9-ce0765b03396', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '81e6f9e3-8cad-422a-834d-0f1b04846178', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('545668f9-bf9f-4d22-93c1-6cd8cae15206', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '16e3d446-e867-4210-a341-4717789ec553', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('cbd9e61a-c0e9-42fc-88dd-169b37423715', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', 'eab056ca-373c-4052-b445-1e1d19aadda3', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('66ee98a3-650f-44d8-8167-7d4a7a4334eb', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '88fa661e-b386-4065-b5b1-4c54cdea90e4', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('a4de349c-bc88-4450-aab4-3c333d342495', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '2823a55d-a0bf-4088-a871-5c3b385dd96e', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('0b3104c2-630b-4f2a-9b83-3ae79dd31264', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', 'c03b79d1-593d-4d76-81bd-736a34f68930', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('9b66c32d-e0ac-4740-babb-40dce60f4a69', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '2c79eaa5-3d55-4300-83a8-7869786016f1', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('e907b800-4442-40e0-a539-df9da16f5c47', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '2c637995-3759-441e-834d-b8646857eb57', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('d2fa1f0f-36c9-46da-b024-b41b3497ee6d', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '99b213ec-6782-4fc0-bbd5-a2055a981c40', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('614a2cb5-f929-4e02-a9c7-48b11c6b0dfc', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', 'ff81a71e-5989-4782-b15f-1ac316c89a03', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('16465b4e-7078-4cbc-95ca-2cd8aa04590a', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '562cff51-32f0-461b-8e1b-a03109ce062a', '2026-09-24 06:35:56.276092+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('a7a24137-3b8f-42a8-925a-f04d2b237962', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '99a8779a-55d5-4f22-9b02-4495bd1c9c8d', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('35218998-a588-480e-838c-405656ffef3d', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', 'a1a403f9-151e-4def-8ba1-646947a28601', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('c6776b92-dfee-4ada-8142-ef2f8b31b37f', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '61ab02c7-5454-4837-b56e-d7ea6e401369', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('db74cfe9-1df0-44d7-810a-7300b54acc1f', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '146230cc-f8fd-4faa-885a-7fcbedffe1d6', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('dd3d4c95-5e73-4267-8a68-98952f28f8da', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', 'b23c1984-cb5c-4714-aa26-4318aa794627', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('5d6480ab-c2f5-42eb-8ca0-bf6e2fefc274', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '6ccd3449-87e6-4f77-bf1f-d3e5c711049c', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('64944b18-0d3a-408d-88ef-9dfe47bb0487', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '16e3d446-e867-4210-a341-4717789ec553', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('d7d5fdf3-f0e1-43d7-80ee-affc06b12221', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '9b45d5ed-741b-4233-8369-5f2caac1e591', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('3909e678-9685-459e-acf2-f6a1ccf86e56', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', 'eab056ca-373c-4052-b445-1e1d19aadda3', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('b237eab1-c750-4d32-9214-9f212c209979', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '88fa661e-b386-4065-b5b1-4c54cdea90e4', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('c9d92f0a-7978-455b-bc87-cf6697234f6c', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '2823a55d-a0bf-4088-a871-5c3b385dd96e', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('2b430fb9-995f-4333-8cbd-5a0c93875aa2', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', 'c03b79d1-593d-4d76-81bd-736a34f68930', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('5c99f78a-7698-44e6-b971-a8a51bbd3d4b', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', 'e0fce02e-6ab6-4645-adcb-06f60917d963', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('8b74b8b1-364e-4040-b924-2581d2135c4d', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '2c79eaa5-3d55-4300-83a8-7869786016f1', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('f4c6b534-a267-4e35-a950-c95dd1d022a3', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '2c637995-3759-441e-834d-b8646857eb57', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('d036a425-afc8-43a2-b81a-d89f81a4c673', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '99b213ec-6782-4fc0-bbd5-a2055a981c40', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('43a4e90a-7016-45f0-85f7-31d08485633f', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', 'ff81a71e-5989-4782-b15f-1ac316c89a03', '2026-09-24 06:35:56.2774+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('85ddd6d1-8cf3-4308-893d-1fe875e3380a', '04132c14-a49f-479d-a4b2-e21fe5530d17', '99a8779a-55d5-4f22-9b02-4495bd1c9c8d', '2026-09-24 06:35:56.278445+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('2be355ca-0cfd-4612-9213-e4211aa06d61', '04132c14-a49f-479d-a4b2-e21fe5530d17', '146230cc-f8fd-4faa-885a-7fcbedffe1d6', '2026-09-24 06:35:56.278445+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('dfc5418d-44be-49ce-baf1-4dcf48e31a89', '04132c14-a49f-479d-a4b2-e21fe5530d17', '16e3d446-e867-4210-a341-4717789ec553', '2026-09-24 06:35:56.278445+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('ae82fdf4-7c4d-4d5c-aa75-7593e56ea307', '04132c14-a49f-479d-a4b2-e21fe5530d17', 'eab056ca-373c-4052-b445-1e1d19aadda3', '2026-09-24 06:35:56.278445+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('5ceba684-dbb4-4241-bbde-3c6fdcddedcb', '04132c14-a49f-479d-a4b2-e21fe5530d17', 'c03b79d1-593d-4d76-81bd-736a34f68930', '2026-09-24 06:35:56.278445+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('100da91a-1fcd-4558-910a-8d60ad0b4638', '04132c14-a49f-479d-a4b2-e21fe5530d17', '2c79eaa5-3d55-4300-83a8-7869786016f1', '2026-09-24 06:35:56.278445+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('72e73f14-959e-4312-b72d-4324eeedc1bc', '04132c14-a49f-479d-a4b2-e21fe5530d17', 'd96c477e-714e-4aa6-97fa-6a8d807c33e9', '2026-09-24 06:35:56.278445+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('5d8b0c1e-e888-4c74-aa86-c473f4a29008', '04132c14-a49f-479d-a4b2-e21fe5530d17', 'ff81a71e-5989-4782-b15f-1ac316c89a03', '2026-09-24 06:35:56.278445+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('e28e4cdf-01e9-45a0-add7-12dd35445d32', '04132c14-a49f-479d-a4b2-e21fe5530d17', '562cff51-32f0-461b-8e1b-a03109ce062a', '2026-09-24 06:35:56.278445+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('5a743184-8527-4116-8f22-6824c4a95a7c', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '7682e352-fb82-4751-8319-e35728accd1d', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('97b274e2-f3a4-4463-ae63-030396cdbf50', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '4411bafa-3d18-4cc4-a569-823b79bcd258', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('2615672f-ff7e-49a0-84af-f1be47cc8b6e', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '3113b7b3-3ad6-4555-b105-2f180e591aca', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('d5112981-2a8f-4fc5-8922-4dc3f05f190d', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '0c5241d2-4f99-4501-a6bb-0a1685f3b27a', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('6abad906-82c3-400c-8341-ee533b341efa', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'e3ee3935-54a9-4a01-b083-f4204a467dd3', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('84a40e89-3de8-4112-a762-97c71827a29a', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'fbce4dde-aa68-4d80-936d-612f4d592ee9', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('593e5bdb-b91e-4ad3-ad91-226adae305b5', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '43d0db4b-f448-43b0-9417-8e19ab0886c4', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('5c891f10-c909-481d-9969-0c2a8ad1dadc', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'e507952f-5c59-4c0b-a123-379877c3c539', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('e05d7443-1661-4c89-931c-9386401c2c81', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '07ccf0ba-f81e-4205-bd7d-d5d8609b9ac1', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('2470e98e-4d1e-4f6c-be7b-0d4394e3e42e', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '6be99af7-c4ca-4ed0-bded-18b3488e60b3', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('0a6533be-d812-4a36-90bf-4453e0a0de21', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '2ea3706b-95ea-4410-885f-31cab95e62b2', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('884e90f5-49bd-430c-ad8f-9bb38dcb8b7e', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '89b97fa8-9bba-4c6f-b2a7-4acb81253a0b', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('445e29e9-aeb5-44bd-a6b4-afff49e0fe38', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '3d8c8adf-6513-4f58-9b32-89eda5d629e5', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('69b7369e-c322-4c0a-9265-c79e0b922564', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '43f715ff-0653-4187-b1f7-2ed0e598abf2', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('535234a8-9958-4f1a-b43c-53a70a66a2aa', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', '32ffa7d7-d2a3-42ef-b744-cd2f9cd00568', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('f6527dbc-24b8-44fe-887f-ad3d52ced873', 'c8afeb18-abf6-41c1-9d9f-cf02e18415ea', 'ec35ecbe-47bd-4870-8760-c429ad8d5212', '2026-09-24 06:35:56.325925+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('de7f91e6-edec-4b8e-bb30-2770d336fb7e', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '7682e352-fb82-4751-8319-e35728accd1d', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('0297a37c-8363-4272-8439-463251a4fe12', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '4411bafa-3d18-4cc4-a569-823b79bcd258', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('0c3ed260-f181-4ef9-bee5-7c9e14334f07', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '3113b7b3-3ad6-4555-b105-2f180e591aca', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('ee0c9412-77be-431d-a009-12cbe639f329', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', 'e3ee3935-54a9-4a01-b083-f4204a467dd3', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('138bd5c5-ab06-45c2-9d54-f385701a23b2', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', 'fbce4dde-aa68-4d80-936d-612f4d592ee9', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('5bdb4f5a-5101-4d75-a894-bb95ad651bb0', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '43d0db4b-f448-43b0-9417-8e19ab0886c4', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('9a7c6f1a-d748-4405-b00d-5fd73907f2e6', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '07ccf0ba-f81e-4205-bd7d-d5d8609b9ac1', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('daf3d26a-64a4-4b94-9ac0-4526efa4bba2', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '6be99af7-c4ca-4ed0-bded-18b3488e60b3', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('c8d087a4-8e4c-452e-9e54-1a6ae07fb8c4', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '2ea3706b-95ea-4410-885f-31cab95e62b2', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('7adf38d9-f7bd-4418-a37e-57cefce59b5d', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '3d8c8adf-6513-4f58-9b32-89eda5d629e5', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('9fe8c528-b9fe-4e06-b565-d79fffb99709', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '43f715ff-0653-4187-b1f7-2ed0e598abf2', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('69146010-4b16-477b-816f-b7cd86d75f4b', '2b0afe0f-8ae6-4c9a-84cf-ab63bd82826f', '32ffa7d7-d2a3-42ef-b744-cd2f9cd00568', '2026-09-24 06:35:56.327958+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('02db5419-5a72-46d3-b133-05cdee7f1502', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '7682e352-fb82-4751-8319-e35728accd1d', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('9631cb97-be6f-41f0-84cd-d112ed52b726', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '4411bafa-3d18-4cc4-a569-823b79bcd258', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('a146bfe9-6a20-4f2e-98cc-f2e698db8bf3', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '3113b7b3-3ad6-4555-b105-2f180e591aca', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('6e8c9d3f-b943-4571-9835-198f3e3606d5', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', 'e3ee3935-54a9-4a01-b083-f4204a467dd3', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('e251b33e-906b-4da9-885b-f11f222a4c8f', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', 'fbce4dde-aa68-4d80-936d-612f4d592ee9', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('f3aaa2a0-4c17-4be3-870d-3e9c1ff9d741', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '43d0db4b-f448-43b0-9417-8e19ab0886c4', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('58b6f655-5340-4bc6-91f8-e9da338f81a5', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '07ccf0ba-f81e-4205-bd7d-d5d8609b9ac1', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('1a5d9a76-031b-4d5c-9d7e-f10482546ac8', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '6be99af7-c4ca-4ed0-bded-18b3488e60b3', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('b2b8f934-6a94-42ae-add1-1fc658c49d65', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '2ea3706b-95ea-4410-885f-31cab95e62b2', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('a3f66692-f535-472b-861b-28b8d66c3b53', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '3d8c8adf-6513-4f58-9b32-89eda5d629e5', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('5f40bab7-90d7-4328-b26f-a68b85f85ab9', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '43f715ff-0653-4187-b1f7-2ed0e598abf2', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('1b3971bb-c08f-4d52-83e6-020009f88ac1', 'ab97a9b7-2cd6-4335-9aae-55335215eb81', '32ffa7d7-d2a3-42ef-b744-cd2f9cd00568', '2026-09-24 06:35:56.329166+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('c1ad9329-f1f4-4be0-9ff7-a0b1e886b34c', '04132c14-a49f-479d-a4b2-e21fe5530d17', '7682e352-fb82-4751-8319-e35728accd1d', '2026-09-24 06:35:56.330606+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('8eac213d-7357-406d-8a02-53d9315732a1', '04132c14-a49f-479d-a4b2-e21fe5530d17', 'e3ee3935-54a9-4a01-b083-f4204a467dd3', '2026-09-24 06:35:56.330606+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('3cabfd8c-46ea-4114-9373-c8853949b0c9', '04132c14-a49f-479d-a4b2-e21fe5530d17', '07ccf0ba-f81e-4205-bd7d-d5d8609b9ac1', '2026-09-24 06:35:56.330606+00');
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at) VALUES ('4eed5213-d555-455a-b04b-279065e7eee3', '04132c14-a49f-479d-a4b2-e21fe5530d17', '3d8c8adf-6513-4f58-9b32-89eda5d629e5', '2026-09-24 06:35:56.330606+00');


--
-- PostgreSQL database dump complete
--




-- 4. Signup trigger + profiles for existing users --------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_rbac ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, u.email, COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), u.email)
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 5. Administrator access --------------------------------------------------------
UPDATE public.profiles SET primary_role_id = 'admin', status = 'ACTIVE'
WHERE lower(email) = 'admin@sckt.com';

INSERT INTO public.user_roles_mapping (user_id, role_id, is_primary, is_active)
SELECT u.id, rd.id, TRUE, TRUE
FROM auth.users u
JOIN public.role_definitions rd ON rd.role_code = 'admin'
WHERE lower(u.email) = 'admin@sckt.com'
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = TRUE, is_active = TRUE;



-- Result check: expect one row "admin@sckt.com | admin | ACTIVE | true"
SELECT p.email, p.primary_role_id, p.status, public.is_admin(p.id) AS is_admin
FROM public.profiles p
WHERE lower(p.email) = 'admin@sckt.com';


-- ============================================================================
-- SECTION 15 - 20: LATEST MIGRATION FIXES (006A - 006E) & SUPPLEMENTAL CONTRACTS
-- ============================================================================
-- ============================================================================
-- SCKT: apply migrations 006A-006E in one go (Supabase SQL editor)
-- Date: 2026-09-26
--
-- Paste this whole file into the Supabase SQL editor and run it once, AFTER
-- supabase/rebuild/20260925_rebuild_database.sql has been applied (it has, on
-- the live project). Everything runs in one transaction: either all of it is
-- applied or nothing is. Each part is also safe to re-run.
--
--   006A  cost_sheets header columns (cost sheet save)
--   006B  allocate_payment_atomic fixes (payments could never be applied)
--   006C  inventory ledger trigger fix (no stock movement could be recorded)
--   006D  design persistence (archived_at, feeder pick/card, child RLS,
--         save_design)
--   006E  backend blockers 1-4 (payment RPC permissions, cost sheet
--         versions, inventory item creation, party type)
--
-- The same SQL lives in supabase/migrations/20260926_006*.sql.
-- ============================================================================




-- >>>>>>>>>>>>>>>>>>>> 20260926_006A_cost_sheet_header_fields.sql

-- ============================================================================
-- MIGRATION 006A: Cost sheet header fields used by the cost sheet editor
-- Date: 2026-09-26
--
-- Why: the cost sheet editor collects Costing Date, Prepared By, Unit Basis,
-- Markup % and Manual Sale Rate, and costSheetsService writes them, but
-- public.cost_sheets never had these columns. Every save failed with
-- PGRST204 "Could not find the 'costing_date' column of 'cost_sheets'".
--
-- Money/percent columns use fixed precision (never float).
-- Safe to re-run. Rollback:
--   ALTER TABLE public.cost_sheets
--     DROP CONSTRAINT IF EXISTS cost_sheets_unit_basis_check,
--     DROP COLUMN IF EXISTS costing_date, DROP COLUMN IF EXISTS prepared_by,
--     DROP COLUMN IF EXISTS unit_basis, DROP COLUMN IF EXISTS markup_pct,
--     DROP COLUMN IF EXISTS manual_sale_rate;
-- ============================================================================

ALTER TABLE public.cost_sheets
  ADD COLUMN IF NOT EXISTS costing_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS prepared_by VARCHAR(150),
  ADD COLUMN IF NOT EXISTS unit_basis TEXT NOT NULL DEFAULT 'per metre',
  ADD COLUMN IF NOT EXISTS markup_pct DECIMAL(7, 2),
  ADD COLUMN IF NOT EXISTS manual_sale_rate DECIMAL(12, 2);

ALTER TABLE public.cost_sheets DROP CONSTRAINT IF EXISTS cost_sheets_unit_basis_check;
ALTER TABLE public.cost_sheets
  ADD CONSTRAINT cost_sheets_unit_basis_check CHECK (unit_basis IN ('per metre', 'per piece'));

ALTER TABLE public.cost_sheets DROP CONSTRAINT IF EXISTS cost_sheets_markup_pct_check;
ALTER TABLE public.cost_sheets
  ADD CONSTRAINT cost_sheets_markup_pct_check CHECK (markup_pct IS NULL OR markup_pct >= 0);

ALTER TABLE public.cost_sheets DROP CONSTRAINT IF EXISTS cost_sheets_manual_sale_rate_check;
ALTER TABLE public.cost_sheets
  ADD CONSTRAINT cost_sheets_manual_sale_rate_check
  CHECK (manual_sale_rate IS NULL OR manual_sale_rate >= 0);

-- Make PostgREST pick up the new columns immediately.

-- >>>>>>>>>>>>>>>>>>>> 20260926_006B_fix_allocate_payment_ambiguity.sql

-- ============================================================================
-- MIGRATION 006B: Fix allocate_payment_atomic "column reference is ambiguous"
-- Date: 2026-09-26
--
-- Why: allocate_payment_atomic RETURNS TABLE(..., allocated_amount, ...) and its
-- body sums sales_payment_allocations.allocated_amount unqualified. PL/pgSQL
-- treats the output column as a variable, so every call failed with
--   column reference "allocated_amount" is ambiguous
-- and no payment could ever be applied to an invoice.
--
-- Fix: same function body with `#variable_conflict use_column`, so bare
-- names resolve to table columns. The three validation messages built with ||
-- are now cast to VARCHAR: as text they did not match the RETURNS TABLE type,
-- so RETURN QUERY raised "structure of query does not match function result
-- type" instead of returning the validation message. Signature, SECURITY DEFINER, search_path and
-- existing grants are unchanged (CREATE OR REPLACE keeps the ACL).
-- Plain $$ quoting (the Supabase SQL editor mis-splits other dollar tags).
-- Safe to re-run. Rollback: re-apply 20260923_003N_1_payment_allocation_fixes.sql.
-- ============================================================================

-- Superseded implementation omitted; final definition below.



-- >>>>>>>>>>>>>>>>>>>> 20260926_006C_fix_inventory_balance_trigger.sql

-- ============================================================================
-- MIGRATION 006C: Fix the inventory ledger balance trigger
-- Date: 2026-09-26
--
-- Why: every INSERT into inventory_transactions failed, so no stock receipt,
-- issue or dispatch could be recorded:
--   1. update_inventory_balance() selects item_id with SUM(...) aggregates but
--      no GROUP BY -> "column inventory_transactions.item_id must appear in the
--      GROUP BY clause".
--   2. It ran as the calling user, but inventory_balances_cache denies all
--      writes through RLS (it is maintained only by this trigger) and
--      inventory_items updates are limited to managers, so even with (1) fixed
--      the cache insert would be rejected.
--
-- Fix: same logic with GROUP BY item_id, SECURITY DEFINER with a fixed
-- search_path (documented exception: the balance cache is trigger-owned), and
-- no direct EXECUTE for API roles (triggers don't need it).
-- Plain $$ quoting for the Supabase SQL editor. Safe to re-run.
-- Rollback: re-apply the function from 20260920_003_inventory_ledger_schema.sql.
-- ============================================================================




REVOKE ALL ON FUNCTION public.update_inventory_balance() FROM PUBLIC, anon, authenticated;

-- >>>>>>>>>>>>>>>>>>>> 20260926_006D_design_persistence.sql

-- ============================================================================
-- MIGRATION 006D: Design persistence (soft delete, feeder matrix, child RLS)
-- Date: 2026-09-26
--
-- Why: designs were saved only to browser localStorage. Moving them to the
-- database needs:
--   1. designs.archived_at - soft delete for master data (CLAUDE.md rule 8);
--      designsService already filtered on it, so the Designs list failed with
--      42703 "column designs.archived_at does not exist".
--   2. feeders.feeder_number / pick / card - the design editor requires a
--      positive Pick and Card per feeder row; the table could not store them.
--   3. RLS on beam_colours / feeders was USING (true) WITH CHECK (true) for
--      every signed-in user, so a viewer could change any design's feeder
--      matrix. Child rows now follow the parent design's permissions
--      (read: design:read; write: design:create/design:update on a design the
--      user created, or any design for admins - same rule as designs).
--   4. save_design(): writes a design and its whole beam colour x feeder
--      matrix in one transaction (SECURITY INVOKER, so the RLS here applies);
--      the app no longer saves header and children in separate requests.
--
-- Safe to re-run. Rollback:
--   ALTER TABLE public.designs DROP COLUMN IF EXISTS archived_at;
--   ALTER TABLE public.feeders DROP COLUMN IF EXISTS feeder_number,
--     DROP COLUMN IF EXISTS pick, DROP COLUMN IF EXISTS card;
--   (and restore the previous beam_colours_* / feeders_* policies)
-- ============================================================================

ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_designs_archived_at ON public.designs (archived_at);

ALTER TABLE public.feeders
  ADD COLUMN IF NOT EXISTS feeder_number TEXT,
  ADD COLUMN IF NOT EXISTS pick DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS card DECIMAL(10, 2);

ALTER TABLE public.feeders DROP CONSTRAINT IF EXISTS feeders_pick_positive;
ALTER TABLE public.feeders
  ADD CONSTRAINT feeders_pick_positive CHECK (pick IS NULL OR pick > 0);
ALTER TABLE public.feeders DROP CONSTRAINT IF EXISTS feeders_card_positive;
ALTER TABLE public.feeders
  ADD CONSTRAINT feeders_card_positive CHECK (card IS NULL OR card > 0);

-- ---------------------------------------------------------------------------
-- Child-table RLS follows the parent design
-- ---------------------------------------------------------------------------
ALTER TABLE public.beam_colours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS beam_colours_all ON public.beam_colours;
DROP POLICY IF EXISTS beam_colours_select ON public.beam_colours;
DROP POLICY IF EXISTS feeders_all ON public.feeders;
DROP POLICY IF EXISTS feeders_select ON public.feeders;
DROP POLICY IF EXISTS beam_colours_read ON public.beam_colours;
DROP POLICY IF EXISTS beam_colours_write ON public.beam_colours;
DROP POLICY IF EXISTS feeders_read ON public.feeders;
DROP POLICY IF EXISTS feeders_write ON public.feeders;

CREATE POLICY beam_colours_read ON public.beam_colours
  FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'design:read'));

CREATE POLICY beam_colours_write ON public.beam_colours
  FOR ALL TO authenticated
  USING (
    (public.user_has_permission(auth.uid(), 'design:create')
      OR public.user_has_permission(auth.uid(), 'design:update'))
    AND EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = beam_colours.design_id
        AND (d.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
  )
  WITH CHECK (
    (public.user_has_permission(auth.uid(), 'design:create')
      OR public.user_has_permission(auth.uid(), 'design:update'))
    AND EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = beam_colours.design_id
        AND (d.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY feeders_read ON public.feeders
  FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'design:read'));

CREATE POLICY feeders_write ON public.feeders
  FOR ALL TO authenticated
  USING (
    (public.user_has_permission(auth.uid(), 'design:create')
      OR public.user_has_permission(auth.uid(), 'design:update'))
    AND EXISTS (
      SELECT 1 FROM public.beam_colours bc
      JOIN public.designs d ON d.id = bc.design_id
      WHERE bc.id = feeders.beam_colour_id
        AND (d.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
  )
  WITH CHECK (
    (public.user_has_permission(auth.uid(), 'design:create')
      OR public.user_has_permission(auth.uid(), 'design:update'))
    AND EXISTS (
      SELECT 1 FROM public.beam_colours bc
      JOIN public.designs d ON d.id = bc.design_id
      WHERE bc.id = feeders.beam_colour_id
        AND (d.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- save_design(p_design_id, p_design, p_beam_colours) -> design id
--   p_design_id    NULL to create, else the design to update
--   p_design       {"design_number", "design_name", "dn", "dn_code", "reed", "pick",
--                   "cards", "patti", "total_dc", "total_cut", "work", "blue_apt",
--                   "description", "remarks", "image"}
--   p_beam_colours [{"beam_colour", "display_order",
--                    "feeders": [{"feeder_number", "color_name", "old_number",
--                                 "pick", "card", "display_order"}]}]
-- The matrix is replaced on update. Duplicate design numbers raise 23505.
-- ---------------------------------------------------------------------------


REVOKE ALL ON FUNCTION public.save_design(UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;


-- >>>>>>>>>>>>>>>>>>>> 20260926_006E_backend_blockers_1_4.sql

-- ============================================================================
-- MIGRATION 006E: Backend blockers 1-4
-- Date: 2026-09-26
-- Run after 006A-006D. Plain $$ quoting (Supabase SQL editor safe). Re-runnable.
--
-- 1. Payment / invoice RPCs checked only that the caller was signed in.
--    record_payment_atomic, allocate_payment_atomic and
--    create_invoice_from_shipment_atomic (SECURITY DEFINER, used by the app) now
--    require sales:update - the same rule create_invoice_from_order and
--    record_payment(5-arg) already apply. The legacy record_payment(6-arg) and
--    generate_invoice take a caller-supplied actor name and are not used by the
--    app: API roles lose EXECUTE on them. anon loses EXECUTE on all of them.
-- 2. Cost sheet "New Version" always failed: versions reuse the sheet number but
--    cost_sheets.sheet_no was UNIQUE. Uniqueness is now (sheet_no, version).
-- 3. Only admins could create inventory items (a deny_insert policy plus
--    admin-only access). Users with inventory:write may now create items with
--    zero stock (stock arrives only through the ledger) and delete an item that
--    has no transactions (used to roll back a failed first receipt). The
--    no-op permissive deny_insert / deny_delete policies are removed.
-- 4. parties.party_type did not exist, so the Party Master tab (Job / Purchase /
--    Sell) was never saved. Added with a check constraint; existing rows default
--    to 'Job Party' (what the screen already showed for them).
--
-- Rollback notes:
--   1. re-apply the functions from 006B / 20260923_003N_*; GRANT EXECUTE back.
--   2. ALTER TABLE cost_sheets DROP CONSTRAINT cost_sheets_sheet_no_version_key,
--      ADD CONSTRAINT cost_sheets_sheet_no_key UNIQUE (sheet_no);
--   3. DROP POLICY inventory_items_create / inventory_items_delete_unused.
--   4. ALTER TABLE parties DROP COLUMN party_type;
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Payment / invoice RPC authorization
-- ---------------------------------------------------------------------------






REVOKE EXECUTE ON FUNCTION public.record_payment_atomic(UUID, NUMERIC, VARCHAR, VARCHAR, DATE, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.allocate_payment_atomic(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_invoice_from_shipment_atomic(UUID, UUID, NUMERIC, DATE, DATE, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_invoice_from_order(UUID, DATE, DATE, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_payment(UUID, NUMERIC, VARCHAR, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_invoice_summary(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_payment_aging_report(UUID) FROM PUBLIC, anon, authenticated;

-- Legacy overloads with a caller-supplied actor name: not callable through the API.
REVOKE EXECUTE ON FUNCTION public.record_payment(UUID, NUMERIC, VARCHAR, VARCHAR, DATE, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invoice(UUID, DATE, DATE, VARCHAR) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cost sheet versions share a sheet number
-- ---------------------------------------------------------------------------
ALTER TABLE public.cost_sheets DROP CONSTRAINT IF EXISTS cost_sheets_sheet_no_key;
ALTER TABLE public.cost_sheets DROP CONSTRAINT IF EXISTS cost_sheets_sheet_no_version_key;
ALTER TABLE public.cost_sheets
  ADD CONSTRAINT cost_sheets_sheet_no_version_key UNIQUE (sheet_no, version);

-- ---------------------------------------------------------------------------
-- 3. Inventory items: create with inventory:write
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_items_deny_insert ON public.inventory_items;
DROP POLICY IF EXISTS inventory_items_deny_delete ON public.inventory_items;
DROP POLICY IF EXISTS inventory_items_create ON public.inventory_items;
DROP POLICY IF EXISTS inventory_items_delete_unused ON public.inventory_items;

CREATE POLICY inventory_items_create ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'inventory:write')
    AND total_qty = 0
    AND reserved_qty = 0
  );

CREATE POLICY inventory_items_delete_unused ON public.inventory_items
  FOR DELETE TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'inventory:write')
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_transactions t WHERE t.item_id = inventory_items.id
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Party type
-- ---------------------------------------------------------------------------
ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS party_type TEXT NOT NULL DEFAULT 'Job Party';
ALTER TABLE public.parties DROP CONSTRAINT IF EXISTS parties_party_type_check;
ALTER TABLE public.parties
  ADD CONSTRAINT parties_party_type_check
  CHECK (party_type IN ('Job Party', 'Purchase Party', 'Sell Party'));
CREATE INDEX IF NOT EXISTS idx_parties_party_type ON public.parties (party_type);



NOTIFY pgrst, 'reload schema';



-- Check (should return 5 rows, all true):
SELECT 'cost_sheets.costing_date' AS item,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cost_sheets' AND column_name = 'costing_date') AS ok
UNION ALL SELECT 'designs.archived_at',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'designs' AND column_name = 'archived_at')
UNION ALL SELECT 'parties.party_type',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'parties' AND column_name = 'party_type')
UNION ALL SELECT 'save_design()',
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'save_design')
UNION ALL SELECT 'cost_sheets (sheet_no, version) unique',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cost_sheets_sheet_no_version_key');


-- ============================================================================
-- SECTION 25: MIGRATION 006F - SECURITY & RESERVATION RECONCILIATION
-- ============================================================================



REVOKE ALL ON FUNCTION public.approve_stock_reservation_atomic(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_stock_reservation_atomic(UUID) FROM anon;


REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- ============================================================================
-- ============================================================================



-- ============================================================================
-- SECTION 26: OPTIONAL INITIAL ADMIN ROLE ASSIGNMENT
-- ============================================================================
-- Note: Run this AFTER your Admin user signs up via Supabase Auth:
/*
  INSERT INTO public.user_roles_mapping (user_id, role_id, is_primary)
  SELECT 
    u.id, 
    r.id, 
    TRUE
  FROM auth.users u
  CROSS JOIN public.role_definitions r
  WHERE u.email = 'admin@sckt.com'
    AND r.role_code = 'admin'
  ON CONFLICT (user_id, role_id) DO NOTHING;
*/

-- Initial Admin assignment is an explicit operator action documented in FRESH_SUPABASE_SETUP.md.


-- FINAL SECURITY ACL: no automatic client function exposure.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON public.cost_sheets FROM authenticated;
REVOKE ALL ON public.vw_inventory_available_qty FROM authenticated;
GRANT SELECT ON public.vw_inventory_available_qty TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
-- Client RPCs found in current route dependencies (signatures unchanged).
GRANT EXECUTE ON FUNCTION public.allocate_inventory_for_sales(uuid, character varying, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_job_output(uuid, numeric, character varying, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_quality_inspection(uuid, character varying, character varying, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_sales_order(uuid, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inventory_by_quality_grade(uuid, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_saleable_inventory(uuid, character varying, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_effective_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_material_to_production(uuid, uuid, numeric, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission_v2(uuid, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_design(UUID, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_atomic(uuid, numeric, character varying, character varying, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_payment_atomic(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_stock_reservation_atomic(UUID) TO authenticated;
-- These helpers are also evaluated directly by authenticated RLS policies.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, character varying) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

