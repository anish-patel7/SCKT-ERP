/**
 * Item Master helpers: empty / clone factories, safe summaries and frontend validation.
 *
 * Validation here is for data entry only — THE BACKEND MUST VALIDATE AGAIN.
 * Summaries are plain sums of entered line values. No textile formula (per-piece yarn,
 * pick rate, job rate, beam cost, net cost, warp/weft weight) is computed here:
 * FINAL BUSINESS FORMULA PENDING CONFIRMATION.
 */
import type {
  ItemInput,
  ItemRecord,
  ItemValidationErrors,
  WarpDetail,
  WarpLine,
  WeftDetail,
  WeftLine,
} from "@/features/item-master/types/item-master";
import { isIsoDate, todayIso } from "@/lib/erp/formatting";
import { sumQty } from "@/lib/erp/numbers";

export const RATE_SLOTS = 10;

let seq = 0;
export function newRowId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function emptyWeftLine(): WeftLine {
  return {
    id: newRowId("weft"),
    productId: "",
    pick: null,
    card: null,
    denier: null,
    perPcsYarn: null,
    rate: null,
    perPcsRate: null,
  };
}

export function emptyWarpLine(): WarpLine {
  return {
    id: newRowId("warp"),
    typeId: "",
    productId: "",
    denier: null,
    ends: null,
    pattern: "",
    patternSeq: "",
    qtyWt: null,
    perMtrYarnWt: null,
    yarnRate: null,
    amount: null,
  };
}

export function emptyItemInput(): ItemInput {
  return {
    basic: {
      productTypeId: "",
      productName: "",
      categoryId: "",
      groupId: "",
      subGroupId: "",
      brandId: "",
      shadeId: "",
      shortDescription: "",
      itemRemark: "",
      workCut: "",
      createDate: todayIso(),
      menu: "",
      designGroupId: "",
      isService: false,
      primaryUnitId: "",
      secondaryUnitId: "",
      hsnSac: "",
      tax1Pct: null,
      tax2Pct: null,
      tax3Pct: null,
    },
    partyAliases: [],
    weft: {
      groundPick: null,
      cut: null,
      widthReed: "",
      reedSpace: null,
      copyRecipeItemId: "",
      addCutPct: null,
      saleRate: null,
      otherCost: null,
      beam: {
        productId: "",
        noOfEnds: null,
        meter: null,
        denier: null,
        weightPerPcs: null,
        rate: null,
        cost: null,
      },
      lines: [],
      bomDescription: "",
      pickRate: null,
      perPcsYarn: null,
      jobRate: null,
      netCost: null,
    },
    warp: {
      length: null,
      denting: "",
      bomDescription: "",
      totalBeamEnds: null,
      lines: [],
      perPcsYarn: null,
      netCost: null,
    },
    setup: {
      manageLotNumber: false,
      manageQualityControlled: false,
      manageContainerControlled: false,
      standardBomBeamId: "",
      standardBomId: "",
      ratePct: null,
      discountPct: null,
      rates: Array.from({ length: RATE_SLOTS }, () => null),
      conversion: null,
      avgWeight: null,
      primaryConversionFactor: null,
      multiplier: null,
      specialDiscountPct: null,
    },
    status: {
      productStatusId: "",
      validFrom: todayIso(),
      validTo: "",
      allowedCompanyIds: [],
      allowedDepartmentIds: [],
      allowedProcessIds: [],
    },
    image: null,
    attachments: [],
  };
}

/** The editable part of a record (identity, status and timestamps stripped). */
export function toInput(record: ItemRecord): ItemInput {
  const {
    id: _id,
    code: _code,
    recordStatus: _rs,
    origin: _o,
    createdAt: _c,
    updatedAt: _u,
    ...input
  } = record;
  return structuredClone(input);
}

/**
 * Clone into a new draft: all five configuration tabs and party aliases are copied with
 * fresh row ids. Not copied: identity, code, timestamps, image and attachments (files
 * belong to the original item). The name is only a suggestion.
 */
export function cloneItemInput(source: ItemInput): ItemInput {
  const copy = structuredClone(source);
  return {
    ...copy,
    basic: {
      ...copy.basic,
      productName: copy.basic.productName ? `Copy of ${copy.basic.productName}` : "",
      createDate: todayIso(),
    },
    partyAliases: copy.partyAliases.map((a) => ({ ...a, id: newRowId("alias") })),
    weft: { ...copy.weft, lines: copy.weft.lines.map((l) => ({ ...l, id: newRowId("weft") })) },
    warp: { ...copy.warp, lines: copy.warp.lines.map((l) => ({ ...l, id: newRowId("warp") })) },
    image: null,
    attachments: [],
  };
}

