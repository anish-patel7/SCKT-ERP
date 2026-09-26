import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/system/settings")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Settings & Constants — SCKT ERP" },
      {
        name: "description",
        content:
          "System constants that drive the costing engine: kg divisor, card divisor, default wastage and display precision.",
      },
      { property: "og:title", content: "Settings & Constants — SCKT ERP" },
      {
        property: "og:description",
        content: "Configurable costing constants, snapshotted per sheet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const CONSTANTS = [
  ["kg_divisor", "9,000,000", "Divides ends × denier × length (and panna for weft) into kilograms"],
  ["card_divisor", "39.37", "Divides cards × card rate; the literal never appears in code"],
  ["default_wastage_pct", "10", "Copied onto a new sheet, never refreshed afterwards"],
  ["wastage_warn_threshold_pct", "25", "Above this a warning requires acknowledgement"],
  ["warp_min_rows", "3", "Empty warp rows rendered on a new sheet"],
  ["weft_min_rows", "6", "Empty weft rows rendered on a new sheet"],
  ["kg_display_precision", "4", "Display only — stored values keep full precision"],
  ["cost_display_precision", "2", "Display only — card cost enters the final sum unrounded"],
];

function SettingsPage() {
  return (
    <AppShell
      title="Settings & Constants"
      breadcrumb={[{ label: "System", to: "/system" }, { label: "Settings" }]}
    >
      <Card className="gap-0 rounded-sm py-0">
        <CardHeader className="border-b px-4 py-2.5">
          <CardTitle className="text-sm">Costing engine constants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="h-8 w-64">Constant</TableHead>
                <TableHead className="h-8 w-32 text-right">Value</TableHead>
                <TableHead className="h-8">Effect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CONSTANTS.map(([k, v, d]) => (
                <TableRow key={k}>
                  <TableCell className="num py-1.5">{k}</TableCell>
                  <TableCell className="num py-1.5 text-right">{v}</TableCell>
                  <TableCell className="py-1.5 text-muted-foreground">{d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        Each cost sheet snapshots these values at creation, so reopening a five-year-old sheet
        returns identical figures regardless of later changes.
      </p>
    </AppShell>
  );
}
