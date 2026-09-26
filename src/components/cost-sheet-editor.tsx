import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Can } from "@/components/auth";
import {
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Copy,
  Printer,
  Sparkles,
  Layers,
  Loader2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  computeCostSheet,
  fmt,
  fmtCurr,
  isBlankLine,
  lineCost,
  lineKg,
  type ChargeLine,
  type CostLine,
} from "@/lib/costing";
import { useYarnMaterials } from "@/hooks/useYarnMaterials";
import { useDesigns } from "@/hooks/useDesigns";
import { type CostSheetHeader } from "@/services/costSheets";
import {
  useCreateCostSheet,
  useUpdateCostSheet,
  useApproveCostSheet,
  useCreateCostSheetVersion,
  useDuplicateCostSheet,
} from "@/hooks/useCostSheets";
import { PrintableCostSheet } from "@/components/printable-cost-sheet";

const uid = () => Math.random().toString(36).slice(2);

const blankLine = (section: "warp" | "weft", sequence: number): CostLine => ({
  id: uid(),
  section,
  label: `${section.toUpperCase()} ${sequence}`,
  material_id: null,
  yarn_name: "",
  quantity: 0,
  denier: 0,
  length_metre: 0,
  panna_inch: 0,
  rate_per_kg: 0,
});

export const emptyHeader = (sheetNo: string): CostSheetHeader => ({
  id: `new-${Date.now()}`,
  sheet_no: sheetNo,
  design_no: "",
  party_id: null,
  party_name: "",
  quality: "",
  reed: 0,
  pick: 0,
  panna_inch: 49.5,
  length_metre: 6.65,
  wastage_pct: 10,
  card_rate: 0,
  number_of_cards: 0,
  kg_divisor: 9000000,
  card_divisor: 39.37,
  status: "draft",
  version: 1,
  remarks: "",
  costing_date: new Date().toISOString().split("T")[0] || "",
  // Blank: the service records the signed-in user.
  prepared_by: "",
  unit_basis: "per metre",
  markup_pct: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const defaultLines = (): CostLine[] => [
  ...Array.from({ length: 3 }, (_, i) => blankLine("warp", i + 1)),
  ...Array.from({ length: 6 }, (_, i) => blankLine("weft", i + 1)),
];

export const defaultCharges = (): ChargeLine[] => [
  { id: uid(), charge_name: "Butta", rate: 2, quantity: 6.65 },
  { id: uid(), charge_name: "RFD", rate: 0, quantity: 7 },
];

function NumCell({
  value,
  onChange,
  dp = 4,
}: {
  value: number;
  onChange: (n: number) => void;
  dp?: number;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      className="w-full bg-transparent text-right font-mono focus:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5"
      inputMode="decimal"
      value={text ?? (value ? String(value) : "")}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = Number(text ?? value);
        if (text !== null) {
          if (Number.isNaN(n)) toast.error("Numeric value required");
          else if (n < 0) toast.error("Negative values are rejected");
          else onChange(Number(n.toFixed(dp)));
          setText(null);
        }
      }}
    />
  );
}

