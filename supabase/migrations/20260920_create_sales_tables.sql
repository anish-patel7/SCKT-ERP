-- STEP 16 Phases 2-6: Sales Order Management System
-- Creates customers, quotations, orders, invoices, fulfillment, payments tables

-- ============================================================================
-- 1. CUSTOMERS (Extended Party Master)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_id UUID NOT NULL UNIQUE REFERENCES public.parties(id) ON DELETE CASCADE,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  current_credit_used DECIMAL(15,2) DEFAULT 0,
  payment_terms_days INT DEFAULT 30,
  default_shipping_address TEXT,
  contact_person VARCHAR(150),
  phone VARCHAR(20),
  email VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150)
);

CREATE INDEX idx_customers_party_id ON public.customers(party_id);
CREATE INDEX idx_customers_is_active ON public.customers(is_active);

-- ============================================================================
-- 2. SALES QUOTATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_no VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  quoted_date DATE NOT NULL,
  valid_till DATE NOT NULL,

  subtotal_amount DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,

  status VARCHAR(20) DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CLOSED')),

  remarks TEXT,
  quoted_by VARCHAR(150),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150),

  CONSTRAINT total_amount_check CHECK (total_amount > 0)
);

CREATE INDEX idx_sales_quotations_customer_id ON public.sales_quotations(customer_id);
CREATE INDEX idx_sales_quotations_status ON public.sales_quotations(status);
CREATE INDEX idx_sales_quotations_quotation_no ON public.sales_quotations(quotation_no);

-- ============================================================================
-- 3. SALES QUOTATION ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_quotation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID NOT NULL REFERENCES public.sales_quotations(id) ON DELETE CASCADE,
  line_number INT NOT NULL,

  fabric_quality_name VARCHAR(200) NOT NULL,
  design_no VARCHAR(50),
  qty_metre DECIMAL(10,2) NOT NULL,
  rate_per_metre DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,

  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT qty_positive CHECK (qty_metre > 0),
  CONSTRAINT rate_positive CHECK (rate_per_metre > 0)
);

CREATE INDEX idx_sales_quotation_items_quotation_id ON public.sales_quotation_items(quotation_id);

-- ============================================================================
-- 4. SALES ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no VARCHAR(50) NOT NULL UNIQUE,
  quotation_id UUID REFERENCES public.sales_quotations(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  order_date DATE NOT NULL,
  delivery_date DATE NOT NULL,

  subtotal_amount DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,

  status VARCHAR(30) DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'ALLOCATED', 'FULFILLED',
                      'SHIPPED', 'DELIVERED', 'INVOICED', 'PAID', 'CANCELLED')),

  shipping_address TEXT NOT NULL,
  billing_address TEXT NOT NULL,
  delivery_instructions TEXT,
  remarks TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150),

  confirmed_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT total_amount_check CHECK (total_amount >= 0)
);

CREATE INDEX idx_sales_orders_order_no ON public.sales_orders(order_no);
CREATE INDEX idx_sales_orders_customer_id ON public.sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX idx_sales_orders_order_date ON public.sales_orders(order_date);
CREATE INDEX idx_sales_orders_delivery_date ON public.sales_orders(delivery_date);

-- ============================================================================
-- 5. SALES ORDER ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  line_number INT NOT NULL,

  fabric_quality_name VARCHAR(200) NOT NULL,
  design_no VARCHAR(50),
  qty_metre DECIMAL(10,2) NOT NULL,
  qty_allocated DECIMAL(10,2) DEFAULT 0,
  qty_shipped DECIMAL(10,2) DEFAULT 0,

  rate_per_metre DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,

  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT qty_positive CHECK (qty_metre > 0),
  CONSTRAINT qty_allocated_check CHECK (qty_allocated >= 0 AND qty_allocated <= qty_metre),
  CONSTRAINT qty_shipped_check CHECK (qty_shipped >= 0 AND qty_shipped <= qty_allocated)
);

CREATE INDEX idx_sales_order_items_order_id ON public.sales_order_items(order_id);

-- ============================================================================
-- 6. SALES INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no VARCHAR(50) NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,

  subtotal_amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,

  amount_paid DECIMAL(15,2) DEFAULT 0,
  amount_outstanding DECIMAL(15,2) NOT NULL,

  status VARCHAR(20) DEFAULT 'UNPAID'
    CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED')),

  remarks TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150),

  CONSTRAINT amount_paid_check CHECK (amount_paid >= 0 AND amount_paid <= total_amount)
);

