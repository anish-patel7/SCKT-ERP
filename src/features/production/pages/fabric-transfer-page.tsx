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
import type { FabricTransferRow } from "@/features/production/types/production";
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

type Values = {
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  jobCardId: string;
  itemId: string;
  yarnId: string;
  qty: string;
  remark: string;
};

const CONFIG: DocumentFormConfig<"fabricTransfer", Values> = {
  empty: () => ({
    date: todayIso(),
    fromWarehouseId: "",
    toWarehouseId: "",
    jobCardId: "",
    itemId: "",
    yarnId: "",
    qty: "",
    remark: "",
  }),
  toInput: (v) => ({ ...v, jobCardId: v.jobCardId || null, qty: num(v.qty) }),
  fromInput: (i) => ({ ...i, jobCardId: i.jobCardId ?? "", qty: text(i.qty) }),
};

const COLUMNS: RegisterColumn<FabricTransferRow>[] = [
  { id: "number", header: "Transfer No.", value: (r) => r.number, sticky: true, width: 7 },
  { id: "date", header: "Transfer Date", value: (r) => r.date, kind: "date" },
  { id: "id", header: "Transfer ID", value: (r) => r.id, width: 9, hideOnMobile: true },
  { id: "from", header: "From Warehouse", value: (r) => r.fromWarehouseName, width: 9 },
  { id: "to", header: "To Warehouse", value: (r) => r.toWarehouseName, width: 9 },
  { id: "jobCard", header: "Job Card No.", value: (r) => r.jobCardNo, width: 7 },
  { id: "item", header: "Item", value: (r) => r.itemName, width: 11 },
  { id: "yarn", header: "Yarn", value: (r) => r.yarnName, width: 10, hideOnMobile: true },
  { id: "qty", header: "Transfer Qty", value: (r) => r.qty, kind: "qty", total: true },
  { id: "remark", header: "Remark", value: (r) => r.remark || null, width: 10, hideOnMobile: true },
];

