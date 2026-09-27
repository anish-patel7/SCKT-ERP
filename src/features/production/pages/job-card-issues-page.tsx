import { useState } from "react";
import { SlidersHorizontal, TriangleAlert } from "lucide-react";
import type { ProductionFeatureDefinition } from "@/features/production/config/production-features";
import { ProductionPageShell } from "@/features/production/components/production-page-shell";
import {
  ProductionRegister,
  type RegisterColumn,
} from "@/features/production/components/production-register";
import { ProductionFormDialog } from "@/features/production/components/production-form-dialog";
import { DraftsPanel } from "@/features/production/components/drafts-panel";
import { RecordViewDialog } from "@/features/production/components/record-view-dialog";
import { OperationalStatusBadge } from "@/features/production/components/status-badges";
import { TraceabilityPanel } from "@/features/production/components/traceability-panel";
import {
  DateField,
  FieldGrid,
  FormSection,
  NumberField,
  ReadOnlyField,
  ReferenceSelect,
  TextField,
} from "@/components/erp/form-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDocumentForm,
  type DocumentFormConfig,
} from "@/features/production/hooks/use-document-form";
import {
  useAdjustJobCard,
  useProductionList,
  useProductionMasters,
} from "@/features/production/hooks/use-production";
import { ProductionValidationError } from "@/features/production/services/production-service";
import type { JobCardRow } from "@/features/production/types/production";
import { formatDate, formatQty, todayIso } from "@/lib/erp/formatting";
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
  jobOrderId: string;
  partyId: string;
  cardNo: string;
  itemId: string;
  yarnId: string;
  machineId: string;
  unitId: string;
  issuedQty: string;
  remark: string;
};

const CONFIG: DocumentFormConfig<"jobCard", Values> = {
  empty: () => ({
    date: todayIso(),
    jobOrderId: "",
    partyId: "",
    cardNo: "",
    itemId: "",
    yarnId: "",
    machineId: "",
    unitId: "",
    issuedQty: "",
    remark: "",
  }),
  toInput: (v) => ({ ...v, issuedQty: num(v.issuedQty) }),
  fromInput: (i) => ({ ...i, issuedQty: text(i.issuedQty) }),
};

const JOB_CARD_COLUMNS: RegisterColumn<JobCardRow>[] = [
  { id: "number", header: "Job Challan No.", value: (r) => r.number, sticky: true, width: 8 },
  { id: "date", header: "Job Challan Date", value: (r) => r.date, kind: "date" },
  { id: "jobOrder", header: "Job Order No.", value: (r) => r.jobOrderNo, width: 8 },
  {
    id: "orderNo",
    header: "Order No.",
    value: (r) => r.salesOrderNo,
    width: 8,
    hideOnMobile: true,
  },
  { id: "party", header: "Account / Party", value: (r) => r.partyName, width: 11 },
  { id: "cardNo", header: "Card No.", value: (r) => r.cardNo, width: 6, hideOnMobile: true },
  { id: "item", header: "Item", value: (r) => r.itemName, width: 11, hideOnMobile: true },
  { id: "yarn", header: "Yarn Item", value: (r) => r.yarnName, width: 10, hideOnMobile: true },
  { id: "issued", header: "Issued Qty", value: (r) => r.issuedQty, kind: "qty", total: true },
  { id: "received", header: "Received Qty", value: (r) => r.receivedQty, kind: "qty", total: true },
  {
    id: "adjustment",
    header: "Adjustment",
    value: (r) => r.adjustmentQty,
    kind: "qty",
    total: true,
    hideOnMobile: true,
  },
  { id: "balance", header: "Balance Qty", value: (r) => r.balanceQty, kind: "qty", total: true },
  {
    id: "status",
    header: "Status",
    value: (r) => r.status,
    render: (r) => <OperationalStatusBadge status={r.status} />,
    width: 5,
  },
  { id: "machine", header: "Machine / Loom", value: (r) => r.machineName, width: 7 },
  // "Pending Card": exact meaning not yet specified; shown as Yes while a balance remains.
  {
    id: "pendingCard",
    header: "Pending Card",
    value: (r) => (r.status === "Pending" ? "Yes" : "No"),
    width: 6,
    hideOnMobile: true,
  },
  { id: "unit", header: "Unit", value: (r) => r.unitName, width: 5, hideOnMobile: true },
];

