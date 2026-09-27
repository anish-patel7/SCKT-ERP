/**
 * Butta Cutting and Mill issue / receive screens. Both follow the same linked quantity
 * pattern (issue → receipts → balance / status) but keep their own fields: the Mill issue
 * screen has no warehouse.
 */
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
import { OperationalStatusBadge } from "@/features/production/components/status-badges";
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
import type {
  OutwardIssueRow,
  OutwardProcess,
  OutwardReceiptRow,
} from "@/features/production/types/production";
import {
  formatAmount,
  formatDate,
  formatMetres,
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
  partyOptions,
  text,
  useCanEnterProduction,
  useRegisterRange,
} from "@/features/production/pages/page-helpers";
import { DocumentInfoSection, RemarkField } from "@/features/production/pages/page-sections";

const PROCESS = {
  butta: {
    issueKind: "buttaIssue",
    receiptKind: "buttaReceipt",
    name: "Butta Cutting",
    slug: "butta-cutting",
  },
  mill: { issueKind: "millIssue", receiptKind: "millReceipt", name: "Mill", slug: "mill" },
} as const;

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

type IssueValues = {
  date: string;
  warehouseId: string;
  partyId: string;
  jobOrderId: string;
  itemId: string;
  yarnId: string;
  qty: string;
  metres: string;
  remark: string;
};

function issueConfig(
  process: OutwardProcess,
): DocumentFormConfig<"buttaIssue" | "millIssue", IssueValues> {
  return {
    empty: () => ({
      date: todayIso(),
      warehouseId: "",
      partyId: "",
      jobOrderId: "",
      itemId: "",
      yarnId: "",
      qty: "",
      metres: "",
      remark: "",
    }),
    toInput: (v) => ({
      ...v,
      warehouseId: process === "butta" ? v.warehouseId : null,
      qty: num(v.qty),
      metres: num(v.metres),
    }),
    fromInput: (i) => ({
      ...i,
      warehouseId: i.warehouseId ?? "",
      qty: text(i.qty),
      metres: text(i.metres),
    }),
  };
}

const ISSUE_CONFIG = { butta: issueConfig("butta"), mill: issueConfig("mill") };

function issueColumns(process: OutwardProcess): RegisterColumn<OutwardIssueRow>[] {
  return [
    { id: "number", header: "Issue No.", value: (r) => r.number, sticky: true, width: 7 },
    { id: "date", header: "Issue Date", value: (r) => r.date, kind: "date" },
    { id: "id", header: "ID", value: (r) => r.id, width: 9, hideOnMobile: true },
    ...(process === "butta"
      ? [
          {
            id: "warehouse",
            header: "Warehouse",
            value: (r: OutwardIssueRow) => r.warehouseName,
            width: 9,
          },
        ]
      : []),
    { id: "party", header: "Mill / Job Work Party", value: (r) => r.partyName, width: 11 },
    { id: "jobOrder", header: "Job Order No.", value: (r) => r.jobOrderNo, width: 8 },
    { id: "item", header: "Item", value: (r) => r.itemName, width: 11, hideOnMobile: true },
    { id: "yarn", header: "Yarn Item", value: (r) => r.yarnName, width: 10, hideOnMobile: true },
    { id: "qty", header: "Issue Qty", value: (r) => r.qty, kind: "qty", total: true },
    { id: "metres", header: "Metres", value: (r) => r.metres, kind: "metres", total: true },
    {
      id: "received",
      header: "Received Qty",
      value: (r) => r.receivedQty,
      kind: "qty",
      total: true,
    },
    { id: "balance", header: "Balance Qty", value: (r) => r.balanceQty, kind: "qty", total: true },
    {
      id: "status",
      header: "Status",
      value: (r) => r.status,
      render: (r) => <OperationalStatusBadge status={r.status} />,
      width: 5,
    },
  ];
}