export default function FabricTransferPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const [range, setRange] = useRegisterRange();
  const list = useProductionList("fabricTransfer", range);
  const cards = useProductionList("jobCard");
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const form = useDocumentForm("fabricTransfer", CONFIG);
  const [viewing, setViewing] = useState<FabricTransferRow | null>(null);
  const v = form.values;
  const e = form.errors;
  const ready = form.isOpen && !!v.itemId && !!v.yarnId;
  const source = useAvailableQty(
    ready && v.fromWarehouseId
      ? { kind: "fabric", warehouseId: v.fromWarehouseId, itemId: v.itemId, yarnId: v.yarnId }
      : null,
  );
  const dest = useAvailableQty(
    ready && v.toWarehouseId
      ? { kind: "fabric", warehouseId: v.toWarehouseId, itemId: v.itemId, yarnId: v.yarnId }
      : null,
  );
  const qty = num(v.qty);
  const current = Number.isFinite(qty) ? qty : null;
  const available = source.data ?? null;
  const over = available !== null && current !== null && compareQty(current, available) > 0;
  const same = !!v.fromWarehouseId && v.fromWarehouseId === v.toWarehouseId;

  return (
    <ProductionPageShell feature={feature}>
      <DraftsPanel
        kind="fabricTransfer"
        onEdit={form.open}
        describe={(i) =>
          `${m?.warehouses.find((w) => w.id === i.fromWarehouseId)?.name ?? "—"} → ${
            m?.warehouses.find((w) => w.id === i.toWarehouseId)?.name ?? "—"
          } · qty ${i.qty || "—"}`
        }
      />
      <ProductionRegister
        title={feature.label}
        exportName="fabric-stock-transfers"
        rows={list.data}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="Transfer no., warehouse, job card, item…"
        filters={[
          { id: "from", label: "From Warehouse", value: (r) => r.fromWarehouseName },
          { id: "to", label: "To Warehouse", value: (r) => r.toWarehouseName },
        ]}
        groupBy={[
          { id: "from", label: "From Warehouse", value: (r) => r.fromWarehouseName },
          { id: "to", label: "To Warehouse", value: (r) => r.toWarehouseName },
          { id: "item", label: "Item", value: (r) => r.itemName },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
        onView={setViewing}
      />

      <ProductionFormDialog
        form={form}
        title="Fabric Stock Transfer Entry"
        description="Demo: the source warehouse goes down and the destination goes up together. The backend must perform both movements atomically."
      >
        <DocumentInfoSection
          idPrefix="ft"
          dateLabel="Transfer Date"
          numberLabel="Transfer No."
          date={v.date}
          onDate={(d) => form.set("date", d)}
          dateError={e["date"]}
        />
        <FormSection title="Warehouses & Item">
          <FieldGrid>
            <ReferenceSelect
              id="ft-from"
              label="From Warehouse"
              required
              value={v.fromWarehouseId}
              options={masterOptions(m?.warehouses)}
              onChange={(id) => form.set("fromWarehouseId", id)}
              error={e["fromWarehouseId"]}
            />
            <ReferenceSelect
              id="ft-to"
              label="To Warehouse"
              required
              value={v.toWarehouseId}
              options={masterOptions(m?.warehouses).map((o) => ({
                ...o,
                disabled: o.id === v.fromWarehouseId,
              }))}
              onChange={(id) => form.set("toWarehouseId", id)}
              error={e["toWarehouseId"] ?? (same ? "Must differ from From Warehouse" : undefined)}
            />
            <ReferenceSelect
              id="ft-job-card"
              label="Job Card"
              value={v.jobCardId}
              options={(cards.data ?? []).map((c) => ({
                id: c.id,
                label: c.number,
                detail: `${c.jobOrderNo} · ${c.itemName}`,
              }))}
              onChange={(id) => {
                const card = cards.data?.find((c) => c.id === id);
                form.update((prev) => ({
                  ...prev,
                  jobCardId: id,
                  itemId: prev.itemId || card?.itemId || "",
                  yarnId: prev.yarnId || card?.yarnId || "",
                }));
              }}
              error={e["jobCardId"]}
            />
            <ReferenceSelect
              id="ft-item"
              label="Item"
              required
              value={v.itemId}
              options={masterOptions(m?.items)}
              onChange={(id) => form.set("itemId", id)}
              error={e["itemId"]}
            />
            <ReferenceSelect
              id="ft-yarn"
              label="Yarn"
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
                value={
                  available === null ? "Select warehouse, item and yarn" : formatQty(available)
                }
                mono
              />
              <NumberField
                id="ft-qty"
                label="Transfer Qty"
                required
                value={v.qty}
                onChange={(x) => form.set("qty", x)}
                error={e["qty"] ?? (over ? "More than the demo available quantity" : undefined)}
              />
              <RemarkField
                id="ft-remark"
                value={v.remark}
                onChange={(x) => form.set("remark", x)}
              />
            </FieldGrid>
          </FormSection>
          <QuantitySummary
            title="Stock Movement (demo)"
            rows={[
              { label: "From: available", value: available },
              {
                label: "From: after OUT",
                value:
                  available !== null && current !== null ? subtractQty(available, current) : null,
                tone: over ? "danger" : "default",
              },
              { label: "To: current", value: dest.data ?? null },
              {
                label: "To: after IN",
                value:
                  dest.data !== undefined && current !== null ? sumQty([dest.data, current]) : null,
                result: true,
              },
            ]}
          />
        </div>
      </ProductionFormDialog>

      <RecordViewDialog
        row={viewing}
        title={(r) => `Fabric Stock Transfer ${r.number}`}
        columns={COLUMNS}
        jobOrderId={(r) => cards.data?.find((c) => c.id === r.jobCardId)?.jobOrderId ?? null}
        onClose={() => setViewing(null)}
      />
    </ProductionPageShell>
  );
}
