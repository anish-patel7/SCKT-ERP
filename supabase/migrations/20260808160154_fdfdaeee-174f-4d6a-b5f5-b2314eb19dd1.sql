CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TYPE public.app_role AS ENUM ('admin','manager','costing','viewer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'costing') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  composition text,
  denier numeric(12,4),
  rate_per_kg numeric(19,6) NOT NULL DEFAULT 0,
  uom text NOT NULL DEFAULT 'KG',
  active boolean NOT NULL DEFAULT true,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_read" ON public.materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "materials_insert" ON public.materials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "materials_update" ON public.materials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "materials_delete" ON public.materials FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER materials_updated BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.material_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  rate_per_kg numeric(19,6) NOT NULL,
  effective_from date NOT NULL DEFAULT current_date,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.material_rate_history TO authenticated;
GRANT ALL ON public.material_rate_history TO service_role;
ALTER TABLE public.material_rate_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mrh_read" ON public.material_rate_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "mrh_insert" ON public.material_rate_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.masters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_type text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (master_type, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.masters TO authenticated;
GRANT ALL ON public.masters TO service_role;
ALTER TABLE public.masters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "masters_read" ON public.masters FOR SELECT TO authenticated USING (true);
CREATE POLICY "masters_insert" ON public.masters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "masters_update" ON public.masters FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "masters_delete" ON public.masters FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER masters_updated BEFORE UPDATE ON public.masters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cost_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_no text NOT NULL UNIQUE,
  design_no text,
  party_id uuid REFERENCES public.masters(id),
  party_name text,
  quality text,
  reed numeric(12,4),
  pick numeric(12,4),
  panna_inch numeric(10,4),
  length_metre numeric(14,4),
  wastage_pct numeric(7,4) NOT NULL DEFAULT 10,
  card_rate numeric(19,6) NOT NULL DEFAULT 0,
  number_of_cards numeric(19,6) NOT NULL DEFAULT 0,
  kg_divisor numeric(19,6) NOT NULL DEFAULT 9000000,
  card_divisor numeric(19,6) NOT NULL DEFAULT 39.37,
  warp_cost numeric(19,6) NOT NULL DEFAULT 0,
  weft_cost numeric(19,6) NOT NULL DEFAULT 0,
  total_kg numeric(19,6) NOT NULL DEFAULT 0,
  wastage_cost numeric(19,6) NOT NULL DEFAULT 0,
  process_cost numeric(19,6) NOT NULL DEFAULT 0,
  card_cost numeric(19,6) NOT NULL DEFAULT 0,
  final_cost numeric(19,6) NOT NULL DEFAULT 0,
  sale_rate numeric(19,6) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  remarks text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_sheets TO authenticated;
GRANT ALL ON public.cost_sheets TO service_role;
ALTER TABLE public.cost_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_read" ON public.cost_sheets FOR SELECT TO authenticated USING (true);
CREATE POLICY "cs_insert" ON public.cost_sheets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cs_update" ON public.cost_sheets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cs_delete" ON public.cost_sheets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER cost_sheets_updated BEFORE UPDATE ON public.cost_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cost_sheet_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.cost_sheets(id) ON DELETE CASCADE,
  section text NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  label text,
  material_id uuid REFERENCES public.materials(id),
  yarn_name text,
  quantity numeric(12,4) NOT NULL DEFAULT 0,
  denier numeric(12,4) NOT NULL DEFAULT 0,
  length_metre numeric(14,4) NOT NULL DEFAULT 0,
  panna_inch numeric(10,4) NOT NULL DEFAULT 0,
  rate_per_kg numeric(19,6) NOT NULL DEFAULT 0,
  calculated_kg numeric(19,6) NOT NULL DEFAULT 0,
  cost numeric(19,6) NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_sheet_lines TO authenticated;
GRANT ALL ON public.cost_sheet_lines TO service_role;
ALTER TABLE public.cost_sheet_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csl_read" ON public.cost_sheet_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "csl_write" ON public.cost_sheet_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.cost_sheet_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.cost_sheets(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 1,
  charge_name text NOT NULL,
  rate numeric(19,6) NOT NULL DEFAULT 0,
  quantity numeric(19,6) NOT NULL DEFAULT 0,
  amount numeric(19,6) NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_sheet_charges TO authenticated;
GRANT ALL ON public.cost_sheet_charges TO service_role;
ALTER TABLE public.cost_sheet_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csc_read" ON public.cost_sheet_charges FOR SELECT TO authenticated USING (true);
CREATE POLICY "csc_write" ON public.cost_sheet_charges FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id text,
  action text NOT NULL,
  details text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO public.materials (code, name, composition, denier, rate_per_kg) VALUES
 ('PV150','PV 150/48','100% Polyester Viscose',150,132.500000),
 ('POY300','POY 300/96','100% Polyester',300,118.000000),
 ('VIS30','Viscose 30s','100% Viscose',180,205.000000),
 ('COT40','Cotton 40s Combed','100% Cotton',148,268.750000),
 ('LUR01','Lurex Gold','Metallic',120,410.000000);

INSERT INTO public.masters (master_type, code, name, description, attributes) VALUES
 ('party','P001','Shree Fabrics Pvt Ltd','Surat','{"gst":"24AABCS1429B1Z1","city":"Surat"}'),
 ('party','P002','Meridian Textiles','Mumbai','{"city":"Mumbai"}'),
 ('jobwork_party','JW01','Ganesh Processors','Dyeing & finishing','{}'),
 ('item','IT01','Grey Fabric','Base grey roll','{}'),
 ('beam','BM01','Beam 1200','1200 ends beam','{"ends":1200}'),
 ('loom','LM01','Jacquard 01','Jacquard 4400 hooks','{"type":"Jacquard","hooks":4400}'),
 ('loom','LM02','Rapier 07','Rapier 190cm','{"type":"Rapier"}'),
 ('broker','BR01','A. K. Brokers','2% commission','{"commission_pct":2}'),
 ('salesman','SM01','Rakesh Patel','West zone','{}'),
 ('beam_colour','BC5831','Colour 5831','Feeder colour 5831','{"hex":"#8a4b2a"}'),
 ('process','PR01','Butta','Butta work','{}'),
 ('process','PR02','RFD','Ready for dyeing','{}');