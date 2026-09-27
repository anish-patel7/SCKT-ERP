import { useState } from "react";
import type { ProductionFeatureDefinition } from "@/features/production/config/production-features";
import { ProductionPageShell } from "@/features/production/components/production-page-shell";
import {
  ProductionRegister,
  type RegisterColumn,
} from "@/features/production/components/production-register";
import { ProductionFormDialog } from "@/features/production/components/production-form-dialog";
import { DraftsPanel } from "@/features/production/components/drafts-panel";
import { RecordViewDialog } from "@/features/production/components/record-view-dialog";
import { DocumentStatusBadge } from "@/features/production/components/status-badges";
import { QuantitySummary } from "@/features/production/components/quantity-summary";
import { TraceabilityPanel } from "@/features/production/components/traceability-panel";
import {
  FieldGrid,
  FormSection,
  NumberField,
  ReadOnlyField,
  ReferenceSelect,
} from "@/components/erp/form-controls";
import {
  useDocumentForm,
  type DocumentFormConfig,
} from "@/features/production/hooks/use-document-form";
import {
  useAvailableQty,
  useProductionList,
  useProductionMasters,
} from "@/features/production/hooks/use-production";
import type { YarnIssueRow } from "@/features/production/types/production";
import { formatAmount, formatQty, todayIso } from "@/lib/erp/formatting";
import { compareQty, lineAmount, subtractQty } from "@/lib/erp/numbers";
import {
  masterOptions,
  num,
  text,
  useCanEnterProduction,
  useRegisterRange,
} from "@/features/production/pages/page-helpers";
import { DocumentInfoSection, RemarkField } from "@/features/production/pages/page-sections";

type Values = {
  date: string;
  jobOrderId: string;
  warehouseId: string;
  unitId: string;
  yarnId: string;
  qty: string;
  rate: string;
  remark: string;
};

const CONFIG: DocumentFormConfig<"yarnIssue", Values> = {
  empty: () => ({
    date: todayIso(),
    jobOrderId: "",
    warehouseId: "",
    unitId: "",
    yarnId: "",
    qty: "",
    rate: "",
    remark: "",
  }),
  toInput: (v) => ({ ...v, qty: num(v.qty), rate: num(v.rate) }),
  fromInput: (i) => ({ ...i, qty: text(i.qty), rate: text(i.rate) }),
};

const COLUMNS: RegisterColumn<YarnIssueRow>[] = [
  { id: "number", header: "Issue No.", value: (r) => r.number, sticky: true, width: 7 },
  { id: "date", header: "Issue Date", value: (r) => r.date, kind: "date" },
  { id: "jobOrder", header: "Job Order No.", value: (r) => r.jobOrderNo, width: 8 },
  { id: "warehouse", header: "Warehouse", value: (r) => r.warehouseName, width: 9 },
  { id: "unit", header: "Unit", value: (r) => r.unitName, width: 5 },
  { id: "yarn", header: "Yarn / Item", value: (r) => r.yarnName, width: 11 },
  { id: "qty", header: "Issue Quantity", value: (r) => r.qty, kind: "qty", total: true },
  { id: "returned", header: "Returned", value: (r) => r.returnedQty, kind: "qty", total: true },
  { id: "net", header: "Net Issued", value: (r) => r.outstandingQty, kind: "qty", total: true },
  { id: "amount", header: "Amount", value: (r) => r.amount, kind: "amount", total: true },
  {
    id: "status",
    header: "Status",
    value: (r) => r.documentStatus,
    render: (r) => <DocumentStatusBadge status={r.documentStatus} />,
    width: 5,
  },
  { id: "remark", header: "Remark", value: (r) => r.remark || null, width: 10, hideOnMobile: true },
];

