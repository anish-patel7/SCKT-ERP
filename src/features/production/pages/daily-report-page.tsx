import { useMemo, useState } from "react";
import { Eye, FileDown, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import type { ProductionFeatureDefinition } from "@/features/production/config/production-features";
import { ProductionPageShell } from "@/features/production/components/production-page-shell";
import { DateRangeFilter } from "@/features/production/components/production-register";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDailyProductionLines,
  useProductionMasters,
} from "@/features/production/hooks/use-production";
import type {
  DailyProductionLineRow,
  DateRange,
  ProductionMasters,
} from "@/features/production/types/production";
import {
  defaultRange,
  formatAmount,
  formatDate,
  formatQty,
  formatRate,
  plainNumber,
} from "@/lib/erp/formatting";
import { sumAmount, sumQty } from "@/lib/erp/numbers";
import { downloadCsv, printTable, type ExportTable } from "@/lib/erp/export";

type DimensionId = "category" | "party" | "unit" | "product" | "yarn" | "machine" | "company";
type Option = { id: string; label: string };

const DIMENSIONS: { id: DimensionId; label: string; key: (l: DailyProductionLineRow) => string }[] =
  [
    { id: "category", label: "Category", key: (l) => l.category },
    { id: "party", label: "Party", key: (l) => l.partyId },
    { id: "unit", label: "Unit", key: (l) => l.unitId },
    { id: "product", label: "Product", key: (l) => l.itemId },
    { id: "yarn", label: "Yarn Item", key: (l) => l.yarnId },
    { id: "machine", label: "Machine", key: (l) => l.machineId },
    { id: "company", label: "Company", key: (l) => l.companyId },
  ];

function dimensionOptions(m: ProductionMasters | undefined): Record<DimensionId, Option[]> {
  const opt = (list: { id: string; name: string }[] | undefined) =>
    (list ?? []).map((x) => ({ id: x.id, label: x.name }));
  return {
    category: [...new Set((m?.items ?? []).map((i) => i.category))].map((c) => ({
      id: c,
      label: c,
    })),
    party: opt(m?.parties.filter((p) => p.kind === "customer")),
    unit: opt(m?.units),
    product: opt(m?.items),
    yarn: opt(m?.yarns),
    machine: opt(m?.machines),
    company: opt(m?.companies),
  };
}

const REPORT_TYPES = [
  {
    id: "beam-colour-detail",
    label: "Beam Colour Wise Daily Production Detail",
    implemented: true,
  },
] as const;

const REPORT_COLUMNS = [
  "Date",
  "Receive No.",
  "Job Challan No.",
  "Job Order No.",
  "Party",
  "Item Code",
  "Item",
  "Machine",
  "Unit",
  "Qty",
  "Rate",
  "Amount",
] as const;

type ReportGroup = { colour: string; lines: DailyProductionLineRow[]; qty: number; amount: number };
type ReportSnapshot = { range: DateRange; groups: ReportGroup[]; qty: number; amount: number };

