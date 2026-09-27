import { useState } from "react";
import { Info } from "lucide-react";
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
import {
  useProductionList,
  useProductionMasters,
} from "@/features/production/hooks/use-production";
import type { JobCardReceiptRow } from "@/features/production/types/production";
import {
  formatAmount,
  formatDate,
  formatQty,
  todayIso,
} from "@/lib/erp/formatting";
import {
  compareQty,
  lineAmount,
  subtractQty,
  sumQty,
} from "@/lib/erp/numbers";
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
  jobCardId: string;
  unitId: string;
  beamId: string;
  receiveQty: string;
  saleQty: string;
  stockQty: string;
  stockStatus: string;
  pickRate: string;
  remark: string;
};

const CONFIG: DocumentFormConfig<"jobCardReceipt", Values> = {
  empty: () => ({
    date: todayIso(),
    jobCardId: "",
    unitId: "",
    beamId: "",
    receiveQty: "",
    saleQty: "0",
    stockQty: "0",
    stockStatus: "",
    pickRate: "",
    remark: "",
  }),
  toInput: (v) => ({
    ...v,
    beamId: v.beamId || null,
    receiveQty: num(v.receiveQty),
    saleQty: num(v.saleQty),
    stockQty: num(v.stockQty),
    pickRate: num(v.pickRate),
  }),
  fromInput: (i) => ({
    ...i,
    beamId: i.beamId ?? "",
    receiveQty: text(i.receiveQty),
    saleQty: text(i.saleQty),
    stockQty: text(i.stockQty),
    pickRate: text(i.pickRate),
  }),
};

const COLUMNS: RegisterColumn<JobCardReceiptRow>[] = [
  { id: "number", header: "Job Receive No.", value: (r) => r.number, sticky: true, width: 8 },
  { id: "date", header: "Job Receive Date", value: (r) => r.date, kind: "date" },
  { id: "unit", header: "Unit", value: (r) => r.unitName, width: 5, hideOnMobile: true },
  { id: "jobCard", header: "Job Challan No.", value: (r) => r.jobChallanNo, width: 8 },
  { id: "jobOrder", header: "Job Order No.", value: (r) => r.jobOrderNo, width: 8 },
  {
    id: "salesOrder",
    header: "Sales Order No.",
    value: (r) => r.salesOrderNo,
    width: 8,
    hideOnMobile: true,
  },
  { id: "item", header: "Item", value: (r) => r.itemName, width: 11, hideOnMobile: true },
  { id: "yarn", header: "Yarn Item", value: (r) => r.yarnName, width: 10, hideOnMobile: true },
  { id: "party", header: "Account / Party", value: (r) => r.partyName, width: 11 },
  { id: "card", header: "Card", value: (r) => r.cardNo, width: 6, hideOnMobile: true },
  { id: "receiveQty", header: "Receive Qty", value: (r) => r.receiveQty, kind: "qty", total: true },
  { id: "saleQty", header: "Sale Qty", value: (r) => r.saleQty, kind: "qty", total: true },
  { id: "stockQty", header: "Stock Qty", value: (r) => r.stockQty, kind: "qty", total: true },
  { id: "stockStatus", header: "Stock Status", value: (r) => r.stockStatus, width: 6 },
  // "Total Card": exact meaning not yet specified; each receipt references one card.
  { id: "totalCard", header: "Total Card", value: () => "1", width: 5, hideOnMobile: true },
  {
    id: "pickRate",
    header: "Pick Rate",
    value: (r) => r.pickRate,
    kind: "rate",
    hideOnMobile: true,
  },
  { id: "amount", header: "Amount", value: (r) => r.amount, kind: "amount", total: true },
  { id: "machine", header: "Machine / Loom", value: (r) => r.machineName, width: 7 },
  { id: "beam", header: "Beam No.", value: (r) => r.beamName, width: 6, hideOnMobile: true },
];

