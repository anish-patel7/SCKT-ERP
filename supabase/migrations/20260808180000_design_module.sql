-- Create designs table
CREATE TABLE IF NOT EXISTS public.designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_number text NOT NULL UNIQUE,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create beam_colours table
CREATE TABLE IF NOT EXISTS public.beam_colours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  beam_colour text NOT NULL,
  display_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create feeders table
CREATE TABLE IF NOT EXISTS public.feeders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beam_colour_id uuid NOT NULL REFERENCES public.beam_colours(id) ON DELETE CASCADE,
  color_name text NOT NULL,
  old_number text,
  display_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beam_colours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeders ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beam_colours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feeders TO authenticated;
GRANT ALL ON public.designs TO service_role;
GRANT ALL ON public.beam_colours TO service_role;
GRANT ALL ON public.feeders TO service_role;

-- Policies
CREATE POLICY "designs_select" ON public.designs FOR SELECT TO authenticated USING (true);
CREATE POLICY "designs_all" ON public.designs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "beam_colours_select" ON public.beam_colours FOR SELECT TO authenticated USING (true);
CREATE POLICY "beam_colours_all" ON public.beam_colours FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "feeders_select" ON public.feeders FOR SELECT TO authenticated USING (true);
CREATE POLICY "feeders_all" ON public.feeders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_designs_number ON public.designs(design_number);
CREATE INDEX IF NOT EXISTS idx_beam_colours_design ON public.beam_colours(design_id);
CREATE INDEX IF NOT EXISTS idx_feeders_beam ON public.feeders(beam_colour_id);
CREATE INDEX IF NOT EXISTS idx_feeders_color ON public.feeders(color_name);
CREATE INDEX IF NOT EXISTS idx_feeders_old_num ON public.feeders(old_number);
