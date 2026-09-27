/** Browser print layout for one item (no server PDF). */
import type {
  ItemInput,
  ItemMasterLookups,
  LookupOption,
} from "@/features/item-master/types/item-master";
import { warpTotals, weftTotals } from "@/features/item-master/utils/item-model";
import { formatDate, formatNumber } from "@/lib/erp/formatting";
import type { PrecisionKind } from "@/lib/erp/numbers";
import { printSections, type PrintSection } from "@/lib/erp/export";

const n = (v: number | null, kind: PrecisionKind) => (v === null ? "" : formatNumber(v, kind));
const name = (list: LookupOption[], id: string) => list.find((x) => x.id === id)?.name ?? "";
const names = (list: LookupOption[], ids: string[]) =>
  ids
    .map((id) => name(list, id))
    .filter(Boolean)
    .join(", ");
const yes = (b: boolean) => (b ? "Yes" : "No");
const R = "right" as const;

export function buildItemPrintSections(item: ItemInput, l: ItemMasterLookups): PrintSection[] {
  const b = item.basic;
  const w = item.weft;
  const wp = item.warp;
  const s = item.setup;
  const st = item.status;
  const yarn = (id: string) => name(l.yarns, id);
  const wt = weftTotals(w);
  const pt = warpTotals(wp);
  return [
    {
      heading: "Basic Configuration",
      fields: [
        ["Product Type", name(l.productTypes, b.productTypeId)],
        ["Product Name", b.productName],
        ["Category", name(l.categories, b.categoryId)],
        ["Group", name(l.groups, b.groupId)],
        ["Sub Group", name(l.subGroups, b.subGroupId)],
        ["Brand", name(l.brands, b.brandId)],
        ["Shade", name(l.shades, b.shadeId)],
        ["Design Group", name(l.designGroups, b.designGroupId)],
        ["Short Description", b.shortDescription],
        ["Item Remark", b.itemRemark],
        ["Work Cut", b.workCut],
        ["Create Date", formatDate(b.createDate)],
        ["Menu", b.menu],
        ["Is Service", yes(b.isService)],
        ["Primary Unit", l.uoms.find((u) => u.id === b.primaryUnitId)?.code ?? ""],
        ["Secondary Unit", l.uoms.find((u) => u.id === b.secondaryUnitId)?.code ?? ""],
        ["HSN / SAC", b.hsnSac],
        [
          "Tax 1 / 2 / 3 (%)",
          [b.tax1Pct, b.tax2Pct, b.tax3Pct].map((t) => n(t, "percent") || "—").join(" / "),
        ],
      ],
      table: {
        columns: [{ header: "Sr" }, { header: "Party Name" }, { header: "Synonym" }],
        rows: item.partyAliases.map((a, i) => [
          String(i + 1),
          name(l.parties, a.partyId),
          a.synonym,
        ]),
      },
    },
    {
      heading: "Weft BOM",
      fields: [
        ["Ground Pick", n(w.groundPick, "qty")],
        ["Cut", n(w.cut, "metres")],
        ["Width / Reed", w.widthReed],
        ["Reed Space", n(w.reedSpace, "qty")],
        ["Add Cut %", n(w.addCutPct, "percent")],
        ["Sale Rate", n(w.saleRate, "rate")],
        ["Other Cost", n(w.otherCost, "amount")],
        ["Beam Product", yarn(w.beam.productId)],
        ["Beam Ends / Meter", `${n(w.beam.noOfEnds, "qty")} / ${n(w.beam.meter, "metres")}`],
        ["Beam Denier", n(w.beam.denier, "qty")],
        ["Beam Weight / Pcs", n(w.beam.weightPerPcs, "weight")],
        ["Beam Rate / Cost", `${n(w.beam.rate, "rate")} / ${n(w.beam.cost, "amount")}`],
        ["BOM Description", w.bomDescription],
        ["Total Pick", n(wt.totalPick, "qty")],
        ["Total Card", n(wt.totalCard, "qty")],
        ["Total Per Pcs Yarn", n(wt.totalPerPcsYarn, "weight")],
        ["Pick Rate *", n(w.pickRate, "rate")],
        ["Per Pcs Yarn *", n(w.perPcsYarn, "weight")],
        ["Job Rate *", n(w.jobRate, "rate")],
        ["Net Cost *", n(w.netCost, "amount")],
      ],
      table: {
        columns: [
          { header: "No." },
          { header: "Product Name" },
          { header: "Pick", align: R },
          { header: "Card", align: R },
          { header: "Denier", align: R },
          { header: "Per Pcs Yarn", align: R },
          { header: "Rate", align: R },
          { header: "Per Pcs Rate", align: R },
        ],
        rows: w.lines.map((x, i) => [
          String(i + 1),
          yarn(x.productId),
          n(x.pick, "qty"),
          n(x.card, "qty"),
          n(x.denier, "qty"),
          n(x.perPcsYarn, "weight"),
          n(x.rate, "rate"),
          n(x.perPcsRate, "amount"),
        ]),
      },
      note: "* Entered values — formula pending business confirmation.",
    },
    {
      heading: "Warp BOM",
      fields: [
        ["Length", n(wp.length, "metres")],
        ["Denting (Bharan)", wp.denting],
        ["Total Beam Ends", n(wp.totalBeamEnds, "qty")],
        ["BOM Description", wp.bomDescription],
        ["Total Ends", n(pt.totalEnds, "qty")],
        ["Total Qty (Wt)", n(pt.totalQtyWt, "weight")],
        ["Per Pcs Yarn *", n(wp.perPcsYarn, "weight")],
        ["Net Cost *", n(wp.netCost, "amount")],
      ],
      table: {
        columns: [
          { header: "No." },
          { header: "Type" },
          { header: "Product Name" },
          { header: "Denier", align: R },
          { header: "Ends", align: R },
          { header: "Pattern" },
          { header: "Pattern Seq" },
          { header: "Qty (Wt)", align: R },
          { header: "Per Mtr Yarn (Wt)", align: R },
          { header: "Yarn Rate", align: R },
          { header: "Amount", align: R },
        ],
        rows: wp.lines.map((x, i) => [
          String(i + 1),
          name(l.warpTypes, x.typeId),
          yarn(x.productId),
          n(x.denier, "qty"),
          n(x.ends, "qty"),
          x.pattern,
          x.patternSeq,
          n(x.qtyWt, "weight"),
          n(x.perMtrYarnWt, "conversion"),
          n(x.yarnRate, "rate"),
          n(x.amount, "amount"),
        ]),
      },
      note: "* Entered values — formula pending business confirmation.",
    },
    {
      heading: "Setup Configuration",
      fields: [
        ["Manage Lot Number", yes(s.manageLotNumber)],
        ["Manage Quality Controlled", yes(s.manageQualityControlled)],
        ["Manage Container Controlled", yes(s.manageContainerControlled)],
        ["Standard BOM Beam", name(l.standardBomBeams, s.standardBomBeamId)],
        ["Standard BoM", name(l.standardBoms, s.standardBomId)],
        ["Rate %", n(s.ratePct, "percent")],
        ...s.rates.map((r, i): [string, string] => [`Rate ${i + 1}`, n(r, "rate")]),
        ["Conversion", n(s.conversion, "conversion")],
        ["Primary Conversion Factor", n(s.primaryConversionFactor, "conversion")],
        ["Multiplier", n(s.multiplier, "conversion")],
        ["Avg Weight", n(s.avgWeight, "weight")],
        ["Discount (%)", n(s.discountPct, "percent")],
        ["Special Dis (%)", n(s.specialDiscountPct, "percent")],
      ],
    },
    {
      heading: "Status Configuration",
      fields: [
        ["Product Status", name(l.productStatuses, st.productStatusId)],
        ["Valid From", formatDate(st.validFrom)],
        ["Upto Date", st.validTo ? formatDate(st.validTo) : "Open-ended"],
        ["Allowed Company", names(l.companies, st.allowedCompanyIds)],
        ["Allowed Department", names(l.departments, st.allowedDepartmentIds)],
        ["Allowed Process", names(l.processes, st.allowedProcessIds)],
      ],
    },
  ];
}

export function printItem(code: string, item: ItemInput, lookups: ItemMasterLookups): boolean {
  return printSections(
    `Item Master — ${code} ${item.basic.productName}`,
    "Frontend prototype — not saved to the database",
    buildItemPrintSections(item, lookups),
  );
}