export default function JobCardIssuesPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const [range, setRange] = useRegisterRange();
  const list = useProductionList("jobCard", range);
  const jobOrders = useProductionList("jobOrder");
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm("jobCard", CONFIG);
  const [viewing, setViewing] = useState<JobCardRow | null>(null);
  const [adjusting, setAdjusting] = useState<JobCardRow | null>(null);
  const v = form.values;
  const e = form.errors;
  const jo = jobOrders.data?.find((j) => j.id === v.jobOrderId);

  return (
    <ProductionPageShell feature={feature}>
      <DraftsPanel
        kind="jobCard"
        onEdit={form.open}
        describe={(i) =>
          `${jobOrders.data?.find((j) => j.id === i.jobOrderId)?.number ?? "No job order"} · card ${
            i.cardNo || "—"
          } · qty ${i.issuedQty || "—"}`
        }
      />
      <ProductionRegister
        title={feature.label}
        exportName="job-card-issues"
        rows={list.data}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={JOB_CARD_COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="Challan, job order, party, machine…"
        filters={[
          { id: "status", label: "Status", value: (r) => r.status },
          { id: "party", label: "Party", value: (r) => r.partyName },
          { id: "machine", label: "Machine", value: (r) => r.machineName },
        ]}
        groupBy={[
          { id: "party", label: "Party", value: (r) => r.partyName },
          { id: "jobOrder", label: "Job Order", value: (r) => r.jobOrderNo },
          { id: "machine", label: "Machine", value: (r) => r.machineName },
          { id: "status", label: "Status", value: (r) => r.status },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
        onView={setViewing}
        mobileBadges={(r) => <OperationalStatusBadge status={r.status} />}
        rowActions={(r) =>
          canEnter && r.status === "Pending" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setAdjusting(r)}
              title="Demo adjustment (backend: controlled permission + reason)"
            >
              <SlidersHorizontal className="size-3.5" /> Adjust
            </Button>
          ) : null
        }
      />

      <ProductionFormDialog form={form} title="Job Card Issue Entry">
        <DocumentInfoSection
          idPrefix="jc"
          dateLabel="Job Challan Date"
          numberLabel="Job Challan No."
          date={v.date}
          onDate={(d) => form.set("date", d)}
          dateError={e["date"]}
        >
          <TextField
            id="jc-card"
            label="Card No."
            required
            value={v.cardNo}
            onChange={(x) => form.set("cardNo", x)}
            error={e["cardNo"]}
          />
        </DocumentInfoSection>
        <FormSection title="Business Reference">
          <FieldGrid>
            <ReferenceSelect
              id="jc-job-order"
              label="Job Order"
              required
              value={v.jobOrderId}
              options={(jobOrders.data ?? []).map((j) => ({
                id: j.id,
                label: j.number,
                detail: `${j.partyName} · ${j.itemName}`,
              }))}
              onChange={(id) => {
                const selected = jobOrders.data?.find((j) => j.id === id);
                form.update((prev) => ({
                  ...prev,
                  jobOrderId: id,
                  // Prefill from the job order; still editable.
                  partyId: prev.partyId || selected?.orderPartyId || "",
                  itemId: prev.itemId || selected?.itemId || "",
                  yarnId: prev.yarnId || selected?.yarnId || "",
                }));
                form.clearError("jobOrderId");
              }}
              error={e["jobOrderId"]}
            />
            <ReadOnlyField label="Order No." value={jo?.salesOrderNo} />
            <ReferenceSelect
              id="jc-party"
              label="Party"
              required
              value={v.partyId}
              options={partyOptions(m?.parties, "customer")}
              onChange={(id) => form.set("partyId", id)}
              error={e["partyId"]}
            />
            <ReferenceSelect
              id="jc-item"
              label="Item"
              required
              value={v.itemId}
              options={masterOptions(m?.items)}
              onChange={(id) => form.set("itemId", id)}
              error={e["itemId"]}
            />
            <ReferenceSelect
              id="jc-yarn"
              label="Yarn"
              required
              value={v.yarnId}
              options={masterOptions(m?.yarns)}
              onChange={(id) => form.set("yarnId", id)}
              error={e["yarnId"]}
            />
            <ReferenceSelect
              id="jc-machine"
              label="Machine / Loom"
              required
              value={v.machineId}
              options={(m?.machines ?? []).map((mc) => ({
                id: mc.id,
                label: mc.name,
                detail: m?.units.find((u) => u.id === mc.unitId)?.name ?? "",
              }))}
              onChange={(id) => {
                form.set("machineId", id);
                const unit = m?.machines.find((mc) => mc.id === id)?.unitId;
                if (unit && !v.unitId) form.set("unitId", unit);
              }}
              error={e["machineId"]}
            />
            <ReferenceSelect
              id="jc-unit"
              label="Unit"
              required
              value={v.unitId}
              options={masterOptions(m?.units)}
              onChange={(id) => form.set("unitId", id)}
              error={e["unitId"]}
            />
          </FieldGrid>
        </FormSection>
        <FormSection title="Quantity">
          <FieldGrid cols={4}>
            <NumberField
              id="jc-issued"
              label="Issued Qty"
              required
              value={v.issuedQty}
              onChange={(x) => form.set("issuedQty", x)}
              error={e["issuedQty"]}
            />
            <ReadOnlyField label="Received Qty" value="0.000 (updated by production / receipts)" />
            <ReadOnlyField
              label="Balance Qty"
              value={Number.isFinite(num(v.issuedQty)) ? formatQty(num(v.issuedQty)) : "—"}
              mono
            />
            <RemarkField id="jc-remark" value={v.remark} onChange={(x) => form.set("remark", x)} />
          </FieldGrid>
        </FormSection>
        <TraceabilityPanel jobOrderId={v.jobOrderId || null} />
      </ProductionFormDialog>

      <RecordViewDialog
        row={viewing}
        title={(r) => `Job Card ${r.number}`}
        columns={JOB_CARD_COLUMNS}
        jobOrderId={(r) => r.jobOrderId}
        onClose={() => setViewing(null)}
      >
        {(r) =>
          r.adjustments.length > 0 && (
            <div className="rounded-md border border-border p-2 text-xs">
              <div className="mb-1 font-semibold">Demo adjustments</div>
              <ul className="space-y-0.5">
                {r.adjustments.map((a) => (
                  <li key={a.id}>
                    {formatDate(a.date)} · {formatQty(a.qty)} · {a.reason}
                  </li>
                ))}
              </ul>
            </div>
          )
        }
      </RecordViewDialog>

      <AdjustmentDialog card={adjusting} onClose={() => setAdjusting(null)} />
    </ProductionPageShell>
  );
}

