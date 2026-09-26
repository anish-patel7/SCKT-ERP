-- STEP 14 Phase 6: Inbound Approval Workflow
-- Add approval tracking and quality inspection to inventory transactions

-- Add columns to inventory_transactions for approval workflow
ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS quality_grade VARCHAR(50),
ADD COLUMN IF NOT EXISTS quality_remarks TEXT,
ADD COLUMN IF NOT EXISTS inspected_by VARCHAR(150),
ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(150),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejection_qty DECIMAL(10, 2) DEFAULT 0;

-- Add constraint for approval status values
ALTER TABLE public.inventory_transactions
ADD CONSTRAINT check_approval_status CHECK (
  approval_status IN ('PENDING', 'QA_INSPECTED', 'APPROVED', 'REJECTED', 'PARTIAL_REJECT')
);

-- Add constraint for quality grades
ALTER TABLE public.inventory_transactions
ADD CONSTRAINT check_quality_grade CHECK (
  quality_grade IS NULL OR quality_grade IN ('A', 'B', 'C', 'REJECTED')
);

-- Create quality_inspections table for detailed inspection records
CREATE TABLE IF NOT EXISTS public.quality_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL,
  inspection_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  inspected_by VARCHAR(150) NOT NULL,
  quality_grade VARCHAR(50) NOT NULL,
  remarks TEXT,
  defects_found JSONB DEFAULT '[]'::jsonb,
  sample_size INTEGER,
  defect_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_transaction FOREIGN KEY (transaction_id) REFERENCES public.inventory_transactions(id) ON DELETE CASCADE,
  CONSTRAINT check_quality_grade CHECK (quality_grade IN ('A', 'B', 'C', 'REJECTED'))
);

-- Create approval_workflow table for audit trail
CREATE TABLE IF NOT EXISTS public.approval_workflow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL,
  step_number INTEGER NOT NULL,
  step_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  assigned_to VARCHAR(150),
  completed_by VARCHAR(150),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_transaction FOREIGN KEY (transaction_id) REFERENCES public.inventory_transactions(id) ON DELETE CASCADE,
  CONSTRAINT check_step_status CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED', 'SKIPPED'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_approval_status ON public.inventory_transactions(approval_status);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_quality_grade ON public.inventory_transactions(quality_grade);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inspected_by ON public.inventory_transactions(inspected_by);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_approved_by ON public.inventory_transactions(approved_by);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_transaction_id ON public.quality_inspections(transaction_id);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_inspected_by ON public.quality_inspections(inspected_by);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_quality_grade ON public.quality_inspections(quality_grade);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_transaction_id ON public.approval_workflow(transaction_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_status ON public.approval_workflow(status);

-- RLS Policies for quality_inspections
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_inspections" ON public.quality_inspections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

CREATE POLICY "qa_manage_inspections" ON public.quality_inspections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'role-qa')
    )
  );

CREATE POLICY "manager_view_inspections" ON public.quality_inspections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'role-qa', 'manager')
    )
  );

-- RLS Policies for approval_workflow
ALTER TABLE public.approval_workflow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_workflow" ON public.approval_workflow
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id = 'admin'
    )
  );

CREATE POLICY "staff_view_workflow" ON public.approval_workflow
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'role-qa')
    )
  );

CREATE POLICY "staff_update_workflow" ON public.approval_workflow
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.primary_role_id IN ('admin', 'manager', 'role-qa')
    )
  );
