/**
 * DEVELOPMENT / DEMO DATA ONLY for the Item Master prototype. In memory, rebuilt on every
 * page load, never written to Supabase or localStorage. Values are illustrative: they are
 * NOT verified textile recipes and no formula was used to derive them.
 */
import type {
  ItemInput,
  ItemMasterLookups,
  ItemRecord,
} from "@/features/item-master/types/item-master";
import {
  DEMO_COMPANIES,
  DEMO_DEPARTMENTS,
  DEMO_PARTIES,
  DEMO_PROCESSES,
  DEMO_UOMS,
  DEMO_YARNS,
} from "@/features/masters/demo/shared-master-fixtures";
import { emptyItemInput, RATE_SLOTS } from "@/features/item-master/utils/item-model";
import { addDays, todayIso } from "@/lib/erp/formatting";

const opt = (id: string, code: string, name: string) => ({ id, code, name });

export const ITEM_MASTER_DEMO_LOOKUPS: ItemMasterLookups = {
  // Placeholder lists until the canonical masters are connected.
  productTypes: [
    opt("pt-fabric", "FAB", "Finished Fabric"),
    opt("pt-grey", "GRY", "Grey Fabric"),
    opt("pt-saree", "SAR", "Saree"),
    opt("pt-service", "SRV", "Service"),
  ],
  categories: [
    opt("cat-saree", "SAREE", "Saree"),
    opt("cat-dress", "DRESS", "Dress Material"),
    opt("cat-dupatta", "DUP", "Dupatta"),
  ],
  groups: [opt("grp-jacquard", "RJQ", "Rapier Jacquard"), opt("grp-plain", "RPL", "Rapier Plain")],
  subGroups: [
    { ...opt("sg-butta", "BUT", "Butta"), groupId: "grp-jacquard" },
    { ...opt("sg-allover", "ALL", "All-over"), groupId: "grp-jacquard" },
    { ...opt("sg-border", "BRD", "Border"), groupId: "grp-plain" },
    { ...opt("sg-solid", "SOL", "Solid"), groupId: "grp-plain" },
  ],
  brands: [opt("br-sckt", "SCKT", "SCKT Premium"), opt("br-ck", "CK", "Chehar Krupa")],
  shades: [
    opt("sh-red", "RED", "Red"),
    opt("sh-beige", "BEI", "Beige"),
    opt("sh-gold", "GLD", "Gold"),
    opt("sh-navy", "NAV", "Navy"),
    opt("sh-multi", "MLT", "Multi"),
  ],
  designGroups: [
    opt("dg-salsa", "DG-SAL", "Salsa Series"),
    opt("dg-floral", "DG-FLR", "Floral Garden"),
    opt("dg-classic", "DG-CLS", "Classic Plain"),
  ],
  uoms: DEMO_UOMS,
  parties: DEMO_PARTIES.filter((p) => p.kind === "customer"),
  yarns: DEMO_YARNS,
  // Warp line "Type" values are not specified yet.
  warpTypes: [
    opt("wt-ground", "GRD", "Ground"),
    opt("wt-border", "BRD", "Border"),
    opt("wt-selvedge", "SEL", "Selvedge"),
  ],
  standardBomBeams: [
    opt("sbb-101", "BM-101", "30 Kota Black Beam"),
    opt("sbb-102", "BM-102", "75 Beam Jari"),
    opt("sbb-103", "BM-103", "21 Bright Mono Beam"),
  ],
  standardBoms: [
    opt("bom-salsa", "BOM-SAL-01", "Salsa Standard BOM"),
    opt("bom-plain", "BOM-PLN-01", "Plain Saree Standard BOM"),
  ],
  productStatuses: [opt("ps-active", "ACT", "Active"), opt("ps-inactive", "INA", "Inactive")],
  companies: DEMO_COMPANIES,
  departments: DEMO_DEPARTMENTS,
  processes: DEMO_PROCESSES,
};

const rates = (values: (number | null)[]) =>
  Array.from({ length: RATE_SLOTS }, (_, i) => values[i] ?? null);