/** Copy Recipe: the weft detail rows of another item (fresh row ids). */
export function copyWeftRecipe(from: WeftDetail): WeftLine[] {
  return from.lines.map((l) => ({ ...structuredClone(l), id: newRowId("weft") }));
}

const entered = (values: (number | null)[]) => values.filter((v): v is number => v !== null);

/** Plain sums of the weft lines (safe: no business formula). */
export function weftTotals(weft: WeftDetail) {
  return {
    totalPick: sumQty(entered(weft.lines.map((l) => l.pick))),
    totalCard: sumQty(entered(weft.lines.map((l) => l.card))),
    totalPerPcsYarn: sumQty(entered(weft.lines.map((l) => l.perPcsYarn))),
  };
}

/** Plain sums of the warp lines (safe: no business formula). */
export function warpTotals(warp: WarpDetail) {
  return {
    totalEnds: sumQty(entered(warp.lines.map((l) => l.ends))),
    totalQtyWt: sumQty(entered(warp.lines.map((l) => l.qtyWt))),
  };
}

// ---------------------------------------------------------------------------
// Validation (frontend only)
// ---------------------------------------------------------------------------

function checkPercent(errors: ItemValidationErrors, path: string, value: number | null) {
  if (value !== null && (value < 0 || value > 100)) errors[path] = "Enter a value from 0 to 100";
}

function checkNonNegative(errors: ItemValidationErrors, path: string, value: number | null) {
  if (value !== null && value < 0) errors[path] = "Cannot be negative";
}

/**
 * "draft": only the identity needed to find the draft again (product name).
 * "save": required fields and sanity checks for a complete item.
 */
export function validateItem(input: ItemInput, level: "draft" | "save"): ItemValidationErrors {
  const errors: ItemValidationErrors = {};
  const b = input.basic;
  if (!b.productName.trim()) errors["basic.productName"] = "Product Name is required";
  if (level === "draft") return errors;

  if (!b.productTypeId) errors["basic.productTypeId"] = "Select a product type";
  if (!b.createDate || !isIsoDate(b.createDate)) errors["basic.createDate"] = "Enter a valid date";
  checkPercent(errors, "basic.tax1Pct", b.tax1Pct);
  checkPercent(errors, "basic.tax2Pct", b.tax2Pct);
  checkPercent(errors, "basic.tax3Pct", b.tax3Pct);

  input.partyAliases.forEach((a, i) => {
    if (!a.partyId) errors[`partyAliases.${i}.partyId`] = "Select a party";
    if (!a.synonym.trim())
      errors[`partyAliases.${i}.synonym`] = "Enter the party's name for this item";
  });

  checkPercent(errors, "weft.addCutPct", input.weft.addCutPct);
  input.weft.lines.forEach((l, i) => {
    for (const f of ["pick", "card", "denier", "perPcsYarn", "rate", "perPcsRate"] as const) {
      checkNonNegative(errors, `weft.lines.${i}.${f}`, l[f]);
    }
  });
  input.warp.lines.forEach((l, i) => {
    for (const f of ["denier", "ends", "qtyWt", "perMtrYarnWt", "yarnRate", "amount"] as const) {
      checkNonNegative(errors, `warp.lines.${i}.${f}`, l[f]);
    }
  });

  const s = input.setup;
  checkPercent(errors, "setup.ratePct", s.ratePct);
  checkPercent(errors, "setup.discountPct", s.discountPct);
  checkPercent(errors, "setup.specialDiscountPct", s.specialDiscountPct);

  const st = input.status;
  if (!st.productStatusId) errors["status.productStatusId"] = "Select a product status";
  if (!st.validFrom || !isIsoDate(st.validFrom)) {
    errors["status.validFrom"] = "Enter a valid date";
  } else if (st.validTo) {
    if (!isIsoDate(st.validTo)) errors["status.validTo"] = "Enter a valid date";
    else if (st.validTo < st.validFrom)
      errors["status.validTo"] = "Upto Date cannot be before Valid From";
  }
  return errors;
}

/** Which tab holds a validation error, so the workspace can jump to it. */
export function tabOfError(path: string): "basic" | "weft" | "warp" | "setup" | "status" {
  const head = path.split(".")[0];
  if (head === "partyAliases" || head === "basic") return "basic";
  if (head === "weft" || head === "warp" || head === "setup" || head === "status") return head;
  return "basic";
}
