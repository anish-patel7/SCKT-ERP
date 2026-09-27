import { useState } from "react";
import { Info, Plus } from "lucide-react";
import type { ProductionFeatureDefinition } from "@/features/production/config/production-features";
import { ProductionPageShell } from "@/features/production/components/production-page-shell";
import {
  ProductionRegister,
  type RegisterColumn,
} from "@/features/production/components/production-register";
import { ProductionFormDialog } from "@/features/production/components/production-form-dialog";
import { DraftsPanel } from "@/features/production/components/drafts-panel";
import { RecordViewDialog } from "@/features/production/components/record-view-dialog";
import {
  DetailGrid,
  type DetailColumn,
} from "@/components/erp/detail-grid";
import { QuantitySummary } from "@/features/production/components/quantity-summary";
import {
  FieldGrid,
  FormSection,
  ReadOnlyField,
  ReferenceSelect,
  TextField,
} from "@/components/erp/form-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDocumentForm,
  type DocumentFormConfig,
} from "@/features/production/hooks/use-document-form";
import {
  useProductionList,
  useProductionMasters,
} from "@/features/production/hooks/use-production";
import type { FabricConversionRow, MasterOption } from "@/features/production/types/production";
import { formatQty, todayIso } from "@/lib/erp/formatting";
import { compareQty, subtractQty, sumQty } from "@/lib/erp/numbers";
import {
  masterOptions,
  num,
  text,
  useCanEnterProduction,
  useRegisterRange,
} from "@/features/production/pages/page-helpers";
import { DocumentInfoSection, RemarkField } from "@/features/production/pages/page-sections";
import { cn } from "@/lib/utils";

type OutLine = {
  key: string;
  jobOrderId: string;
  itemId: string;
  yarnId: string;
  unitId: string;
  boxNo: string;
  qty: string;
  remark: string;
};
/** PENDING FINAL STOCK-IN SCREEN SPECIFICATION: generic fields only, extend when supplied. */
type InLine = { key: string; itemId: string; unitId: string; qty: string; remark: string };
type Values = {
  date: string;
  conversionType: string;
  warehouseId: string;
  convertBy: string;
  productName: string;
  quantityPreserving: boolean;
  remark: string;
  stockOut: OutLine[];
  stockIn: InLine[];
};

let seq = 0;
const key = () => `cv-${++seq}`;
const emptyOut = (): OutLine => ({
  key: key(),
  jobOrderId: "",
  itemId: "",
  yarnId: "",
  unitId: "",
  boxNo: "",
  qty: "",
  remark: "",
});
const emptyIn = (): InLine => ({ key: key(), itemId: "", unitId: "", qty: "", remark: "" });

const CONFIG: DocumentFormConfig<"fabricConversion", Values> = {
  empty: () => ({
    date: todayIso(),
    conversionType: "",
    warehouseId: "",
    convertBy: "",
    productName: "",
    quantityPreserving: false,
    remark: "",
    stockOut: [emptyOut()],
    stockIn: [emptyIn()],
  }),
  toInput: ({ stockOut, stockIn, ...header }) => ({
    ...header,
    stockOut: stockOut.map(({ key: _k, qty, ...l }) => ({ ...l, qty: num(qty) })),
    stockIn: stockIn.map(({ key: _k, qty, ...l }) => ({ ...l, qty: num(qty) })),
  }),
  fromInput: ({ stockOut, stockIn, ...header }) => ({
    ...header,
    stockOut: stockOut.map((l) => ({ ...l, key: key(), qty: text(l.qty) })),
    stockIn: stockIn.map((l) => ({ ...l, key: key(), qty: text(l.qty) })),
  }),
};

const COLUMNS: RegisterColumn<FabricConversionRow>[] = [
  { id: "number", header: "No.", value: (r) => r.number, sticky: true, width: 7 },
  { id: "date", header: "Date", value: (r) => r.date, kind: "date" },
  { id: "id", header: "ID", value: (r) => r.id, width: 9, hideOnMobile: true },
  { id: "type", header: "Type", value: (r) => r.conversionType, width: 8 },
  { id: "warehouse", header: "Warehouse", value: (r) => r.warehouseName, width: 9 },
  {
    id: "convertBy",
    header: "Convert By",
    value: (r) => r.convertBy || null,
    width: 8,
    hideOnMobile: true,
  },
  { id: "product", header: "Product Name", value: (r) => r.productName || null, width: 10 },
  { id: "out", header: "Stock Out Qty", value: (r) => r.totalOutQty, kind: "qty", total: true },
  { id: "in", header: "Stock In Qty", value: (r) => r.totalInQty, kind: "qty", total: true },
  { id: "diff", header: "Difference", value: (r) => r.differenceQty, kind: "qty", total: true },
  { id: "remark", header: "Remark", value: (r) => r.remark || null, width: 10, hideOnMobile: true },
];

