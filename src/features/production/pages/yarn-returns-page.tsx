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
  ReadOnlyField,
  ReferenceSelect,
} from "@/components/erp/form-controls";
import {
  useDocumentForm,
  type DocumentFormConfig,
} from "@/features/production/hooks/use-document-form";
import { useProductionList } from "@/features/production/hooks/use-production";
import type { YarnReturnRow } from "@/features/production/types/production";
import { formatDate, formatQty, todayIso } from "@/lib/erp/formatting";
import { compareQty, subtractQty } from "@/lib/erp/numbers";
import {
  num,
  text,
  useCanEnterProduction,
  useRegisterRange,
} from "@/features/production/pages/page-helpers";
import { DocumentInfoSection, RemarkField } from "@/features/production/pages/page-sections";

type Values = { date: string; yarnIssueId: string; qty: string; remark: string };

const CONFIG: DocumentFormConfig<"yarnReturn", Values> = {
  empty: () => ({ date: todayIso(), yarnIssueId: "", qty: "", remark: "" }),
  toInput: (v) => ({ ...v, qty: num(v.qty) }),
  fromInput: (i) => ({ ...i, qty: text(i.qty) }),
};

const COLUMNS: RegisterColumn<YarnReturnRow>[] = [
  { id: "number", header: "Return Challan No.", value: (r) => r.number, sticky: true, width: 8 },
  { id: "date", header: "Return Date", value: (r) => r.date, kind: "date" },
  { id: "issueNo", header: "Original Issue No.", value: (r) => r.issueNo, width: 8 },
  { id: "party", header: "Account / Party", value: (r) => r.partyName, width: 11 },
  { id: "productType", header: "Product Type", value: (r) => r.productType, width: 8 },
  { id: "item", header: "Item", value: (r) => r.yarnName, width: 11 },
  { id: "issueQty", header: "Issue Qty", value: (r) => r.issueQty, kind: "qty" },
  { id: "qty", header: "Return Qty", value: (r) => r.qty, kind: "qty", total: true },
  { id: "amount", header: "Amount", value: (r) => r.amount, kind: "amount", total: true },
  { id: "remark", header: "Remark", value: (r) => r.remark || null, width: 10, hideOnMobile: true },
];

export default function YarnReturnsPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const [range, setRange] = useRegisterRange();
  const list = useProductionList("yarnReturn", range);
  const issues = useProductionList("yarnIssue");
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm("yarnReturn", CONFIG);
  const [viewing, setViewing] = useState<YarnReturnRow | null>(null);
  const v = form.values;
  const e = form.errors;
  const issue = issues.data?.find((i) => i.id === v.yarnIssueId);
  const qty = num(v.qty);
  const current = Number.isFinite(qty) ? qty : null;
  const over = !!issue && current !== null && compareQty(current, issue.outstandingQty) > 0;

  return (
    <ProductionPageShell feature={feature}>
      <DraftsPanel
        kind="yarnReturn"
        onEdit={form.open}
        describe={(i) =>
          `Return against ${issues.data?.find((x) => x.id === i.yarnIssueId)?.number ?? "—"} · qty ${i.qty || "—"}`
        }
      />
      <ProductionRegister
        title={feature.label}
        exportName="yarn-returns"
        rows={list.data}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="Challan, issue no., party, item…"
        filters={[{ id: "party", label: "Party", value: (r) => r.partyName }]}
        groupBy={[
          { id: "party", label: "Party", value: (r) => r.partyName },
          { id: "item", label: "Item", value: (r) => r.yarnName },
          { id: "jobOrder", label: "Job Order", value: (r) => r.jobOrderNo },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
        onView={setViewing}
      />

      <ProductionFormDialog form={form} title="Yarn Return Entry">
        <FormSection title="Original Yarn Issue">
          <FieldGrid>
            <ReferenceSelect
              id="yr-issue"
              label="Original Issue No."
              required
              value={v.yarnIssueId}
              options={(issues.data ?? []).map((i) => ({
                id: i.id,
                label: i.number,
                detail: `${formatDate(i.date)} · ${i.jobOrderNo} · ${i.yarnName}`,
                meta: `O/S ${formatQty(i.outstandingQty)}`,
                disabled: compareQty(i.outstandingQty, 0) <= 0,
              }))}
              onChange={(id) => form.set("yarnIssueId", id)}
              error={e["yarnIssueId"]}
            />
            <ReadOnlyField label="Job Order" value={issue?.jobOrderNo} />
            <ReadOnlyField label="Party" value={issue?.partyName} />
            <ReadOnlyField label="Item" value={issue?.yarnName} />
            <ReadOnlyField label="Warehouse" value={issue?.warehouseName} />
            <ReadOnlyField label="Issue Date" value={issue ? formatDate(issue.date) : ""} />
          </FieldGrid>
        </FormSection>
        <DocumentInfoSection
          idPrefix="yr"
          dateLabel="Return Date"
          numberLabel="Return Challan No."
          date={v.date}
          onDate={(d) => form.set("date", d)}
          dateError={e["date"]}
        />
        <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
          <FormSection title="Return">
            <FieldGrid cols={2}>
              <NumberField
                id="yr-qty"
                label="Return Qty"
                required
                value={v.qty}
                onChange={(x) => form.set("qty", x)}
                error={
                  e["qty"] ??
                  (over
                    ? `Cannot exceed the outstanding ${formatQty(issue?.outstandingQty)}`
                    : undefined)
                }
              />
              <RemarkField
                id="yr-remark"
                value={v.remark}
                onChange={(x) => form.set("remark", x)}
              />
            </FieldGrid>
          </FormSection>
          <QuantitySummary
            rows={[
              { label: "Issued", value: issue?.qty ?? null },
              { label: "Previously Returned", value: issue?.returnedQty ?? null },
              { label: "Outstanding", value: issue?.outstandingQty ?? null },
              { label: "Current Return", value: current },
              {
                label: "Net Issued After",
                value:
                  issue && current !== null ? subtractQty(issue.outstandingQty, current) : null,
                result: true,
                tone: over ? "danger" : "default",
              },
            ]}
          />
        </div>
        <TraceabilityPanel jobOrderId={issue?.jobOrderId ?? null} />
      </ProductionFormDialog>

      <RecordViewDialog
        row={viewing}
        title={(r) => `Yarn Return ${r.number}`}
        columns={COLUMNS}
        jobOrderId={(r) => r.jobOrderId}
        onClose={() => setViewing(null)}
      />
    </ProductionPageShell>
  );
}