function AdjustmentDialog({ card, onClose }: { card: JobCardRow | null; onClose: () => void }) {
  const adjust = useAdjustJobCard();
  const [date, setDate] = useState(todayIso());
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const close = () => {
    setQty("");
    setReason("");
    setErrors({});
    onClose();
  };

  const submit = () => {
    if (!card) return;
    adjust.mutate(
      { jobCardId: card.id, date, qty: num(qty), reason },
      {
        onSuccess: close,
        onError: (error) =>
          setErrors(
            error instanceof ProductionValidationError
              ? { [error.field]: error.message }
              : { form: error instanceof Error ? error.message : "Could not save" },
          ),
      },
    );
  };

  return (
    <Dialog open={card !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Demo Adjustment — {card?.number}</DialogTitle>
          <DialogDescription className="text-xs">
            Balance {formatQty(card?.balanceQty)}. An adjustment reduces the balance without a
            receipt.
          </DialogDescription>
        </DialogHeader>
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Backend will require a controlled adjustment permission and a recorded reason.
        </p>
        <div className="space-y-3">
          <DateField
            id="adj-date"
            label="Adjustment Date"
            required
            value={date}
            onChange={setDate}
            error={errors["date"]}
          />
          <NumberField
            id="adj-qty"
            label="Demo Adjustment Qty"
            required
            value={qty}
            onChange={setQty}
            error={errors["qty"]}
          />
          <TextField
            id="adj-reason"
            label="Reason"
            required
            value={reason}
            onChange={setReason}
            error={errors["reason"]}
          />
          {errors["form"] && <p className="text-xs text-destructive">{errors["form"]}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={adjust.isPending}>
            Save Demo Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