export default function YarnIssuesPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const [range, setRange] = useRegisterRange();
  const list = useProductionList("yarnIssue", range);
  const jobOrders = useProductionList("jobOrder");
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm("yarnIssue", CONFIG);
  const [viewing, setViewing] = useState<YarnIssueRow | null>(null);
  const v = form.values;
  const e = form.errors;
  const stock = useAvailableQty(
    form.isOpen && v.warehouseId && v.yarnId
      ? { kind: "yarn", warehouseId: v.warehouseId, yarnId: v.yarnId }
      : null,
  );
  const qty = num(v.qty);
  const rate = num(v.rate);
  const available = stock.data ?? null;
  const over = available !== null && Number.isFinite(qty) && compareQty(qty, available) > 0;

  return (
    <ProductionPageShell feature={feature}>
      <DraftsPanel
        kind="yarnIssue"
        onEdit={form.open}
        describe={(i) =>
          `${jobOrders.data?.find((j) => j.id === i.jobOrderId)?.number ?? "No job order"} · ${
            m?.yarns.find((y) => y.id === i.yarnId)?.name ?? "No yarn"
          } · qty ${i.qty || "—"}`
        }
      />
      <ProductionRegister
        title={feature.label}
        exportName="yarn-issues"
        rows={list.data}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="Issue no., job order, yarn…"
        filters={[
          { id: "warehouse", label: "Warehouse", value: (r) => r.warehouseName },
          { id: "jobOrder", label: "Job Order", value: (r) => r.jobOrderNo },
        ]}
        groupBy={[
          { id: "jobOrder", label: "Job Order", value: (r) => r.jobOrderNo },
          { id: "yarn", label: "Yarn / Item", value: (r) => r.yarnName },
          { id: "warehouse", label: "Warehouse", value: (r) => r.warehouseName },
          { id: "unit", label: "Unit", value: (r) => r.unitName },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
        onView={setViewing}
      />

      <ProductionFormDialog form={form} title="Yarn Issue Entry">
        <DocumentInfoSection
          idPrefix="yi"
          dateLabel="Issue Date"
          numberLabel="Issue No."
          date={v.date}
          onDate={(d) => form.set("date", d)}
          dateError={e["date"]}
        />
        <FormSection title="Business Reference">
          <FieldGrid>
            <ReferenceSelect
              id="yi-job-order"
              label="Job Order"
              required
              value={v.jobOrderId}
              options={(jobOrders.data ?? []).map((j) => ({
                id: j.id,
                label: j.number,
                detail: `${j.partyName} · ${j.itemName} · ${j.yarnName}`,
              }))}
              onChange={(id) => {
                form.set("jobOrderId", id);
                const jo = jobOrders.data?.find((j) => j.id === id);
                if (jo && !v.yarnId) form.set("yarnId", jo.yarnId);
              }}
              error={e["jobOrderId"]}
            />
            <ReferenceSelect
              id="yi-warehouse"
              label="Warehouse"
              required
              value={v.warehouseId}
              options={masterOptions(m?.warehouses)}
              onChange={(id) => form.set("warehouseId", id)}
              error={e["warehouseId"]}
            />
            <ReferenceSelect
              id="yi-unit"
              label="Unit"
              required
              value={v.unitId}
              options={masterOptions(m?.units)}
              onChange={(id) => form.set("unitId", id)}
              error={e["unitId"]}
            />
            <ReferenceSelect
              id="yi-yarn"
              label="Yarn / Item"
              required
              value={v.yarnId}
              options={masterOptions(m?.yarns)}
              onChange={(id) => form.set("yarnId", id)}
              error={e["yarnId"]}
            />
          </FieldGrid>
        </FormSection>
        <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
          <FormSection title="Quantity">
            <FieldGrid cols={2}>
              <ReadOnlyField
                label="Available Qty (demo stock)"
                value={available === null ? "Select warehouse and yarn" : formatQty(available)}
                mono
              />
              <NumberField
                id="yi-qty"
                label="Issue Quantity"
                required
                value={v.qty}
                onChange={(x) => form.set("qty", x)}
                error={e["qty"] ?? (over ? "More than the demo available quantity" : undefined)}
              />
              <NumberField
                id="yi-rate"
                label="Rate"
                value={v.rate}
                onChange={(x) => form.set("rate", x)}
                error={e["rate"]}
              />
              <ReadOnlyField
                label="Amount (preview)"
                value={
                  Number.isFinite(qty) && Number.isFinite(rate)
                    ? formatAmount(lineAmount(qty, rate))
                    : "—"
                }
                mono
              />
              <RemarkField
                id="yi-remark"
                value={v.remark}
                onChange={(x) => form.set("remark", x)}
              />
            </FieldGrid>
          </FormSection>
          <QuantitySummary
            title="Demo Stock"
            rows={[
              { label: "Available", value: available },
              { label: "This Issue", value: Number.isFinite(qty) ? qty : null },
              {
                label: "Available After",
                value:
                  available !== null && Number.isFinite(qty) ? subtractQty(available, qty) : null,
                result: true,
                tone: over ? "danger" : "default",
              },
            ]}
          />
        </div>
        <TraceabilityPanel jobOrderId={v.jobOrderId || null} />
      </ProductionFormDialog>

      <RecordViewDialog
        row={viewing}
        title={(r) => `Yarn Issue ${r.number}`}
        columns={COLUMNS}
        jobOrderId={(r) => r.jobOrderId}
        onClose={() => setViewing(null)}
      />
    </ProductionPageShell>
  );
}
