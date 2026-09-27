import { useState } from "react";
import { Plus } from "lucide-react";
import type { ProductionFeatureDefinition } from "@/features/production/config/production-features";
import { ProductionSourceTabs } from "@/features/production/components/production-source-tabs";
import { LiveDailyProduction } from "@/features/production/live/live-daily-production";
import { ProductionPageShell } from "@/features/production/components/production-page-shell";
import {
  ProductionRegister,
  type RegisterColumn,
} from "@/features/production/components/production-register";
import { ProductionFormDialog } from "@/features/production/components/production-form-dialog";
import { DraftsPanel } from "@/features/production/components/drafts-panel";
import { RecordViewDialog } from "@/features/production/components/record-view-dialog";
import { DetailGrid, type DetailColumn } from "@/components/erp/detail-grid";
import {
  FieldGrid,
  FormSection,
  ReadOnlyField,
  ReferenceSelect,
} from "@/components/erp/form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  useDocumentForm,
  type DocumentFormConfig,
} from "@/features/production/hooks/use-document-form";
import {
  useProductionList,
  useProductionMasters,
} from "@/features/production/hooks/use-production";
import {
  DOWNTIME_REASONS,
  PRODUCTION_SHIFTS,
  type DailyProductionRow,
  type JobCardRow,
  type ProductionShift,
} from "@/features/production/types/production";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAmount, formatQty, formatRate, formatWeight, todayIso } from "@/lib/erp/formatting";
import { compareQty, lineAmount, subtractQty, sumAmount, sumQty } from "@/lib/erp/numbers";
import {
  masterOptions,
  num,
  text,
  useCanEnterProduction,
  useRegisterRange,
} from "@/features/production/pages/page-helpers";
import { DocumentInfoSection, RemarkField } from "@/features/production/pages/page-sections";
import { cn } from "@/lib/utils";

type LineValues = {
  key: string;
  jobCardId: string;
  qty: string;
  saleRate: string;
  pickRate: string;
  rate: string;
  /** Existing Daily Production fields (optional). */
  yarnUsedKg: string;
  downtimeMin: string;
  downtimeReason: string;
};
type Values = {
  date: string;
  warehouseId: string;
  unitId: string;
  remark: string;
  shift: ProductionShift | "";
  lines: LineValues[];
};

/** Blank optional number → null; anything else parsed (NaN is rejected by the service). */
const optionalNum = (value: string) => (value.trim() === "" ? null : num(value));
const NO_REASON = "__none";

let lineSeq = 0;
const newKey = () => `line-${++lineSeq}`;

const CONFIG: DocumentFormConfig<"dailyProduction", Values> = {
  empty: () => ({
    date: todayIso(),
    warehouseId: "",
    unitId: "",
    remark: "",
    shift: "",
    lines: [],
  }),
  toInput: (v) => ({
    date: v.date,
    warehouseId: v.warehouseId,
    unitId: v.unitId,
    remark: v.remark,
    shift: v.shift,
    receiveType: "DAILY PRODUCTION",
    lines: v.lines.map((l) => ({
      jobCardId: l.jobCardId,
      qty: num(l.qty),
      saleRate: num(l.saleRate),
      pickRate: num(l.pickRate),
      rate: num(l.rate),
      yarnUsedKg: optionalNum(l.yarnUsedKg),
      downtimeMin: optionalNum(l.downtimeMin),
      downtimeReason: l.downtimeReason,
    })),
  }),
  fromInput: (i) => ({
    date: i.date,
    warehouseId: i.warehouseId,
    unitId: i.unitId,
    remark: i.remark,
    shift: i.shift ?? "",
    lines: i.lines.map((l) => ({
      key: newKey(),
      jobCardId: l.jobCardId,
      qty: text(l.qty),
      saleRate: text(l.saleRate),
      pickRate: text(l.pickRate),
      rate: text(l.rate),
      yarnUsedKg: l.yarnUsedKg == null ? "" : text(l.yarnUsedKg),
      downtimeMin: l.downtimeMin == null ? "" : text(l.downtimeMin),
      downtimeReason: l.downtimeReason ?? "",
    })),
  }),
};

