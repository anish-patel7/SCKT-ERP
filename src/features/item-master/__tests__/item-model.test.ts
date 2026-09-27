import { describe, expect, it } from "vitest";
import {
  cloneItemInput,
  copyWeftRecipe,
  emptyItemInput,
  tabOfError,
  toInput,
  validateItem,
  warpTotals,
  weftTotals,
} from "@/features/item-master/utils/item-model";
import { demoItemRecords } from "@/features/item-master/demo/item-master-demo-data";
import { buildItemPrintSections } from "@/features/item-master/utils/item-print";
import { ITEM_MASTER_DEMO_LOOKUPS } from "@/features/item-master/demo/item-master-demo-data";
import { todayIso } from "@/lib/erp/formatting";

const salsa = () => {
  const r = demoItemRecords().find((i) => i.code === "SL02");
  if (!r) throw new Error("SL02 fixture missing");
  return r;
};

describe("validateItem", () => {
  it("draft requires only the product name", () => {
    const input = emptyItemInput();
    expect(validateItem(input, "draft")).toEqual({
      "basic.productName": "Product Name is required",
    });
    input.basic.productName = "Test";
    expect(validateItem(input, "draft")).toEqual({});
  });

  it("save requires product type and product status", () => {
    const input = emptyItemInput();
    input.basic.productName = "Test";
    const errors = validateItem(input, "save");
    expect(Object.keys(errors).sort()).toEqual(["basic.productTypeId", "status.productStatusId"]);
  });

  it("checks tax and setup percentages are 0–100", () => {
    const input = toInput(salsa());
    input.basic.tax1Pct = 101;
    input.basic.tax2Pct = -1;
    input.setup.discountPct = 150;
    input.weft.addCutPct = 100;
    const errors = validateItem(input, "save");
    expect(errors["basic.tax1Pct"]).toBeDefined();
    expect(errors["basic.tax2Pct"]).toBeDefined();
    expect(errors["setup.discountPct"]).toBeDefined();
    expect(errors["weft.addCutPct"]).toBeUndefined();
  });

  it("allows open-ended validity and rejects Upto before Valid From", () => {
    const input = toInput(salsa());
    input.status.validFrom = "2026-09-10";
    input.status.validTo = "";
    expect(validateItem(input, "save")).toEqual({});
    input.status.validTo = "2026-09-10";
    expect(validateItem(input, "save")).toEqual({});
    input.status.validTo = "2026-09-09";
    expect(validateItem(input, "save")["status.validTo"]).toMatch(/before/);
  });

  it("requires complete party alias rows and non-negative grid values", () => {
    const input = toInput(salsa());
    input.partyAliases.push({ id: "a", partyId: "", synonym: " " });
    const firstWeft = input.weft.lines[0];
    const firstWarp = input.warp.lines[0];
    if (!firstWeft || !firstWarp) throw new Error("fixture rows missing");
    firstWeft.pick = -1;
    firstWarp.ends = -5;
    const errors = validateItem(input, "save");
    expect(errors["partyAliases.2.partyId"]).toBeDefined();
    expect(errors["partyAliases.2.synonym"]).toBeDefined();
    expect(errors["weft.lines.0.pick"]).toBeDefined();
    expect(errors["warp.lines.0.ends"]).toBeDefined();
  });

  it("maps error paths to tabs", () => {
    expect(tabOfError("partyAliases.0.partyId")).toBe("basic");
    expect(tabOfError("weft.lines.1.pick")).toBe("weft");
    expect(tabOfError("warp.length")).toBe("warp");
    expect(tabOfError("setup.ratePct")).toBe("setup");
    expect(tabOfError("status.validTo")).toBe("status");
  });
});

describe("clone and copy recipe", () => {
  it("copies all five tabs and aliases with fresh row ids, suggests a name", () => {
    const source = toInput(salsa());
    source.image = { name: "a.png", type: "image/png", size: 1, url: "blob:x" };
    source.attachments = [{ id: "x", name: "f", type: "t", size: 1, addedBy: "u", addedAt: "" }];
    const clone = cloneItemInput(source);
    expect(clone.basic.productName).toBe("Copy of SL02-SALSA");
    expect(clone.basic.createDate).toBe(todayIso());
    expect(clone.basic.productTypeId).toBe(source.basic.productTypeId);
    expect(clone.weft.beam).toEqual(source.weft.beam);
    expect(clone.setup).toEqual(source.setup);
    expect(clone.status).toEqual(source.status);
    expect(clone.warp.lines.map((l) => l.ends)).toEqual(source.warp.lines.map((l) => l.ends));
    const ids = [...clone.weft.lines, ...clone.warp.lines, ...clone.partyAliases].map((l) => l.id);
    const sourceIds = [...source.weft.lines, ...source.warp.lines, ...source.partyAliases].map(
      (l) => l.id,
    );
    expect(ids.some((id) => sourceIds.includes(id))).toBe(false);
    expect(clone.image).toBeNull();
    expect(clone.attachments).toEqual([]);
  });

  it("does not share nested objects with the source", () => {
    const source = toInput(salsa());
    const clone = cloneItemInput(source);
    clone.status.allowedCompanyIds.push("co-x");
    expect(source.status.allowedCompanyIds).not.toContain("co-x");
  });

  it("copy recipe returns the weft rows with new ids", () => {
    const source = salsa().weft;
    const lines = copyWeftRecipe(source);
    expect(lines.map((l) => l.productId)).toEqual(source.lines.map((l) => l.productId));
    expect(lines.map((l) => l.id)).not.toEqual(source.lines.map((l) => l.id));
  });
});

describe("safe totals (plain sums only)", () => {
  it("sums weft pick, card and per-pcs yarn without float drift", () => {
    const t = weftTotals(salsa().weft);
    expect(t).toEqual({ totalPick: 64, totalCard: 2400, totalPerPcsYarn: 0.318 });
  });

  it("ignores blank cells", () => {
    const input = emptyItemInput();
    input.warp.lines = [
      { ...toInput(salsa()).warp.lines[0]!, ends: 10, qtyWt: 0.1 },
      { ...toInput(salsa()).warp.lines[1]!, ends: null, qtyWt: 0.2 },
    ];
    expect(warpTotals(input.warp)).toEqual({ totalEnds: 10, totalQtyWt: 0.3 });
  });
});

describe("print layout", () => {
  it("includes basic, weft, warp, setup and status sections", () => {
    const sections = buildItemPrintSections(toInput(salsa()), ITEM_MASTER_DEMO_LOOKUPS);
    expect(sections.map((s) => s.heading)).toEqual([
      "Basic Configuration",
      "Weft BOM",
      "Warp BOM",
      "Setup Configuration",
      "Status Configuration",
    ]);
    expect(sections[1]?.table?.rows).toHaveLength(3);
    expect(sections[2]?.table?.rows).toHaveLength(2);
  });
});
