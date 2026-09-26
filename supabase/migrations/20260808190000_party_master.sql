-- Party Master Database Migration (M18 - Party Master)
CREATE TABLE IF NOT EXISTS public.parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_code TEXT UNIQUE NOT NULL,
  party_name TEXT NOT NULL,
  office_name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  area TEXT,
  city TEXT NOT NULL,
  district TEXT,
  state TEXT NOT NULL,
  pin_code TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  contact_person TEXT,
  designation TEXT,
  mobile TEXT,
  alternate_mobile TEXT,
  email TEXT,
  whatsapp_number TEXT,
  gstin TEXT,
  pan TEXT,
  job_work_applicable TEXT DEFAULT 'Yes',
  job_work_remarks TEXT,
  remarks TEXT,
  status TEXT DEFAULT 'Active',
  transaction_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users"
ON public.parties FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON public.parties FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
ON public.parties FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete access for authenticated users"
ON public.parties FOR DELETE
TO authenticated
USING (true);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_parties_code ON public.parties(party_code);
CREATE INDEX IF NOT EXISTS idx_parties_name ON public.parties(party_name);
CREATE INDEX IF NOT EXISTS idx_parties_city ON public.parties(city);
CREATE INDEX IF NOT EXISTS idx_parties_status ON public.parties(status);