function salsa(): ItemInput {
  const base = emptyItemInput();
  return {
    ...base,
    basic: {
      ...base.basic,
      productTypeId: "pt-saree",
      productName: "SL02-SALSA",
      categoryId: "cat-saree",
      groupId: "grp-jacquard",
      subGroupId: "sg-butta",
      brandId: "br-sckt",
      shadeId: "sh-multi",
      shortDescription: "Salsa jacquard butta saree (demo fixture)",
      itemRemark: "Fixture for manual testing — values are illustrative only.",
      workCut: "5.50",
      createDate: addDays(todayIso(), -45),
      menu: "Sarees",
      designGroupId: "dg-salsa",
      primaryUnitId: "uom-pcs",
      secondaryUnitId: "uom-mtr",
      hsnSac: "5407",
      tax1Pct: 2.5,
      tax2Pct: 2.5,
      tax3Pct: null,
    },
    partyAliases: [
      { id: "alias-f1", partyId: "pt-labdhi", synonym: "SALSA BUTTA 5.5" },
      { id: "alias-f2", partyId: "pt-ridhi", synonym: "RS-SALSA-02" },
    ],
    weft: {
      ...base.weft,
      groundPick: 64,
      cut: 5.5,
      widthReed: "48/72",
      reedSpace: 52,
      addCutPct: 2,
      saleRate: 685,
      otherCost: 18,
      beam: {
        productId: "yn-kota-black",
        noOfEnds: 5444,
        meter: 1000,
        denier: 35,
        weightPerPcs: 0.21,
        rate: 480,
        cost: 100.8,
      },
      lines: [
        {
          id: "weft-f1",
          productId: "yn-vis-red",
          pick: 32,
          card: 1200,
          denier: 120,
          perPcsYarn: 0.165,
          rate: 360,
          perPcsRate: 59.4,
        },
        {
          id: "weft-f2",
          productId: "yn-zari",
          pick: 16,
          card: 800,
          denier: 150,
          perPcsYarn: 0.092,
          rate: 1450,
          perPcsRate: 133.4,
        },
        {
          id: "weft-f3",
          productId: "yn-poly-beige",
          pick: 16,
          card: 400,
          denier: 80,
          perPcsYarn: 0.061,
          rate: 210,
          perPcsRate: 12.81,
        },
      ],
      bomDescription: "Viscose red ground with zari butta, beige filler",
      pickRate: 0.32,
      perPcsYarn: 0.318,
      jobRate: 145,
      netCost: 469.41,
    },
    warp: {
      length: 5.5,
      denting: "2",
      bomDescription: "Kota black ground with zari border",
      totalBeamEnds: 5668,
      lines: [
        {
          id: "warp-f1",
          typeId: "wt-ground",
          productId: "yn-kota-black",
          denier: 35,
          ends: 5444,
          pattern: "1/1",
          patternSeq: "A",
          qtyWt: 0.205,
          perMtrYarnWt: 0.0373,
          yarnRate: 480,
          amount: 98.4,
        },
        {
          id: "warp-f2",
          typeId: "wt-border",
          productId: "yn-zari",
          denier: 150,
          ends: 224,
          pattern: "2/2",
          patternSeq: "B",
          qtyWt: 0.036,
          perMtrYarnWt: 0.0065,
          yarnRate: 1450,
          amount: 52.2,
        },
      ],
      perPcsYarn: 0.241,
      netCost: 150.6,
    },
    setup: {
      manageLotNumber: true,
      manageQualityControlled: true,
      manageContainerControlled: false,
      standardBomBeamId: "sbb-101",
      standardBomId: "bom-salsa",
      ratePct: 10,
      discountPct: 2,
      rates: rates([685, 670, 655, 640]),
      conversion: 5.5,
      avgWeight: 0.46,
      primaryConversionFactor: 1,
      multiplier: 1,
      specialDiscountPct: null,
    },
    status: {
      productStatusId: "ps-active",
      validFrom: addDays(todayIso(), -45),
      validTo: "",
      allowedCompanyIds: ["co-1", "co-2"],
      allowedDepartmentIds: ["dp-weaving", "dp-warping", "dp-folding"],
      allowedProcessIds: ["pr-butta"],
    },
  };
}

/** Items also referenced by the Production prototype (same ids, codes and names). */
function simple(
  name: string,
  categoryId: string,
  productTypeId: string,
  shadeId: string,
): ItemInput {
  const base = emptyItemInput();
  return {
    ...base,
    basic: {
      ...base.basic,
      productTypeId,
      productName: name,
      categoryId,
      groupId: "grp-plain",
      brandId: "br-ck",
      shadeId,
      primaryUnitId: "uom-pcs",
      secondaryUnitId: "uom-mtr",
      hsnSac: "5407",
      createDate: addDays(todayIso(), -90),
    },
    status: {
      ...base.status,
      productStatusId: "ps-active",
      validFrom: addDays(todayIso(), -90),
      allowedCompanyIds: ["co-1"],
    },
  };
}

export function demoItemRecords(): ItemRecord[] {
  const now = new Date().toISOString();
  const rec = (id: string, code: string, input: ItemInput): ItemRecord => ({
    ...input,
    id,
    code,
    recordStatus: "SAVED",
    origin: "fixture",
    createdAt: now,
    updatedAt: now,
  });
  return [
    rec("it-sl02", "SL02", salsa()),
    rec("it-501", "RP-501", simple("Rapier Saree 5.5 Mtr", "cat-saree", "pt-saree", "sh-red")),
    rec("it-620", "RP-620", simple("Rapier Dress Material", "cat-dress", "pt-fabric", "sh-beige")),
    rec("it-710", "RP-710", simple("Jacquard Butta Saree", "cat-saree", "pt-saree", "sh-gold")),
  ];
}
