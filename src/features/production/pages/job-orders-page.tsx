import { useState } from "react";
import type { ProductionFeatureDefinition } from "@/features/production/config/production-features";
import { ProductionSourceTabs } from "@/features/production/components/production-source-tabs";
import { LiveProductionOrders } from "@/features/production/live/live-production-orders";
import { ProductionPageShell } from "@/features/production/components/production-page-shell";
import {
  ProductionRegister,
  type RegisterColumn,
} from "@/features/production/components/production-register";
import { ProductionFormDialog } from "@/features/production/components/production-form-dialog";
import { DraftsPanel } from "@/features/production/components/drafts-panel";
import { RecordViewDialog } from "@/features/production/components/record-view-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DateField,
  FieldGrid,
  FormSection,
  NumberField,
  ReadOnlyField,
  ReferenceSelect,
  TextField,
} from "@/components/erp/form-controls";
import {
  useDocumentForm,
  type DocumentFormConfig,
} from "@/features/production/hooks/use-document-form";
import {
  useProductionList,
  useProductionMasters,
} from "@/features/production/hooks/use-production";
import {
  JOB_ORDER_PRIORITIES,
  type JobOrderPriority,
  type JobOrderRow,
} from "@/features/production/types/production";
import { formatAmount, todayIso } from "@/lib/erp/formatting";
import { QtyProgress } from "@/features/production/components/qty-progress";
import { lineAmount } from "@/lib/erp/numbers";
import {
  masterOptions,
  num,
  partyOptions,
  text,
  useCanEnterProduction,
  useRegisterRange,
} from "@/features/production/pages/page-helpers";
import { DocumentInfoSection, RemarkField } from "@/features/production/pages/page-sections";

type Values = {
  date: string;
  orderPartyId: string;
  salesOrderId: string;
  partyOrderNo: string;
  itemId: string;
  yarnId: string;
  qty: string;
  rate: string;
  remark: string;
  priority: JobOrderPriority;
  deliveryDate: string;
};

const CONFIG: DocumentFormConfig<"jobOrder", Values> = {
  empty: () => ({
    date: todayIso(),
    orderPartyId: "",
    salesOrderId: "",
    partyOrderNo: "",
    itemId: "",
    yarnId: "",
    qty: "",
    rate: "",
    remark: "",
    priority: "normal",
    deliveryDate: "",
  }),
  toInput: (v) => ({ ...v, qty: num(v.qty), rate: num(v.rate) }),
  fromInput: (i) => ({
    ...i,
    qty: text(i.qty),
    rate: text(i.rate),
    priority: i.priority ?? "normal",
    deliveryDate: i.deliveryDate ?? "",
  }),
};

const PRIORITY_TONE: Record<JobOrderPriority, string> = {
  low: "border-border text-muted-foreground",
  normal: "border-border",
  high: "border-amber-400 text-amber-700 dark:text-amber-300",
  urgent: "border-destructive/60 text-destructive",
};

const JOB_ORDER_COLUMNS: RegisterColumn<JobOrderRow>[] = [
  { id: "number", header: "Job Order No.", value: (r) => r.number, sticky: true, width: 8 },
  { id: "date", header: "Job Order Date", value: (r) => r.date, kind: "date" },
  { id: "id", header: "Transaction ID", value: (r) => r.id, width: 9, hideOnMobile: true },
  { id: "party", header: "Order Party", value: (r) => r.partyName, width: 11 },
  { id: "orderNo", header: "Order No.", value: (r) => r.salesOrderNo, width: 8 },
  { id: "partyOrderNo", header: "Party Order No.", value: (r) => r.partyOrderNo || null, width: 8 },
  { id: "item", header: "Item", value: (r) => r.itemName, width: 11 },
  { id: "yarn", header: "Yarn Item", value: (r) => r.yarnName, width: 10 },
  { id: "qty", header: "Quantity", value: (r) => r.qty, kind: "qty", total: true },
  { id: "rate", header: "Rate", value: (r) => r.rate, kind: "rate", hideOnMobile: true },
  { id: "amount", header: "Amount", value: (r) => r.amount, kind: "amount", total: true },
  {
    id: "cardQty",
    header: "Job Card Qty",
    value: (r) => r.cardIssuedQty,
    kind: "qty",
    total: true,
    hideOnMobile: true,
  },
  {
    id: "progress",
    header: "Production Progress",
    value: (r) => r.producedQty,
    kind: "qty",
    total: true,
    width: 11,
    render: (r) => <QtyProgress done={r.producedQty} total={r.qty} label="Production progress" />,
  },
  { id: "delivery", header: "Delivery Date", value: (r) => r.deliveryDate || null, kind: "date" },
  {
    id: "priority",
    header: "Priority",
    value: (r) => r.priority,
    render: (r) => (
      <Badge variant="outline" className={`capitalize ${PRIORITY_TONE[r.priority]}`}>
        {r.priority}
      </Badge>
    ),
  },
];

