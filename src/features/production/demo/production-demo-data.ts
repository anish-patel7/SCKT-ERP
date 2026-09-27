/**
 * DEVELOPMENT / DEMO DATA ONLY — not real masters, stock or transactions.
 *
 * Held in memory by ProductionDemoService, rebuilt on every page load, never written to
 * Supabase or localStorage. Delete this file (and the demo service) once the Supabase
 * production service exists. Dates are relative to today so the default date range of
 * every register shows data.
 */
import type {
  InputOf,
  ProductionKind,
  ProductionMasters,
} from "@/features/production/types/production";
import { addDays, todayIso } from "@/features/production/utils/formatting";

export const DEMO_MASTERS: ProductionMasters = {
  companies: [
    { id: "co-1", code: "CKT", name: "Chehar Krupa Textiles (Demo)" },
    { id: "co-2", code: "SCW", name: "SCKT Weaving (Demo)" },
  ],
  units: [
    { id: "unit-1", code: "U1", name: "Unit-1", companyId: "co-1" },
    { id: "unit-2", code: "U2", name: "Unit-2", companyId: "co-1" },
    { id: "unit-3", code: "U3", name: "Unit-3", companyId: "co-2" },
  ],
  warehouses: [
    { id: "wh-yarn", code: "YS", name: "Yarn Store" },
    { id: "wh-main", code: "MG", name: "Main Godown" },
    { id: "wh-grey", code: "GG", name: "Grey Godown" },
    { id: "wh-fin", code: "FG", name: "Finished Godown" },
  ],
  parties: [
    { id: "pt-labdhi", code: "C-101", name: "LABDHI SAREES", kind: "customer" },
    { id: "pt-krishna", code: "C-102", name: "SHREE KRISHNA FASHION", kind: "customer" },
    { id: "pt-ridhi", code: "C-103", name: "RIDHI SIDHI TEXTILES", kind: "customer" },
    { id: "jw-mahavir", code: "J-201", name: "MAHAVIR BUTTA WORKS", kind: "job_work" },
    { id: "jw-ganesh", code: "J-202", name: "GANESH DYEING MILL", kind: "job_work" },
    { id: "jw-surat", code: "J-203", name: "SURAT PROCESSORS", kind: "job_work" },
  ],
  items: [
    { id: "it-501", code: "RP-501", name: "Rapier Saree 5.5 Mtr", category: "Saree" },
    { id: "it-620", code: "RP-620", name: "Rapier Dress Material", category: "Dress Material" },
    { id: "it-710", code: "RP-710", name: "Jacquard Butta Saree", category: "Saree" },
  ],
  yarns: [
    { id: "yn-vis-red", code: "Y-11", name: "Viscose 120D Red", productType: "Filament Yarn" },
    {
      id: "yn-poly-beige",
      code: "Y-12",
      name: "Polyester 80D Beige",
      productType: "Filament Yarn",
    },
    { id: "yn-zari", code: "Y-13", name: "Zari Gold 150D", productType: "Zari" },
    { id: "yn-cotton", code: "Y-14", name: "Cotton 40s Grey", productType: "Spun Yarn" },
  ],
  machines: [
    { id: "mc-12", code: "LOOM-12", name: "LOOM-12", unitId: "unit-1" },
    { id: "mc-33", code: "LOOM-33", name: "LOOM-33", unitId: "unit-1" },
    { id: "mc-41", code: "LOOM-41", name: "LOOM-41", unitId: "unit-2" },
    { id: "mc-07", code: "LOOM-07", name: "LOOM-07", unitId: "unit-3" },
  ],
  beams: [
    { id: "bm-101", code: "BM-101", name: "BM-101" },
    { id: "bm-102", code: "BM-102", name: "BM-102" },
    { id: "bm-205", code: "BM-205", name: "BM-205" },
  ],
  // Placeholder grades until the controlled grade list is confirmed.
  grades: [
    { id: "gr-a", code: "A", name: "A Grade" },
    { id: "gr-b", code: "B", name: "B Grade" },
    { id: "gr-sec", code: "SEC", name: "Seconds" },
  ],
  salesOrders: [
    {
      id: "so-118",
      code: "SO/2026/118",
      name: "SO/2026/118",
      partyId: "pt-labdhi",
      orderDate: addDays(todayIso(), -30),
    },
    {
      id: "so-121",
      code: "SO/2026/121",
      name: "SO/2026/121",
      partyId: "pt-krishna",
      orderDate: addDays(todayIso(), -28),
    },
    {
      id: "so-130",
      code: "SO/2026/130",
      name: "SO/2026/130",
      partyId: "pt-ridhi",
      orderDate: addDays(todayIso(), -10),
    },
  ],
  // Placeholders: the real stock status and conversion type lists are not specified yet.
  stockStatuses: ["Stock", "Sale", "Hold"],
  conversionTypes: ["Fabric Conversion"],
};

