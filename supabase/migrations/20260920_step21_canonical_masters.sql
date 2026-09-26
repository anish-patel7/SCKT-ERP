-- STEP 21 PHASE 2: Canonical Master Data Tables
-- Establishes authoritative master data tables for:
-- - Party Sub-Parties (locations of parties)
-- - Warehouses (master warehouse/godown data)
-- - Processes (manufacturing processes: dyeing, finishing, etc.)
-- - Machines (looms and other production equipment)
-- - Units (units of measurement)
-- - Colors (optional: color master for quality/design specs)

-- ============================================================================
-- PARTY_SUB_PARTIES: Multi-location/office support for parties
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.party_sub_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  sub_party_code TEXT NOT NULL UNIQUE,
  sub_party_name TEXT NOT NULL,
  party_type TEXT NOT NULL DEFAULT 'Job Party', -- 'Job Party', 'Purchase Party', 'Sell Party'
  location_type TEXT DEFAULT 'Branch Office',
  location_type_other TEXT,

  -- Address fields
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  area TEXT,
  city TEXT NOT NULL,
  district TEXT,
  state TEXT NOT NULL,
  pin_code TEXT,
  country TEXT DEFAULT 'India',

  -- Tax & Compliance
  gstin TEXT,
  pan TEXT,

  -- Contact information
  contact_person TEXT,
  mobile TEXT,
  alternate_mobile TEXT,
  phone TEXT,
  email TEXT,
  alternate_email TEXT,

  -- Addresses for different purposes
  billing_address TEXT,
  shipping_address TEXT,
  delivery_address TEXT,

  -- Flags
  is_default BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Active', -- 'Active', 'Inactive'

  -- Metadata
  remarks TEXT,
  internal_notes TEXT,
  transaction_count INT DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT sub_party_code_not_empty CHECK (length(sub_party_code) > 0),
  CONSTRAINT sub_party_name_not_empty CHECK (length(sub_party_name) > 0),
  CONSTRAINT address_line1_not_empty CHECK (length(address_line1) > 0),
  CONSTRAINT city_not_empty CHECK (length(city) > 0)
);

CREATE INDEX idx_party_sub_parties_party_id ON public.party_sub_parties(party_id);
CREATE INDEX idx_party_sub_parties_code ON public.party_sub_parties(sub_party_code);
CREATE INDEX idx_party_sub_parties_status ON public.party_sub_parties(status);
CREATE INDEX idx_party_sub_parties_is_default ON public.party_sub_parties(is_default);

ALTER TABLE public.party_sub_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_parties_read" ON public.party_sub_parties FOR SELECT TO authenticated USING (true);
CREATE POLICY "sub_parties_insert" ON public.party_sub_parties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sub_parties_update" ON public.party_sub_parties FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sub_parties_delete" ON public.party_sub_parties FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE TRIGGER party_sub_parties_updated BEFORE UPDATE ON public.party_sub_parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- WAREHOUSES: Master warehouse/godown data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_code TEXT NOT NULL UNIQUE,
  warehouse_name TEXT NOT NULL,
  warehouse_type TEXT NOT NULL, -- 'Raw Material', 'Yarn', 'Beam', 'Grey Fabric', 'Finished Goods', 'Chemical', 'Packing Material', 'General', 'Third Party', 'Other'
  warehouse_type_other TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  area TEXT,
  city TEXT,
  district TEXT,
  state TEXT,
  pin_code TEXT,
  country TEXT DEFAULT 'India',

  -- Contact
  contact_person TEXT,
  mobile TEXT,
  email TEXT,

  -- Capacity & metadata
  total_capacity_kg DECIMAL(14, 4),
  total_capacity_metres DECIMAL(14, 4),

  -- Status
  remarks TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'Active',

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT warehouse_code_not_empty CHECK (length(warehouse_code) > 0),
  CONSTRAINT warehouse_name_not_empty CHECK (length(warehouse_name) > 0)
);

CREATE INDEX idx_warehouses_code ON public.warehouses(warehouse_code);
CREATE INDEX idx_warehouses_type ON public.warehouses(warehouse_type);
CREATE INDEX idx_warehouses_is_active ON public.warehouses(is_active);
CREATE INDEX idx_warehouses_status ON public.warehouses(status);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses_read" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "warehouses_insert" ON public.warehouses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "warehouses_update" ON public.warehouses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "warehouses_delete" ON public.warehouses FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE TRIGGER warehouses_updated BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PROCESSES: Manufacturing process master
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_code TEXT NOT NULL UNIQUE,
  process_name TEXT NOT NULL,
  description TEXT,

  -- Process details
  process_category TEXT, -- 'Dyeing', 'Finishing', 'Printing', 'Weaving', 'Knitting', 'Embroidery', 'Packing', etc.
  default_rate NUMERIC(19, 6) DEFAULT 0, -- Current reference rate (not used in old costings)
  unit_of_rate TEXT DEFAULT 'per_kg', -- 'per_kg', 'per_metre', 'per_piece', 'per_hour'

  -- Standard times/metrics
  processing_time_hours NUMERIC(10, 2),

  -- Flags
  is_active BOOLEAN DEFAULT TRUE,
  is_outsourced BOOLEAN DEFAULT FALSE, -- TRUE if usually outsourced to job workers

  -- Metadata
  remarks TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT process_code_not_empty CHECK (length(process_code) > 0),
  CONSTRAINT process_name_not_empty CHECK (length(process_name) > 0)
);

