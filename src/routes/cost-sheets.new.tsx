import { createFileRoute } from "@tanstack/react-router";
import {
  CostSheetEditor,
  defaultCharges,
  defaultLines,
  emptyHeader,
} from "@/components/cost-sheet-editor";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/cost-sheets/new")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "New Cost Sheet — SCKT ERP" },
      {
        name: "description",
        content:
          "Create a fabric cost sheet: warp and weft yarn lines, wastage, process charges and card cost with exact workbook arithmetic.",
      },
      { property: "og:title", content: "New Cost Sheet — SCKT ERP" },
      {
        property: "og:description",
        content: "Spreadsheet-grade fabric costing with frozen yarn rates and audit attribution.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewCostSheet,
});

function NewCostSheet() {
  const sheetNo = `CS-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  return (
    <CostSheetEditor
      initialHeader={emptyHeader(sheetNo)}
      initialLines={defaultLines()}
      initialCharges={defaultCharges()}
    />
  );
}
