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
import { QuantitySummary } from "@/features/production/components/quantity-summary";
import { TraceabilityPanel } from "@/features/production/components/traceability-panel";
import {
  FieldGrid,
  FormSection,
  NumberField,
  ReferenceSelect,
} from "@/features/production/components/form-controls";
import {
  useDocumentForm,
  type DocumentFormConfig,
} from "@/features/production/hooks/use-document-form";
import {
  useAvailableQty,
  useProductionList,
  useProductionMasters,
} from "@/features/production/hooks/use-production";
import type { CuttingRow } from "@/features/production/types/production";
import { todayIso } from "@/features/production/utils/formatting";
import { compareQty, subtractQty } from "@/features/production/utils/quantities";
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
  salesOrderId: string;
  jobOrderId: string;
  itemId: string;
  yarnId: string;
  gradeId: string;
  qty: string;
  remark: string;
};

const CONFIG: DocumentFormConfig<"cutting", Values> = {
  empty: () => ({
    date: todayIso(),
    salesOrderId: "",
    jobOrderId: "",
    itemId: "",
    yarnId: "",
    gradeId: "",
    qty: "",
    remark: "",
  }),
  toInput: (v) => ({ ...v, qty: num(v.qty) }),
  fromInput: (i) => ({ ...i, qty: text(i.qty) }),
};

const COLUMNS: RegisterColumn<CuttingRow>[] = [
  { id: "number", header: "Cutting No.", value: (r) => r.number, sticky: true, width: 7 },
  { id: "date", header: "Cutting Date", value: (r) => r.date, kind: "date" },
  { id: "salesOrder", header: "Sales Order No.", value: (r) => r.salesOrderNo, width: 8 },
  { id: "jobOrder", header: "Job Order No.", value: (r) => r.jobOrderNo, width: 8 },
  { id: "item", header: "Item", value: (r) => r.itemName, width: 11 },
  { id: "yarn", header: "Yarn", value: (r) => r.yarnName, width: 10, hideOnMobile: true },
  { id: "grade", header: "Grade", value: (r) => r.gradeName, width: 6 },
  { id: "qty", header: "Cutting Qty", value: (r) => r.qty, kind: "qty", total: true },
];

export default function CuttingPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const [range, setRange] = useRegisterRange();
  const list = useProductionList("cutting", range);
  const jobOrders = useProductionList("jobOrder");
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm("cutting", CONFIG);
  const [viewing, setViewing] = useState<CuttingRow | null>(null);
  const v = form.values;
  const e = form.errors;
  const source = useAvailableQty(
    form.isOpen && v.jobOrderId && v.itemId && v.yarnId
      ? { kind: "cuttingSource", jobOrderId: v.jobOrderId, itemId: v.itemId, yarnId: v.yarnId }
      : null,
  );
  const qty = num(v.qty);
  const current = Number.isFinite(qty) ? qty : null;
  const available = source.data ?? null;
  const over = available !== null && current !== null && compareQty(current, available) > 0;
  const jobOrderOptions = (jobOrders.data ?? [])
    .filter((j) => !v.salesOrderId || j.salesOrderId === v.salesOrderId)
    .map((j) => ({
      id: j.id,
      label: j.number,
      detail: `${j.salesOrderNo} · ${j.partyName} · ${j.itemName}`,
    }));

  return (
    <ProductionPageShell feature={feature}>
      <DraftsPanel
        kind="cutting"
        onEdit={form.open}
        describe={(i) =>
          `${jobOrders.data?.find((j) => j.id === i.jobOrderId)?.number ?? "No job order"} · ${
            m?.grades.find((g) => g.id === i.gradeId)?.name ?? "No grade"
          } · qty ${i.qty || "—"}`
        }
      />
      <ProductionRegister
        title={feature.label}
        exportName="cutting"
        rows={list.data}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="Cutting no., order, item, grade…"
        filters={[{ id: "grade", label: "Grade", value: (r) => r.gradeName }]}
        groupBy={[
          { id: "grade", label: "Grade", value: (r) => r.gradeName },
          { id: "jobOrder", label: "Job Order", value: (r) => r.jobOrderNo },
          { id: "item", label: "Item", value: (r) => r.itemName },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
        onView={setViewing}
      />

      <ProductionFormDialog form={form} title="Cutting Entry">
        <DocumentInfoSection
          idPrefix="ct"
          dateLabel="Cutting Date"
          numberLabel="Cutting No."
          date={v.date}
          onDate={(d) => form.set("date", d)}
          dateError={e["date"]}
        />
        <FormSection title="Business Reference">
          <FieldGrid>
            <ReferenceSelect
              id="ct-sales-order"
              label="Sales Order"
              required
              value={v.salesOrderId}
              options={(m?.salesOrders ?? []).map((so) => ({
                id: so.id,
                label: so.code,
                detail: m?.parties.find((p) => p.id === so.partyId)?.name ?? "",
              }))}
              onChange={(id) => form.set("salesOrderId", id)}
              error={e["salesOrderId"]}
            />
            <ReferenceSelect
              id="ct-job-order"
              label="Job Order"
              required
              value={v.jobOrderId}
              options={jobOrderOptions}
              onChange={(id) => {
                const jo = jobOrders.data?.find((j) => j.id === id);
                form.update((prev) => ({
                  ...prev,
                  jobOrderId: id,
                  salesOrderId: prev.salesOrderId || jo?.salesOrderId || "",
                  itemId: prev.itemId || jo?.itemId || "",
                  yarnId: prev.yarnId || jo?.yarnId || "",
                }));
                form.clearError("jobOrderId");
              }}
              error={e["jobOrderId"]}
            />
            <ReferenceSelect
              id="ct-item"
              label="Item"
              required
              value={v.itemId}
              options={masterOptions(m?.items)}
              onChange={(id) => form.set("itemId", id)}
              error={e["itemId"]}
            />
            <ReferenceSelect
              id="ct-yarn"
              label="Yarn"
              required
              value={v.yarnId}
              options={masterOptions(m?.yarns)}
              onChange={(id) => form.set("yarnId", id)}
              error={e["yarnId"]}
            />
            <ReferenceSelect
              id="ct-grade"
              label="Grade"
              required
              value={v.gradeId}
              options={masterOptions(m?.grades)}
              onChange={(id) => form.set("gradeId", id)}
              error={e["gradeId"]}
            />
          </FieldGrid>
        </FormSection>
        <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
          <FormSection title="Quantity">
            <FieldGrid cols={2}>
              <NumberField
                id="ct-qty"
                label="Cutting Qty"
                required
                value={v.qty}
                onChange={(x) => form.set("qty", x)}
                error={e["qty"] ?? (over ? "More than the demo available quantity" : undefined)}
              />
              <RemarkField
                id="ct-remark"
                value={v.remark}
                onChange={(x) => form.set("remark", x)}
              />
            </FieldGrid>
          </FormSection>
          <QuantitySummary
            title="Available / WIP (demo)"
            rows={[
              { label: "Available (received − cut)", value: available },
              { label: "Current Cutting", value: current },
              {
                label: "Available After",
                value:
                  available !== null && current !== null ? subtractQty(available, current) : null,
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
        title={(r) => `Cutting ${r.number}`}
        columns={COLUMNS}
        jobOrderId={(r) => r.jobOrderId}
        onClose={() => setViewing(null)}
      />
    </ProductionPageShell>
  );
}