CREATE INDEX idx_processes_code ON public.processes(process_code);
CREATE INDEX idx_processes_category ON public.processes(process_category);
CREATE INDEX idx_processes_is_active ON public.processes(is_active);
CREATE INDEX idx_processes_is_outsourced ON public.processes(is_outsourced);

ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processes_read" ON public.processes FOR SELECT TO authenticated USING (true);
CREATE POLICY "processes_insert" ON public.processes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "processes_update" ON public.processes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "processes_delete" ON public.processes FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE TRIGGER processes_updated BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track process rate history (like material rates)
CREATE TABLE IF NOT EXISTS public.process_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  default_rate NUMERIC(19, 6) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_process_rate_history_process_id ON public.process_rate_history(process_id);

ALTER TABLE public.process_rate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prh_read" ON public.process_rate_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "prh_insert" ON public.process_rate_history FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- MACHINES: Production equipment (looms, knitting machines, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_code TEXT NOT NULL UNIQUE,
  machine_name TEXT NOT NULL,
  description TEXT,

  -- Type and location
  machine_type TEXT, -- 'Loom', 'Knitting Machine', 'Dyeing Vat', 'Finishing Equipment', etc.
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL, -- Primary process performed
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL, -- Location

  -- Specifications
  specifications JSONB DEFAULT '{}'::jsonb, -- Machine-specific data (width, speed, capacity, etc.)

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'Active', -- 'Active', 'Maintenance', 'Retired'

  -- Metadata
  remarks TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT machine_code_not_empty CHECK (length(machine_code) > 0),
  CONSTRAINT machine_name_not_empty CHECK (length(machine_name) > 0)
);

CREATE INDEX idx_machines_code ON public.machines(machine_code);
CREATE INDEX idx_machines_type ON public.machines(machine_type);
CREATE INDEX idx_machines_process_id ON public.machines(process_id);
CREATE INDEX idx_machines_warehouse_id ON public.machines(warehouse_id);
CREATE INDEX idx_machines_is_active ON public.machines(is_active);
CREATE INDEX idx_machines_status ON public.machines(status);

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "machines_read" ON public.machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "machines_insert" ON public.machines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "machines_update" ON public.machines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "machines_delete" ON public.machines FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE TRIGGER machines_updated BEFORE UPDATE ON public.machines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- UNITS: Unit of Measurement Master
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code TEXT NOT NULL UNIQUE,
  unit_name TEXT NOT NULL,
  description TEXT,

  -- Measurement type
  measurement_type TEXT NOT NULL, -- 'weight', 'length', 'count', 'area', 'volume', 'time'

  -- SI conversion
  base_unit TEXT, -- e.g., 'KG' for weight, 'M' for length
  conversion_factor NUMERIC(19, 6) DEFAULT 1, -- Conversion to base unit

  -- Flags
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE, -- Default unit for this measurement type

  -- Metadata
  remarks TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT unit_code_not_empty CHECK (length(unit_code) > 0),
  CONSTRAINT unit_name_not_empty CHECK (length(unit_name) > 0)
);

CREATE INDEX idx_units_code ON public.units(unit_code);
CREATE INDEX idx_units_measurement_type ON public.units(measurement_type);
CREATE INDEX idx_units_is_active ON public.units(is_active);
CREATE INDEX idx_units_is_default ON public.units(is_default);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_read" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "units_insert" ON public.units FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "units_update" ON public.units FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "units_delete" ON public.units FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE TRIGGER units_updated BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- COLORS: Color/Shade Master (optional - can be text in feeders)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  color_code TEXT NOT NULL UNIQUE,
  color_name TEXT NOT NULL,
  color_hex TEXT, -- Hex color code for UI representation
  description TEXT,

  -- Type
  color_type TEXT DEFAULT 'General', -- 'Dye', 'Yarn', 'Fabric', 'General'

  -- Flags
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  remarks TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT color_code_not_empty CHECK (length(color_code) > 0),
  CONSTRAINT color_name_not_empty CHECK (length(color_name) > 0)
);

