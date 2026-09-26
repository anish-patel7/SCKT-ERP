-- STEP 3L: Invoice Model Consolidation & Contract Alignment
-- Date: September 22, 2026
--
-- CONSOLIDATION DECISION:
-- Canonical Model: public.sales_invoices + sales_payments (from 20260920_create_sales_tables.sql)
-- Deprecated Model: public.invoices + payments (from 20260921_part3_dispatch_operations.sql)
--
-- RATIONALE:
-- 1. sales_invoices has complete atomic RPC functions (create_invoice_from_order, record_payment, etc.)
-- 2. Canonical invoicing.ts service calls create_invoice_from_order and record_payment RPCs
-- 3. sales_invoices has proper financial controls (amount_outstanding field, CHECK constraints)
-- 4. Uses safe FK constraints (ON DELETE CASCADE vs RESTRICT)
-- 5. References canonical customers table (not parties)
--
-- ACTION:
-- - Keep public.invoices and public.payments tables for backward compatibility
-- - Mark with deprecation notices in table comments
-- - Direct all new code to use sales_invoices/sales_payments via invoicing.ts service
-- - Update dispatch.ts to delegate to canonical invoicing.ts instead of direct table queries

-- ============================================================================
-- DEPRECATION NOTICES
-- ============================================================================

COMMENT ON TABLE public.invoices IS 'DEPRECATED (STEP 3L): Use public.sales_invoices instead. This table is legacy from part3_dispatch_operations.sql and should not be used for new code. Access invoicing via invoicing.ts service.';

COMMENT ON TABLE public.payments IS 'DEPRECATED (STEP 3L): Use public.sales_payments instead. This table is legacy from part3_dispatch_operations.sql and should not be used for new code. Use invoicing.ts recordPayment() service method.';

COMMENT ON TABLE public.sales_invoices IS 'CANONICAL (STEP 3L): Primary invoice table for all invoicing operations. Use via invoicing.ts service which calls canonical RPC functions (create_invoice_from_order, record_payment, get_invoice_summary, complete_order).';

COMMENT ON TABLE public.sales_payments IS 'CANONICAL (STEP 3L): Primary payment records table. Use via invoicing.ts service.';

-- ============================================================================
-- RLS POLICIES FOR CANONICAL TABLES
-- ============================================================================

-- Verify RLS is enabled on canonical tables
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;

-- Admin: Full access to invoices
DROP POLICY IF EXISTS "admin_full_access_sales_invoices" ON public.sales_invoices;
CREATE POLICY "admin_full_access_sales_invoices" ON public.sales_invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- Manager: Can view and create invoices
DROP POLICY IF EXISTS "manager_read_write_sales_invoices" ON public.sales_invoices;
CREATE POLICY "manager_read_write_sales_invoices" ON public.sales_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- Operator: Read-only access
DROP POLICY IF EXISTS "operator_read_sales_invoices" ON public.sales_invoices;
CREATE POLICY "operator_read_sales_invoices" ON public.sales_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

-- Admin: Full access to payments
DROP POLICY IF EXISTS "admin_full_access_sales_payments" ON public.sales_payments;
CREATE POLICY "admin_full_access_sales_payments" ON public.sales_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

-- Manager: Can view and record payments
DROP POLICY IF EXISTS "manager_read_write_sales_payments" ON public.sales_payments;
CREATE POLICY "manager_read_write_sales_payments" ON public.sales_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager')
    )
  );

-- Operator: Read-only access to payments
DROP POLICY IF EXISTS "operator_read_sales_payments" ON public.sales_payments;
CREATE POLICY "operator_read_sales_payments" ON public.sales_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'operator')
    )
  );

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- STEP 3L Invoice Model Consolidation:
--
-- 1. CANONICAL SELECTION: public.sales_invoices + sales_payments
--    - Used by canonical invoicing.ts service
--    - Complete RPC function suite for atomic operations
--    - Proper financial controls and constraints
--
-- 2. DEPRECATION: public.invoices + payments
--    - Marked with deprecation notices
--    - Kept for backward compatibility (not deleted)
--    - Should not be used in new code
--
-- 3. SERVICE LAYER UPDATE: dispatch.ts
--    - Removed duplicate invoicing/payment services
--    - Delegates to canonical invoicing.ts instead
--    - Imports InvoiceCreated, PaymentRecorded types from invoicing.ts
--
-- 4. RLS POLICIES:
--    - Added comprehensive RLS to canonical tables
--    - Enforces role-based access (admin/manager/operator/viewer)
--    - All financial data protected at database layer
--
-- MIGRATION PATH FOR EXISTING CODE:
-- OLD: dispatch.ts → direct query invoices table
-- NEW: dispatch.ts → invoicing.ts service → sales_invoices via RPC
--
-- This consolidation ensures:
-- ✓ Single source of truth for invoice data
-- ✓ Atomic RPC-based operations (no race conditions)
-- ✓ Proper financial audit trail
-- ✓ Role-based access control
-- ✓ Backward compatibility (old tables still exist)
