-- STEP 006F: Security & Reservation Reconciliation Migration
-- Date: September 26, 2026
--
-- 1. Canonical Atomic Stock Reservation Approval RPC (approve_stock_reservation_atomic)
-- 2. Hardens complete_quality_inspection actor handling & search_path
-- 3. Hardens function execution privileges (revokes business mutation RPC execution from anon / PUBLIC)
-- 4. Reconciles legacy RLS policies to use canonical RBAC (user_has_permission)

BEGIN;

-- ============================================================================
-- 1. CANONICAL ATOMIC STOCK RESERVATION APPROVAL RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_stock_reservation_atomic(
  p_reservation_id UUID
)
RETURNS JSONB
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
    v_actor_email := 'system';
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

-- Secure function permissions for approve_stock_reservation_atomic
REVOKE ALL ON FUNCTION public.approve_stock_reservation_atomic(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_stock_reservation_atomic(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_stock_reservation_atomic(UUID) TO authenticated, service_role;

-- Remove obsolete update_reserved_qty function if it exists to ensure no bypass exists
DROP FUNCTION IF EXISTS public.update_reserved_qty(UUID, NUMERIC);

-- ============================================================================
-- 2. HARDEN EXISTING SECURITY DEFINER RPCS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'complete_quality_inspection') THEN
    ALTER FUNCTION public.complete_quality_inspection SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.complete_quality_inspection FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.complete_quality_inspection TO authenticated, service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'confirm_stock_reservation_atomic') THEN
    ALTER FUNCTION public.confirm_stock_reservation_atomic SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.confirm_stock_reservation_atomic FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.confirm_stock_reservation_atomic TO authenticated, service_role;
  END IF;
END $$;

-- ============================================================================
-- 3. GLOBAL FUNCTION ACL HARDENING: REVOKE MUTATION RPC EXECUTION FROM ANON
-- ============================================================================

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- ============================================================================
-- 4. LEGACY RLS POLICIES RECONCILIATION
-- ============================================================================

-- Warehouses
DROP POLICY IF EXISTS warehouses_all ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_admin_all" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_staff_read" ON public.warehouses;

CREATE POLICY warehouses_select ON public.warehouses FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:read') OR public.user_has_permission(auth.uid(), 'inventory:read') OR public.is_admin(auth.uid()));
CREATE POLICY warehouses_insert ON public.warehouses FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:create') OR public.is_admin(auth.uid()));
CREATE POLICY warehouses_update ON public.warehouses FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()))
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()));
CREATE POLICY warehouses_delete ON public.warehouses FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:delete') OR public.is_admin(auth.uid()));

-- Processes
DROP POLICY IF EXISTS processes_all ON public.processes;
CREATE POLICY processes_select ON public.processes FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:read') OR public.is_admin(auth.uid()));
CREATE POLICY processes_insert ON public.processes FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:create') OR public.is_admin(auth.uid()));
CREATE POLICY processes_update ON public.processes FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()));
CREATE POLICY processes_delete ON public.processes FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:delete') OR public.is_admin(auth.uid()));

-- Units
DROP POLICY IF EXISTS units_all ON public.units;
CREATE POLICY units_select ON public.units FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:read') OR public.is_admin(auth.uid()));
CREATE POLICY units_insert ON public.units FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:create') OR public.is_admin(auth.uid()));
CREATE POLICY units_update ON public.units FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()));
CREATE POLICY units_delete ON public.units FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:delete') OR public.is_admin(auth.uid()));

-- Colors
DROP POLICY IF EXISTS colors_all ON public.colors;
CREATE POLICY colors_select ON public.colors FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:read') OR public.is_admin(auth.uid()));
CREATE POLICY colors_insert ON public.colors FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission(auth.uid(), 'masters.generic:create') OR public.is_admin(auth.uid()));
CREATE POLICY colors_update ON public.colors FOR UPDATE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:update') OR public.is_admin(auth.uid()));
CREATE POLICY colors_delete ON public.colors FOR DELETE TO authenticated
  USING (public.user_has_permission(auth.uid(), 'masters.generic:delete') OR public.is_admin(auth.uid()));

COMMIT;