/** Opening yarn stock per `${warehouseId}|${yarnId}`. */
export const DEMO_YARN_STOCK: Record<string, number> = {
  "wh-yarn|yn-vis-red": 800,
  "wh-yarn|yn-poly-beige": 500,
  "wh-yarn|yn-zari": 200,
  "wh-yarn|yn-cotton": 350,
  "wh-main|yn-vis-red": 150,
};

/** Opening fabric stock per `${warehouseId}|${itemId}|${yarnId}`. */
export const DEMO_FABRIC_STOCK: Record<string, number> = {
  "wh-grey|it-501|yn-vis-red": 100,
  "wh-fin|it-620|yn-poly-beige": 60,
  "wh-main|it-710|yn-zari": 40,
};

/** Last demo number per document type; new documents continue from here. */
export const DEMO_COUNTERS: Record<ProductionKind, number> = {
  jobOrder: 2864,
  yarnIssue: 411,
  yarnReturn: 57,
  jobCard: 3243,
  dailyProduction: 1880,
  jobCardReceipt: 972,
  buttaIssue: 140,
  buttaReceipt: 131,
  millIssue: 88,
  millReceipt: 80,
  fabricTransfer: 23,
  cutting: 311,
  fabricConversion: 16,
};

type Seed = { [K in ProductionKind]: { kind: K; input: InputOf<K> } }[ProductionKind];

const d = (daysAgo: number) => addDays(todayIso(), -daysAgo);

/**
 * Seed documents, posted in order through the demo service so their linked quantities
 * follow the same rules as documents entered on screen. `ref:<kind>:<n>` placeholders
 * are replaced with the id of the n-th seeded document of that kind.
 */