export default function JobCardReceiptsPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const [range, setRange] = useRegisterRange();
  const list = useProductionList("jobCardReceipt", range);
  const cards = useProductionList("jobCard");
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm("jobCardReceipt", CONFIG);
  const [viewing, setViewing] = useState<JobCardReceiptRow | null>(null);
  const v = form.values;
  const e = form.errors;
  const card = cards.data?.find((c) => c.id === v.jobCardId);
  const receive = num(v.receiveQty);
  const current = Number.isFinite(receive) ? receive : null;
  const over = !!card && current !== null && compareQty(current, card.balanceQty) > 0;
  const sale = num(v.saleQty);
  const stock = num(v.stockQty);
  // Not an enforced rule: whether Receive = Sale + Stock is not confirmed.
  const splitDiffers =
    current !== null &&
    Number.isFinite(sale) &&
    Number.isFinite(stock) &&
    compareQty(sumQty([sale, stock]), current) !== 0;
  const pickRate = num(v.pickRate);

  return (
    <ProductionPageShell feature={feature}>
      <DraftsPanel
        kind="jobCardReceipt"
        onEdit={form.open}
        describe={(i) =>
          `Receive against ${cards.data?.find((c) => c.id === i.jobCardId)?.number ?? "—"} · qty ${i.receiveQty || "—"}`
        }
      />
      <ProductionRegister
        title={feature.label}
        exportName="job-card-receipts"
        rows={list.data}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="Receive no., challan, party, beam…"
        filters={[
          { id: "party", label: "Party", value: (r) => r.partyName },
          { id: "stockStatus", label: "Stock Status", value: (r) => r.stockStatus },
        ]}
        groupBy={[
          { id: "party", label: "Party", value: (r) => r.partyName },
          { id: "jobOrder", label: "Job Order", value: (r) => r.jobOrderNo },
          { id: "machine", label: "Machine", value: (r) => r.machineName },
          { id: "stockStatus", label: "Stock Status", value: (r) => r.stockStatus },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
        onView={setViewing}
      />

      <ProductionFormDialog form={form} title="Job Card Receive Entry">
        <FormSection title="Original Job Card / Challan">
          <FieldGrid>
            <ReferenceSelect
              id="jcr-card"
              label="Job Challan No."
              required
              value={v.jobCardId}
              options={(cards.data ?? []).map((c) => ({
                id: c.id,
                label: c.number,
                detail: `${c.jobOrderNo} · ${c.partyName} · ${c.machineName}`,
                meta: `O/S ${formatQty(c.balanceQty)}`,
                disabled: c.status !== "Pending",
              }))}
              onChange={(id) => {
                const selected = cards.data?.find((c) => c.id === id);
                form.update((prev) => ({
                  ...prev,
                  jobCardId: id,
                  unitId: prev.unitId || selected?.unitId || "",
                }));
                form.clearError("jobCardId");
              }}
              error={e["jobCardId"]}
            />
            <ReadOnlyField label="Job Order" value={card?.jobOrderNo} />
            <ReadOnlyField label="Order" value={card?.salesOrderNo} />
            <ReadOnlyField label="Party" value={card?.partyName} />
            <ReadOnlyField label="Item" value={card?.itemName} />
            <ReadOnlyField label="Yarn" value={card?.yarnName} />
            <ReadOnlyField label="Machine" value={card?.machineName} />
            <ReadOnlyField label="Challan Date" value={card ? formatDate(card.date) : ""} />
          </FieldGrid>
        </FormSection>
        <DocumentInfoSection
          idPrefix="jcr"
          dateLabel="Job Receive Date"
          numberLabel="Job Receive No."
          date={v.date}
          onDate={(d) => form.set("date", d)}
          dateError={e["date"]}
        >
          <ReferenceSelect
            id="jcr-unit"
            label="Unit"
            required
            value={v.unitId}
            options={masterOptions(m?.units)}
            onChange={(id) => form.set("unitId", id)}
            error={e["unitId"]}
          />
          <ReferenceSelect
            id="jcr-beam"
            label="Beam"
            value={v.beamId}
            options={masterOptions(m?.beams)}
            onChange={(id) => form.set("beamId", id)}
            error={e["beamId"]}
          />
        </DocumentInfoSection>
        <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
          <FormSection title="Receive">
            <FieldGrid cols={2}>
              <NumberField
                id="jcr-receive"
                label="Receive Qty"
                required
                value={v.receiveQty}
                onChange={(x) => form.set("receiveQty", x)}
                error={
                  e["receiveQty"] ??
                  (over
                    ? `Cannot exceed the outstanding ${formatQty(card?.balanceQty)}`
                    : undefined)
                }
              />
              <ReferenceSelect
                id="jcr-stock-status"
                label="Stock Status"
                required
                value={v.stockStatus}
                options={(m?.stockStatuses ?? []).map((s) => ({ id: s, label: s }))}
                onChange={(id) => form.set("stockStatus", id)}
                error={e["stockStatus"]}
              />
              <NumberField
                id="jcr-sale"
                label="Sale Qty"
                value={v.saleQty}
                onChange={(x) => form.set("saleQty", x)}
                error={e["saleQty"]}
              />
              <NumberField
                id="jcr-stock"
                label="Stock Qty"
                value={v.stockQty}
                onChange={(x) => form.set("stockQty", x)}
                error={e["stockQty"]}
              />
              <NumberField
                id="jcr-pick"
                label="Pick Rate"
                value={v.pickRate}
                onChange={(x) => form.set("pickRate", x)}
                error={e["pickRate"]}
              />
              <ReadOnlyField
                label="Amount (Receive Qty × Pick Rate, preview)"
                value={
                  current !== null && Number.isFinite(pickRate)
                    ? formatAmount(lineAmount(current, pickRate))
                    : "—"
                }
                mono
              />
              <RemarkField
                id="jcr-remark"
                value={v.remark}
                onChange={(x) => form.set("remark", x)}
              />
            </FieldGrid>
            {splitDiffers && (
              <p className="mt-2 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Sale Qty + Stock Qty differs from Receive Qty. This is allowed; the rule between
                them is not confirmed yet.
              </p>
            )}
          </FormSection>
          <QuantitySummary
            rows={[
              { label: "Issued Qty", value: card?.issuedQty ?? null },
              { label: "Previously Received", value: card?.receivedQty ?? null },
              { label: "Adjustment", value: card?.adjustmentQty ?? null },
              { label: "Outstanding", value: card?.balanceQty ?? null },
              { label: "Current Receive", value: current },
              {
                label: "Balance After",
                value: card && current !== null ? subtractQty(card.balanceQty, current) : null,
                result: true,
                tone: over ? "danger" : "default",
              },
            ]}
          />
        </div>
        <TraceabilityPanel jobOrderId={card?.jobOrderId ?? null} />
      </ProductionFormDialog>

      <RecordViewDialog
        row={viewing}
        title={(r) => `Job Receive ${r.number}`}
        columns={COLUMNS}
        jobOrderId={(r) => r.jobOrderId}
        onClose={() => setViewing(null)}
      />
    </ProductionPageShell>
  );
}
