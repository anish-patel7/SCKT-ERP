export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgresVersion: "14.15";
  };
  public: {
    Tables: {
      profiles: {
                Row: {
                  id: string | null;
                  full_name: string | null;
                  email: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  first_name: string | null;
                  last_name: string | null;
                  display_name: string | null;
                  mobile: string | null;
                  employee_id: string | null;
                  department: string | null;
                  designation: string | null;
                  primary_role_id: string | null;
                  additional_role_ids: string | null;
                  status: string | null;
                  last_login: string | null;
                  failed_login_attempts: number | null;
                  is_locked: boolean | null;
                  approval_status: string | null;
                  creation_method: string | null;
                  approved_by: string | null;
                  approved_at: string | null;
                  require_password_change: boolean | null;
                };
                Insert: {
                  id?: string | null;
                  full_name?: string | null;
                  email?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  first_name?: string | null;
                  last_name?: string | null;
                  display_name?: string | null;
                  mobile?: string | null;
                  employee_id?: string | null;
                  department?: string | null;
                  designation?: string | null;
                  primary_role_id?: string | null;
                  additional_role_ids?: string | null;
                  status?: string | null;
                  last_login?: string | null;
                  failed_login_attempts?: number | null;
                  is_locked?: boolean | null;
                  approval_status?: string | null;
                  creation_method?: string | null;
                  approved_by?: string | null;
                  approved_at?: string | null;
                  require_password_change?: boolean | null;
                };
                Update: {
                  id?: string | null;
                  full_name?: string | null;
                  email?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  first_name?: string | null;
                  last_name?: string | null;
                  display_name?: string | null;
                  mobile?: string | null;
                  employee_id?: string | null;
                  department?: string | null;
                  designation?: string | null;
                  primary_role_id?: string | null;
                  additional_role_ids?: string | null;
                  status?: string | null;
                  last_login?: string | null;
                  failed_login_attempts?: number | null;
                  is_locked?: boolean | null;
                  approval_status?: string | null;
                  creation_method?: string | null;
                  approved_by?: string | null;
                  approved_at?: string | null;
                  require_password_change?: boolean | null;
                };
                Relationships: [
                ];
      };
      user_roles: {
                Row: {
                  id: string;
                  user_id: string;
                  role: Database["public"]["Enums"]["app_role"];
                  created_at: string;
                };
                Insert: {
                  id?: string;
                  user_id: string;
                  role: Database["public"]["Enums"]["app_role"];
                  created_at?: string;
                };
                Update: {
                  id?: string;
                  user_id?: string;
                  role?: Database["public"]["Enums"]["app_role"];
                  created_at?: string;
                };
                Relationships: [
                ];
      };
      materials: {
                Row: {
                  id: string;
                  code: string;
                  name: string;
                  composition: string | null;
                  denier: number | null;
                  rate_per_kg: number | null;
                  uom: string;
                  active: boolean;
                  remarks: string | null;
                  created_at: string;
                  updated_at: string;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  code: string;
                  name: string;
                  composition?: string | null;
                  denier?: number | null;
                  rate_per_kg?: number | null;
                  uom?: string;
                  active?: boolean;
                  remarks?: string | null;
                  created_at?: string;
                  updated_at?: string;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  code?: string;
                  name?: string;
                  composition?: string | null;
                  denier?: number | null;
                  rate_per_kg?: number | null;
                  uom?: string;
                  active?: boolean;
                  remarks?: string | null;
                  created_at?: string;
                  updated_at?: string;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      material_rate_history: {
                Row: {
                  id: string;
                  material_id: string;
                  rate_per_kg: number | null;
                  effective_from: string;
                  note: string | null;
                  created_by: string | null;
                  created_at: string;
                };
                Insert: {
                  id?: string;
                  material_id: string;
                  rate_per_kg?: number | null;
                  effective_from?: string;
                  note?: string | null;
                  created_by?: string | null;
                  created_at?: string;
                };
                Update: {
                  id?: string;
                  material_id?: string;
                  rate_per_kg?: number | null;
                  effective_from?: string;
                  note?: string | null;
                  created_by?: string | null;
                  created_at?: string;
                };
                Relationships: [
                  {
                    foreignKeyName: "material_rate_history_material_id_fkey";
                    columns: ["material_id"];
                    isOneToOne: false;
                    referencedRelation: "materials";
                    referencedColumns: ["id"];
                  },
                ];
      };
      masters: {
                Row: {
                  id: string;
                  master_type: string;
                  code: string;
                  name: string;
                  description: string | null;
                  attributes: Json;
                  active: boolean;
                  created_at: string;
                  updated_at: string;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  master_type: string;
                  code: string;
                  name: string;
                  description?: string | null;
                  attributes?: Json;
                  active?: boolean;
                  created_at?: string;
                  updated_at?: string;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  master_type?: string;
                  code?: string;
                  name?: string;
                  description?: string | null;
                  attributes?: Json;
                  active?: boolean;
                  created_at?: string;
                  updated_at?: string;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      cost_sheets: {
                Row: {
                  id: string;
                  sheet_no: string;
                  design_no: string | null;
                  party_id: string | null;
                  party_name: string | null;
                  quality: string | null;
                  reed: number | null;
                  pick: number | null;
                  panna_inch: number | null;
                  length_metre: number | null;
                  wastage_pct: number | null;
                  card_rate: number | null;
                  number_of_cards: number | null;
                  kg_divisor: number | null;
                  card_divisor: number | null;
                  markup_pct: number | null;
                  manual_sale_rate: number | null;
                  unit_basis: string;
                  status: string | null;
                  version: number | null;
                  remarks: string | null;
                  costing_date: string | null;
                  prepared_by: string | null;
                  total_warp_kg: number | null;
                  total_weft_kg: number | null;
                  total_kg: number | null;
                  warp_cost: number | null;
                  weft_cost: number | null;
                  base_material_cost: number | null;
                  wastage_cost: number | null;
                  material_with_wastage: number | null;
                  process_cost: number | null;
                  card_cost: number | null;
                  final_cost: number | null;
                  sale_rate: number | null;
                  created_by: string | null;
                  created_at: string | null;
                  updated_by: string | null;
                  updated_at: string | null;
                  approved_by: string | null;
                  approved_at: string | null;
                };
                Insert: {
                  id?: string;
                  sheet_no: string;
                  design_no?: string | null;
                  party_id?: string | null;
                  party_name?: string | null;
                  quality?: string | null;
                  reed?: number | null;
                  pick?: number | null;
                  panna_inch?: number | null;
                  length_metre?: number | null;
                  wastage_pct?: number | null;
                  card_rate?: number | null;
                  number_of_cards?: number | null;
                  kg_divisor?: number | null;
                  card_divisor?: number | null;
                  markup_pct?: number | null;
                  manual_sale_rate?: number | null;
                  unit_basis: string;
                  status?: string | null;
                  version?: number | null;
                  remarks?: string | null;
                  costing_date?: string | null;
                  prepared_by?: string | null;
                  total_warp_kg?: number | null;
                  total_weft_kg?: number | null;
                  total_kg?: number | null;
                  warp_cost?: number | null;
                  weft_cost?: number | null;
                  base_material_cost?: number | null;
                  wastage_cost?: number | null;
                  material_with_wastage?: number | null;
                  process_cost?: number | null;
                  card_cost?: number | null;
                  final_cost?: number | null;
                  sale_rate?: number | null;
                  created_by?: string | null;
                  created_at?: string | null;
                  updated_by?: string | null;
                  updated_at?: string | null;
                  approved_by?: string | null;
                  approved_at?: string | null;
                };
                Update: {
                  id?: string;
                  sheet_no?: string;
                  design_no?: string | null;
                  party_id?: string | null;
                  party_name?: string | null;
                  quality?: string | null;
                  reed?: number | null;
                  pick?: number | null;
                  panna_inch?: number | null;
                  length_metre?: number | null;
                  wastage_pct?: number | null;
                  card_rate?: number | null;
                  number_of_cards?: number | null;
                  kg_divisor?: number | null;
                  card_divisor?: number | null;
                  markup_pct?: number | null;
                  manual_sale_rate?: number | null;
                  unit_basis?: string;
                  status?: string | null;
                  version?: number | null;
                  remarks?: string | null;
                  costing_date?: string | null;
                  prepared_by?: string | null;
                  total_warp_kg?: number | null;
                  total_weft_kg?: number | null;
                  total_kg?: number | null;
                  warp_cost?: number | null;
                  weft_cost?: number | null;
                  base_material_cost?: number | null;
                  wastage_cost?: number | null;
                  material_with_wastage?: number | null;
                  process_cost?: number | null;
                  card_cost?: number | null;
                  final_cost?: number | null;
                  sale_rate?: number | null;
                  created_by?: string | null;
                  created_at?: string | null;
                  updated_by?: string | null;
                  updated_at?: string | null;
                  approved_by?: string | null;
                  approved_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "cost_sheets_design_no_fkey";
                    columns: ["design_no"];
                    isOneToOne: false;
                    referencedRelation: "designs";
                    referencedColumns: ["design_number"];
                  },
                  {
                    foreignKeyName: "cost_sheets_party_id_fkey";
                    columns: ["party_id"];
                    isOneToOne: false;
                    referencedRelation: "parties";
                    referencedColumns: ["id"];
                  },
                ];
      };
      cost_sheet_lines: {
                Row: {
                  id: string;
                  cost_sheet_id: string;
                  section: string;
                  label: string | null;
                  sequence: number | null;
                  material_id: string | null;
                  yarn_name: string | null;
                  quantity: number | null;
                  denier: number | null;
                  length_metre: number | null;
                  panna_inch: number | null;
                  rate_per_kg: number | null;
                  created_at: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  cost_sheet_id: string;
                  section: string;
                  label?: string | null;
                  sequence?: number | null;
                  material_id?: string | null;
                  yarn_name?: string | null;
                  quantity?: number | null;
                  denier?: number | null;
                  length_metre?: number | null;
                  panna_inch?: number | null;
                  rate_per_kg?: number | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  cost_sheet_id?: string;
                  section?: string;
                  label?: string | null;
                  sequence?: number | null;
                  material_id?: string | null;
                  yarn_name?: string | null;
                  quantity?: number | null;
                  denier?: number | null;
                  length_metre?: number | null;
                  panna_inch?: number | null;
                  rate_per_kg?: number | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "cost_sheet_lines_cost_sheet_id_fkey";
                    columns: ["cost_sheet_id"];
                    isOneToOne: false;
                    referencedRelation: "cost_sheets";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "cost_sheet_lines_material_id_fkey";
                    columns: ["material_id"];
                    isOneToOne: false;
                    referencedRelation: "materials";
                    referencedColumns: ["id"];
                  },
                ];
      };
      cost_sheet_charges: {
                Row: {
                  id: string;
                  cost_sheet_id: string;
                  charge_name: string | null;
                  rate: number | null;
                  quantity: number | null;
                  sequence: number | null;
                  created_at: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  cost_sheet_id: string;
                  charge_name?: string | null;
                  rate?: number | null;
                  quantity?: number | null;
                  sequence?: number | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  cost_sheet_id?: string;
                  charge_name?: string | null;
                  rate?: number | null;
                  quantity?: number | null;
                  sequence?: number | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "cost_sheet_charges_cost_sheet_id_fkey";
                    columns: ["cost_sheet_id"];
                    isOneToOne: false;
                    referencedRelation: "cost_sheets";
                    referencedColumns: ["id"];
                  },
                ];
      };
      audit_log: {
                Row: {
                  id: string;
                  entity: string;
                  entity_id: string | null;
                  action: string;
                  details: string | null;
                  actor_id: string | null;
                  actor_name: string | null;
                  created_at: string;
                };
                Insert: {
                  id?: string;
                  entity: string;
                  entity_id?: string | null;
                  action: string;
                  details?: string | null;
                  actor_id?: string | null;
                  actor_name?: string | null;
                  created_at?: string;
                };
                Update: {
                  id?: string;
                  entity?: string;
                  entity_id?: string | null;
                  action?: string;
                  details?: string | null;
                  actor_id?: string | null;
                  actor_name?: string | null;
                  created_at?: string;
                };
                Relationships: [
                ];
      };
      designs: {
                Row: {
                  id: string;
                  design_number: string;
                  design_name: string | null;
                  dn: string | null;
                  dn_code: string | null;
                  reed: number | null;
                  pick: number | null;
                  cards: number | null;
                  patti: number | null;
                  total_dc: number | null;
                  total_cut: number | null;
                  work: string | null;
                  blue_apt: string | null;
                  description: string | null;
                  remarks: string | null;
                  image: string | null;
                  created_at: string;
                  updated_at: string;
                  created_by: string | null;
                  updated_by: string | null;
                  archived_at: string | null;
                };
                Insert: {
                  id?: string;
                  design_number: string;
                  design_name?: string | null;
                  dn?: string | null;
                  dn_code?: string | null;
                  reed?: number | null;
                  pick?: number | null;
                  cards?: number | null;
                  patti?: number | null;
                  total_dc?: number | null;
                  total_cut?: number | null;
                  work?: string | null;
                  blue_apt?: string | null;
                  description?: string | null;
                  remarks?: string | null;
                  image?: string | null;
                  created_at?: string;
                  updated_at?: string;
                  created_by?: string | null;
                  updated_by?: string | null;
                  archived_at?: string | null;
                };
                Update: {
                  id?: string;
                  design_number?: string;
                  design_name?: string | null;
                  dn?: string | null;
                  dn_code?: string | null;
                  reed?: number | null;
                  pick?: number | null;
                  cards?: number | null;
                  patti?: number | null;
                  total_dc?: number | null;
                  total_cut?: number | null;
                  work?: string | null;
                  blue_apt?: string | null;
                  description?: string | null;
                  remarks?: string | null;
                  image?: string | null;
                  created_at?: string;
                  updated_at?: string;
                  created_by?: string | null;
                  updated_by?: string | null;
                  archived_at?: string | null;
                };
                Relationships: [
                ];
      };
      beam_colours: {
                Row: {
                  id: string;
                  design_id: string;
                  beam_colour: string;
                  display_order: number;
                  created_at: string;
                  updated_at: string;
                };
                Insert: {
                  id?: string;
                  design_id: string;
                  beam_colour: string;
                  display_order?: number;
                  created_at?: string;
                  updated_at?: string;
                };
                Update: {
                  id?: string;
                  design_id?: string;
                  beam_colour?: string;
                  display_order?: number;
                  created_at?: string;
                  updated_at?: string;
                };
                Relationships: [
                  {
                    foreignKeyName: "beam_colours_design_id_fkey";
                    columns: ["design_id"];
                    isOneToOne: false;
                    referencedRelation: "designs";
                    referencedColumns: ["id"];
                  },
                ];
      };
      feeders: {
                Row: {
                  id: string;
                  beam_colour_id: string;
                  color_name: string;
                  old_number: string | null;
                  display_order: number;
                  created_at: string;
                  updated_at: string;
                  feeder_number: string | null;
                  pick: number | null;
                  card: number | null;
                };
                Insert: {
                  id?: string;
                  beam_colour_id: string;
                  color_name: string;
                  old_number?: string | null;
                  display_order?: number;
                  created_at?: string;
                  updated_at?: string;
                  feeder_number?: string | null;
                  pick?: number | null;
                  card?: number | null;
                };
                Update: {
                  id?: string;
                  beam_colour_id?: string;
                  color_name?: string;
                  old_number?: string | null;
                  display_order?: number;
                  created_at?: string;
                  updated_at?: string;
                  feeder_number?: string | null;
                  pick?: number | null;
                  card?: number | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "feeders_beam_colour_id_fkey";
                    columns: ["beam_colour_id"];
                    isOneToOne: false;
                    referencedRelation: "beam_colours";
                    referencedColumns: ["id"];
                  },
                ];
      };
      parties: {
                Row: {
                  id: string;
                  party_code: string;
                  party_name: string;
                  office_name: string;
                  address_line1: string;
                  address_line2: string | null;
                  area: string | null;
                  city: string;
                  district: string | null;
                  state: string;
                  pin_code: string;
                  country: string | null;
                  contact_person: string | null;
                  designation: string | null;
                  mobile: string | null;
                  alternate_mobile: string | null;
                  email: string | null;
                  whatsapp_number: string | null;
                  gstin: string | null;
                  pan: string | null;
                  job_work_applicable: string | null;
                  job_work_remarks: string | null;
                  remarks: string | null;
                  status: string | null;
                  transaction_count: number | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                  party_type: string;
                };
                Insert: {
                  id?: string;
                  party_code: string;
                  party_name: string;
                  office_name: string;
                  address_line1: string;
                  address_line2?: string | null;
                  area?: string | null;
                  city: string;
                  district?: string | null;
                  state: string;
                  pin_code: string;
                  country?: string | null;
                  contact_person?: string | null;
                  designation?: string | null;
                  mobile?: string | null;
                  alternate_mobile?: string | null;
                  email?: string | null;
                  whatsapp_number?: string | null;
                  gstin?: string | null;
                  pan?: string | null;
                  job_work_applicable?: string | null;
                  job_work_remarks?: string | null;
                  remarks?: string | null;
                  status?: string | null;
                  transaction_count?: number | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                  party_type: string;
                };
                Update: {
                  id?: string;
                  party_code?: string;
                  party_name?: string;
                  office_name?: string;
                  address_line1?: string;
                  address_line2?: string | null;
                  area?: string | null;
                  city?: string;
                  district?: string | null;
                  state?: string;
                  pin_code?: string;
                  country?: string | null;
                  contact_person?: string | null;
                  designation?: string | null;
                  mobile?: string | null;
                  alternate_mobile?: string | null;
                  email?: string | null;
                  whatsapp_number?: string | null;
                  gstin?: string | null;
                  pan?: string | null;
                  job_work_applicable?: string | null;
                  job_work_remarks?: string | null;
                  remarks?: string | null;
                  status?: string | null;
                  transaction_count?: number | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                  party_type?: string;
                };
                Relationships: [
                ];
      };
      inventory_items: {
                Row: {
                  id: string;
                  item_type: string;
                  item_code: string;
                  item_name: string;
                  lot_no: string | null;
                  grn_no: string | null;
                  yarn_code: string | null;
                  supplier_id: string | null;
                  beam_no: string | null;
                  set_no: string | null;
                  warp_design_no: string | null;
                  piece_no: string | null;
                  design_no: string | null;
                  job_card_no: string | null;
                  total_qty: number | null;
                  total_unit: string;
                  reserved_qty: number | null;
                  available_qty: number | null;
                  rate_per_unit: number | null;
                  cost_basis: number | null;
                  current_location: string | null;
                  current_status: string | null;
                  is_active: boolean | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  item_type: string;
                  item_code: string;
                  item_name: string;
                  lot_no?: string | null;
                  grn_no?: string | null;
                  yarn_code?: string | null;
                  supplier_id?: string | null;
                  beam_no?: string | null;
                  set_no?: string | null;
                  warp_design_no?: string | null;
                  piece_no?: string | null;
                  design_no?: string | null;
                  job_card_no?: string | null;
                  total_qty?: number | null;
                  total_unit: string;
                  reserved_qty?: number | null;
                  available_qty?: number | null;
                  rate_per_unit?: number | null;
                  cost_basis?: number | null;
                  current_location?: string | null;
                  current_status?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  item_type?: string;
                  item_code?: string;
                  item_name?: string;
                  lot_no?: string | null;
                  grn_no?: string | null;
                  yarn_code?: string | null;
                  supplier_id?: string | null;
                  beam_no?: string | null;
                  set_no?: string | null;
                  warp_design_no?: string | null;
                  piece_no?: string | null;
                  design_no?: string | null;
                  job_card_no?: string | null;
                  total_qty?: number | null;
                  total_unit?: string;
                  reserved_qty?: number | null;
                  available_qty?: number | null;
                  rate_per_unit?: number | null;
                  cost_basis?: number | null;
                  current_location?: string | null;
                  current_status?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "inventory_items_supplier_id_fkey";
                    columns: ["supplier_id"];
                    isOneToOne: false;
                    referencedRelation: "parties";
                    referencedColumns: ["id"];
                  },
                ];
      };
      inventory_transactions: {
                Row: {
                  id: string;
                  transaction_date: string;
                  movement_type: string;
                  reference_doc: string | null;
                  item_id: string;
                  qty_change: number | null;
                  unit: string;
                  location_from: string | null;
                  location_to: string | null;
                  rate_per_unit: number | null;
                  cost_value: number | null;
                  reserved_qty_delta: number | null;
                  approval_required: boolean | null;
                  approved_by: string | null;
                  approved_at: string | null;
                  created_at: string | null;
                  created_by: string;
                  remarks: string | null;
                };
                Insert: {
                  id?: string;
                  transaction_date: string;
                  movement_type: string;
                  reference_doc?: string | null;
                  item_id: string;
                  qty_change?: number | null;
                  unit: string;
                  location_from?: string | null;
                  location_to?: string | null;
                  rate_per_unit?: number | null;
                  cost_value?: number | null;
                  reserved_qty_delta?: number | null;
                  approval_required?: boolean | null;
                  approved_by?: string | null;
                  approved_at?: string | null;
                  created_at?: string | null;
                  created_by: string;
                  remarks?: string | null;
                };
                Update: {
                  id?: string;
                  transaction_date?: string;
                  movement_type?: string;
                  reference_doc?: string | null;
                  item_id?: string;
                  qty_change?: number | null;
                  unit?: string;
                  location_from?: string | null;
                  location_to?: string | null;
                  rate_per_unit?: number | null;
                  cost_value?: number | null;
                  reserved_qty_delta?: number | null;
                  approval_required?: boolean | null;
                  approved_by?: string | null;
                  approved_at?: string | null;
                  created_at?: string | null;
                  created_by?: string;
                  remarks?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "inventory_transactions_item_id_fkey";
                    columns: ["item_id"];
                    isOneToOne: false;
                    referencedRelation: "inventory_items";
                    referencedColumns: ["id"];
                  },
                ];
      };
      inventory_balances_cache: {
                Row: {
                  id: string;
                  item_id: string;
                  total_inward_qty: number | null;
                  total_issued_qty: number | null;
                  net_qty: number | null;
                  total_reserved_qty: number | null;
                  available_qty: number | null;
                  total_cost: number | null;
                  avg_cost_per_unit: number | null;
                  last_transaction_at: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  item_id: string;
                  total_inward_qty?: number | null;
                  total_issued_qty?: number | null;
                  net_qty?: number | null;
                  total_reserved_qty?: number | null;
                  available_qty?: number | null;
                  total_cost?: number | null;
                  avg_cost_per_unit?: number | null;
                  last_transaction_at?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  item_id?: string;
                  total_inward_qty?: number | null;
                  total_issued_qty?: number | null;
                  net_qty?: number | null;
                  total_reserved_qty?: number | null;
                  available_qty?: number | null;
                  total_cost?: number | null;
                  avg_cost_per_unit?: number | null;
                  last_transaction_at?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "inventory_balances_cache_item_id_fkey";
                    columns: ["item_id"];
                    isOneToOne: false;
                    referencedRelation: "inventory_items";
                    referencedColumns: ["id"];
                  },
                ];
      };
      production_orders: {
                Row: {
                  id: string;
                  order_no: string;
                  cost_sheet_id: string | null;
                  design_no: string;
                  party_id: string | null;
                  quality_name: string;
                  qty_metre: number | null;
                  priority: string | null;
                  target_delivery_date: string;
                  status: string | null;
                  remarks: string | null;
                  issued_date: string | null;
                  started_date: string | null;
                  completed_date: string | null;
                  qty_completed_metre: number | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  order_no: string;
                  cost_sheet_id?: string | null;
                  design_no: string;
                  party_id?: string | null;
                  quality_name: string;
                  qty_metre?: number | null;
                  priority?: string | null;
                  target_delivery_date: string;
                  status?: string | null;
                  remarks?: string | null;
                  issued_date?: string | null;
                  started_date?: string | null;
                  completed_date?: string | null;
                  qty_completed_metre?: number | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  order_no?: string;
                  cost_sheet_id?: string | null;
                  design_no?: string;
                  party_id?: string | null;
                  quality_name?: string;
                  qty_metre?: number | null;
                  priority?: string | null;
                  target_delivery_date?: string;
                  status?: string | null;
                  remarks?: string | null;
                  issued_date?: string | null;
                  started_date?: string | null;
                  completed_date?: string | null;
                  qty_completed_metre?: number | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "production_orders_cost_sheet_id_fkey";
                    columns: ["cost_sheet_id"];
                    isOneToOne: false;
                    referencedRelation: "cost_sheets";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "production_orders_party_id_fkey";
                    columns: ["party_id"];
                    isOneToOne: false;
                    referencedRelation: "parties";
                    referencedColumns: ["id"];
                  },
                ];
      };
      looms: {
                Row: {
                  id: string;
                  loom_no: string;
                  loom_type: string;
                  panna_inch: number | null;
                  reed_size: number | null;
                  picks_per_minute: number | null;
                  status: string | null;
                  current_job_card_id: string | null;
                  assigned_operator_id: string | null;
                  is_active: boolean | null;
                  remarks: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  loom_no: string;
                  loom_type: string;
                  panna_inch?: number | null;
                  reed_size?: number | null;
                  picks_per_minute?: number | null;
                  status?: string | null;
                  current_job_card_id?: string | null;
                  assigned_operator_id?: string | null;
                  is_active?: boolean | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  loom_no?: string;
                  loom_type?: string;
                  panna_inch?: number | null;
                  reed_size?: number | null;
                  picks_per_minute?: number | null;
                  status?: string | null;
                  current_job_card_id?: string | null;
                  assigned_operator_id?: string | null;
                  is_active?: boolean | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "looms_current_job_card_id_fkey";
                    columns: ["current_job_card_id"];
                    isOneToOne: false;
                    referencedRelation: "job_cards";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "looms_assigned_operator_id_fkey";
                    columns: ["assigned_operator_id"];
                    isOneToOne: false;
                    referencedRelation: "profiles";
                    referencedColumns: ["id"];
                  },
                ];
      };
      production_audit_trail: {
                Row: {
                  id: string;
                  order_id: string;
                  action: string;
                  actor_id: string | null;
                  actor_name: string | null;
                  details: Json | null;
                  timestamp: string | null;
                };
                Insert: {
                  id?: string;
                  order_id: string;
                  action: string;
                  actor_id?: string | null;
                  actor_name?: string | null;
                  details?: Json | null;
                  timestamp?: string | null;
                };
                Update: {
                  id?: string;
                  order_id?: string;
                  action?: string;
                  actor_id?: string | null;
                  actor_name?: string | null;
                  details?: Json | null;
                  timestamp?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "production_audit_trail_order_id_fkey";
                    columns: ["order_id"];
                    isOneToOne: false;
                    referencedRelation: "production_orders";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "production_audit_trail_actor_id_fkey";
                    columns: ["actor_id"];
                    isOneToOne: false;
                    referencedRelation: "profiles";
                    referencedColumns: ["id"];
                  },
                ];
      };
      loom_maintenance: {
                Row: {
                  id: string;
                  loom_id: string;
                  maintenance_type: string;
                  scheduled_start: string;
                  scheduled_end: string;
                  actual_start: string | null;
                  actual_end: string | null;
                  status: string | null;
                  description: string | null;
                  spare_parts_used: Json | null;
                  created_at: string | null;
                  created_by: string | null;
                };
                Insert: {
                  id?: string;
                  loom_id: string;
                  maintenance_type: string;
                  scheduled_start: string;
                  scheduled_end: string;
                  actual_start?: string | null;
                  actual_end?: string | null;
                  status?: string | null;
                  description?: string | null;
                  spare_parts_used?: Json | null;
                  created_at?: string | null;
                  created_by?: string | null;
                };
                Update: {
                  id?: string;
                  loom_id?: string;
                  maintenance_type?: string;
                  scheduled_start?: string;
                  scheduled_end?: string;
                  actual_start?: string | null;
                  actual_end?: string | null;
                  status?: string | null;
                  description?: string | null;
                  spare_parts_used?: Json | null;
                  created_at?: string | null;
                  created_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "loom_maintenance_loom_id_fkey";
                    columns: ["loom_id"];
                    isOneToOne: false;
                    referencedRelation: "looms";
                    referencedColumns: ["id"];
                  },
                ];
      };
      job_cards: {
                Row: {
                  id: string;
                  card_no: string;
                  production_order_id: string;
                  sequence_number: number;
                  loom_id: string | null;
                  qty_metre: number | null;
                  status: string | null;
                  issued_date: string | null;
                  started_date: string | null;
                  completed_date: string | null;
                  feeder_notes: string | null;
                  material_requirements: Json | null;
                  remarks: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                  material_issued_at: string | null;
                  material_issued_by: string | null;
                  completed_at: string | null;
                  completed_by: string | null;
                  output_item_id: string | null;
                };
                Insert: {
                  id?: string;
                  card_no: string;
                  production_order_id: string;
                  sequence_number: number;
                  loom_id?: string | null;
                  qty_metre?: number | null;
                  status?: string | null;
                  issued_date?: string | null;
                  started_date?: string | null;
                  completed_date?: string | null;
                  feeder_notes?: string | null;
                  material_requirements?: Json | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                  material_issued_at?: string | null;
                  material_issued_by?: string | null;
                  completed_at?: string | null;
                  completed_by?: string | null;
                  output_item_id?: string | null;
                };
                Update: {
                  id?: string;
                  card_no?: string;
                  production_order_id?: string;
                  sequence_number?: number;
                  loom_id?: string | null;
                  qty_metre?: number | null;
                  status?: string | null;
                  issued_date?: string | null;
                  started_date?: string | null;
                  completed_date?: string | null;
                  feeder_notes?: string | null;
                  material_requirements?: Json | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                  material_issued_at?: string | null;
                  material_issued_by?: string | null;
                  completed_at?: string | null;
                  completed_by?: string | null;
                  output_item_id?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "job_cards_production_order_id_fkey";
                    columns: ["production_order_id"];
                    isOneToOne: false;
                    referencedRelation: "production_orders";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "job_cards_loom_id_fkey";
                    columns: ["loom_id"];
                    isOneToOne: false;
                    referencedRelation: "looms";
                    referencedColumns: ["id"];
                  },
                ];
      };
      daily_production: {
                Row: {
                  id: string;
                  entry_date: string;
                  shift: string;
                  job_card_id: string;
                  loom_id: string;
                  metre_produced: number | null;
                  yarn_kg_used: number | null;
                  downtime_min: number | null;
                  downtime_reason: string | null;
                  quality_grade: string | null;
                  remarks: string | null;
                  created_at: string | null;
                  recorded_by: string;
                };
                Insert: {
                  id?: string;
                  entry_date: string;
                  shift: string;
                  job_card_id: string;
                  loom_id: string;
                  metre_produced?: number | null;
                  yarn_kg_used?: number | null;
                  downtime_min?: number | null;
                  downtime_reason?: string | null;
                  quality_grade?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  recorded_by: string;
                };
                Update: {
                  id?: string;
                  entry_date?: string;
                  shift?: string;
                  job_card_id?: string;
                  loom_id?: string;
                  metre_produced?: number | null;
                  yarn_kg_used?: number | null;
                  downtime_min?: number | null;
                  downtime_reason?: string | null;
                  quality_grade?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  recorded_by?: string;
                };
                Relationships: [
                  {
                    foreignKeyName: "daily_production_job_card_id_fkey";
                    columns: ["job_card_id"];
                    isOneToOne: false;
                    referencedRelation: "job_cards";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "daily_production_loom_id_fkey";
                    columns: ["loom_id"];
                    isOneToOne: false;
                    referencedRelation: "looms";
                    referencedColumns: ["id"];
                  },
                ];
      };
      stock_reservations: {
                Row: {
                  id: string;
                  item_id: string;
                  qty_reserved: number | null;
                  unit: string;
                  reserved_by: string;
                  reservation_date: string | null;
                  approval_status: string | null;
                  approved_by: string | null;
                  approved_at: string | null;
                  rejection_reason: string | null;
                  expires_at: string | null;
                  reference_doc: string | null;
                  remarks: string | null;
                  is_active: boolean | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  item_id: string;
                  qty_reserved?: number | null;
                  unit: string;
                  reserved_by: string;
                  reservation_date?: string | null;
                  approval_status?: string | null;
                  approved_by?: string | null;
                  approved_at?: string | null;
                  rejection_reason?: string | null;
                  expires_at?: string | null;
                  reference_doc?: string | null;
                  remarks?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  item_id?: string;
                  qty_reserved?: number | null;
                  unit?: string;
                  reserved_by?: string;
                  reservation_date?: string | null;
                  approval_status?: string | null;
                  approved_by?: string | null;
                  approved_at?: string | null;
                  rejection_reason?: string | null;
                  expires_at?: string | null;
                  reference_doc?: string | null;
                  remarks?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      quality_inspections: {
                Row: {
                  id: string;
                  transaction_id: string;
                  inspection_date: string | null;
                  inspected_by: string;
                  quality_grade: string;
                  remarks: string | null;
                  defects_found: Json | null;
                  sample_size: number | null;
                  defect_count: number | null;
                  is_active: boolean | null;
                  created_at: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  transaction_id: string;
                  inspection_date?: string | null;
                  inspected_by: string;
                  quality_grade: string;
                  remarks?: string | null;
                  defects_found?: Json | null;
                  sample_size?: number | null;
                  defect_count?: number | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  transaction_id?: string;
                  inspection_date?: string | null;
                  inspected_by?: string;
                  quality_grade?: string;
                  remarks?: string | null;
                  defects_found?: Json | null;
                  sample_size?: number | null;
                  defect_count?: number | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                ];
      };
      approval_workflow: {
                Row: {
                  id: string;
                  transaction_id: string;
                  step_number: number;
                  step_name: string;
                  status: string;
                  assigned_to: string | null;
                  completed_by: string | null;
                  completed_at: string | null;
                  notes: string | null;
                  created_at: string | null;
                };
                Insert: {
                  id?: string;
                  transaction_id: string;
                  step_number: number;
                  step_name: string;
                  status: string;
                  assigned_to?: string | null;
                  completed_by?: string | null;
                  completed_at?: string | null;
                  notes?: string | null;
                  created_at?: string | null;
                };
                Update: {
                  id?: string;
                  transaction_id?: string;
                  step_number?: number;
                  step_name?: string;
                  status?: string;
                  assigned_to?: string | null;
                  completed_by?: string | null;
                  completed_at?: string | null;
                  notes?: string | null;
                  created_at?: string | null;
                };
                Relationships: [
                ];
      };
      production_inspections: {
                Row: {
                  id: string;
                  inspection_no: string;
                  roll_id: string;
                  roll_no: string;
                  item_code: string;
                  design_no: string;
                  loom_no: string;
                  shift: string;
                  operator_name: string | null;
                  roll_length_yd: number | null;
                  roll_width_inch: number | null;
                  defects: Json | null;
                  total_raw_points: number | null;
                  capped_points: number | null;
                  points_per_100_sq_yd: number | null;
                  system_grade: string;
                  manual_grade_override: string | null;
                  override_reason: string | null;
                  status: string;
                  verified_by: string | null;
                  is_active: boolean | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                  job_card_id: string | null;
                  decision_by: string | null;
                  decision_at: string | null;
                };
                Insert: {
                  id?: string;
                  inspection_no: string;
                  roll_id: string;
                  roll_no: string;
                  item_code: string;
                  design_no: string;
                  loom_no: string;
                  shift: string;
                  operator_name?: string | null;
                  roll_length_yd?: number | null;
                  roll_width_inch?: number | null;
                  defects?: Json | null;
                  total_raw_points?: number | null;
                  capped_points?: number | null;
                  points_per_100_sq_yd?: number | null;
                  system_grade: string;
                  manual_grade_override?: string | null;
                  override_reason?: string | null;
                  status?: string;
                  verified_by?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                  job_card_id?: string | null;
                  decision_by?: string | null;
                  decision_at?: string | null;
                };
                Update: {
                  id?: string;
                  inspection_no?: string;
                  roll_id?: string;
                  roll_no?: string;
                  item_code?: string;
                  design_no?: string;
                  loom_no?: string;
                  shift?: string;
                  operator_name?: string | null;
                  roll_length_yd?: number | null;
                  roll_width_inch?: number | null;
                  defects?: Json | null;
                  total_raw_points?: number | null;
                  capped_points?: number | null;
                  points_per_100_sq_yd?: number | null;
                  system_grade?: string;
                  manual_grade_override?: string | null;
                  override_reason?: string | null;
                  status?: string;
                  verified_by?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                  job_card_id?: string | null;
                  decision_by?: string | null;
                  decision_at?: string | null;
                };
                Relationships: [
                ];
      };
      shade_approvals: {
                Row: {
                  id: string;
                  lab_dip_no: string;
                  customer_name: string;
                  design_no: string;
                  shade_name: string;
                  hex_color: string | null;
                  delta_e_value: number | null;
                  status: string;
                  buyer_remarks: string | null;
                  is_active: boolean | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  lab_dip_no: string;
                  customer_name: string;
                  design_no: string;
                  shade_name: string;
                  hex_color?: string | null;
                  delta_e_value?: number | null;
                  status?: string;
                  buyer_remarks?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  lab_dip_no?: string;
                  customer_name?: string;
                  design_no?: string;
                  shade_name?: string;
                  hex_color?: string | null;
                  delta_e_value?: number | null;
                  status?: string;
                  buyer_remarks?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      lab_tests: {
                Row: {
                  id: string;
                  test_no: string;
                  roll_no: string;
                  gsm_actual: number | null;
                  gsm_spec: number | null;
                  tear_strength_warp: number | null;
                  tear_strength_weft: number | null;
                  shrinkage_pct: number | null;
                  status: string;
                  is_active: boolean | null;
                  tested_at: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  test_no: string;
                  roll_no: string;
                  gsm_actual?: number | null;
                  gsm_spec?: number | null;
                  tear_strength_warp?: number | null;
                  tear_strength_weft?: number | null;
                  shrinkage_pct?: number | null;
                  status?: string;
                  is_active?: boolean | null;
                  tested_at?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  test_no?: string;
                  roll_no?: string;
                  gsm_actual?: number | null;
                  gsm_spec?: number | null;
                  tear_strength_warp?: number | null;
                  tear_strength_weft?: number | null;
                  shrinkage_pct?: number | null;
                  status?: string;
                  is_active?: boolean | null;
                  tested_at?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      quality_hold_records: {
                Row: {
                  id: string;
                  production_inspection_id: string;
                  roll_no: string;
                  hold_reason: string;
                  held_by: string;
                  held_at: string | null;
                  released_by: string | null;
                  released_at: string | null;
                  release_reason: string | null;
                };
                Insert: {
                  id?: string;
                  production_inspection_id: string;
                  roll_no: string;
                  hold_reason: string;
                  held_by: string;
                  held_at?: string | null;
                  released_by?: string | null;
                  released_at?: string | null;
                  release_reason?: string | null;
                };
                Update: {
                  id?: string;
                  production_inspection_id?: string;
                  roll_no?: string;
                  hold_reason?: string;
                  held_by?: string;
                  held_at?: string | null;
                  released_by?: string | null;
                  released_at?: string | null;
                  release_reason?: string | null;
                };
                Relationships: [
                ];
      };
      production_output: {
                Row: {
                  id: string;
                  job_card_id: string;
                  output_qty: number | null;
                  output_grade: string;
                  completed_by: string | null;
                  completed_at: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  output_item_id: string;
                };
                Insert: {
                  id?: string;
                  job_card_id: string;
                  output_qty?: number | null;
                  output_grade: string;
                  completed_by?: string | null;
                  completed_at?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  output_item_id: string;
                };
                Update: {
                  id?: string;
                  job_card_id?: string;
                  output_qty?: number | null;
                  output_grade?: string;
                  completed_by?: string | null;
                  completed_at?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  output_item_id?: string;
                };
                Relationships: [
                ];
      };
      saleable_inventory: {
                Row: {
                  id: string;
                  production_inspection_id: string;
                  final_grade: string;
                  saleable_qty: number | null;
                  available_qty: number | null;
                  decision_at: string | null;
                  decided_by: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  production_inspection_id: string;
                  final_grade: string;
                  saleable_qty?: number | null;
                  available_qty?: number | null;
                  decision_at?: string | null;
                  decided_by?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  production_inspection_id?: string;
                  final_grade?: string;
                  saleable_qty?: number | null;
                  available_qty?: number | null;
                  decision_at?: string | null;
                  decided_by?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                ];
      };
      customers: {
                Row: {
                  id: string;
                  party_id: string;
                  credit_limit: number | null;
                  current_credit_used: number | null;
                  payment_terms_days: number | null;
                  default_shipping_address: string | null;
                  contact_person: string | null;
                  phone: string | null;
                  email: string | null;
                  is_active: boolean | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  party_id: string;
                  credit_limit?: number | null;
                  current_credit_used?: number | null;
                  payment_terms_days?: number | null;
                  default_shipping_address?: string | null;
                  contact_person?: string | null;
                  phone?: string | null;
                  email?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  party_id?: string;
                  credit_limit?: number | null;
                  current_credit_used?: number | null;
                  payment_terms_days?: number | null;
                  default_shipping_address?: string | null;
                  contact_person?: string | null;
                  phone?: string | null;
                  email?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "customers_party_id_fkey";
                    columns: ["party_id"];
                    isOneToOne: false;
                    referencedRelation: "parties";
                    referencedColumns: ["id"];
                  },
                ];
      };
      sales_quotations: {
                Row: {
                  id: string;
                  quotation_no: string;
                  customer_id: string;
                  quoted_date: string;
                  valid_till: string;
                  subtotal_amount: number | null;
                  discount_percent: number | null;
                  discount_amount: number | null;
                  tax_amount: number | null;
                  total_amount: number | null;
                  status: string | null;
                  remarks: string | null;
                  quoted_by: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  quotation_no: string;
                  customer_id: string;
                  quoted_date: string;
                  valid_till: string;
                  subtotal_amount?: number | null;
                  discount_percent?: number | null;
                  discount_amount?: number | null;
                  tax_amount?: number | null;
                  total_amount?: number | null;
                  status?: string | null;
                  remarks?: string | null;
                  quoted_by?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  quotation_no?: string;
                  customer_id?: string;
                  quoted_date?: string;
                  valid_till?: string;
                  subtotal_amount?: number | null;
                  discount_percent?: number | null;
                  discount_amount?: number | null;
                  tax_amount?: number | null;
                  total_amount?: number | null;
                  status?: string | null;
                  remarks?: string | null;
                  quoted_by?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "sales_quotations_customer_id_fkey";
                    columns: ["customer_id"];
                    isOneToOne: false;
                    referencedRelation: "customers";
                    referencedColumns: ["id"];
                  },
                ];
      };
      sales_quotation_items: {
                Row: {
                  id: string;
                  quotation_id: string;
                  line_number: number;
                  fabric_quality_name: string;
                  design_no: string | null;
                  qty_metre: number | null;
                  rate_per_metre: number | null;
                  line_total: number | null;
                  remarks: string | null;
                  created_at: string | null;
                };
                Insert: {
                  id?: string;
                  quotation_id: string;
                  line_number: number;
                  fabric_quality_name: string;
                  design_no?: string | null;
                  qty_metre?: number | null;
                  rate_per_metre?: number | null;
                  line_total?: number | null;
                  remarks?: string | null;
                  created_at?: string | null;
                };
                Update: {
                  id?: string;
                  quotation_id?: string;
                  line_number?: number;
                  fabric_quality_name?: string;
                  design_no?: string | null;
                  qty_metre?: number | null;
                  rate_per_metre?: number | null;
                  line_total?: number | null;
                  remarks?: string | null;
                  created_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "sales_quotation_items_quotation_id_fkey";
                    columns: ["quotation_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_quotations";
                    referencedColumns: ["id"];
                  },
                ];
      };
      sales_orders: {
                Row: {
                  id: string;
                  order_no: string;
                  quotation_id: string | null;
                  customer_id: string;
                  order_date: string;
                  delivery_date: string;
                  subtotal_amount: number | null;
                  discount_percent: number | null;
                  discount_amount: number | null;
                  tax_amount: number | null;
                  total_amount: number | null;
                  status: string | null;
                  shipping_address: string;
                  billing_address: string;
                  delivery_instructions: string | null;
                  remarks: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                  confirmed_at: string | null;
                  shipped_at: string | null;
                  delivered_at: string | null;
                  warehouse_id: string | null;
                  customer_name_snapshot: string | null;
                  broker_name_snapshot: string | null;
                  credit_override_approved: boolean | null;
                  credit_override_reason: string | null;
                  credit_override_approved_by: string | null;
                  credit_override_approved_at: string | null;
                  invoice_id: string | null;
                  allocated_at: string | null;
                  allocated_by: string | null;
                  dispatched_at: string | null;
                  dispatched_by: string | null;
                  delivered_by: string | null;
                  invoiced_at: string | null;
                  invoiced_by: string | null;
                  paid_at: string | null;
                  paid_by: string | null;
                };
                Insert: {
                  id?: string;
                  order_no: string;
                  quotation_id?: string | null;
                  customer_id: string;
                  order_date: string;
                  delivery_date: string;
                  subtotal_amount?: number | null;
                  discount_percent?: number | null;
                  discount_amount?: number | null;
                  tax_amount?: number | null;
                  total_amount?: number | null;
                  status?: string | null;
                  shipping_address: string;
                  billing_address: string;
                  delivery_instructions?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                  confirmed_at?: string | null;
                  shipped_at?: string | null;
                  delivered_at?: string | null;
                  warehouse_id?: string | null;
                  customer_name_snapshot?: string | null;
                  broker_name_snapshot?: string | null;
                  credit_override_approved?: boolean | null;
                  credit_override_reason?: string | null;
                  credit_override_approved_by?: string | null;
                  credit_override_approved_at?: string | null;
                  invoice_id?: string | null;
                  allocated_at?: string | null;
                  allocated_by?: string | null;
                  dispatched_at?: string | null;
                  dispatched_by?: string | null;
                  delivered_by?: string | null;
                  invoiced_at?: string | null;
                  invoiced_by?: string | null;
                  paid_at?: string | null;
                  paid_by?: string | null;
                };
                Update: {
                  id?: string;
                  order_no?: string;
                  quotation_id?: string | null;
                  customer_id?: string;
                  order_date?: string;
                  delivery_date?: string;
                  subtotal_amount?: number | null;
                  discount_percent?: number | null;
                  discount_amount?: number | null;
                  tax_amount?: number | null;
                  total_amount?: number | null;
                  status?: string | null;
                  shipping_address?: string;
                  billing_address?: string;
                  delivery_instructions?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                  confirmed_at?: string | null;
                  shipped_at?: string | null;
                  delivered_at?: string | null;
                  warehouse_id?: string | null;
                  customer_name_snapshot?: string | null;
                  broker_name_snapshot?: string | null;
                  credit_override_approved?: boolean | null;
                  credit_override_reason?: string | null;
                  credit_override_approved_by?: string | null;
                  credit_override_approved_at?: string | null;
                  invoice_id?: string | null;
                  allocated_at?: string | null;
                  allocated_by?: string | null;
                  dispatched_at?: string | null;
                  dispatched_by?: string | null;
                  delivered_by?: string | null;
                  invoiced_at?: string | null;
                  invoiced_by?: string | null;
                  paid_at?: string | null;
                  paid_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "sales_orders_quotation_id_fkey";
                    columns: ["quotation_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_quotations";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "sales_orders_customer_id_fkey";
                    columns: ["customer_id"];
                    isOneToOne: false;
                    referencedRelation: "customers";
                    referencedColumns: ["id"];
                  },
                ];
      };
      sales_order_items: {
                Row: {
                  id: string;
                  order_id: string;
                  line_number: number;
                  fabric_quality_name: string;
                  design_no: string | null;
                  qty_metre: number | null;
                  qty_allocated: number | null;
                  qty_shipped: number | null;
                  rate_per_metre: number | null;
                  line_total: number | null;
                  remarks: string | null;
                  created_at: string | null;
                  design_id: string | null;
                  design_no_snapshot: string | null;
                  design_name_snapshot: string | null;
                  cost_sheet_id: string | null;
                  cost_sheet_no_snapshot: string | null;
                  qty_reserved: number | null;
                  approved_sale_rate: number | null;
                  approved_by: string | null;
                  approved_at: string | null;
                  inventory_item_id: string | null;
                  stock_reservation_id: string | null;
                  qty_dispatched: number | null;
                  updated_at: string | null;
                  updated_by: string | null;
                  shipment_id: string | null;
                  qty_invoiced: number | null;
                };
                Insert: {
                  id?: string;
                  order_id: string;
                  line_number: number;
                  fabric_quality_name: string;
                  design_no?: string | null;
                  qty_metre?: number | null;
                  qty_allocated?: number | null;
                  qty_shipped?: number | null;
                  rate_per_metre?: number | null;
                  line_total?: number | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  design_id?: string | null;
                  design_no_snapshot?: string | null;
                  design_name_snapshot?: string | null;
                  cost_sheet_id?: string | null;
                  cost_sheet_no_snapshot?: string | null;
                  qty_reserved?: number | null;
                  approved_sale_rate?: number | null;
                  approved_by?: string | null;
                  approved_at?: string | null;
                  inventory_item_id?: string | null;
                  stock_reservation_id?: string | null;
                  qty_dispatched?: number | null;
                  updated_at?: string | null;
                  updated_by?: string | null;
                  shipment_id?: string | null;
                  qty_invoiced?: number | null;
                };
                Update: {
                  id?: string;
                  order_id?: string;
                  line_number?: number;
                  fabric_quality_name?: string;
                  design_no?: string | null;
                  qty_metre?: number | null;
                  qty_allocated?: number | null;
                  qty_shipped?: number | null;
                  rate_per_metre?: number | null;
                  line_total?: number | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  design_id?: string | null;
                  design_no_snapshot?: string | null;
                  design_name_snapshot?: string | null;
                  cost_sheet_id?: string | null;
                  cost_sheet_no_snapshot?: string | null;
                  qty_reserved?: number | null;
                  approved_sale_rate?: number | null;
                  approved_by?: string | null;
                  approved_at?: string | null;
                  inventory_item_id?: string | null;
                  stock_reservation_id?: string | null;
                  qty_dispatched?: number | null;
                  updated_at?: string | null;
                  updated_by?: string | null;
                  shipment_id?: string | null;
                  qty_invoiced?: number | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "sales_order_items_order_id_fkey";
                    columns: ["order_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_orders";
                    referencedColumns: ["id"];
                  },
                ];
      };
      sales_invoices: {
                Row: {
                  id: string;
                  invoice_no: string;
                  order_id: string;
                  customer_id: string;
                  invoice_date: string;
                  due_date: string;
                  subtotal_amount: number | null;
                  tax_amount: number | null;
                  total_amount: number | null;
                  amount_paid: number | null;
                  amount_outstanding: number | null;
                  status: string | null;
                  remarks: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  invoice_no: string;
                  order_id: string;
                  customer_id: string;
                  invoice_date: string;
                  due_date: string;
                  subtotal_amount?: number | null;
                  tax_amount?: number | null;
                  total_amount?: number | null;
                  amount_paid?: number | null;
                  amount_outstanding?: number | null;
                  status?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  invoice_no?: string;
                  order_id?: string;
                  customer_id?: string;
                  invoice_date?: string;
                  due_date?: string;
                  subtotal_amount?: number | null;
                  tax_amount?: number | null;
                  total_amount?: number | null;
                  amount_paid?: number | null;
                  amount_outstanding?: number | null;
                  status?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "sales_invoices_order_id_fkey";
                    columns: ["order_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_orders";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "sales_invoices_customer_id_fkey";
                    columns: ["customer_id"];
                    isOneToOne: false;
                    referencedRelation: "customers";
                    referencedColumns: ["id"];
                  },
                ];
      };
      sales_payments: {
                Row: {
                  id: string;
                  invoice_id: string;
                  payment_date: string;
                  amount_paid: number | null;
                  payment_method: string | null;
                  reference_number: string | null;
                  remarks: string | null;
                  created_at: string | null;
                  created_by: string | null;
                  customer_id: string | null;
                  payment_number: string | null;
                  status: string | null;
                  updated_at: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  invoice_id: string;
                  payment_date: string;
                  amount_paid?: number | null;
                  payment_method?: string | null;
                  reference_number?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  created_by?: string | null;
                  customer_id?: string | null;
                  payment_number?: string | null;
                  status?: string | null;
                  updated_at?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  invoice_id?: string;
                  payment_date?: string;
                  amount_paid?: number | null;
                  payment_method?: string | null;
                  reference_number?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  created_by?: string | null;
                  customer_id?: string | null;
                  payment_number?: string | null;
                  status?: string | null;
                  updated_at?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "sales_payments_invoice_id_fkey";
                    columns: ["invoice_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_invoices";
                    referencedColumns: ["id"];
                  },
                ];
      };
      sales_fulfillment: {
                Row: {
                  id: string;
                  pick_list_no: string;
                  fulfillment_date: string;
                  shipped_date: string | null;
                  delivered_date: string | null;
                  status: string | null;
                  tracking_number: string | null;
                  carrier: string | null;
                  remarks: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  pick_list_no: string;
                  fulfillment_date: string;
                  shipped_date?: string | null;
                  delivered_date?: string | null;
                  status?: string | null;
                  tracking_number?: string | null;
                  carrier?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  pick_list_no?: string;
                  fulfillment_date?: string;
                  shipped_date?: string | null;
                  delivered_date?: string | null;
                  status?: string | null;
                  tracking_number?: string | null;
                  carrier?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      sales_fulfillment_items: {
                Row: {
                  id: string;
                  fulfillment_id: string;
                  order_item_id: string;
                  qty_to_ship: number | null;
                  qty_picked: number | null;
                  qty_packed: number | null;
                  qty_shipped: number | null;
                  bin_location: string | null;
                  remarks: string | null;
                  created_at: string | null;
                };
                Insert: {
                  id?: string;
                  fulfillment_id: string;
                  order_item_id: string;
                  qty_to_ship?: number | null;
                  qty_picked?: number | null;
                  qty_packed?: number | null;
                  qty_shipped?: number | null;
                  bin_location?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                };
                Update: {
                  id?: string;
                  fulfillment_id?: string;
                  order_item_id?: string;
                  qty_to_ship?: number | null;
                  qty_picked?: number | null;
                  qty_packed?: number | null;
                  qty_shipped?: number | null;
                  bin_location?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "sales_fulfillment_items_fulfillment_id_fkey";
                    columns: ["fulfillment_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_fulfillment";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "sales_fulfillment_items_order_item_id_fkey";
                    columns: ["order_item_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_order_items";
                    referencedColumns: ["id"];
                  },
                ];
      };
      sales_audit_trail: {
                Row: {
                  id: string;
                  order_id: string | null;
                  quotation_id: string | null;
                  action: string;
                  actor_id: string | null;
                  actor_name: string | null;
                  details: Json | null;
                  timestamp: string | null;
                };
                Insert: {
                  id?: string;
                  order_id?: string | null;
                  quotation_id?: string | null;
                  action: string;
                  actor_id?: string | null;
                  actor_name?: string | null;
                  details?: Json | null;
                  timestamp?: string | null;
                };
                Update: {
                  id?: string;
                  order_id?: string | null;
                  quotation_id?: string | null;
                  action?: string;
                  actor_id?: string | null;
                  actor_name?: string | null;
                  details?: Json | null;
                  timestamp?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "sales_audit_trail_order_id_fkey";
                    columns: ["order_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_orders";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "sales_audit_trail_quotation_id_fkey";
                    columns: ["quotation_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_quotations";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "sales_audit_trail_actor_id_fkey";
                    columns: ["actor_id"];
                    isOneToOne: false;
                    referencedRelation: "profiles";
                    referencedColumns: ["id"];
                  },
                ];
      };
      warehouse_zones: {
                Row: {
                  id: string;
                  name: string;
                  description: string | null;
                  color_code: string | null;
                  is_active: boolean | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  name: string;
                  description?: string | null;
                  color_code?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  name?: string;
                  description?: string | null;
                  color_code?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      warehouse_locations: {
                Row: {
                  id: string;
                  code: string;
                  name: string;
                  zone_id: string;
                  capacity_kg: number | null;
                  capacity_metres: number | null;
                  current_qty_kg: number | null;
                  current_qty_metres: number | null;
                  is_active: boolean | null;
                  coordinates: Json | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  code: string;
                  name: string;
                  zone_id: string;
                  capacity_kg?: number | null;
                  capacity_metres?: number | null;
                  current_qty_kg?: number | null;
                  current_qty_metres?: number | null;
                  is_active?: boolean | null;
                  coordinates?: Json | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  code?: string;
                  name?: string;
                  zone_id?: string;
                  capacity_kg?: number | null;
                  capacity_metres?: number | null;
                  current_qty_kg?: number | null;
                  current_qty_metres?: number | null;
                  is_active?: boolean | null;
                  coordinates?: Json | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "warehouse_locations_zone_id_fkey";
                    columns: ["zone_id"];
                    isOneToOne: false;
                    referencedRelation: "warehouse_zones";
                    referencedColumns: ["id"];
                  },
                ];
      };
      user_preferences: {
                Row: {
                  id: string;
                  user_id: string;
                  preferred_language: string | null;
                  theme: string | null;
                  card_zoom_level: number | null;
                  sidebar_collapsed: boolean | null;
                  sidebar_position: string | null;
                  notification_enabled: boolean | null;
                  notification_sound: boolean | null;
                  dashboard_layout: string | null;
                  dashboard_columns: number | null;
                  favorite_modules: string | null;
                  items_per_page: number | null;
                  default_sort_column: string | null;
                  default_sort_direction: string | null;
                  keyboard_shortcuts_enabled: boolean | null;
                  auto_refresh_enabled: boolean | null;
                  auto_refresh_interval: number | null;
                  export_format: string | null;
                  custom_settings: Json | null;
                  created_at: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  user_id: string;
                  preferred_language?: string | null;
                  theme?: string | null;
                  card_zoom_level?: number | null;
                  sidebar_collapsed?: boolean | null;
                  sidebar_position?: string | null;
                  notification_enabled?: boolean | null;
                  notification_sound?: boolean | null;
                  dashboard_layout?: string | null;
                  dashboard_columns?: number | null;
                  favorite_modules?: string | null;
                  items_per_page?: number | null;
                  default_sort_column?: string | null;
                  default_sort_direction?: string | null;
                  keyboard_shortcuts_enabled?: boolean | null;
                  auto_refresh_enabled?: boolean | null;
                  auto_refresh_interval?: number | null;
                  export_format?: string | null;
                  custom_settings?: Json | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  user_id?: string;
                  preferred_language?: string | null;
                  theme?: string | null;
                  card_zoom_level?: number | null;
                  sidebar_collapsed?: boolean | null;
                  sidebar_position?: string | null;
                  notification_enabled?: boolean | null;
                  notification_sound?: boolean | null;
                  dashboard_layout?: string | null;
                  dashboard_columns?: number | null;
                  favorite_modules?: string | null;
                  items_per_page?: number | null;
                  default_sort_column?: string | null;
                  default_sort_direction?: string | null;
                  keyboard_shortcuts_enabled?: boolean | null;
                  auto_refresh_enabled?: boolean | null;
                  auto_refresh_interval?: number | null;
                  export_format?: string | null;
                  custom_settings?: Json | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                ];
      };
      supported_languages: {
                Row: {
                  code: string;
                  name: string;
                  native_name: string | null;
                  is_active: boolean | null;
                  created_at: string | null;
                };
                Insert: {
                  code: string;
                  name: string;
                  native_name?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                };
                Update: {
                  code?: string;
                  name?: string;
                  native_name?: string | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                };
                Relationships: [
                ];
      };
      party_sub_parties: {
                Row: {
                  id: string;
                  party_id: string;
                  sub_party_code: string;
                  sub_party_name: string;
                  party_type: string;
                  location_type: string | null;
                  location_type_other: string | null;
                  address_line1: string;
                  address_line2: string | null;
                  area: string | null;
                  city: string;
                  district: string | null;
                  state: string;
                  pin_code: string | null;
                  country: string | null;
                  gstin: string | null;
                  pan: string | null;
                  contact_person: string | null;
                  mobile: string | null;
                  alternate_mobile: string | null;
                  phone: string | null;
                  email: string | null;
                  alternate_email: string | null;
                  billing_address: string | null;
                  shipping_address: string | null;
                  delivery_address: string | null;
                  is_default: boolean | null;
                  status: string | null;
                  remarks: string | null;
                  internal_notes: string | null;
                  transaction_count: number | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  party_id: string;
                  sub_party_code: string;
                  sub_party_name: string;
                  party_type?: string;
                  location_type?: string | null;
                  location_type_other?: string | null;
                  address_line1: string;
                  address_line2?: string | null;
                  area?: string | null;
                  city: string;
                  district?: string | null;
                  state: string;
                  pin_code?: string | null;
                  country?: string | null;
                  gstin?: string | null;
                  pan?: string | null;
                  contact_person?: string | null;
                  mobile?: string | null;
                  alternate_mobile?: string | null;
                  phone?: string | null;
                  email?: string | null;
                  alternate_email?: string | null;
                  billing_address?: string | null;
                  shipping_address?: string | null;
                  delivery_address?: string | null;
                  is_default?: boolean | null;
                  status?: string | null;
                  remarks?: string | null;
                  internal_notes?: string | null;
                  transaction_count?: number | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  party_id?: string;
                  sub_party_code?: string;
                  sub_party_name?: string;
                  party_type?: string;
                  location_type?: string | null;
                  location_type_other?: string | null;
                  address_line1?: string;
                  address_line2?: string | null;
                  area?: string | null;
                  city?: string;
                  district?: string | null;
                  state?: string;
                  pin_code?: string | null;
                  country?: string | null;
                  gstin?: string | null;
                  pan?: string | null;
                  contact_person?: string | null;
                  mobile?: string | null;
                  alternate_mobile?: string | null;
                  phone?: string | null;
                  email?: string | null;
                  alternate_email?: string | null;
                  billing_address?: string | null;
                  shipping_address?: string | null;
                  delivery_address?: string | null;
                  is_default?: boolean | null;
                  status?: string | null;
                  remarks?: string | null;
                  internal_notes?: string | null;
                  transaction_count?: number | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "party_sub_parties_party_id_fkey";
                    columns: ["party_id"];
                    isOneToOne: false;
                    referencedRelation: "parties";
                    referencedColumns: ["id"];
                  },
                ];
      };
      warehouses: {
                Row: {
                  id: string;
                  warehouse_code: string;
                  warehouse_name: string;
                  warehouse_type: string;
                  warehouse_type_other: string | null;
                  address_line1: string | null;
                  address_line2: string | null;
                  area: string | null;
                  city: string | null;
                  district: string | null;
                  state: string | null;
                  pin_code: string | null;
                  country: string | null;
                  contact_person: string | null;
                  mobile: string | null;
                  email: string | null;
                  total_capacity_kg: number | null;
                  total_capacity_metres: number | null;
                  remarks: string | null;
                  is_active: boolean | null;
                  status: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  warehouse_code: string;
                  warehouse_name: string;
                  warehouse_type: string;
                  warehouse_type_other?: string | null;
                  address_line1?: string | null;
                  address_line2?: string | null;
                  area?: string | null;
                  city?: string | null;
                  district?: string | null;
                  state?: string | null;
                  pin_code?: string | null;
                  country?: string | null;
                  contact_person?: string | null;
                  mobile?: string | null;
                  email?: string | null;
                  total_capacity_kg?: number | null;
                  total_capacity_metres?: number | null;
                  remarks?: string | null;
                  is_active?: boolean | null;
                  status?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  warehouse_code?: string;
                  warehouse_name?: string;
                  warehouse_type?: string;
                  warehouse_type_other?: string | null;
                  address_line1?: string | null;
                  address_line2?: string | null;
                  area?: string | null;
                  city?: string | null;
                  district?: string | null;
                  state?: string | null;
                  pin_code?: string | null;
                  country?: string | null;
                  contact_person?: string | null;
                  mobile?: string | null;
                  email?: string | null;
                  total_capacity_kg?: number | null;
                  total_capacity_metres?: number | null;
                  remarks?: string | null;
                  is_active?: boolean | null;
                  status?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      processes: {
                Row: {
                  id: string;
                  process_code: string;
                  process_name: string;
                  description: string | null;
                  process_category: string | null;
                  default_rate: number | null;
                  unit_of_rate: string | null;
                  processing_time_hours: number | null;
                  is_active: boolean | null;
                  is_outsourced: boolean | null;
                  remarks: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  process_code: string;
                  process_name: string;
                  description?: string | null;
                  process_category?: string | null;
                  default_rate?: number | null;
                  unit_of_rate?: string | null;
                  processing_time_hours?: number | null;
                  is_active?: boolean | null;
                  is_outsourced?: boolean | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  process_code?: string;
                  process_name?: string;
                  description?: string | null;
                  process_category?: string | null;
                  default_rate?: number | null;
                  unit_of_rate?: string | null;
                  processing_time_hours?: number | null;
                  is_active?: boolean | null;
                  is_outsourced?: boolean | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      process_rate_history: {
                Row: {
                  id: string;
                  process_id: string;
                  default_rate: number | null;
                  effective_from: string;
                  note: string | null;
                  created_by: string | null;
                  created_at: string;
                };
                Insert: {
                  id?: string;
                  process_id: string;
                  default_rate?: number | null;
                  effective_from?: string;
                  note?: string | null;
                  created_by?: string | null;
                  created_at?: string;
                };
                Update: {
                  id?: string;
                  process_id?: string;
                  default_rate?: number | null;
                  effective_from?: string;
                  note?: string | null;
                  created_by?: string | null;
                  created_at?: string;
                };
                Relationships: [
                  {
                    foreignKeyName: "process_rate_history_process_id_fkey";
                    columns: ["process_id"];
                    isOneToOne: false;
                    referencedRelation: "processes";
                    referencedColumns: ["id"];
                  },
                ];
      };
      machines: {
                Row: {
                  id: string;
                  machine_code: string;
                  machine_name: string;
                  description: string | null;
                  machine_type: string | null;
                  process_id: string | null;
                  warehouse_id: string | null;
                  specifications: Json | null;
                  is_active: boolean | null;
                  status: string | null;
                  remarks: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  machine_code: string;
                  machine_name: string;
                  description?: string | null;
                  machine_type?: string | null;
                  process_id?: string | null;
                  warehouse_id?: string | null;
                  specifications?: Json | null;
                  is_active?: boolean | null;
                  status?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  machine_code?: string;
                  machine_name?: string;
                  description?: string | null;
                  machine_type?: string | null;
                  process_id?: string | null;
                  warehouse_id?: string | null;
                  specifications?: Json | null;
                  is_active?: boolean | null;
                  status?: string | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "machines_process_id_fkey";
                    columns: ["process_id"];
                    isOneToOne: false;
                    referencedRelation: "processes";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "machines_warehouse_id_fkey";
                    columns: ["warehouse_id"];
                    isOneToOne: false;
                    referencedRelation: "warehouses";
                    referencedColumns: ["id"];
                  },
                ];
      };
      units: {
                Row: {
                  id: string;
                  unit_code: string;
                  unit_name: string;
                  description: string | null;
                  measurement_type: string;
                  base_unit: string | null;
                  conversion_factor: number | null;
                  is_active: boolean | null;
                  is_default: boolean | null;
                  remarks: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  unit_code: string;
                  unit_name: string;
                  description?: string | null;
                  measurement_type: string;
                  base_unit?: string | null;
                  conversion_factor?: number | null;
                  is_active?: boolean | null;
                  is_default?: boolean | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  unit_code?: string;
                  unit_name?: string;
                  description?: string | null;
                  measurement_type?: string;
                  base_unit?: string | null;
                  conversion_factor?: number | null;
                  is_active?: boolean | null;
                  is_default?: boolean | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      colors: {
                Row: {
                  id: string;
                  color_code: string;
                  color_name: string;
                  color_hex: string | null;
                  description: string | null;
                  color_type: string | null;
                  is_active: boolean | null;
                  remarks: string | null;
                  created_at: string | null;
                  updated_at: string | null;
                  created_by: string | null;
                  updated_by: string | null;
                };
                Insert: {
                  id?: string;
                  color_code: string;
                  color_name: string;
                  color_hex?: string | null;
                  description?: string | null;
                  color_type?: string | null;
                  is_active?: boolean | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Update: {
                  id?: string;
                  color_code?: string;
                  color_name?: string;
                  color_hex?: string | null;
                  description?: string | null;
                  color_type?: string | null;
                  is_active?: boolean | null;
                  remarks?: string | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                  created_by?: string | null;
                  updated_by?: string | null;
                };
                Relationships: [
                ];
      };
      role_definitions: {
                Row: {
                  id: string;
                  role_code: string;
                  role_name: string;
                  description: string | null;
                  display_order: number | null;
                  is_system: boolean | null;
                  is_active: boolean | null;
                  created_at: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  role_code: string;
                  role_name: string;
                  description?: string | null;
                  display_order?: number | null;
                  is_system?: boolean | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  role_code?: string;
                  role_name?: string;
                  description?: string | null;
                  display_order?: number | null;
                  is_system?: boolean | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                ];
      };
      permissions: {
                Row: {
                  id: string;
                  permission_code: string;
                  permission_name: string;
                  description: string | null;
                  module: string;
                  action: string;
                  is_system: boolean | null;
                  is_active: boolean | null;
                  created_at: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  permission_code: string;
                  permission_name: string;
                  description?: string | null;
                  module: string;
                  action: string;
                  is_system?: boolean | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  permission_code?: string;
                  permission_name?: string;
                  description?: string | null;
                  module?: string;
                  action?: string;
                  is_system?: boolean | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                ];
      };
      role_permissions: {
                Row: {
                  id: string;
                  role_id: string;
                  permission_id: string;
                  created_at: string | null;
                };
                Insert: {
                  id?: string;
                  role_id: string;
                  permission_id: string;
                  created_at?: string | null;
                };
                Update: {
                  id?: string;
                  role_id?: string;
                  permission_id?: string;
                  created_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "role_permissions_role_id_fkey";
                    columns: ["role_id"];
                    isOneToOne: false;
                    referencedRelation: "role_definitions";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "role_permissions_permission_id_fkey";
                    columns: ["permission_id"];
                    isOneToOne: false;
                    referencedRelation: "permissions";
                    referencedColumns: ["id"];
                  },
                ];
      };
      profile_audit_log: {
                Row: {
                  id: string;
                  profile_id: string;
                  action: string;
                  changed_fields: Json | null;
                  changed_by: string | null;
                  changed_by_email: string | null;
                  change_reason: string | null;
                  created_at: string | null;
                };
                Insert: {
                  id?: string;
                  profile_id: string;
                  action: string;
                  changed_fields?: Json | null;
                  changed_by?: string | null;
                  changed_by_email?: string | null;
                  change_reason?: string | null;
                  created_at?: string | null;
                };
                Update: {
                  id?: string;
                  profile_id?: string;
                  action?: string;
                  changed_fields?: Json | null;
                  changed_by?: string | null;
                  changed_by_email?: string | null;
                  change_reason?: string | null;
                  created_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "profile_audit_log_profile_id_fkey";
                    columns: ["profile_id"];
                    isOneToOne: false;
                    referencedRelation: "profiles";
                    referencedColumns: ["id"];
                  },
                ];
      };
      shipments: {
                Row: {
                  id: string;
                  order_id: string;
                  warehouse_id: string;
                  status: string;
                  shipping_address: string;
                  carrier_name: string | null;
                  tracking_number: string | null;
                  created_by: string | null;
                  created_at: string | null;
                  dispatched_at: string | null;
                  dispatched_by: string | null;
                  delivered_at: string | null;
                  delivered_by: string | null;
                  updated_by: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  order_id: string;
                  warehouse_id: string;
                  status?: string;
                  shipping_address: string;
                  carrier_name?: string | null;
                  tracking_number?: string | null;
                  created_by?: string | null;
                  created_at?: string | null;
                  dispatched_at?: string | null;
                  dispatched_by?: string | null;
                  delivered_at?: string | null;
                  delivered_by?: string | null;
                  updated_by?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  order_id?: string;
                  warehouse_id?: string;
                  status?: string;
                  shipping_address?: string;
                  carrier_name?: string | null;
                  tracking_number?: string | null;
                  created_by?: string | null;
                  created_at?: string | null;
                  dispatched_at?: string | null;
                  dispatched_by?: string | null;
                  delivered_at?: string | null;
                  delivered_by?: string | null;
                  updated_by?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "shipments_order_id_fkey";
                    columns: ["order_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_orders";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "shipments_warehouse_id_fkey";
                    columns: ["warehouse_id"];
                    isOneToOne: false;
                    referencedRelation: "warehouse_locations";
                    referencedColumns: ["id"];
                  },
                ];
      };
      invoices: {
                Row: {
                  id: string;
                  invoice_number: string;
                  order_id: string;
                  customer_id: string;
                  customer_name_snapshot: string | null;
                  subtotal_amount: number | null;
                  tax_amount: number | null;
                  total_amount: number | null;
                  paid_amount: number | null;
                  invoice_date: string;
                  due_date: string;
                  status: string;
                  created_by: string | null;
                  created_at: string | null;
                  paid_at: string | null;
                  updated_by: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  invoice_number: string;
                  order_id: string;
                  customer_id: string;
                  customer_name_snapshot?: string | null;
                  subtotal_amount?: number | null;
                  tax_amount?: number | null;
                  total_amount?: number | null;
                  paid_amount?: number | null;
                  invoice_date: string;
                  due_date: string;
                  status?: string;
                  created_by?: string | null;
                  created_at?: string | null;
                  paid_at?: string | null;
                  updated_by?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  invoice_number?: string;
                  order_id?: string;
                  customer_id?: string;
                  customer_name_snapshot?: string | null;
                  subtotal_amount?: number | null;
                  tax_amount?: number | null;
                  total_amount?: number | null;
                  paid_amount?: number | null;
                  invoice_date?: string;
                  due_date?: string;
                  status?: string;
                  created_by?: string | null;
                  created_at?: string | null;
                  paid_at?: string | null;
                  updated_by?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "invoices_order_id_fkey";
                    columns: ["order_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_orders";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "invoices_customer_id_fkey";
                    columns: ["customer_id"];
                    isOneToOne: false;
                    referencedRelation: "parties";
                    referencedColumns: ["id"];
                  },
                ];
      };
      payments: {
                Row: {
                  id: string;
                  invoice_id: string;
                  amount_paid: number | null;
                  payment_method: string;
                  reference_number: string | null;
                  payment_date: string;
                  status: string;
                  created_by: string | null;
                  created_at: string | null;
                  updated_by: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  invoice_id: string;
                  amount_paid?: number | null;
                  payment_method: string;
                  reference_number?: string | null;
                  payment_date: string;
                  status?: string;
                  created_by?: string | null;
                  created_at?: string | null;
                  updated_by?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  invoice_id?: string;
                  amount_paid?: number | null;
                  payment_method?: string;
                  reference_number?: string | null;
                  payment_date?: string;
                  status?: string;
                  created_by?: string | null;
                  created_at?: string | null;
                  updated_by?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "payments_invoice_id_fkey";
                    columns: ["invoice_id"];
                    isOneToOne: false;
                    referencedRelation: "invoices";
                    referencedColumns: ["id"];
                  },
                ];
      };
      sales_invoice_items: {
                Row: {
                  id: string;
                  invoice_id: string;
                  order_item_id: string;
                  qty_invoiced: number | null;
                  rate: number | null;
                  discount_pct: number | null;
                  tax_pct: number | null;
                  gross_amount: number | null;
                  discount_amount: number | null;
                  tax_amount: number | null;
                  net_amount: number | null;
                  created_at: string | null;
                  created_by: string | null;
                };
                Insert: {
                  id?: string;
                  invoice_id: string;
                  order_item_id: string;
                  qty_invoiced?: number | null;
                  rate?: number | null;
                  discount_pct?: number | null;
                  tax_pct?: number | null;
                  gross_amount?: number | null;
                  discount_amount?: number | null;
                  tax_amount?: number | null;
                  net_amount?: number | null;
                  created_at?: string | null;
                  created_by?: string | null;
                };
                Update: {
                  id?: string;
                  invoice_id?: string;
                  order_item_id?: string;
                  qty_invoiced?: number | null;
                  rate?: number | null;
                  discount_pct?: number | null;
                  tax_pct?: number | null;
                  gross_amount?: number | null;
                  discount_amount?: number | null;
                  tax_amount?: number | null;
                  net_amount?: number | null;
                  created_at?: string | null;
                  created_by?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "sales_invoice_items_invoice_id_fkey";
                    columns: ["invoice_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_invoices";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "sales_invoice_items_order_item_id_fkey";
                    columns: ["order_item_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_order_items";
                    referencedColumns: ["id"];
                  },
                ];
      };
      sales_payment_allocations: {
                Row: {
                  id: string;
                  payment_id: string;
                  invoice_id: string;
                  allocated_amount: number | null;
                  payment_customer_id: string;
                  invoice_customer_id: string;
                  status: string | null;
                  allocated_at: string | null;
                  allocated_by: string;
                  created_at: string | null;
                };
                Insert: {
                  id?: string;
                  payment_id: string;
                  invoice_id: string;
                  allocated_amount?: number | null;
                  payment_customer_id: string;
                  invoice_customer_id: string;
                  status?: string | null;
                  allocated_at?: string | null;
                  allocated_by: string;
                  created_at?: string | null;
                };
                Update: {
                  id?: string;
                  payment_id?: string;
                  invoice_id?: string;
                  allocated_amount?: number | null;
                  payment_customer_id?: string;
                  invoice_customer_id?: string;
                  status?: string | null;
                  allocated_at?: string | null;
                  allocated_by?: string;
                  created_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "sales_payment_allocations_payment_id_fkey";
                    columns: ["payment_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_payments";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "sales_payment_allocations_invoice_id_fkey";
                    columns: ["invoice_id"];
                    isOneToOne: false;
                    referencedRelation: "sales_invoices";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "sales_payment_allocations_payment_customer_id_fkey";
                    columns: ["payment_customer_id"];
                    isOneToOne: false;
                    referencedRelation: "customers";
                    referencedColumns: ["id"];
                  },
                  {
                    foreignKeyName: "sales_payment_allocations_invoice_customer_id_fkey";
                    columns: ["invoice_customer_id"];
                    isOneToOne: false;
                    referencedRelation: "customers";
                    referencedColumns: ["id"];
                  },
                ];
      };
      user_roles_mapping: {
                Row: {
                  id: string;
                  user_id: string;
                  role_id: string;
                  is_primary: boolean | null;
                  is_active: boolean | null;
                  created_at: string | null;
                  updated_at: string | null;
                };
                Insert: {
                  id?: string;
                  user_id: string;
                  role_id: string;
                  is_primary?: boolean | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Update: {
                  id?: string;
                  user_id?: string;
                  role_id?: string;
                  is_primary?: boolean | null;
                  is_active?: boolean | null;
                  created_at?: string | null;
                  updated_at?: string | null;
                };
                Relationships: [
                  {
                    foreignKeyName: "user_roles_mapping_role_id_fkey";
                    columns: ["role_id"];
                    isOneToOne: false;
                    referencedRelation: "role_definitions";
                    referencedColumns: ["id"];
                  },
                ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      update_updated_at_column: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      handle_new_user: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      update_inventory_balance: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      handle_new_user_preferences: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      update_user_preferences_timestamp: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      handle_new_user_rbac: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      confirm_sales_order: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      validate_sales_order_update: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      validate_sales_order_item_update: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      get_saleable_inventory: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      get_inventory_by_quality_grade: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      allocate_inventory_for_sales: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      create_fulfillment_from_order: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      update_fulfillment_item: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      ship_fulfillment: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      deliver_fulfillment: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      create_invoice_from_order: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      record_payment: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      get_invoice_summary: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      get_payment_aging_report: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      complete_order: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      user_has_permission: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      get_user_primary_role: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      audit_profile_change: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      is_admin: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      user_owns_record: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      get_user_role: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      issue_material_to_production: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      complete_job_output: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      complete_quality_inspection: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      confirm_sales_order_with_reservation: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      confirm_stock_reservation: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      create_shipment: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      confirm_shipment_dispatch: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      confirm_shipment_delivery: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      generate_invoice: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      confirm_stock_reservation_dispatch: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      reserve_sales_stock_atomic: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      confirm_stock_reservation_atomic: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      release_sales_stock_atomic: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      cancel_sales_order_atomic: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      create_shipment_atomic: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      create_invoice_from_shipment_atomic: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      reset_payment_sequence_if_needed: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      allocate_payment_atomic: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      record_payment_atomic: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      get_user_effective_permissions: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      user_has_permission_v2: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      get_user_primary_role_id: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      rbac_user_role_ids: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      guard_profile_privileged_columns: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      save_design: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      approve_stock_reservation_atomic: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      app_role: "admin" | "manager" | "costing" | "viewer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "costing", "viewer"],
    },
  },
} as const;