export function demoSeeds(): Seed[] {
  return [
    {
      kind: "jobOrder",
      input: {
        date: d(21),
        orderPartyId: "pt-krishna",
        salesOrderId: "so-121",
        partyOrderNo: "SKF/PO/77",
        itemId: "it-620",
        yarnId: "yn-poly-beige",
        qty: 300,
        rate: 42.5,
        remark: "",
      },
    },
    {
      kind: "jobOrder",
      input: {
        date: d(20),
        orderPartyId: "pt-labdhi",
        salesOrderId: "so-118",
        partyOrderNo: "LS/2026/044",
        itemId: "it-501",
        yarnId: "yn-vis-red",
        qty: 500,
        rate: 38.75,
        remark: "Urgent",
      },
    },
    {
      kind: "yarnIssue",
      input: {
        date: d(18),
        jobOrderId: "ref:jobOrder:1",
        warehouseId: "wh-yarn",
        unitId: "unit-1",
        yarnId: "yn-vis-red",
        qty: 100,
        rate: 210,
        remark: "",
      },
    },
    {
      kind: "yarnReturn",
      input: { date: d(12), yarnIssueId: "ref:yarnIssue:0", qty: 20, remark: "Excess cones" },
    },
    {
      kind: "yarnIssue",
      input: {
        date: d(17),
        jobOrderId: "ref:jobOrder:0",
        warehouseId: "wh-yarn",
        unitId: "unit-2",
        yarnId: "yn-poly-beige",
        qty: 150,
        rate: 185,
        remark: "",
      },
    },
    {
      kind: "jobCard",
      input: {
        date: d(16),
        jobOrderId: "ref:jobOrder:1",
        partyId: "pt-labdhi",
        cardNo: "C-33-01",
        itemId: "it-501",
        yarnId: "yn-vis-red",
        machineId: "mc-33",
        unitId: "unit-1",
        issuedQty: 120,
        remark: "",
      },
    },
    {
      kind: "jobCard",
      input: {
        date: d(15),
        jobOrderId: "ref:jobOrder:0",
        partyId: "pt-krishna",
        cardNo: "C-12-04",
        itemId: "it-620",
        yarnId: "yn-poly-beige",
        machineId: "mc-12",
        unitId: "unit-1",
        issuedQty: 200,
        remark: "",
      },
    },
    {
      kind: "dailyProduction",
      input: {
        date: d(9),
        warehouseId: "wh-grey",
        unitId: "unit-1",
        receiveType: "DAILY PRODUCTION",
        remark: "",
        lines: [{ jobCardId: "ref:jobCard:0", qty: 30, saleRate: 0, pickRate: 0.32, rate: 38.75 }],
      },
    },
    {
      kind: "dailyProduction",
      input: {
        date: d(5),
        warehouseId: "wh-fin",
        unitId: "unit-1",
        receiveType: "DAILY PRODUCTION",
        remark: "",
        lines: [{ jobCardId: "ref:jobCard:1", qty: 40, saleRate: 0, pickRate: 0.28, rate: 42.5 }],
      },
    },
    {
      kind: "jobCardReceipt",
      input: {
        date: d(7),
        jobCardId: "ref:jobCard:1",
        unitId: "unit-1",
        beamId: "bm-102",
        receiveQty: 50,
        saleQty: 20,
        stockQty: 30,
        stockStatus: "Stock",
        pickRate: 0.28,
        remark: "",
      },
    },
    {
      kind: "buttaIssue",
      input: {
        date: d(8),
        warehouseId: "wh-grey",
        partyId: "jw-mahavir",
        jobOrderId: "ref:jobOrder:1",
        itemId: "it-501",
        yarnId: "yn-vis-red",
        qty: 100,
        metres: 550,
        remark: "",
      },
    },
    {
      kind: "buttaReceipt",
      input: {
        date: d(4),
        issueId: "ref:buttaIssue:0",
        warehouseId: "wh-grey",
        receiveQty: 40,
        metres: 220,
        saleQty: 0,
        stockQty: 40,
        stockStatus: "Stock",
        rate: 12,
        remark: "",
      },
    },
    {
      kind: "millIssue",
      input: {
        date: d(6),
        warehouseId: null,
        partyId: "jw-ganesh",
        jobOrderId: "ref:jobOrder:0",
        itemId: "it-620",
        yarnId: "yn-poly-beige",
        qty: 150,
        metres: 900,
        remark: "",
      },
    },
    {
      kind: "millReceipt",
      input: {
        date: d(3),
        issueId: "ref:millIssue:0",
        warehouseId: "wh-fin",
        receiveQty: 50,
        metres: 300,
        saleQty: 10,
        stockQty: 40,
        stockStatus: "Stock",
        rate: 9.5,
        remark: "",
      },
    },
    {
      kind: "fabricTransfer",
      input: {
        date: d(2),
        fromWarehouseId: "wh-fin",
        toWarehouseId: "wh-main",
        jobCardId: "ref:jobCard:1",
        itemId: "it-620",
        yarnId: "yn-poly-beige",
        qty: 10,
        remark: "Showroom sample",
      },
    },
    {
      kind: "cutting",
      input: {
        date: d(2),
        salesOrderId: "so-118",
        jobOrderId: "ref:jobOrder:1",
        itemId: "it-501",
        yarnId: "yn-vis-red",
        gradeId: "gr-a",
        qty: 10,
        remark: "",
      },
    },
    {
      kind: "fabricConversion",
      input: {
        date: d(1),
        conversionType: "Fabric Conversion",
        warehouseId: "wh-main",
        convertBy: "Demo Supervisor",
        productName: "Jacquard Butta Saree",
        quantityPreserving: false,
        remark: "",
        stockOut: [
          {
            jobOrderId: "ref:jobOrder:1",
            itemId: "it-501",
            yarnId: "yn-vis-red",
            unitId: "unit-1",
            boxNo: "BX-14",
            qty: 20,
            remark: "",
          },
        ],
        stockIn: [{ itemId: "it-710", unitId: "unit-1", qty: 19.5, remark: "" }],
      },
    },
  ];
}
