/**
 * DEVELOPMENT / DEMO DATA ONLY — shared by the frontend prototypes (Item Master,
 * Production) so each master list is defined once. In memory only; never written to
 * Supabase or localStorage. These lists are replaced by the canonical Masters (Yarn,
 * Party, Company, …) when the backend phase connects them.
 */

export type DemoCompany = { id: string; code: string; name: string };
export type DemoParty = {
  id: string;
  code: string;
  name: string;
  kind: "customer" | "job_work";
};
/** Yarn remains its own master; Item Master and Production only reference it. */
export type DemoYarn = {
  id: string;
  code: string;
  name: string;
  productType: string;
  denier: number | null;
};
/** Unit of measure (MTR, PCS, …) — not the factory "Unit" used by Production. */
export type DemoUom = { id: string; code: string; name: string };
export type DemoLookup = { id: string; code: string; name: string };

export const DEMO_COMPANIES: DemoCompany[] = [
  { id: "co-1", code: "CKT", name: "Chehar Krupa Textiles (Demo)" },
  { id: "co-2", code: "SCW", name: "SCKT Weaving (Demo)" },
];

export const DEMO_PARTIES: DemoParty[] = [
  { id: "pt-labdhi", code: "C-101", name: "LABDHI SAREES", kind: "customer" },
  { id: "pt-krishna", code: "C-102", name: "SHREE KRISHNA FASHION", kind: "customer" },
  { id: "pt-ridhi", code: "C-103", name: "RIDHI SIDHI TEXTILES", kind: "customer" },
  { id: "jw-mahavir", code: "J-201", name: "MAHAVIR BUTTA WORKS", kind: "job_work" },
  { id: "jw-ganesh", code: "J-202", name: "GANESH DYEING MILL", kind: "job_work" },
  { id: "jw-surat", code: "J-203", name: "SURAT PROCESSORS", kind: "job_work" },
];

export const DEMO_YARNS: DemoYarn[] = [
  {
    id: "yn-vis-red",
    code: "Y-11",
    name: "Viscose 120D Red",
    productType: "Filament Yarn",
    denier: 120,
  },
  {
    id: "yn-poly-beige",
    code: "Y-12",
    name: "Polyester 80D Beige",
    productType: "Filament Yarn",
    denier: 80,
  },
  { id: "yn-zari", code: "Y-13", name: "Zari Gold 150D", productType: "Zari", denier: 150 },
  {
    id: "yn-cotton",
    code: "Y-14",
    name: "Cotton 40s Grey",
    productType: "Spun Yarn",
    denier: null,
  },
  {
    id: "yn-kota-black",
    code: "Y-21",
    name: "Kota Black 35D",
    productType: "Filament Yarn",
    denier: 35,
  },
  {
    id: "yn-mono-bright",
    code: "Y-22",
    name: "Bright Mono 21D",
    productType: "Filament Yarn",
    denier: 21,
  },
];

export const DEMO_UOMS: DemoUom[] = [
  { id: "uom-mtr", code: "MTR", name: "Metre" },
  { id: "uom-pcs", code: "PCS", name: "Pieces" },
  { id: "uom-kg", code: "KG", name: "Kilogram" },
  { id: "uom-set", code: "SET", name: "Set" },
];

export const DEMO_DEPARTMENTS: DemoLookup[] = [
  { id: "dp-weaving", code: "WEV", name: "Weaving" },
  { id: "dp-warping", code: "WRP", name: "Warping" },
  { id: "dp-folding", code: "FLD", name: "Folding & Checking" },
  { id: "dp-dyeing", code: "DYE", name: "Dyeing" },
  { id: "dp-dispatch", code: "DSP", name: "Dispatch" },
];

export const DEMO_PROCESSES: DemoLookup[] = [
  { id: "pr-butta", code: "PRC-01", name: "Butta Cutting & Processing" },
  { id: "pr-rfd", code: "PRC-02", name: "Ready for Dyeing (RFD) Finish" },
  { id: "pr-wash", code: "PRC-03", name: "Soft Wash & Calendar Finish" },
  { id: "pr-mill", code: "PRC-04", name: "Mill Processing" },
];
