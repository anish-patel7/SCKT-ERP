import { describe, expect, it } from "vitest";
import {
  compareQty,
  lineAmount,
  parseDecimal,
  subtractQty,
  sumAmount,
  sumQty,
} from "@/lib/erp/numbers";
import { formatAmount, formatDate, formatQty, isIsoDate } from "@/lib/erp/formatting";
import { toCsv } from "@/lib/erp/export";
import {
  PRODUCTION_FEATURES,
  featurePath,
  findFeature,
  productionModuleNav,
} from "@/features/production/config/production-features";

describe("decimal-safe quantities", () => {
  it("does not drift like floating point", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumQty([0.1, 0.2])).toBe(0.3);
    expect(subtractQty(120, 30, 0.1)).toBe(89.9);
    expect(compareQty(80, 80.0000001)).toBe(0);
    expect(sumAmount([0.1, 0.2])).toBe(0.3);
  });

  it("amount = qty × rate rounded to 2 decimals", () => {
    expect(lineAmount(500, 38.75)).toBe(19375);
    expect(lineAmount(1.005, 1)).toBe(1.01);
    expect(lineAmount(12.345, 10.1)).toBe(124.68);
  });

  it("parses only plain decimals", () => {
    expect(parseDecimal("1,250.5")).toBe(1250.5);
    expect(parseDecimal("")).toBeNaN();
    expect(parseDecimal("12abc")).toBeNaN();
  });

  it("formats by kind and dates as DD/MM/YYYY", () => {
    expect(formatQty(90)).toBe("90.000");
    expect(formatAmount(19375)).toBe("19,375.00");
    expect(formatDate("2026-09-27")).toBe("27/09/2026");
    expect(isIsoDate("2026-02-30")).toBe(false);
  });

  it("escapes CSV cells", () => {
    expect(
      toCsv({ columns: [{ header: "A" }, { header: "B" }], rows: [["x,y", 'say "hi"']] }),
    ).toBe('A,B\r\n"x,y","say ""hi"""');
  });
});

describe("production feature registry", () => {
  it("has the 14 Rapier screens and 10 Warping screens with unique paths", () => {
    const rapier = PRODUCTION_FEATURES.filter((f) => f.module === "rapier");
    const warping = PRODUCTION_FEATURES.filter((f) => f.module === "warping");
    expect(rapier).toHaveLength(14);
    expect(warping).toHaveLength(10);
    // Every Warping screen is built (three from the old Beam Store, seven provisional).
    expect(warping.every((f) => f.status === "demo")).toBe(true);
    const paths = PRODUCTION_FEATURES.map(featurePath);
    expect(new Set(paths).size).toBe(paths.length);
    expect(findFeature("rapier", "job-cards/daily-production")?.label).toBe(
      "Daily Job Card Production Entry",
    );
  });

  it("nests the daily production screens under their section in the menu", () => {
    const nav = productionModuleNav("rapier");
    expect(nav.label).toBe("Rapier Module");
    const section = nav.children?.find((c) => c.label === "Daily Production Section");
    expect(section?.children?.map((c) => c.label)).toEqual([
      "Daily Job Card Production Entry",
      "Daily Job Card Production Report",
    ]);
    expect(nav.children?.map((c) => c.label)).toEqual([
      "Job Order Entry",
      "Yarn Issue Entry",
      "Yarn Return Entry",
      "Job Card Issue Entry",
      "Daily Production Section",
      "Job Card Receive Entry",
      "Butta Cutting Issue Entry",
      "Butta Cutting Receive Entry",
      "Mill Issue Entry",
      "Mill Receive Entry",
      "Fabric Stock Transfer Entry",
      "Cutting Entry",
      "Fabric Stock Convert Entry",
    ]);
  });

  it("future permission resources are metadata, not active codes", () => {
    for (const f of PRODUCTION_FEATURES) {
      expect(f.futurePermissionResource).toMatch(/^production\.(rapier|warping)\.[a-z_]+$/);
      expect(f.futurePermissionResource).not.toContain(":");
    }
  });
});