const COLUMNS: RegisterColumn<DailyProductionRow>[] = [
  { id: "number", header: "Receive No.", value: (r) => r.number, sticky: true, width: 8 },
  { id: "date", header: "Receive Date", value: (r) => r.date, kind: "date" },
  { id: "id", header: "Transaction ID", value: (r) => r.id, width: 9, hideOnMobile: true },
  { id: "type", header: "Receive Type", value: (r) => r.receiveType, width: 9, hideOnMobile: true },
  { id: "warehouse", header: "Warehouse", value: (r) => r.warehouseName, width: 9 },
  { id: "unit", header: "Unit", value: (r) => r.unitName, width: 5 },
  { id: "shift", header: "Shift", value: (r) => (r.shift ? `Shift ${r.shift}` : null), width: 5 },
  { id: "cards", header: "Job Cards", value: (r) => r.lineCount, kind: "text", width: 5 },
  { id: "qty", header: "Total Qty", value: (r) => r.totalQty, kind: "qty", total: true },
  { id: "amount", header: "Amount", value: (r) => r.totalAmount, kind: "amount", total: true },
  { id: "remark", header: "Remark", value: (r) => r.remark || null, width: 10, hideOnMobile: true },
];

export default function DailyProductionPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const [range, setRange] = useRegisterRange();
  const list = useProductionList("dailyProduction", range);
  const cards = useProductionList("jobCard");
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm("dailyProduction", CONFIG);
  const [viewing, setViewing] = useState<DailyProductionRow | null>(null);
  const [picking, setPicking] = useState(false);
  const v = form.values;
  const e = form.errors;
  const cardOf = (id: string) => cards.data?.find((c) => c.id === id);

  const setLine = (index: number, patch: Partial<LineValues>) => {
    form.update((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
    for (const field of Object.keys(patch)) form.clearError(`lines.${index}.${field}`);
  };

  /** Quantity already entered on this document for a card, excluding one line. */
  const enteredFor = (cardId: string, exceptIndex: number) =>
    sumQty(
      v.lines
        .filter((l, i) => i !== exceptIndex && l.jobCardId === cardId)
        .map((l) => num(l.qty))
        .filter(Number.isFinite),
    );

  const lineAmountOf = (l: LineValues) => {
    const q = num(l.qty);
    const r = num(l.rate);
    return Number.isFinite(q) && Number.isFinite(r) ? lineAmount(q, r) : null;
  };

  const numberCell =
    (
      field: "qty" | "saleRate" | "pickRate" | "rate" | "yarnUsedKg" | "downtimeMin",
      label: string,
    ) =>
    (l: LineValues, i: number) => (
      <div className="min-w-20">
        <Input
          aria-label={`Line ${i + 1} ${label}`}
          inputMode="decimal"
          value={l[field]}
          onChange={(ev) => setLine(i, { [field]: ev.target.value })}
          aria-invalid={!!e[`lines.${i}.${field}`]}
          className={cn(
            "h-8 text-right font-mono text-xs",
            e[`lines.${i}.${field}`] && "border-destructive",
          )}
        />
        {field === "qty" && qtyHint(l, i)}
        {e[`lines.${i}.${field}`] && (
          <p
            role="alert"
            className="mt-0.5 max-w-48 whitespace-normal text-[0.625rem] text-destructive"
          >
            {e[`lines.${i}.${field}`]}
          </p>
        )}
      </div>
    );

  function qtyHint(line: LineValues, index: number) {
    const card = cardOf(line.jobCardId);
    if (!card) return null;
    const q = num(line.qty);
    const after = subtractQty(
      card.balanceQty,
      enteredFor(card.id, index),
      Number.isFinite(q) ? q : 0,
    );
    return (
      <p
        className={cn(
          "mt-0.5 text-[0.625rem]",
          compareQty(after, 0) < 0 ? "text-destructive" : "text-muted-foreground",
        )}
      >
        O/S {formatQty(card.balanceQty)} → {formatQty(after)}
      </p>
    );
  }

  const info = (pick: (c: JobCardRow) => string) => (l: LineValues) => {
    const card = cardOf(l.jobCardId);
    return <span className="whitespace-nowrap">{card ? pick(card) : "—"}</span>;
  };

  const lineColumns: DetailColumn<LineValues>[] = [
    {
      id: "challan",
      header: "Job Challan No.",
      width: 7,
      sticky: true,
      render: info((c) => c.number),
    },
    { id: "jobOrder", header: "Job Order No.", width: 7, render: info((c) => c.jobOrderNo) },
    { id: "salesOrder", header: "Sales Order No.", width: 7, render: info((c) => c.salesOrderNo) },
    { id: "party", header: "Sales Order Party", width: 9, render: info((c) => c.partyName) },
    {
      id: "itemCode",
      header: "Item Code",
      width: 5,
      render: info((c) => m?.items.find((i) => i.id === c.itemId)?.code ?? "—"),
    },
    { id: "goods", header: "Description of Goods", width: 10, render: info((c) => c.itemName) },
    { id: "yarn", header: "Yarn Item", width: 9, render: info((c) => c.yarnName) },
    { id: "machine", header: "Machine", width: 5, render: info((c) => c.machineName) },
    { id: "unit", header: "Unit", width: 4, render: info((c) => c.unitName) },
    { id: "qty", header: "Qty", width: 7, align: "right", render: numberCell("qty", "Qty") },
    {
      id: "saleRate",
      header: "Sale Rate",
      width: 6,
      align: "right",
      render: numberCell("saleRate", "Sale Rate"),
    },
    {
      id: "pickRate",
      header: "Pick Rate",
      width: 6,
      align: "right",
      render: numberCell("pickRate", "Pick Rate"),
    },
    { id: "rate", header: "Rate", width: 6, align: "right", render: numberCell("rate", "Rate") },
    {
      id: "amount",
      header: "Amount",
      width: 7,
      align: "right",
      render: (l) => {
        const a = lineAmountOf(l);
        return a === null ? "—" : formatAmount(a);
      },
    },
    {
      id: "yarnUsedKg",
      header: "Yarn Used (kg)",
      width: 6,
      align: "right",
      render: numberCell("yarnUsedKg", "Yarn Used (kg)"),
    },
    {
      id: "downtimeMin",
      header: "Downtime (min)",
      width: 6,
      align: "right",
      render: numberCell("downtimeMin", "Downtime (min)"),
    },
    {
      id: "downtimeReason",
      header: "Downtime Reason",
      width: 10,
      render: (l, i) => (
        <Select
          value={l.downtimeReason || NO_REASON}
          onValueChange={(x) => setLine(i, { downtimeReason: x === NO_REASON ? "" : x })}
        >
          <SelectTrigger aria-label={`Line ${i + 1} Downtime Reason`} className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_REASON}>—</SelectItem>
            {DOWNTIME_REASONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];

  const totalQty = sumQty(v.lines.map((l) => num(l.qty)).filter(Number.isFinite));
  const totalAmount = sumAmount(v.lines.map(lineAmountOf).filter((a): a is number => a !== null));

  return (
    <ProductionPageShell feature={feature}>
      <ProductionSourceTabs
        liveLabel="Daily Production"
        liveNote="Live daily production log from the database, as before (shift, job card, loom, metres, yarn, downtime). Entries in the workflow tab are prototype records until the backend phase merges both."
        live={<LiveDailyProduction />}
      >
        <DraftsPanel
          kind="dailyProduction"
          onEdit={form.open}
          describe={(i) =>
            `${i.lines.length} job card line(s) · ${m?.warehouses.find((w) => w.id === i.warehouseId)?.name ?? "No warehouse"}`
          }
        />
        <ProductionRegister
          title={feature.label}
          exportName="daily-production"
          rows={list.data}
          isLoading={list.isFetching}
          error={list.error}
          onRefresh={() => void list.refetch()}
          range={range}
          onRangeChange={setRange}
          columns={COLUMNS}
          rowKey={(r) => r.id}
          searchPlaceholder="Receive no., warehouse, unit…"
          filters={[
            { id: "warehouse", label: "Warehouse", value: (r) => r.warehouseName },
            { id: "unit", label: "Unit", value: (r) => r.unitName },
          ]}
          groupBy={[
            { id: "unit", label: "Unit", value: (r) => r.unitName },
            { id: "warehouse", label: "Warehouse", value: (r) => r.warehouseName },
          ]}
          onAdd={() => form.open()}
          canAdd={canEnter}
          onView={setViewing}
        />

        <ProductionFormDialog form={form} title="Daily Job Card Production Entry" size="xl">
          <DocumentInfoSection
            idPrefix="dp"
            dateLabel="Receive Date"
            numberLabel="Receive No."
            date={v.date}
            onDate={(d) => form.set("date", d)}
            dateError={e["date"]}
          >
            <ReadOnlyField label="Transaction ID" value="Assigned on post" />
            <ReadOnlyField label="Receive Type" value="DAILY PRODUCTION" />
          </DocumentInfoSection>
          <FormSection title="Header">
            <FieldGrid cols={4}>
              <ReferenceSelect
                id="dp-warehouse"
                label="Warehouse"
                required
                value={v.warehouseId}
                options={masterOptions(m?.warehouses)}
                onChange={(id) => form.set("warehouseId", id)}
                error={e["warehouseId"]}
              />
              <ReferenceSelect
                id="dp-unit"
                label="Unit"
                required
                value={v.unitId}
                options={masterOptions(m?.units)}
                onChange={(id) => form.set("unitId", id)}
                error={e["unitId"]}
              />
              <ReferenceSelect
                id="dp-shift"
                label="Shift"
                value={v.shift}
                options={PRODUCTION_SHIFTS.map((s) => ({ id: s, label: `Shift ${s}` }))}
                onChange={(id) => form.set("shift", id as ProductionShift)}
              />
              <RemarkField
                id="dp-remark"
                value={v.remark}
                onChange={(x) => form.set("remark", x)}
              />
            </FieldGrid>
          </FormSection>
          <FormSection
            title="Production Detail"
            description="Each line adds to the job card's received quantity when posted."
            actions={
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={() => setPicking(true)}
              >
                <Plus className="size-3.5" /> Add Job Card
              </Button>
            }
          >
            {e["lines"] && (
              <p role="alert" className="mb-2 text-xs text-destructive">
                {e["lines"]}
              </p>
            )}
            <DetailGrid
              columns={lineColumns}
              lines={v.lines}
              lineKey={(l) => l.key}
              lineLabel="Job card"
              emptyText="No job cards added. Use “Add Job Card” to select open job cards."
              onRemove={(index) =>
                form.update((prev) => ({
                  ...prev,
                  lines: prev.lines.filter((_, i) => i !== index),
                }))
              }
            />
            {v.lines.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-end gap-4 text-xs">
                <span>
                  Lines <strong className="font-mono">{v.lines.length}</strong>
                </span>
                <span>
                  Total Qty <strong className="font-mono">{formatQty(totalQty)}</strong>
                </span>
                <span>
                  Total Amount <strong className="font-mono">{formatAmount(totalAmount)}</strong>
                </span>
              </div>
            )}
          </FormSection>
        </ProductionFormDialog>

        <JobCardPicker
          open={picking}
          cards={(cards.data ?? []).filter(
            (c) => c.status === "Pending" && c.documentStatus === "POSTED",
          )}
          onClose={() => setPicking(false)}
          onPick={(card) => {
            form.update((prev) => ({
              ...prev,
              unitId: prev.unitId || card.unitId,
              lines: [
                ...prev.lines,
                {
                  key: newKey(),
                  jobCardId: card.id,
                  qty: "",
                  saleRate: "0",
                  pickRate: "0",
                  rate: "0",
                  yarnUsedKg: "",
                  downtimeMin: "",
                  downtimeReason: "",
                },
              ],
            }));
            form.clearError("lines");
            setPicking(false);
          }}
        />

        <RecordViewDialog
          row={viewing}
          title={(r) => `Daily Production ${r.number}`}
          columns={COLUMNS}
          onClose={() => setViewing(null)}
        >
          {(r) => (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    {[
                      "Job Challan",
                      "Job Order",
                      "Party",
                      "Machine",
                      "Qty",
                      "Pick Rate",
                      "Rate",
                      "Amount",
                      "Yarn (kg)",
                      "Downtime",
                    ].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="h-8 whitespace-nowrap px-2 text-left font-semibold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((l) => {
                    const card = cardOf(l.jobCardId);
                    return (
                      <tr key={l.id} className="border-t border-border">
                        <td className="px-2 py-1 font-mono">{card?.number ?? "—"}</td>
                        <td className="px-2 py-1">{card?.jobOrderNo ?? "—"}</td>
                        <td className="px-2 py-1">{card?.partyName ?? "—"}</td>
                        <td className="px-2 py-1">{card?.machineName ?? "—"}</td>
                        <td className="px-2 py-1 text-right font-mono">{formatQty(l.qty)}</td>
                        <td className="px-2 py-1 text-right font-mono">{formatRate(l.pickRate)}</td>
                        <td className="px-2 py-1 text-right font-mono">{formatRate(l.rate)}</td>
                        <td className="px-2 py-1 text-right font-mono">
                          {formatAmount(lineAmount(l.qty, l.rate))}
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {l.yarnUsedKg == null ? "—" : formatWeight(l.yarnUsedKg)}
                        </td>
                        <td className="px-2 py-1">
                          {l.downtimeMin == null
                            ? "—"
                            : `${l.downtimeMin} min${l.downtimeReason ? ` · ${l.downtimeReason}` : ""}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </RecordViewDialog>
      </ProductionSourceTabs>
    </ProductionPageShell>
  );
}

/** Searchable selector of open (demo Pending) job cards. */
function JobCardPicker({
  open,
  cards,
  onClose,
  onPick,
}: {
  open: boolean;
  cards: JobCardRow[];
  onClose: () => void;
  onPick: (card: JobCardRow) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 sm:max-w-3xl">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Add Job Card</DialogTitle>
          <DialogDescription className="text-xs">
            Only open job cards (outstanding quantity above zero) can be selected.
          </DialogDescription>
        </DialogHeader>
        <Command className="rounded-none border-t border-border">
          <CommandInput placeholder="Search challan, job order, sales order, party, item, machine…" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No open job cards</CommandEmpty>
            <CommandGroup>
              {cards.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.number} ${c.jobOrderNo} ${c.salesOrderNo} ${c.partyName} ${c.itemName} ${c.machineName}`}
                  onSelect={() => onPick(c)}
                  className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[6rem_6rem_7rem_1fr_5rem_6rem]"
                >
                  <span className="font-mono font-semibold">{c.number}</span>
                  <span>{c.jobOrderNo}</span>
                  <span>{c.salesOrderNo}</span>
                  <span className="truncate">
                    {c.partyName} · {c.itemName}
                  </span>
                  <span>{c.machineName}</span>
                  <span className="text-right font-mono">O/S {formatQty(c.balanceQty)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