CREATE INDEX idx_sales_invoices_invoice_no ON public.sales_invoices(invoice_no);
CREATE INDEX idx_sales_invoices_customer_id ON public.sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_order_id ON public.sales_invoices(order_id);
CREATE INDEX idx_sales_invoices_status ON public.sales_invoices(status);
CREATE INDEX idx_sales_invoices_due_date ON public.sales_invoices(due_date);

-- ============================================================================
-- 7. SALES PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount_paid DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(30),
  reference_number VARCHAR(100),
  remarks TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),

  CONSTRAINT amount_positive CHECK (amount_paid > 0)
);

CREATE INDEX idx_sales_payments_invoice_id ON public.sales_payments(invoice_id);
CREATE INDEX idx_sales_payments_payment_date ON public.sales_payments(payment_date);

-- ============================================================================
-- 8. SALES FULFILLMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_fulfillment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pick_list_no VARCHAR(50) NOT NULL UNIQUE,

  fulfillment_date DATE NOT NULL,
  shipped_date DATE,
  delivered_date DATE,

  status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PICKING', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED')),

  tracking_number VARCHAR(100),
  carrier VARCHAR(100),

  remarks TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150)
);

CREATE INDEX idx_sales_fulfillment_status ON public.sales_fulfillment(status);
CREATE INDEX idx_sales_fulfillment_pick_list_no ON public.sales_fulfillment(pick_list_no);

-- ============================================================================
-- 9. SALES FULFILLMENT ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_fulfillment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fulfillment_id UUID NOT NULL REFERENCES public.sales_fulfillment(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.sales_order_items(id) ON DELETE CASCADE,

  qty_to_ship DECIMAL(10,2) NOT NULL,
  qty_picked DECIMAL(10,2) DEFAULT 0,
  qty_packed DECIMAL(10,2) DEFAULT 0,
  qty_shipped DECIMAL(10,2) DEFAULT 0,

  bin_location VARCHAR(50),
  remarks TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT qty_positive CHECK (qty_to_ship > 0)
);

CREATE INDEX idx_sales_fulfillment_items_fulfillment_id ON public.sales_fulfillment_items(fulfillment_id);

-- ============================================================================
-- 10. SALES AUDIT TRAIL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES public.sales_quotations(id) ON DELETE CASCADE,

  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name VARCHAR(150),

  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT action_valid CHECK (
    action IN ('QUOTATION_CREATED', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED',
               'ORDER_CREATED', 'ORDER_CONFIRMED', 'ORDER_ALLOCATED',
               'FULFILLMENT_CREATED', 'ORDER_SHIPPED', 'ORDER_DELIVERED',
               'INVOICE_CREATED', 'PAYMENT_RECORDED', 'STATUS_CHANGED')
  )
);

CREATE INDEX idx_sales_audit_trail_order_id ON public.sales_audit_trail(order_id);
CREATE INDEX idx_sales_audit_trail_quotation_id ON public.sales_audit_trail(quotation_id);
CREATE INDEX idx_sales_audit_trail_timestamp ON public.sales_audit_trail(timestamp);

-- ============================================================================
-- 11. RLS POLICIES
-- ============================================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_fulfillment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_fulfillment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_audit_trail ENABLE ROW LEVEL SECURITY;

-- Admin policies (full access)
CREATE POLICY "admin_full_access_customers" ON public.customers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE POLICY "admin_full_access_sales_quotations" ON public.sales_quotations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE POLICY "admin_full_access_sales_orders" ON public.sales_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE POLICY "admin_full_access_sales_invoices" ON public.sales_invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE POLICY "admin_full_access_sales_payments" ON public.sales_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE POLICY "admin_full_access_sales_fulfillment" ON public.sales_fulfillment FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

-- Manager policies (view + modify)
CREATE POLICY "manager_view_customers" ON public.customers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager'))
);

CREATE POLICY "manager_view_sales_orders" ON public.sales_orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager'))
);

CREATE POLICY "manager_view_sales_invoices" ON public.sales_invoices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager'))
);

-- Operator policies (fulfillment only)
CREATE POLICY "operator_create_fulfillment" ON public.sales_fulfillment FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager', 'operator'))
);

CREATE POLICY "operator_view_fulfillment" ON public.sales_fulfillment FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager', 'operator'))
);

CREATE POLICY "operator_record_payment" ON public.sales_payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id IN ('admin', 'manager', 'operator'))
);