export function CostSheetEditor({
  sheetId,
  initialHeader,
  initialLines,
  initialCharges,
}: {
  sheetId?: string;
  initialHeader: CostSheetHeader;
  initialLines: CostLine[];
  initialCharges: ChargeLine[];
}) {
  const navigate = useNavigate();
  const [header, setHeader] = useState<CostSheetHeader>(initialHeader);
  const [lines, setLines] = useState<CostLine[]>(initialLines);
  const [charges, setCharges] = useState<ChargeLine[]>(initialCharges);
  const [showPrintMode, setShowPrintMode] = useState(false);

  // Mutations
  const { mutate: createSheet, isPending: isCreating } = useCreateCostSheet();
  const { mutate: updateSheet, isPending: isUpdating } = useUpdateCostSheet();
  const { mutate: approveSheet, isPending: isApproving } = useApproveCostSheet();
  const { mutate: duplicateSheet } = useDuplicateCostSheet();
  const { mutate: versionSheet } = useCreateCostSheetVersion();

  // Materials & Designs lists
  // Yarn Master (materials table): cost lines reference materials.id.
  const { data: yarnRows = [] } = useYarnMaterials({ status: "Active" });
  const materials = useMemo(
    () =>
      yarnRows.flatMap((y) =>
        y.id
          ? [
              {
                id: y.id,
                code: y.code,
                name: y.name,
                denier: y.denier ?? 0,
                ratePerKg: y.rate_per_kg,
              },
            ]
          : [],
      ),
    [yarnRows],
  );
  // Design master (designs table); cost_sheets.design_no stores the design number.
  const { data: designs = [] } = useDesigns();

  const isSaving = isCreating || isUpdating || isApproving;

  const totals = useMemo(
    () =>
      computeCostSheet({
        lines,
        charges,
        wastage_pct: header.wastage_pct,
        card_rate: header.card_rate,
        number_of_cards: header.number_of_cards,
        kg_divisor: header.kg_divisor,
        card_divisor: header.card_divisor,
        markup_pct: header.markup_pct,
        manual_sale_rate: header.manual_sale_rate,
      }),
    [lines, charges, header],
  );

  // Patch line item
  const patchLine = (id: string, patch: Partial<CostLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  // Auto-fill Reed, Pick, Cards when Design is selected
  const handleSelectDesign = (designNo: string) => {
    const target = designs.find((d) => d.designNumber === designNo);
    if (target) {
      setHeader({
        ...header,
        design_no: designNo,
        quality: target.designName,
        reed: target.reed || header.reed,
        pick: target.pick || header.pick,
        number_of_cards: target.cards ? target.cards * 268 : header.number_of_cards,
      });
    } else {
      setHeader({ ...header, design_no: designNo });
    }
  };

  // Save Cost Sheet (create or update)
  const handleSave = (statusOverride?: string) => {
    if (!header.sheet_no.trim()) {
      return;
    }

    const fullSheet = {
      header: {
        ...header,
        status: statusOverride || header.status,
      },
      lines,
      charges,
    };

    if (sheetId && header.id && !header.id.startsWith("new-")) {
      // Update existing
      updateSheet(
        { id: sheetId, data: fullSheet },
        {
          onSuccess: (result) => {
            navigate({ to: "/cost-sheets/$id", params: { id: result.header.id || sheetId } });
          },
        },
      );
    } else {
      // Create new
      createSheet(fullSheet, {
        onSuccess: (result) => {
          navigate({ to: "/cost-sheets/$id", params: { id: result.header.id || "" } });
        },
      });
    }
  };

  // Approve Sheet
  const handleApprove = () => {
    if (!sheetId || (header.id && header.id.startsWith("new-"))) {
      return;
    }
    approveSheet(sheetId);
  };

  // Duplicate Sheet
  const handleDuplicate = () => {
    if (!sheetId) return;
    duplicateSheet(
      { originalId: sheetId, newSheetNo: `${header.sheet_no}-DUP` },
      {
        onSuccess: (dup) => {
          navigate({ to: "/cost-sheets/$id", params: { id: dup.header.id || sheetId } });
        },
      },
    );
  };

  // Create New Version
  const handleNewVersion = () => {
    if (!sheetId) return;
    versionSheet(sheetId, {
      onSuccess: (ver) => {
        navigate({ to: "/cost-sheets/$id", params: { id: ver.header.id || sheetId } });
      },
    });
  };

  if (showPrintMode) {
    return (
      <AppShell
        title={`Print Preview — ${header.sheet_no}`}
        breadcrumb={[{ label: "Cost Sheets", to: "/cost-sheets" }, { label: "Print Preview" }]}
      >
        <PrintableCostSheet
          sheet={{ header, lines, charges }}
          onBack={() => setShowPrintMode(false)}
        />
      </AppShell>
    );
  }

  const renderSection = (sectionName: "warp" | "weft") => {
    const rows = lines.filter((l) => l.section === sectionName);
    const isWeft = sectionName === "weft";

    return (
      <Card className="rounded-md border border-border">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border py-2.5 px-4 bg-muted/40">
          <CardTitle className="text-sm font-semibold capitalize tracking-tight flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded bg-primary text-[0.625rem] font-bold text-primary-foreground">
              {sectionName === "warp" ? "W" : "F"}
            </span>
            {sectionName} Section ({rows.length} Rows)
          </CardTitle>
          <Can anyOf={["cost_sheet:create", "cost_sheet:update"]}>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[0.6875rem]"
              onClick={() => setLines((ls) => [...ls, blankLine(sectionName, rows.length + 1)])}
            >
              <Plus className="size-3" /> Add Row
            </Button>
          </Can>
        </CardHeader>

        <CardContent className="overflow-x-auto p-0">
          <Table className="min-w-[900px] text-xs">
            <TableHeader>
              <TableRow className="bg-muted/70 font-semibold text-muted-foreground">
                <TableHead className="h-7 w-8">#</TableHead>
                <TableHead className="h-7 w-52">Select Yarn / Material</TableHead>
                <TableHead className="h-7 w-28">Label</TableHead>
                <TableHead className="h-7 text-right">{isWeft ? "Picks/in" : "Ends"}</TableHead>
                <TableHead className="h-7 text-right">Denier</TableHead>
                <TableHead className="h-7 text-right">Length (m)</TableHead>
                <TableHead className="h-7 text-right">Panna (in)</TableHead>
                <TableHead className="h-7 text-right">Rate/kg (GST incl)</TableHead>
                <TableHead className="h-7 text-right">Calculated KG</TableHead>
                <TableHead className="h-7 text-right">Cost (₹)</TableHead>
                <TableHead className="h-7 w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l, i) => (
                <TableRow key={l.id} className="hover:bg-muted/30">
                  <TableCell className="num py-0.5 text-muted-foreground font-mono text-[0.6875rem]">
                    {i + 1}
                  </TableCell>
                  <TableCell className="py-0.5">
                    <Select
                      value={l.material_id ?? ""}
                      onValueChange={(v) => {
                        const m = materials.find((x) => x.id === v);
                        patchLine(l.id, {
                          material_id: v,
                          yarn_name: m?.name ?? "",
                          denier: Number(m?.denier ?? 0),
                          rate_per_kg: Number(m?.ratePerKg ?? 0),
                          length_metre: l.length_metre || header.length_metre,
                          panna_inch: isWeft ? l.panna_inch || header.panna_inch : l.panna_inch,
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 rounded text-xs font-medium">
                        <SelectValue placeholder="Select Yarn Material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.code} — {m.name} (Denier {m.denier} · ₹{m.ratePerKg}/kg)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-0.5">
                    <input
                      className="w-full bg-transparent text-left font-medium focus:bg-accent/40 focus:outline-none rounded px-1 py-0.5"
                      value={l.label}
                      onChange={(e) => patchLine(l.id, { label: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-0.5">
                    <NumCell
                      value={l.quantity}
                      onChange={(n) => patchLine(l.id, { quantity: n })}
                    />
                  </TableCell>
                  <TableCell className="py-0.5">
                    <NumCell value={l.denier} onChange={(n) => patchLine(l.id, { denier: n })} />
                  </TableCell>
                  <TableCell className="py-0.5">
                    <NumCell
                      value={l.length_metre}
                      onChange={(n) => patchLine(l.id, { length_metre: n })}
                    />
                  </TableCell>
                  <TableCell className="py-0.5">
                    <NumCell
                      value={l.panna_inch}
                      onChange={(n) => patchLine(l.id, { panna_inch: n })}
                    />
                  </TableCell>
                  <TableCell className="py-0.5">
                    <NumCell
                      value={l.rate_per_kg}
                      dp={2}
                      onChange={(n) => patchLine(l.id, { rate_per_kg: n })}
                    />
                  </TableCell>
                  <TableCell className="num py-0.5 text-right text-muted-foreground font-mono">
                    {fmt(lineKg(l, header.kg_divisor), 4)}
                  </TableCell>
                  <TableCell className="num py-0.5 text-right font-mono font-bold text-foreground">
                    {fmt(lineCost(l, header.kg_divisor))}
                  </TableCell>
                  <TableCell className="py-0.5">
                    <Can anyOf={["cost_sheet:create", "cost_sheet:update"]}>
                      <button
                        className="text-muted-foreground hover:text-destructive p-1 rounded"
                        aria-label="Delete row"
                        onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Summary Row */}
              <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
                <TableCell
                  colSpan={3}
                  className="py-1 text-xs uppercase tracking-wider text-muted-foreground"
                >
                  {isWeft ? "TOTAL WEFT" : "TOTAL WARP"}
                </TableCell>
                <TableCell className="num py-1 text-right font-mono">
                  {fmt(isWeft ? totals.totalWeftPicks : totals.totalWarpEnds, 2)}
                </TableCell>
                <TableCell colSpan={4} />
                <TableCell className="num py-1 text-right font-mono">
                  {fmt(isWeft ? totals.weftKg : totals.warpKg, 4)}
                </TableCell>
                <TableCell className="num py-1 text-right font-mono text-primary text-sm">
                  ₹{fmt(isWeft ? totals.weftCost : totals.warpCost, 2)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppShell
      title={sheetId ? `Cost Sheet ${header.sheet_no}` : "New Fabric Cost Sheet"}
      breadcrumb={[
        { label: "Cost Sheets", to: "/cost-sheets" },
        { label: sheetId ? header.sheet_no : "New" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setShowPrintMode(true)}
          >
            <Printer className="size-3.5" /> Print A4
          </Button>

          {sheetId && (
            <Can permission="cost_sheet:create">
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  disabled={isSaving}
                  onClick={handleDuplicate}
                >
                  <Copy className="size-3.5" /> Duplicate
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  disabled={isSaving}
                  onClick={handleNewVersion}
                >
                  <Layers className="size-3.5" /> New Version
                </Button>
              </>
            </Can>
          )}

          <Can anyOf={["cost_sheet:create", "cost_sheet:update"]}>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={isSaving}
              onClick={() => handleSave()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5" /> Save
                </>
              )}
            </Button>
          </Can>

          <Can permission="cost_sheet:approve">
            <Button
              size="sm"
              className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-600/50"
              disabled={isSaving}
              onClick={handleApprove}
            >
              {isApproving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" /> Approve Sheet
                </>
              )}
            </Button>
          </Can>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Cost Sheet Header Card */}
        <Card className="rounded-md border border-border">
          <CardHeader className="py-2.5 px-4 bg-muted/40 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold tracking-tight">
              Cost Sheet Information
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                Status: {header.status.toUpperCase()} · v{header.version}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Sheet Number *</Label>
                <Input
                  className="h-7 text-xs font-mono font-bold"
                  value={header.sheet_no}
                  onChange={(e) => setHeader({ ...header, sheet_no: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Design Number</Label>
                <Select value={header.design_no || ""} onValueChange={handleSelectDesign}>
                  <SelectTrigger className="h-7 text-xs font-mono font-semibold">
                    <SelectValue placeholder="Select Design" />
                  </SelectTrigger>
                  <SelectContent>
                    {designs.map((d) => (
                      <SelectItem key={d.id} value={d.designNumber} className="text-xs font-mono">
                        {d.designNumber} — {d.designName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Customer / Party Name</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="e.g. Shree Fabrics Pvt Ltd"
                  value={header.party_name}
                  onChange={(e) => setHeader({ ...header, party_name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Unit Basis</Label>
                <Select
                  value={header.unit_basis || "per metre"}
                  onValueChange={(val: "per metre" | "per piece") =>
                    setHeader({ ...header, unit_basis: val })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Unit Basis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per metre">Per Metre</SelectItem>
                    <SelectItem value="per piece">Per Piece</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Quality / Description</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="e.g. Grey Fabric"
                  value={header.quality}
                  onChange={(e) => setHeader({ ...header, quality: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reed</Label>
                <Input
                  type="number"
                  className="h-7 text-xs font-mono text-right"
                  value={String(header.reed || "")}
                  onChange={(e) => setHeader({ ...header, reed: Number(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Pick</Label>
                <Input
                  type="number"
                  className="h-7 text-xs font-mono text-right"
                  value={String(header.pick || "")}
                  onChange={(e) => setHeader({ ...header, pick: Number(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Panna (Width Inches)</Label>
                <Input
                  type="number"
                  className="h-7 text-xs font-mono text-right"
                  value={String(header.panna_inch || "")}
                  onChange={(e) =>
                    setHeader({ ...header, panna_inch: Number(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Length (Metres)</Label>
                <Input
                  type="number"
                  className="h-7 text-xs font-mono text-right"
                  value={String(header.length_metre || "")}
                  onChange={(e) =>
                    setHeader({ ...header, length_metre: Number(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warp Section Table */}
        {renderSection("warp")}

        {/* Weft Section Table */}
        {renderSection("weft")}

        {/* Summary & Charges Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Left Column: Wastage & Process Charges */}
          <div className="space-y-4">
            {/* Process Charges Card */}
            <Card className="rounded-md border border-border">
              <CardHeader className="py-2 px-4 bg-muted/40 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Process Charges
                </CardTitle>
                <Can anyOf={["cost_sheet:create", "cost_sheet:update"]}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 px-2 text-[0.6875rem]"
                    onClick={() =>
                      setCharges((cs) => [
                        ...cs,
                        {
                          id: uid(),
                          charge_name: `Process ${cs.length + 1}`,
                          rate: 0,
                          quantity: header.length_metre,
                        },
                      ])
                    }
                  >
                    <Plus className="size-3" /> Add Charge
                  </Button>
                </Can>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/50 text-muted-foreground">
                      <TableHead className="h-7">Charge Name</TableHead>
                      <TableHead className="h-7 text-right w-28">Rate</TableHead>
                      <TableHead className="h-7 text-right w-28">Qty / Cut</TableHead>
                      <TableHead className="h-7 text-right w-28">Amount (₹)</TableHead>
                      <TableHead className="h-7 w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {charges.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="py-0.5">
                          <input
                            className="w-full bg-transparent text-left font-medium focus:bg-accent/40 focus:outline-none rounded px-1"
                            value={c.charge_name}
                            onChange={(e) =>
                              setCharges((cs) =>
                                cs.map((x) =>
                                  x.id === c.id ? { ...x, charge_name: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="py-0.5">
                          <NumCell
                            value={c.rate}
                            dp={2}
                            onChange={(n) =>
                              setCharges((cs) =>
                                cs.map((x) => (x.id === c.id ? { ...x, rate: n } : x)),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="py-0.5">
                          <NumCell
                            value={c.quantity}
                            dp={2}
                            onChange={(n) =>
                              setCharges((cs) =>
                                cs.map((x) => (x.id === c.id ? { ...x, quantity: n } : x)),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="py-0.5 text-right font-mono font-semibold">
                          ₹{fmt(c.rate * c.quantity, 2)}
                        </TableCell>
                        <TableCell className="py-0.5 text-right">
                          <Can anyOf={["cost_sheet:create", "cost_sheet:update"]}>
                            <button
                              className="text-muted-foreground hover:text-destructive p-1 rounded"
                              onClick={() => setCharges((cs) => cs.filter((x) => x.id !== c.id))}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </Can>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-bold">
                      <TableCell colSpan={3} className="py-1">
                        Total Process Cost
                      </TableCell>
                      <TableCell className="py-1 text-right font-mono text-primary">
                        ₹{fmt(totals.processCost, 2)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Card Costing Card */}
            <Card className="rounded-md border border-border p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Card Costing Calculation
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs">Card Rate (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-7 text-xs font-mono text-right"
                    value={String(header.card_rate || "")}
                    onChange={(e) =>
                      setHeader({ ...header, card_rate: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Number of Cards</Label>
                  <Input
                    type="number"
                    className="h-7 text-xs font-mono text-right"
                    value={String(header.number_of_cards || "")}
                    onChange={(e) =>
                      setHeader({ ...header, number_of_cards: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border text-xs">
                <span className="text-muted-foreground font-mono">
                  Formula: ({header.number_of_cards} × ₹{header.card_rate}) / 39.37
                </span>
                <span className="font-mono font-bold text-primary text-sm">
                  ₹{fmt(totals.cardCost, 2)}
                </span>
              </div>
            </Card>
          </div>

          {/* Right Column: Costing Summary & Sale Rate */}
          <Card className="rounded-md border-2 border-primary/40 bg-card p-4 space-y-3">
            <h4 className="font-bold text-sm text-primary uppercase tracking-wider border-b border-border pb-1">
              FINANCIAL COSTING RECAP
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Warp Total Cost:</span>
                <span className="font-mono font-medium">₹{fmt(totals.warpCost, 2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Weft Total Cost:</span>
                <span className="font-mono font-medium">₹{fmt(totals.weftCost, 2)}</span>
              </div>

              <div className="flex justify-between font-bold pt-1 border-t border-border">
                <span>Base Fabric Material Cost:</span>
                <span className="font-mono text-foreground">
                  ₹{fmt(totals.baseMaterialCost, 2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  Wastage Percentage:
                  <input
                    type="number"
                    className="w-14 h-6 text-right font-mono text-xs rounded border border-border bg-background px-1"
                    value={header.wastage_pct}
                    onChange={(e) =>
                      setHeader({ ...header, wastage_pct: Number(e.target.value) || 0 })
                    }
                  />
                  %
                </span>
                <span className="font-mono font-medium">₹{fmt(totals.wastageCost, 2)}</span>
              </div>

              <div className="flex justify-between font-bold pt-1 border-t border-border">
                <span>Material Cost With Wastage:</span>
                <span className="font-mono">₹{fmt(totals.materialWithWastage, 2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Additional Process Cost:</span>
                <span className="font-mono">₹{fmt(totals.processCost, 2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Card Cost:</span>
                <span className="font-mono">₹{fmt(totals.cardCost, 2)}</span>
              </div>

              {/* Final Selling Rate Card */}
              <div className="mt-4 rounded-md bg-primary p-4 text-primary-foreground shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider opacity-90">
                      FINAL SELLING RATE / COST ({header.unit_basis || "per metre"})
                    </span>
                    <span className="text-[0.6875rem] opacity-75">
                      Unrounded precision internally
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold font-mono">
                      {fmtCurr(totals.saleRate)}
                    </span>
                    <span className="block text-xs font-mono opacity-80">
                      (~ ₹{Math.round(totals.saleRate)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
