import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  CostSheetEditor,
  defaultCharges,
  defaultLines,
} from "@/components/cost-sheet-editor";
import { useCostSheetDetail } from "@/hooks/useCostSheets";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/cost-sheets/$id")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Cost Sheet — SCKT ERP" },
      {
        name: "description",
        content:
          "Open a fabric cost sheet with its warp and weft lines, wastage, process charges, card cost and approval state.",
      },
      { property: "og:title", content: "Cost Sheet — SCKT ERP" },
      {
        property: "og:description",
        content: "Versioned fabric costing with frozen rates and full approval attribution.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CostSheetDetail,
});

function CostSheetDetail() {
  const { id } = Route.useParams();
  const { data: targetSheet, isLoading, error } = useCostSheetDetail(id);

  if (isLoading) {
    return (
      <AppShell
        title="Cost Sheet"
        breadcrumb={[{ label: "Cost Sheets", to: "/cost-sheets" }, { label: "Loading..." }]}
      >
        <div className="flex flex-col items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Loading cost sheet...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !targetSheet) {
    return (
      <AppShell
        title="Cost Sheet"
        breadcrumb={[{ label: "Cost Sheets", to: "/cost-sheets" }, { label: "Not Found" }]}
      >
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-sm font-semibold text-foreground">Cost Sheet Not Found</p>
          <p className="text-xs text-muted-foreground mt-1">
            The requested cost sheet ID "{id}" could not be located.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <CostSheetEditor
      sheetId={targetSheet.header.id}
      initialHeader={targetSheet.header}
      initialLines={targetSheet.lines.length ? targetSheet.lines : defaultLines()}
      initialCharges={targetSheet.charges.length ? targetSheet.charges : defaultCharges()}
    />
  );
}