function OutwardIssuesPage({
  feature,
  process,
}: {
  feature: ProductionFeatureDefinition;
  process: OutwardProcess;
}) {
  const kind = PROCESS[process].issueKind;
  const [range, setRange] = useRegisterRange();
  const list = useProductionList(kind, range);
  const jobOrders = useProductionList("jobOrder");
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm(kind, ISSUE_CONFIG[process]);
  const [viewing, setViewing] = useState<OutwardIssueRow | null>(null);
  const columns = issueColumns(process);
  const v = form.values;
  const e = form.errors;
  const title = `${PROCESS[process].name} Issue Entry`;

  return (
    <ProductionPageShell feature={feature}>
      <DraftsPanel
        kind={kind}
        onEdit={form.open}
        describe={(i) =>
          `${m?.parties.find((p) => p.id === i.partyId)?.name ?? "No party"} · ${
            jobOrders.data?.find((j) => j.id === i.jobOrderId)?.number ?? "No job order"
          } · qty ${i.qty || "—"}`
        }
      />
      <ProductionRegister
        title={feature.label}
        exportName={`${PROCESS[process].slug}-issues`}
        rows={list.data}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Issue no., party, job order, item…"
        filters={[
          { id: "status", label: "Status", value: (r) => r.status },
          { id: "party", label: "Party", value: (r) => r.partyName },
          ...(process === "butta"
            ? [
                {
                  id: "warehouse",
                  label: "Warehouse",
                  value: (r: OutwardIssueRow) => r.warehouseName,
                },
              ]
            : []),
        ]}
        groupBy={[
          { id: "party", label: "Party", value: (r) => r.partyName },
          { id: "jobOrder", label: "Job Order", value: (r) => r.jobOrderNo },
          { id: "item", label: "Item", value: (r) => r.itemName },
          { id: "status", label: "Status", value: (r) => r.status },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
        onView={setViewing}
        mobileBadges={(r) => <OperationalStatusBadge status={r.status} />}
      />

      <ProductionFormDialog form={form} title={title}>
        <DocumentInfoSection
          idPrefix={`${process}-i`}
          dateLabel="Issue Date"
          numberLabel="Issue No."
          date={v.date}
          onDate={(d) => form.set("date", d)}
          dateError={e["date"]}
        >
          {process === "butta" && (
            <ReferenceSelect
              id={`${process}-i-warehouse`}
              label="Warehouse"
              required
              value={v.warehouseId}
              options={masterOptions(m?.warehouses)}
              onChange={(id) => form.set("warehouseId", id)}
              error={e["warehouseId"]}
            />
          )}
        </DocumentInfoSection>
        <FormSection title="Business Reference">
          <FieldGrid>
            <ReferenceSelect
              id={`${process}-i-party`}
              label="Mill / Job Work Party"
              required
              value={v.partyId}
              options={partyOptions(m?.parties, "job_work")}
              onChange={(id) => form.set("partyId", id)}
              error={e["partyId"]}
            />
            <ReferenceSelect
              id={`${process}-i-job-order`}
              label="Job Order"
              required
              value={v.jobOrderId}
              options={(jobOrders.data ?? []).map((j) => ({
                id: j.id,
                label: j.number,
                detail: `${j.partyName} · ${j.itemName}`,
              }))}
              onChange={(id) => {
                const jo = jobOrders.data?.find((j) => j.id === id);
                form.update((prev) => ({
                  ...prev,
                  jobOrderId: id,
                  itemId: prev.itemId || jo?.itemId || "",
                  yarnId: prev.yarnId || jo?.yarnId || "",
                }));
                form.clearError("jobOrderId");
              }}
              error={e["jobOrderId"]}
            />
            <ReferenceSelect
              id={`${process}-i-item`}
              label="Item"
              required
              value={v.itemId}
              options={masterOptions(m?.items)}
              onChange={(id) => form.set("itemId", id)}
              error={e["itemId"]}
            />
            <ReferenceSelect
              id={`${process}-i-yarn`}
              label="Yarn"
              required
              value={v.yarnId}
              options={masterOptions(m?.yarns)}
              onChange={(id) => form.set("yarnId", id)}
              error={e["yarnId"]}
            />
          </FieldGrid>
        </FormSection>
        <FormSection title="Quantity">
          <FieldGrid cols={4}>
            <NumberField
              id={`${process}-i-qty`}
              label="Issue Qty"
              required
              value={v.qty}
              onChange={(x) => form.set("qty", x)}
              error={e["qty"]}
            />
            <NumberField
              id={`${process}-i-metres`}
              label="Metres"
              value={v.metres}
              onChange={(x) => form.set("metres", x)}
              error={e["metres"]}
            />
            <RemarkField
              id={`${process}-i-remark`}
              value={v.remark}
              onChange={(x) => form.set("remark", x)}
            />
          </FieldGrid>
        </FormSection>
        <TraceabilityPanel jobOrderId={v.jobOrderId || null} />
      </ProductionFormDialog>

      <RecordViewDialog
        row={viewing}
        title={(r) => `${PROCESS[process].name} Issue ${r.number}`}
        columns={columns}
        jobOrderId={(r) => r.jobOrderId}
        onClose={() => setViewing(null)}
      />
    </ProductionPageShell>
  );
}

// ---------------------------------------------------------------------------
// Receive
// ---------------------------------------------------------------------------

type ReceiptValues = {
  date: string;
  issueId: string;
  warehouseId: string;
  receiveQty: string;
  metres: string;
  saleQty: string;
  stockQty: string;
  stockStatus: string;
  rate: string;
  remark: string;
};

const RECEIPT_CONFIG: DocumentFormConfig<"buttaReceipt" | "millReceipt", ReceiptValues> = {
  empty: () => ({
    date: todayIso(),
    issueId: "",
    warehouseId: "",
    receiveQty: "",
    metres: "",
    saleQty: "0",
    stockQty: "0",
    stockStatus: "",
    rate: "",
    remark: "",
  }),
  toInput: (v) => ({
    ...v,
    receiveQty: num(v.receiveQty),
    metres: num(v.metres),
    saleQty: num(v.saleQty),
    stockQty: num(v.stockQty),
    rate: num(v.rate),
  }),
  fromInput: (i) => ({
    ...i,
    receiveQty: text(i.receiveQty),
    metres: text(i.metres),
    saleQty: text(i.saleQty),
    stockQty: text(i.stockQty),
    rate: text(i.rate),
  }),
};

const RECEIPT_COLUMNS: RegisterColumn<OutwardReceiptRow>[] = [
  { id: "number", header: "Receive No.", value: (r) => r.number, sticky: true, width: 7 },
  { id: "date", header: "Receive Date", value: (r) => r.date, kind: "date" },
  { id: "id", header: "ID", value: (r) => r.id, width: 9, hideOnMobile: true },
  { id: "issueNo", header: "Issue No.", value: (r) => r.issueNo, width: 7 },
  { id: "warehouse", header: "Warehouse", value: (r) => r.warehouseName, width: 9 },
  { id: "party", header: "Mill / Job Work Party", value: (r) => r.partyName, width: 11 },
  { id: "jobOrder", header: "Job Order", value: (r) => r.jobOrderNo, width: 8 },
  { id: "item", header: "Item", value: (r) => r.itemName, width: 11, hideOnMobile: true },
  { id: "yarn", header: "Yarn", value: (r) => r.yarnName, width: 10, hideOnMobile: true },
  { id: "receiveQty", header: "Receive Qty", value: (r) => r.receiveQty, kind: "qty", total: true },
  { id: "metres", header: "Metres", value: (r) => r.metres, kind: "metres", total: true },
  {
    id: "saleQty",
    header: "Sale Qty",
    value: (r) => r.saleQty,
    kind: "qty",
    total: true,
    hideOnMobile: true,
  },
  {
    id: "stockQty",
    header: "Stock Qty",
    value: (r) => r.stockQty,
    kind: "qty",
    total: true,
    hideOnMobile: true,
  },
  { id: "stockStatus", header: "Stock Status", value: (r) => r.stockStatus, width: 6 },
  { id: "amount", header: "Amount", value: (r) => r.amount, kind: "amount", total: true },
];

function OutwardReceiptsPage({
  feature,
  process,
}: {
  feature: ProductionFeatureDefinition;
  process: OutwardProcess;
}) {
  const kind = PROCESS[process].receiptKind;
  const [range, setRange] = useRegisterRange();
  const list = useProductionList(kind, range);
  const issues = useProductionList(PROCESS[process].issueKind);
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm(kind, RECEIPT_CONFIG);
  const [viewing, setViewing] = useState<OutwardReceiptRow | null>(null);
  const v = form.values;
  const e = form.errors;
  const issue = issues.data?.find((i) => i.id === v.issueId);
  const receive = num(v.receiveQty);
  const current = Number.isFinite(receive) ? receive : null;
  const over = !!issue && current !== null && compareQty(current, issue.balanceQty) > 0;
  const rate = num(v.rate);
  const sale = num(v.saleQty);
  const stock = num(v.stockQty);
  const splitDiffers =
    current !== null &&
    Number.isFinite(sale) &&
    Number.isFinite(stock) &&
    compareQty(sumQty([sale, stock]), current) !== 0;
  const name = PROCESS[process].name;

  return (
    <ProductionPageShell feature={feature}>
      <DraftsPanel
        kind={kind}
        onEdit={form.open}
        describe={(i) =>
          `Receive against ${issues.data?.find((x) => x.id === i.issueId)?.number ?? "—"} · qty ${i.receiveQty || "—"}`
        }
      />
      <ProductionRegister
        title={feature.label}
        exportName={`${PROCESS[process].slug}-receipts`}
        rows={list.data}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={RECEIPT_COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="Receive no., issue no., party…"
        filters={[
          { id: "party", label: "Party", value: (r) => r.partyName },
          { id: "warehouse", label: "Warehouse", value: (r) => r.warehouseName },
        ]}
        groupBy={[
          { id: "party", label: "Party", value: (r) => r.partyName },
          { id: "jobOrder", label: "Job Order", value: (r) => r.jobOrderNo },
          { id: "warehouse", label: "Warehouse", value: (r) => r.warehouseName },
          { id: "stockStatus", label: "Stock Status", value: (r) => r.stockStatus },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
        onView={setViewing}
      />

      <ProductionFormDialog form={form} title={`${name} Receive Entry`}>
        <FormSection title={`Original ${name} Issue`}>
          <FieldGrid>
            <ReferenceSelect
              id={`${process}-r-issue`}
              label="Issue No."
              required
              value={v.issueId}
              options={(issues.data ?? []).map((i) => ({
                id: i.id,
                label: i.number,
                detail: `${formatDate(i.date)} · ${i.partyName} · ${i.jobOrderNo}`,
                meta: `O/S ${formatQty(i.balanceQty)}`,
                disabled: i.status !== "Pending",
              }))}
              onChange={(id) => {
                const selected = issues.data?.find((i) => i.id === id);
                form.update((prev) => ({
                  ...prev,
                  issueId: id,
                  warehouseId: prev.warehouseId || selected?.warehouseId || "",
                }));
                form.clearError("issueId");
              }}
              error={e["issueId"]}
            />
            <ReadOnlyField label="Mill / Job Work Party" value={issue?.partyName} />
            <ReadOnlyField label="Job Order" value={issue?.jobOrderNo} />
            <ReadOnlyField label="Item" value={issue?.itemName} />
            <ReadOnlyField label="Yarn" value={issue?.yarnName} />
            <ReadOnlyField
              label="Issued Metres"
              value={issue ? formatMetres(issue.metres) : ""}
              mono
            />
          </FieldGrid>
        </FormSection>
        <DocumentInfoSection
          idPrefix={`${process}-r`}
          dateLabel="Receive Date"
          numberLabel="Receive No."
          date={v.date}
          onDate={(d) => form.set("date", d)}
          dateError={e["date"]}
        >
          <ReferenceSelect
            id={`${process}-r-warehouse`}
            label="Warehouse"
            required
            value={v.warehouseId}
            options={masterOptions(m?.warehouses)}
            onChange={(id) => form.set("warehouseId", id)}
            error={e["warehouseId"]}
          />
        </DocumentInfoSection>
        <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
          <FormSection title="Receive">
            <FieldGrid cols={2}>
              <NumberField
                id={`${process}-r-qty`}
                label="Receive Qty"
                required
                value={v.receiveQty}
                onChange={(x) => form.set("receiveQty", x)}
                error={
                  e["receiveQty"] ??
                  (over
                    ? `Cannot exceed the outstanding ${formatQty(issue?.balanceQty)}`
                    : undefined)
                }
              />
              <NumberField
                id={`${process}-r-metres`}
                label="Metres"
                value={v.metres}
                onChange={(x) => form.set("metres", x)}
                error={e["metres"]}
              />
              <NumberField
                id={`${process}-r-sale`}
                label="Sale Qty"
                value={v.saleQty}
                onChange={(x) => form.set("saleQty", x)}
                error={e["saleQty"]}
              />
              <NumberField
                id={`${process}-r-stock`}
                label="Stock Qty"
                value={v.stockQty}
                onChange={(x) => form.set("stockQty", x)}
                error={e["stockQty"]}
              />
              <ReferenceSelect
                id={`${process}-r-stock-status`}
                label="Stock Status"
                required
                value={v.stockStatus}
                options={(m?.stockStatuses ?? []).map((s) => ({ id: s, label: s }))}
                onChange={(id) => form.set("stockStatus", id)}
                error={e["stockStatus"]}
              />
              <NumberField
                id={`${process}-r-rate`}
                label="Rate"
                value={v.rate}
                onChange={(x) => form.set("rate", x)}
                error={e["rate"]}
              />
              <ReadOnlyField
                label="Amount (Receive Qty × Rate, preview)"
                value={
                  current !== null && Number.isFinite(rate)
                    ? formatAmount(lineAmount(current, rate))
                    : "—"
                }
                mono
              />
              <RemarkField
                id={`${process}-r-remark`}
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
              { label: "Issue Qty", value: issue?.qty ?? null },
              { label: "Previously Received", value: issue?.receivedQty ?? null },
              { label: "Outstanding", value: issue?.balanceQty ?? null },
              { label: "Current Receive", value: current },
              {
                label: "Balance After",
                value: issue && current !== null ? subtractQty(issue.balanceQty, current) : null,
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
        title={(r) => `${name} Receive ${r.number}`}
        columns={RECEIPT_COLUMNS}
        jobOrderId={(r) => r.jobOrderId}
        onClose={() => setViewing(null)}
      />
    </ProductionPageShell>
  );
}

export function ButtaIssuesPage({ feature }: { feature: ProductionFeatureDefinition }) {
  return <OutwardIssuesPage feature={feature} process="butta" />;
}
export function ButtaReceiptsPage({ feature }: { feature: ProductionFeatureDefinition }) {
  return <OutwardReceiptsPage feature={feature} process="butta" />;
}
export function MillIssuesPage({ feature }: { feature: ProductionFeatureDefinition }) {
  return <OutwardIssuesPage feature={feature} process="mill" />;
}
export function MillReceiptsPage({ feature }: { feature: ProductionFeatureDefinition }) {
  return <OutwardReceiptsPage feature={feature} process="mill" />;
}