export default function JobOrdersPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const [range, setRange] = useRegisterRange();
  const list = useProductionList("jobOrder", range);
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm("jobOrder", CONFIG);
  const [viewing, setViewing] = useState<JobOrderRow | null>(null);
  const v = form.values;
  const e = form.errors;
  const qty = num(v.qty);
  const rate = num(v.rate);
  // UI PREVIEW CALCULATION — FINAL BACKEND MUST VALIDATE.
  const amount = Number.isFinite(qty) && Number.isFinite(rate) ? lineAmount(qty, rate) : null;

  return (
    <ProductionPageShell feature={feature}>
      <ProductionSourceTabs
        liveLabel="Production Orders"
        liveNote="Live Production Orders from the database, as before (raise order, status, archive, cost sheet link). Job Orders in the workflow tab are prototype records. Whether a Production Order and a Job Order are the same business document is a BUSINESS RELATIONSHIP TO VALIDATE before the backend merges them."
        live={<LiveProductionOrders />}
      >
        <DraftsPanel
          kind="jobOrder"
          onEdit={form.open}
          describe={(i) =>
            `${m?.parties.find((p) => p.id === i.orderPartyId)?.name ?? "No party"} · ${
              m?.items.find((x) => x.id === i.itemId)?.name ?? "No item"
            } · qty ${i.qty || "—"}`
          }
        />
        <ProductionRegister
          title={feature.label}
          exportName="job-orders"
          rows={list.data}
          isLoading={list.isFetching}
          error={list.error}
          onRefresh={() => void list.refetch()}
          range={range}
          onRangeChange={setRange}
          columns={JOB_ORDER_COLUMNS}
          rowKey={(r) => r.id}
          searchPlaceholder="Job order, party, item…"
          filters={[
            { id: "party", label: "Party", value: (r) => r.partyName },
            { id: "priority", label: "Priority", value: (r) => r.priority },
          ]}
          groupBy={[
            { id: "party", label: "Party", value: (r) => r.partyName },
            { id: "item", label: "Item", value: (r) => r.itemName },
            { id: "yarn", label: "Yarn Item", value: (r) => r.yarnName },
            { id: "priority", label: "Priority", value: (r) => r.priority },
          ]}
          onAdd={() => form.open()}
          canAdd={canEnter}
          onView={setViewing}
        />

        <ProductionFormDialog form={form} title="Job Order Entry">
          <DocumentInfoSection
            idPrefix="jo"
            dateLabel="Job Order Date"
            numberLabel="Job Order No."
            date={v.date}
            onDate={(d) => form.set("date", d)}
            dateError={e["date"]}
          />
          <FormSection title="Business Reference">
            <FieldGrid>
              <ReferenceSelect
                id="jo-order"
                label="Order No."
                required
                value={v.salesOrderId}
                options={(m?.salesOrders ?? []).map((so) => ({
                  id: so.id,
                  label: so.code,
                  detail: m?.parties.find((p) => p.id === so.partyId)?.name ?? "",
                }))}
                onChange={(id) => {
                  form.set("salesOrderId", id);
                  const party = m?.salesOrders.find((so) => so.id === id)?.partyId;
                  if (party && !v.orderPartyId) form.set("orderPartyId", party);
                }}
                error={e["salesOrderId"]}
              />
              <ReferenceSelect
                id="jo-party"
                label="Order Party"
                required
                value={v.orderPartyId}
                options={partyOptions(m?.parties, "customer")}
                onChange={(id) => form.set("orderPartyId", id)}
                error={e["orderPartyId"]}
              />
              <TextField
                id="jo-party-order"
                label="Party Order No."
                value={v.partyOrderNo}
                onChange={(x) => form.set("partyOrderNo", x)}
              />
              <ReferenceSelect
                id="jo-item"
                label="Item"
                required
                value={v.itemId}
                options={masterOptions(m?.items)}
                onChange={(id) => form.set("itemId", id)}
                error={e["itemId"]}
              />
              <ReferenceSelect
                id="jo-yarn"
                label="Yarn Item"
                required
                value={v.yarnId}
                options={masterOptions(m?.yarns)}
                onChange={(id) => form.set("yarnId", id)}
                error={e["yarnId"]}
              />
            </FieldGrid>
          </FormSection>
          <FormSection title="Quantity & Amount">
            <FieldGrid>
              <NumberField
                id="jo-qty"
                label="Quantity"
                required
                value={v.qty}
                onChange={(x) => form.set("qty", x)}
                error={e["qty"]}
              />
              <NumberField
                id="jo-rate"
                label="Rate"
                required
                value={v.rate}
                onChange={(x) => form.set("rate", x)}
                error={e["rate"]}
              />
              <ReadOnlyField
                label="Amount (Quantity × Rate, preview)"
                value={amount === null ? "—" : formatAmount(amount)}
                mono
              />
              <RemarkField
                id="jo-remark"
                value={v.remark}
                onChange={(x) => form.set("remark", x)}
              />
            </FieldGrid>
          </FormSection>
          <FormSection title="Planning">
            <FieldGrid>
              <DateField
                id="jo-delivery"
                label="Delivery Date"
                value={v.deliveryDate}
                onChange={(x) => form.set("deliveryDate", x)}
                error={e["deliveryDate"]}
              />
              <ReferenceSelect
                id="jo-priority"
                label="Priority"
                value={v.priority}
                options={JOB_ORDER_PRIORITIES.map((p) => ({
                  id: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                }))}
                onChange={(id) => form.set("priority", id as JobOrderPriority)}
              />
            </FieldGrid>
          </FormSection>
        </ProductionFormDialog>

        <RecordViewDialog
          row={viewing}
          title={(r) => `Job Order ${r.number}`}
          columns={JOB_ORDER_COLUMNS}
          jobOrderId={(r) => r.id}
          onClose={() => setViewing(null)}
        />
      </ProductionSourceTabs>
    </ProductionPageShell>
  );
}
