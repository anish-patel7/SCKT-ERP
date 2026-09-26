-- STEP 14 Phase 3: Warehouse Location Management
-- Create warehouse_zones and warehouse_locations tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create warehouse_zones table
CREATE TABLE IF NOT EXISTS public.warehouse_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color_code VARCHAR(7) DEFAULT '#6366F1',  -- Indigo default
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150),
  CONSTRAINT warehouse_zones_name_not_empty CHECK (length(name) > 0),
  CONSTRAINT warehouse_zones_color_code_valid CHECK (color_code ~ '^#[0-9A-Fa-f]{6}$')
);

-- Create warehouse_locations table
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  zone_id UUID NOT NULL REFERENCES public.warehouse_zones(id) ON DELETE CASCADE,
  capacity_kg DECIMAL(14, 4) DEFAULT 0,
  capacity_metres DECIMAL(14, 4) DEFAULT 0,
  current_qty_kg DECIMAL(14, 4) DEFAULT 0,
  current_qty_metres DECIMAL(14, 4) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  coordinates JSONB DEFAULT '{"x": 0, "y": 0}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(150),
  updated_by VARCHAR(150),
  CONSTRAINT warehouse_locations_code_not_empty CHECK (length(code) > 0),
  CONSTRAINT warehouse_locations_name_not_empty CHECK (length(name) > 0),
  CONSTRAINT warehouse_locations_coordinates_valid CHECK (
    coordinates->>'x' IS NOT NULL AND
    coordinates->>'y' IS NOT NULL
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_warehouse_zones_is_active
  ON public.warehouse_zones(is_active);

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_code
  ON public.warehouse_locations(code);

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_zone_id
  ON public.warehouse_locations(zone_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_is_active
  ON public.warehouse_locations(is_active);

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_capacity_check
  ON public.warehouse_locations(capacity_kg, current_qty_kg);

-- Enable RLS
ALTER TABLE public.warehouse_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for warehouse_zones
CREATE POLICY "zones_admin_full_access" ON public.warehouse_zones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id = 'admin'
    )
  );

CREATE POLICY "zones_read_all" ON public.warehouse_zones FOR SELECT
  USING (is_active = TRUE);

-- RLS Policies for warehouse_locations
CREATE POLICY "locations_admin_full_access" ON public.warehouse_locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.primary_role_id = 'admin'
    )
  );

CREATE POLICY "locations_read_all" ON public.warehouse_locations FOR SELECT
  USING (is_active = TRUE);

-- Insert seed data: Warehouse zones
INSERT INTO public.warehouse_zones (name, description, color_code) VALUES
  ('Yarn Storage', 'Primary yarn storage area', '#EC4899'),
  ('Beam Racks', 'Warp beam storage and staging', '#3B82F6'),
  ('Fabric Bays', 'Finished fabric inventory', '#10B981')
ON CONFLICT (name) DO NOTHING;

-- Insert seed data: Warehouse locations (8 locations total)
WITH zones AS (
  SELECT id, name FROM public.warehouse_zones WHERE is_active = TRUE
)
INSERT INTO public.warehouse_locations (code, name, zone_id, capacity_kg, capacity_metres, coordinates)
SELECT
  loc.code,
  loc.name,
  z.id,
  loc.capacity_kg,
  loc.capacity_metres,
  loc.coordinates::jsonb
FROM (
  VALUES
    -- Yarn Storage (6 bins)
    ('BIN-A-01', 'Yarn Bin A-01', 'Yarn Storage', 1000, NULL, '{"x": 50, "y": 150}'::jsonb),
    ('BIN-A-02', 'Yarn Bin A-02', 'Yarn Storage', 1000, NULL, '{"x": 150, "y": 150}'::jsonb),
    ('BIN-B-01', 'Yarn Bin B-01', 'Yarn Storage', 1000, NULL, '{"x": 250, "y": 150}'::jsonb),
    ('BIN-B-02', 'Yarn Bin B-02', 'Yarn Storage', 1000, NULL, '{"x": 350, "y": 150}'::jsonb),
    ('BIN-C-01', 'Yarn Bin C-01', 'Yarn Storage', 1000, NULL, '{"x": 450, "y": 150}'::jsonb),
    ('BIN-C-02', 'Yarn Bin C-02', 'Yarn Storage', 1000, NULL, '{"x": 550, "y": 150}'::jsonb),
    -- Beam Racks (1 rack)
    ('RACK-01', 'Beam Rack 01', 'Beam Racks', NULL, 5000, '{"x": 100, "y": 300}'::jsonb),
    -- Fabric Bays (1 bay)
    ('BAY-01', 'Fabric Bay 01', 'Fabric Bays', NULL, 2000, '{"x": 300, "y": 300}'::jsonb)
) AS loc(code, name, zone_name, capacity_kg, capacity_metres, coordinates)
JOIN zones z ON z.name = loc.zone_name
ON CONFLICT (code) DO NOTHING;