function InlineSelect({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string }[];
  error?: string | undefined;
}) {
  return (
    <div className="min-w-32">
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger
          aria-label={label}
          aria-invalid={!!error}
          className={cn("h-8 text-xs", error && "border-destructive")}
        >
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p
          role="alert"
          className="mt-0.5 max-w-48 whitespace-normal text-[0.625rem] text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function InlineInput({
  label,
  value,
  onChange,
  numeric,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  error?: string | undefined;
}) {
  return (
    <div className={numeric ? "min-w-20" : "min-w-24"}>
      <Input
        aria-label={label}
        value={value}
        inputMode={numeric ? "decimal" : undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={cn(
          "h-8 text-xs",
          numeric && "text-right font-mono",
          error && "border-destructive",
        )}
      />
      {error && (
        <p
          role="alert"
          className="mt-0.5 max-w-48 whitespace-normal text-[0.625rem] text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

const opts = (list: MasterOption[] | undefined) =>
  (list ?? []).map((x) => ({ id: x.id, label: x.name }));

export default function FabricConversionPage({
  feature,
}: {
  feature: ProductionFeatureDefinition;
}) {
  const [range, setRange] = useRegisterRange();
  const list = useProductionList("fabricConversion", range);
  const jobOrders = useProductionList("jobOrder");
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm("fabricConversion", CONFIG);
  const [viewing, setViewing] = useState<FabricConversionRow | null>(null);
  const v = form.values;
  const e = form.errors;

  const setOut = (i: number, patch: Partial<OutLine>) => {
    form.update((prev) => ({
      ...prev,
      stockOut: prev.stockOut.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));
    for (const f of Object.keys(patch)) form.clearError(`stockOut.${i}.${f}`);
    form.clearError("stockOut");
  };
  const setIn = (i: number, patch: Partial<InLine>) => {
    form.update((prev) => ({
      ...prev,
      stockIn: prev.stockIn.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));
    for (const f of Object.keys(patch)) form.clearError(`stockIn.${i}.${f}`);
    form.clearError("stockIn");
  };

  const jobOrderOf = (id: string) => jobOrders.data?.find((j) => j.id === id);

  const outColumns: DetailColumn<OutLine>[] = [
    {
      id: "jobOrder",
      header: "Job Order No.",
      width: 8,
      sticky: true,
      render: (l, i) => (
        <InlineSelect
          label={`Stock out line ${i + 1} job order`}
          value={l.jobOrderId}
          options={(jobOrders.data ?? []).map((j) => ({ id: j.id, label: j.number }))}
          onChange={(id) => {
            const jo = jobOrderOf(id);
            setOut(i, {
              jobOrderId: id,
              itemId: l.itemId || jo?.itemId || "",
              yarnId: l.yarnId || jo?.yarnId || "",
            });
          }}
          error={e[`stockOut.${i}.jobOrderId`]}
        />
      ),
    },
    {
      id: "order",
      header: "Order No.",
      width: 7,
      render: (l) => jobOrderOf(l.jobOrderId)?.salesOrderNo ?? "—",
    },
    {
      id: "party",
      header: "Order Party",
      width: 9,
      render: (l) => jobOrderOf(l.jobOrderId)?.partyName ?? "—",
    },
    {
      id: "item",
      header: "Item",
      width: 9,
      render: (l, i) => (
        <InlineSelect
          label={`Stock out line ${i + 1} item`}
          value={l.itemId}
          options={opts(m?.items)}
          onChange={(id) => setOut(i, { itemId: id })}
          error={e[`stockOut.${i}.itemId`]}
        />
      ),
    },
    {
      id: "yarn",
      header: "Yarn Item",
      width: 9,
      render: (l, i) => (
        <InlineSelect
          label={`Stock out line ${i + 1} yarn item`}
          value={l.yarnId}
          options={opts(m?.yarns)}
          onChange={(id) => setOut(i, { yarnId: id })}
          error={e[`stockOut.${i}.yarnId`]}
        />
      ),
    },
    {
      id: "unit",
      header: "Unit",
      width: 6,
      render: (l, i) => (
        <InlineSelect
          label={`Stock out line ${i + 1} unit`}
          value={l.unitId}
          options={opts(m?.units)}
          onChange={(id) => setOut(i, { unitId: id })}
          error={e[`stockOut.${i}.unitId`]}
        />
      ),
    },
    {
      id: "box",
      header: "Box No.",
      width: 6,
      render: (l, i) => (
        <InlineInput
          label={`Stock out line ${i + 1} box no.`}
          value={l.boxNo}
          onChange={(x) => setOut(i, { boxNo: x })}
        />
      ),
    },
    {
      id: "qty",
      header: "Qty",
      width: 6,
      align: "right",
      render: (l, i) => (
        <InlineInput
          label={`Stock out line ${i + 1} qty`}
          numeric
          value={l.qty}
          onChange={(x) => setOut(i, { qty: x })}
          error={e[`stockOut.${i}.qty`]}
        />
      ),
    },
    {
      id: "remark",
      header: "Remark",
      width: 8,
      render: (l, i) => (
        <InlineInput
          label={`Stock out line ${i + 1} remark`}
          value={l.remark}
          onChange={(x) => setOut(i, { remark: x })}
        />
      ),
    },
  ];

  const inColumns: DetailColumn<InLine>[] = [
    {
      id: "item",
      header: "Item",
      width: 10,
      render: (l, i) => (
        <InlineSelect
          label={`Stock in line ${i + 1} item`}
          value={l.itemId}
          options={opts(m?.items)}
          onChange={(id) => setIn(i, { itemId: id })}
          error={e[`stockIn.${i}.itemId`]}
        />
      ),
    },
    {
      id: "unit",
      header: "Unit",
      width: 6,
      render: (l, i) => (
        <InlineSelect
          label={`Stock in line ${i + 1} unit`}
          value={l.unitId}
          options={opts(m?.units)}
          onChange={(id) => setIn(i, { unitId: id })}
          error={e[`stockIn.${i}.unitId`]}
        />
      ),
    },
    {
      id: "qty",
      header: "Qty",
      width: 6,
      align: "right",
      render: (l, i) => (
        <InlineInput
          label={`Stock in line ${i + 1} qty`}
          numeric
          value={l.qty}
          onChange={(x) => setIn(i, { qty: x })}
          error={e[`stockIn.${i}.qty`]}
        />
      ),
    },
    {
      id: "remark",
      header: "Remark",
      width: 10,
      render: (l, i) => (
        <InlineInput
          label={`Stock in line ${i + 1} remark`}
          value={l.remark}
          onChange={(x) => setIn(i, { remark: x })}
        />
      ),
    },
  ];

  const totalOut = sumQty(v.stockOut.map((l) => num(l.qty)).filter(Number.isFinite));
  const totalIn = sumQty(v.stockIn.map((l) => num(l.qty)).filter(Number.isFinite));
  const difference = subtractQty(totalIn, totalOut);
  const outErrors = Object.keys(e).some((k) => k.startsWith("stockOut"));
  const inErrors = Object.keys(e).some((k) => k.startsWith("stockIn"));

  return (
    <ProductionPageShell feature={feature}>
      <DraftsPanel
        kind="fabricConversion"
        onEdit={form.open}
        describe={(i) =>
          `${i.productName || "No product"} · ${i.stockOut.length} out / ${i.stockIn.length} in line(s)`
        }
      />
      <ProductionRegister
        title={feature.label}
        exportName="fabric-stock-conversions"
        rows={list.data}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="No., warehouse, product, convert by…"
        filters={[{ id: "warehouse", label: "Warehouse", value: (r) => r.warehouseName }]}
        groupBy={[
          { id: "warehouse", label: "Warehouse", value: (r) => r.warehouseName },
          { id: "type", label: "Type", value: (r) => r.conversionType },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
        onView={setViewing}
      />

      <ProductionFormDialog
        form={form}
        title="Fabric Stock Convert Entry"
        size="xl"
        description="Stock transformation: stock out lines are converted into stock in lines on one document."
      >
        <DocumentInfoSection
          idPrefix="fc"
          dateLabel="Date"
          numberLabel="No."
          date={v.date}
          onDate={(d) => form.set("date", d)}
          dateError={e["date"]}
        >
          <ReadOnlyField label="ID" value="Assigned on post" />
          <ReferenceSelect
            id="fc-type"
            label="Type"
            required
            value={v.conversionType}
            options={(m?.conversionTypes ?? []).map((t) => ({ id: t, label: t }))}
            onChange={(id) => form.set("conversionType", id)}
            error={e["conversionType"]}
          />
        </DocumentInfoSection>
        <FormSection title="Header">
          <FieldGrid cols={4}>
            <ReferenceSelect
              id="fc-warehouse"
              label="Warehouse"
              required
              value={v.warehouseId}
              options={masterOptions(m?.warehouses)}
              onChange={(id) => form.set("warehouseId", id)}
              error={e["warehouseId"]}
            />
            <TextField
              id="fc-convert-by"
              label="Convert By"
              value={v.convertBy}
              onChange={(x) => form.set("convertBy", x)}
            />
            <TextField
              id="fc-product"
              label="Product Name"
              value={v.productName}
              onChange={(x) => form.set("productName", x)}
            />
            <RemarkField id="fc-remark" value={v.remark} onChange={(x) => form.set("remark", x)} />
          </FieldGrid>
        </FormSection>

        <Tabs defaultValue="out">
          <TabsList>
            <TabsTrigger value="out" className={cn("text-xs", outErrors && "text-destructive")}>
              Stock Out Detail ({v.stockOut.length})
            </TabsTrigger>
            <TabsTrigger value="in" className={cn("text-xs", inErrors && "text-destructive")}>
              Stock In Detail ({v.stockIn.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="out" className="space-y-2">
            {e["stockOut"] && (
              <p role="alert" className="text-xs text-destructive">
                {e["stockOut"]}
              </p>
            )}
            <DetailGrid
              columns={outColumns}
              lines={v.stockOut}
              lineKey={(l) => l.key}
              lineLabel="Stock out line"
              emptyText="No stock out lines."
              onRemove={(i) =>
                form.update((prev) => ({
                  ...prev,
                  stockOut: prev.stockOut.filter((_, idx) => idx !== i),
                }))
              }
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={() => form.update((p) => ({ ...p, stockOut: [...p.stockOut, emptyOut()] }))}
            >
              <Plus className="size-3.5" /> Add Stock Out Line
            </Button>
          </TabsContent>
          <TabsContent value="in" className="space-y-2">
            <p className="flex items-start gap-1 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Stock In detail fields are pending the final screen specification; a generic Item /
              Unit / Qty / Remark grid is used for now.
            </p>
            {e["stockIn"] && (
              <p role="alert" className="text-xs text-destructive">
                {e["stockIn"]}
              </p>
            )}
            <DetailGrid
              columns={inColumns}
              lines={v.stockIn}
              lineKey={(l) => l.key}
              lineLabel="Stock in line"
              emptyText="No stock in lines."
              onRemove={(i) =>
                form.update((prev) => ({
                  ...prev,
                  stockIn: prev.stockIn.filter((_, idx) => idx !== i),
                }))
              }
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={() => form.update((p) => ({ ...p, stockIn: [...p.stockIn, emptyIn()] }))}
            >
              <Plus className="size-3.5" /> Add Stock In Line
            </Button>
          </TabsContent>
        </Tabs>

        <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-2 rounded-md border border-border p-3 text-xs">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={v.quantityPreserving}
                onCheckedChange={(c) => form.set("quantityPreserving", c === true)}
              />
              Quantity preserving conversion (demo: require Stock In total = Stock Out total)
            </label>
            <p className="text-muted-foreground">
              Backend conversion / wastage rules pending confirmation. Without the option above, a
              difference between stock out and stock in is allowed and shown.
            </p>
          </div>
          <QuantitySummary
            title="Conversion Totals"
            rows={[
              { label: "Total Stock Out Qty", value: totalOut },
              { label: "Total Stock In Qty", value: totalIn },
              {
                label: "Difference (In − Out)",
                value: difference,
                result: true,
                tone:
                  compareQty(difference, 0) === 0
                    ? "success"
                    : v.quantityPreserving
                      ? "danger"
                      : "warning",
              },
            ]}
          />
        </div>
      </ProductionFormDialog>

      <RecordViewDialog
        row={viewing}
        title={(r) => `Fabric Stock Conversion ${r.number}`}
        columns={COLUMNS}
        jobOrderId={(r) => r.stockOut[0]?.jobOrderId ?? null}
        onClose={() => setViewing(null)}
      >
        {(r) => (
          <div className="space-y-2 text-xs">
            {[
              {
                title: "Stock Out Detail",
                head: ["Job Order", "Item", "Yarn", "Unit", "Box No.", "Qty", "Remark"],
                rows: r.stockOut.map((l) => [
                  jobOrderOf(l.jobOrderId)?.number ?? "—",
                  m?.items.find((x) => x.id === l.itemId)?.name ?? "—",
                  m?.yarns.find((x) => x.id === l.yarnId)?.name ?? "—",
                  m?.units.find((x) => x.id === l.unitId)?.name ?? "—",
                  l.boxNo || "—",
                  formatQty(l.qty),
                  l.remark || "—",
                ]),
              },
              {
                title: "Stock In Detail",
                head: ["Item", "Unit", "Qty", "Remark"],
                rows: r.stockIn.map((l) => [
                  m?.items.find((x) => x.id === l.itemId)?.name ?? "—",
                  m?.units.find((x) => x.id === l.unitId)?.name ?? "—",
                  formatQty(l.qty),
                  l.remark || "—",
                ]),
              },
            ].map((t) => (
              <div key={t.title} className="overflow-x-auto rounded-md border border-border">
                <div className="bg-muted/40 px-2 py-1 font-semibold">{t.title}</div>
                <table className="w-full">
                  <thead>
                    <tr>
                      {t.head.map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-2 py-1 text-left font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((cells, i) => (
                      <tr key={i} className="border-t border-border">
                        {cells.map((c, j) => (
                          <td key={j} className="whitespace-nowrap px-2 py-1">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </RecordViewDialog>
    </ProductionPageShell>
  );
}