CREATE INDEX idx_colors_code ON public.colors(color_code);
CREATE INDEX idx_colors_type ON public.colors(color_type);
CREATE INDEX idx_colors_is_active ON public.colors(is_active);

ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colors_read" ON public.colors FOR SELECT TO authenticated USING (true);
CREATE POLICY "colors_insert" ON public.colors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "colors_update" ON public.colors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "colors_delete" ON public.colors FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.primary_role_id = 'admin')
);

CREATE TRIGGER colors_updated BEFORE UPDATE ON public.colors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SEED DATA: Essential master records
-- ============================================================================

-- Insert essential processes
INSERT INTO public.processes (process_code, process_name, process_category, default_rate, unit_of_rate, is_active)
VALUES
  ('PROC-001', 'Dyeing', 'Dyeing', 50.00, 'per_kg', TRUE),
  ('PROC-002', 'Finishing', 'Finishing', 30.00, 'per_metre', TRUE),
  ('PROC-003', 'Printing', 'Printing', 40.00, 'per_metre', TRUE),
  ('PROC-004', 'Sizing', 'Finishing', 20.00, 'per_kg', TRUE),
  ('PROC-005', 'Packing', 'Packing', 5.00, 'per_piece', TRUE)
ON CONFLICT (process_code) DO NOTHING;

-- Insert common units
INSERT INTO public.units (unit_code, unit_name, measurement_type, base_unit, conversion_factor, is_active, is_default)
VALUES
  ('KG', 'Kilogram', 'weight', 'KG', 1.0, TRUE, TRUE),
  ('GM', 'Gram', 'weight', 'KG', 0.001, TRUE, FALSE),
  ('M', 'Metre', 'length', 'M', 1.0, TRUE, TRUE),
  ('CM', 'Centimetre', 'length', 'M', 0.01, TRUE, FALSE),
  ('PC', 'Piece', 'count', 'PC', 1.0, TRUE, TRUE),
  ('DZ', 'Dozen', 'count', 'PC', 12.0, TRUE, FALSE),
  ('HR', 'Hour', 'time', 'HR', 1.0, TRUE, TRUE),
  ('DAY', 'Day', 'time', 'HR', 8.0, TRUE, FALSE)
ON CONFLICT (unit_code) DO NOTHING;

-- Insert sample warehouse
INSERT INTO public.warehouses (warehouse_code, warehouse_name, warehouse_type, city, state, is_active)
VALUES
  ('WH-001', 'Main Yarn Warehouse', 'Yarn', 'Surat', 'Gujarat', TRUE),
  ('WH-002', 'Beam Storage', 'Beam', 'Surat', 'Gujarat', TRUE),
  ('WH-003', 'Finished Goods', 'Finished Goods', 'Surat', 'Gujarat', TRUE)
ON CONFLICT (warehouse_code) DO NOTHING;

-- Insert sample machines (looms)
INSERT INTO public.machines (machine_code, machine_name, machine_type, process_id, warehouse_id, is_active)
SELECT
  'LOOM-' || LPAD(CAST(ROW_NUMBER() OVER (ORDER BY p.id) AS TEXT), 3, '0'),
  'Loom ' || LPAD(CAST(ROW_NUMBER() OVER (ORDER BY p.id) AS TEXT), 3, '0'),
  'Loom',
  p.id,
  w.id,
  TRUE
FROM (SELECT id FROM public.processes WHERE process_code LIKE 'PROC-%' LIMIT 5) p
CROSS JOIN (SELECT id FROM public.warehouses WHERE warehouse_code = 'WH-001' LIMIT 1) w
ON CONFLICT (machine_code) DO NOTHING;

-- Insert sample colors
INSERT INTO public.colors (color_code, color_name, color_hex, color_type, is_active)
VALUES
  ('COL-001', 'Red', '#FF0000', 'Dye', TRUE),
  ('COL-002', 'Blue', '#0000FF', 'Dye', TRUE),
  ('COL-003', 'Green', '#00FF00', 'Dye', TRUE),
  ('COL-004', 'White', '#FFFFFF', 'General', TRUE),
  ('COL-005', 'Black', '#000000', 'General', TRUE)
ON CONFLICT (color_code) DO NOTHING;

-- ============================================================================
-- GRANTS: Ensure proper role permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_sub_parties TO authenticated;
GRANT ALL ON public.party_sub_parties TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processes TO authenticated;
GRANT ALL ON public.processes TO service_role;
GRANT SELECT, INSERT ON public.process_rate_history TO authenticated;
GRANT ALL ON public.process_rate_history TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT ALL ON public.machines TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.colors TO authenticated;
GRANT ALL ON public.colors TO service_role;