export default function DailyReportPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const { data: m } = useProductionMasters();
  const options = useMemo(() => dimensionOptions(m), [m]);
  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [reportType, setReportType] = useState<string>(REPORT_TYPES[0].id);
  // null = every option selected (the default).
  const [selected, setSelected] = useState<Record<DimensionId, Set<string> | null>>({
    category: null,
    party: null,
    unit: null,
    product: null,
    yarn: null,
    machine: null,
    company: null,
  });
  // Filters take effect on Preview, so the preview always matches what was requested.
  const [applied, setApplied] = useState<{
    range: DateRange;
    selected: Record<DimensionId, Set<string> | null>;
  } | null>(null);
  const appliedRange = applied?.range ?? null;
  const lines = useDailyProductionLines(appliedRange ?? range);

  const isSelected = (dim: DimensionId, id: string) => selected[dim]?.has(id) ?? true;
  const toggle = (dim: DimensionId, id: string, on: boolean) =>
    setSelected((prev) => {
      const current = new Set(prev[dim] ?? options[dim].map((o) => o.id));
      if (on) current.add(id);
      else current.delete(id);
      return { ...prev, [dim]: current.size === options[dim].length ? null : current };
    });
  const emptyDimensions = DIMENSIONS.filter((d) => selected[d.id]?.size === 0);

  const snapshot: ReportSnapshot | null = useMemo(() => {
    if (!applied || !lines.data) return null;
    const chosen = applied.selected;
    const rows = lines.data.filter((l) =>
      DIMENSIONS.every((d) => chosen[d.id]?.has(d.key(l)) ?? true),
    );
    const byColour = new Map<string, DailyProductionLineRow[]>();
    for (const l of rows) byColour.set(l.yarnName, [...(byColour.get(l.yarnName) ?? []), l]);
    const groups = [...byColour.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([colour, list]) => ({
        colour,
        lines: [...list].sort(
          (a, b) => a.date.localeCompare(b.date) || a.receiveNo.localeCompare(b.receiveNo),
        ),
        qty: sumQty(list.map((l) => l.qty)),
        amount: sumAmount(list.map((l) => l.amount)),
      }));
    return {
      range: applied.range,
      groups,
      qty: sumQty(groups.map((g) => g.qty)),
      amount: sumAmount(groups.map((g) => g.amount)),
    };
  }, [applied, lines.data]);

  const exportTable = (s: ReportSnapshot): ExportTable => ({
    columns: REPORT_COLUMNS.map((h) => ({
      header: h,
      ...(h === "Qty" || h === "Rate" || h === "Amount" ? { align: "right" as const } : {}),
    })),
    rows: s.groups
      .flatMap((g) => [
        [`Beam Colour: ${g.colour}`, "", "", "", "", "", "", "", "", "", "", ""],
        ...g.lines.map((l) => [
          formatDate(l.date),
          l.receiveNo,
          l.jobChallanNo,
          l.jobOrderNo,
          l.partyName,
          l.itemCode,
          l.itemName,
          l.machineName,
          l.unitName,
          plainNumber(l.qty, "qty"),
          plainNumber(l.rate, "rate"),
          plainNumber(l.amount, "amount"),
        ]),
        [
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          `Total ${g.colour}`,
          plainNumber(g.qty, "qty"),
          "",
          plainNumber(g.amount, "amount"),
        ],
      ])
      .concat([
        [
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "Grand Total",
          plainNumber(s.qty, "qty"),
          "",
          plainNumber(s.amount, "amount"),
        ],
      ]),
  });

  const reportTitle = REPORT_TYPES.find((r) => r.id === reportType)?.label ?? feature.label;

  return (
    <ProductionPageShell feature={feature}>
      <Card className="border border-border">
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <DateRangeFilter range={range} onChange={setRange} idPrefix="dpr-range" />
            <div className="space-y-1 lg:w-44">
              <Label htmlFor="dpr-stock-status" className="text-xs">
                Stock Status
              </Label>
              <Select disabled value="all">
                <SelectTrigger
                  id="dpr-stock-status"
                  className="h-9"
                  title="Stock status on daily production is not specified yet"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (spec pending)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="dpr-type" className="text-xs">
                Report Type
              </Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="dpr-type" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="category">
            <TabsList className="flex h-auto w-full flex-wrap justify-start">
              {DIMENSIONS.map((d) => {
                const count = selected[d.id]?.size;
                return (
                  <TabsTrigger key={d.id} value={d.id} className="text-xs">
                    {d.label}
                    <span className="ml-1 text-[0.625rem] text-muted-foreground">
                      {count === undefined ? "(all)" : `(${count}/${options[d.id].length})`}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {DIMENSIONS.map((d) => (
              <TabsContent key={d.id} value={d.id}>
                <DimensionFilter
                  label={d.label}
                  options={options[d.id]}
                  isSelected={(id) => isSelected(d.id, id)}
                  onToggle={(id, on) => toggle(d.id, id, on)}
                  onAll={() => setSelected((p) => ({ ...p, [d.id]: null }))}
                  onClear={() => setSelected((p) => ({ ...p, [d.id]: new Set() }))}
                />
              </TabsContent>
            ))}
          </Tabs>
          {emptyDimensions.length > 0 && (
            <p className="text-xs text-amber-700">
              Nothing selected for {emptyDimensions.map((d) => d.label).join(", ")} — the report
              will be empty.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-8 gap-1"
              onClick={() => setApplied({ range: { ...range }, selected: { ...selected } })}
            >
              <Eye className="size-3.5" /> Preview
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              disabled={!snapshot || snapshot.groups.length === 0}
              onClick={() => {
                if (
                  snapshot &&
                  !printTable(
                    reportTitle,
                    `${formatDate(snapshot.range.from)} – ${formatDate(snapshot.range.to)} · frontend demo data`,
                    exportTable(snapshot),
                  )
                ) {
                  toast.error("Allow pop-ups for this site to print");
                }
              }}
            >
              <Printer className="size-3.5" /> Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              disabled={!snapshot || snapshot.groups.length === 0}
              onClick={() =>
                snapshot &&
                downloadCsv(
                  `beam-colour-daily-production-${snapshot.range.from}-to-${snapshot.range.to}`,
                  exportTable(snapshot),
                )
              }
            >
              <FileDown className="size-3.5" /> Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              disabled
              title="Future: server-side PDF export"
            >
              <FileText className="size-3.5" /> PDF (future)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              disabled
              title="Future: Excel export"
            >
              <FileSpreadsheet className="size-3.5" /> Excel (future)
            </Button>
          </div>
        </CardContent>
      </Card>

      {!appliedRange ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Choose the filters and select Preview.
          </CardContent>
        </Card>
      ) : lines.isLoading || !snapshot ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Preparing report…
          </CardContent>
        </Card>
      ) : snapshot.groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No daily production matches these filters.
          </CardContent>
        </Card>
      ) : (
        <ReportPreview title={reportTitle} snapshot={snapshot} />
      )}
    </ProductionPageShell>
  );
}

function DimensionFilter({
  label,
  options,
  isSelected,
  onToggle,
  onAll,
  onClear,
}: {
  label: string;
  options: Option[];
  isSelected: (id: string) => boolean;
  onToggle: (id: string, on: boolean) => void;
  onAll: () => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visible = options.filter((o) => o.label.toLowerCase().includes(term));
  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={`Search ${label}`}
          placeholder={`Search ${label.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs text-xs"
        />
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onAll}>
          Select All
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onClear}>
          Clear All
        </Button>
      </div>
      <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((o) => (
          <label
            key={o.id}
            className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-1 text-xs hover:bg-muted/50"
          >
            <Checkbox
              checked={isSelected(o.id)}
              onCheckedChange={(c) => onToggle(o.id, c === true)}
            />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
        {visible.length === 0 && <p className="text-xs text-muted-foreground">No matches</p>}
      </div>
    </div>
  );
}

function ReportPreview({ title, snapshot }: { title: string; snapshot: ReportSnapshot }) {
  return (
    <section aria-label="Report preview" className="space-y-2">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">
          {formatDate(snapshot.range.from)} – {formatDate(snapshot.range.to)} · frontend demo data
        </span>
      </header>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[60rem] text-xs">
          <thead className="bg-muted">
            <tr>
              {REPORT_COLUMNS.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={`h-8 whitespace-nowrap px-2 font-semibold ${h === "Qty" || h === "Rate" || h === "Amount" ? "text-right" : "text-left"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          {snapshot.groups.map((g) => (
            <tbody key={g.colour}>
              <tr className="bg-muted/40">
                <th
                  colSpan={REPORT_COLUMNS.length}
                  scope="rowgroup"
                  className="h-8 px-2 text-left font-semibold"
                >
                  Beam Colour: {g.colour}
                </th>
              </tr>
              {g.lines.map((l) => (
                <tr key={l.lineId} className="border-t border-border">
                  <td className="px-2 py-1">{formatDate(l.date)}</td>
                  <td className="px-2 py-1 font-mono">{l.receiveNo}</td>
                  <td className="px-2 py-1 font-mono">{l.jobChallanNo}</td>
                  <td className="px-2 py-1">{l.jobOrderNo}</td>
                  <td className="px-2 py-1">{l.partyName}</td>
                  <td className="px-2 py-1">{l.itemCode}</td>
                  <td className="px-2 py-1">{l.itemName}</td>
                  <td className="px-2 py-1">{l.machineName}</td>
                  <td className="px-2 py-1">{l.unitName}</td>
                  <td className="px-2 py-1 text-right font-mono">{formatQty(l.qty)}</td>
                  <td className="px-2 py-1 text-right font-mono">{formatRate(l.rate)}</td>
                  <td className="px-2 py-1 text-right font-mono">{formatAmount(l.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-semibold">
                <td colSpan={9} className="px-2 py-1 text-right">
                  Total {g.colour}
                </td>
                <td className="px-2 py-1 text-right font-mono">{formatQty(g.qty)}</td>
                <td />
                <td className="px-2 py-1 text-right font-mono">{formatAmount(g.amount)}</td>
              </tr>
            </tbody>
          ))}
          <tfoot className="border-t-2 border-border bg-muted/60 font-semibold">
            <tr>
              <td colSpan={9} className="px-2 py-1.5 text-right">
                Grand Total
              </td>
              <td className="px-2 py-1.5 text-right font-mono">{formatQty(snapshot.qty)}</td>
              <td />
              <td className="px-2 py-1.5 text-right font-mono">{formatAmount(snapshot.amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
