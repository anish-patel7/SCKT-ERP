-- ============================================================================
-- MIGRATION 005C: Close RLS gaps on sales / reference tables
-- Date: 2026-09-25
--
-- After replaying the migration history, these tables had no row-level security:
--   invoices, payments, sales_invoice_items, shipments, supported_languages
-- and these had RLS enabled but no policy (so every request was denied, including
-- the app reading order and quotation lines):
--   sales_order_items, sales_quotation_items, sales_fulfillment_items, sales_audit_trail
--
-- Policies use the canonical permission helper from 005A (administrators always pass).
-- Safe to re-run.
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'invoices', 'payments', 'sales_invoice_items', 'shipments',
    'sales_order_items', 'sales_quotation_items', 'sales_fulfillment_items', 'sales_audit_trail'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
          || 'USING (public.user_has_permission(auth.uid(), %L))',
        t || '_read', t, 'sales:read');
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated '
          || 'WITH CHECK (public.user_has_permission(auth.uid(), %L) '
          || 'OR public.user_has_permission(auth.uid(), %L))',
        t || '_insert', t, 'sales:create', 'sales:update');
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated '
          || 'USING (public.user_has_permission(auth.uid(), %L)) '
          || 'WITH CHECK (public.user_has_permission(auth.uid(), %L))',
        t || '_update', t, 'sales:update', 'sales:update');
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated '
          || 'USING (public.user_has_permission(auth.uid(), %L))',
        t || '_delete', t, 'sales:update');
    END IF;
  END LOOP;
END $$;

-- The audit trail is append-only: no updates or deletes through the API.
DO $$
BEGIN
  IF to_regclass('public.sales_audit_trail') IS NOT NULL THEN
    DROP POLICY IF EXISTS "sales_audit_trail_update" ON public.sales_audit_trail;
    DROP POLICY IF EXISTS "sales_audit_trail_delete" ON public.sales_audit_trail;
  END IF;
END $$;

-- Reference data: readable by any signed-in user, not writable through the API.
DO $$
BEGIN
  IF to_regclass('public.supported_languages') IS NOT NULL THEN
    ALTER TABLE public.supported_languages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "supported_languages_read" ON public.supported_languages;
    CREATE POLICY "supported_languages_read" ON public.supported_languages
      FOR SELECT TO authenticated USING (TRUE);
  END IF;
END $$;
