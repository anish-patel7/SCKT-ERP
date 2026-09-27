import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import {
  DateField,
  FieldGrid,
  NumberField,
  ReferenceSelect,
  TextField,
} from "@/components/erp/form-controls";
import type { ProductionFeatureDefinition } from "@/features/production/config/production-features";
import { ProductionPageShell } from "@/features/production/components/production-page-shell";
import {
  ProductionRegister,
  type RegisterColumn,
  type RegisterDimension,
} from "@/features/production/components/production-register";
import { QuantitySummary } from "@/features/production/components/quantity-summary";
import { useProductionMasters } from "@/features/production/hooks/use-production";
import {
  masterOptions,
  num,
  useCanEnterProduction,
  useRegisterRange,
} from "@/features/production/pages/page-helpers";
import {
  useBeams,
  useIssueMaterial,
  useMaterialIssues,
  useMaterialReturns,
  useReturnMaterial,
  useUpdateYarnIssue,
  useYarnIssueUpdates,
} from "@/features/production/warping/use-warping";
import { useWarpingForm } from "@/features/production/warping/use-warping-form";
import { WarpingFormDialog } from "@/features/production/warping/warping-components";
import {
  YARN_UPDATE_SOURCES,
  type MaterialIssueRow,
  type MaterialReturnRow,
  type YarnIssueUpdateRow,
  type YarnUpdateSource,
} from "@/features/production/warping/warping-types";
import { formatWeight, isWithinRange, todayIso } from "@/lib/erp/formatting";
import { compareQty, subtractQty, sumQty } from "@/lib/erp/numbers";

const NOTE =
  "Quantities in kg. Yarn stock is not reduced in the prototype — stock effect: BACKEND PHASE. PROVISIONAL SCREEN — final fields pending the screenshots.";

function Register<T extends { id: string; date: string }>({
  feature,
  exportName,
  rows,
  loading,
  error,
  refetch,
  columns,
  dimensions,
  onAdd,
  children,
}: {
  feature: ProductionFeatureDefinition;
  exportName: string;
  rows: T[] | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  columns: RegisterColumn<T>[];
  dimensions: RegisterDimension<T>[];
  onAdd: () => void;
  children: ReactNode;
}) {
  const [range, setRange] = useRegisterRange(90);
  const canEnter = useCanEnterProduction();
  const visible = useMemo(
    () => (rows ?? []).filter((r) => isWithinRange(r.date, range.from, range.to)),
    [rows, range],
  );
  return (
    <ProductionPageShell feature={feature}>
      <p className="text-xs text-muted-foreground">{NOTE}</p>
      <ProductionRegister
        title={feature.label}
        exportName={exportName}
        rows={visible}
        isLoading={loading}
        error={error}
        onRefresh={refetch}
        range={range}
        onRangeChange={setRange}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Entry no., beam, yarn…"
        filters={dimensions}
        groupBy={dimensions}
        onAdd={onAdd}
        canAdd={canEnter}
      />
      {children}
    </ProductionPageShell>
  );
}

const issueOption = (i: MaterialIssueRow) => ({
  id: i.id,
  label: i.number,
  detail: `${i.beamNo} · ${i.yarnName}`,
  meta: `net ${formatWeight(i.netIssuedKg)} kg`,
});

// ---------------------------------------------------------------- Material Issue

const ISSUE_COLUMNS: RegisterColumn<MaterialIssueRow>[] = [
  { id: "number", header: "Issue No.", value: (r) => r.number, sticky: true, width: 7 },
  { id: "date", header: "Issue Date", value: (r) => r.date, kind: "date" },
  { id: "beam", header: "Beam No.", value: (r) => r.beamNo, width: 6 },
  { id: "yarn", header: "Yarn", value: (r) => r.yarnName, width: 11 },
  { id: "qty", header: "Issue Qty (kg)", value: (r) => r.qtyKg, kind: "weight", total: true },
  {
    id: "returned",
    header: "Returned (kg)",
    value: (r) => r.returnedKg,
    kind: "weight",
    total: true,
  },
  {
    id: "adjustment",
    header: "Updation (kg)",
    value: (r) => r.adjustmentKg,
    kind: "weight",
    total: true,
    hideOnMobile: true,
  },
  {
    id: "net",
    header: "Net Issued (kg)",
    value: (r) => r.netIssuedKg,
    kind: "weight",
    total: true,
  },
  { id: "remark", header: "Remark", value: (r) => r.remark || null, width: 10, hideOnMobile: true },
];

export function MaterialIssuesPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const list = useMaterialIssues();
  const beams = useBeams();
  const { data: m } = useProductionMasters();
  const issue = useIssueMaterial();
  const form = useWarpingForm(() => ({
    date: todayIso(),
    beamId: "",
    yarnId: "",
    qtyKg: "",
    remark: "",
  }));
  const v = form.values;
  const atWarping = (beams.data ?? []).filter((b) => b.status === "AT_WARPING");
  return (
    <Register
      feature={feature}
      exportName="beam-material-issue"
      rows={list.data}
      loading={list.isFetching}
      error={list.error}
      refetch={() => void list.refetch()}
      columns={ISSUE_COLUMNS}
      dimensions={[
        { id: "beam", label: "Beam", value: (r) => r.beamNo },
        { id: "yarn", label: "Yarn", value: (r) => r.yarnName },
      ]}
      onAdd={() => form.open()}
    >
      <WarpingFormDialog
        form={form}
        title="Material Issue For Beam Production"
        description="Yarn issued for a beam that is at warping."
        saving={issue.isPending}
        onSave={() =>
          void form
            .submit(() => issue.mutateAsync({ ...v, qtyKg: num(v.qtyKg) }))
            .then((ok) => ok && toast.success("Material issue saved in frontend prototype"))
        }
      >
        <FieldGrid cols={2}>
          <DateField
            id="bmi-date"
            label="Issue Date"
            required
            value={v.date}
            onChange={(x) => form.set("date", x)}
            error={form.errors["date"]}
          />
          <ReferenceSelect
            id="bmi-beam"
            label="Beam (at warping)"
            required
            value={v.beamId}
            options={atWarping.map((b) => ({
              id: b.id,
              label: b.beamNo,
              detail: `${b.beamType} · ${b.partyName}`,
            }))}
            onChange={(x) => form.set("beamId", x)}
            error={form.errors["beamId"]}
            placeholder={
              atWarping.length ? "Select beam…" : "No beams at warping — use Beam Issue Entry"
            }
          />
          <ReferenceSelect
            id="bmi-yarn"
            label="Yarn"
            required
            value={v.yarnId}
            options={masterOptions(m?.yarns)}
            onChange={(x) => form.set("yarnId", x)}
            error={form.errors["yarnId"]}
          />
          <NumberField
            id="bmi-qty"
            label="Issue Qty (kg)"
            required
            value={v.qtyKg}
            onChange={(x) => form.set("qtyKg", x)}
            error={form.errors["qtyKg"]}
          />
          <TextField
            id="bmi-remark"
            label="Remark"
            value={v.remark}
            onChange={(x) => form.set("remark", x)}
          />
        </FieldGrid>
      </WarpingFormDialog>
    </Register>
  );
}

// ---------------------------------------------------------------- Material Return

const RETURN_COLUMNS: RegisterColumn<MaterialReturnRow>[] = [
  { id: "number", header: "Return No.", value: (r) => r.number, sticky: true, width: 7 },
  { id: "date", header: "Return Date", value: (r) => r.date, kind: "date" },
  { id: "issue", header: "Issue No.", value: (r) => r.issueNo, width: 7 },
  { id: "beam", header: "Beam No.", value: (r) => r.beamNo, width: 6 },
  { id: "yarn", header: "Yarn", value: (r) => r.yarnName, width: 11 },
  { id: "qty", header: "Return Qty (kg)", value: (r) => r.qtyKg, kind: "weight", total: true },
  { id: "remark", header: "Remark", value: (r) => r.remark || null, width: 10, hideOnMobile: true },
];

export function MaterialReturnsPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const list = useMaterialReturns();
  const issues = useMaterialIssues();
  const ret = useReturnMaterial();
  const form = useWarpingForm(() => ({
    date: todayIso(),
    materialIssueId: "",
    qtyKg: "",
    remark: "",
  }));
  const v = form.values;
  const open = (issues.data ?? []).filter((i) => compareQty(i.netIssuedKg, 0) > 0);
  const selected = issues.data?.find((i) => i.id === v.materialIssueId);
  const current = num(v.qtyKg);
  const currentQty = Number.isFinite(current) ? current : 0;
  return (
    <Register
      feature={feature}
      exportName="beam-material-return"
      rows={list.data}
      loading={list.isFetching}
      error={list.error}
      refetch={() => void list.refetch()}
      columns={RETURN_COLUMNS}
      dimensions={[
        { id: "beam", label: "Beam", value: (r) => r.beamNo },
        { id: "yarn", label: "Yarn", value: (r) => r.yarnName },
      ]}
      onAdd={() => form.open()}
    >
      <WarpingFormDialog
        form={form}
        title="Beam Material Return Entry"
        description="Unused yarn returned against the original material issue."
        saving={ret.isPending}
        onSave={() =>
          void form
            .submit(() => ret.mutateAsync({ ...v, qtyKg: num(v.qtyKg) }))
            .then((ok) => ok && toast.success("Material return saved in frontend prototype"))
        }
      >
        <FieldGrid cols={2}>
          <DateField
            id="bmr-date"
            label="Return Date"
            required
            value={v.date}
            onChange={(x) => form.set("date", x)}
            error={form.errors["date"]}
          />
          <ReferenceSelect
            id="bmr-issue"
            label="Original Material Issue"
            required
            value={v.materialIssueId}
            options={open.map(issueOption)}
            onChange={(x) => form.set("materialIssueId", x)}
            error={form.errors["materialIssueId"]}
          />
          <NumberField
            id="bmr-qty"
            label="Return Qty (kg)"
            required
            value={v.qtyKg}
            onChange={(x) => form.set("qtyKg", x)}
            error={form.errors["qtyKg"]}
          />
          <TextField
            id="bmr-remark"
            label="Remark"
            value={v.remark}
            onChange={(x) => form.set("remark", x)}
          />
        </FieldGrid>
        {selected && (
          <QuantitySummary
            rows={[
              {
                label: "Issued",
                value: sumQty([selected.qtyKg, selected.adjustmentKg]),
                kind: "weight",
              },
              { label: "Previously Returned", value: selected.returnedKg, kind: "weight" },
              { label: "Current Return", value: currentQty, kind: "weight" },
              {
                label: "Net Issued After",
                value: subtractQty(selected.netIssuedKg, currentQty),
                kind: "weight",
                result: true,
                tone:
                  compareQty(subtractQty(selected.netIssuedKg, currentQty), 0) < 0
                    ? "danger"
                    : "default",
              },
            ]}
          />
        )}
      </WarpingFormDialog>
    </Register>
  );
}

// ---------------------------------------------------------------- TFO & Beam Yarn Issue Updation

const UPDATE_COLUMNS: RegisterColumn<YarnIssueUpdateRow>[] = [
  { id: "number", header: "Updation No.", value: (r) => r.number, sticky: true, width: 7 },
  { id: "date", header: "Date", value: (r) => r.date, kind: "date" },
  { id: "source", header: "Source", value: (r) => r.source, width: 5 },
  { id: "issue", header: "Issue No.", value: (r) => r.issueNo, width: 7 },
  { id: "beam", header: "Beam No.", value: (r) => r.beamNo, width: 6 },
  { id: "yarn", header: "Yarn", value: (r) => r.yarnName, width: 11 },
  { id: "change", header: "Change (kg)", value: (r) => r.qtyChangeKg, kind: "weight", total: true },
  { id: "reason", header: "Reason", value: (r) => r.reason, width: 12 },
];

export function YarnIssueUpdatesPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const list = useYarnIssueUpdates();
  const issues = useMaterialIssues();
  const update = useUpdateYarnIssue();
  const form = useWarpingForm(() => ({
    date: todayIso(),
    materialIssueId: "",
    source: "BEAM",
    qtyChangeKg: "",
    reason: "",
  }));
  const v = form.values;
  const selected = issues.data?.find((i) => i.id === v.materialIssueId);
  const change = num(v.qtyChangeKg);
  const changeQty = Number.isFinite(change) ? change : 0;
  return (
    <Register
      feature={feature}
      exportName="tfo-beam-yarn-updation"
      rows={list.data}
      loading={list.isFetching}
      error={list.error}
      refetch={() => void list.refetch()}
      columns={UPDATE_COLUMNS}
      dimensions={[
        { id: "source", label: "Source", value: (r) => r.source },
        { id: "beam", label: "Beam", value: (r) => r.beamNo },
      ]}
      onAdd={() => form.open()}
    >
      <WarpingFormDialog
        form={form}
        title="TFO & Beam Yarn Issue Updation"
        description="Corrects the yarn issued for a beam (+ more issued, − less issued) with a reason. Earlier documents are not edited."
        saving={update.isPending}
        onSave={() =>
          void form
            .submit(() =>
              update.mutateAsync({
                date: v.date,
                materialIssueId: v.materialIssueId,
                source: v.source as YarnUpdateSource,
                qtyChangeKg: num(v.qtyChangeKg),
                reason: v.reason,
              }),
            )
            .then((ok) => ok && toast.success("Yarn issue updated in frontend prototype"))
        }
      >
        <FieldGrid cols={2}>
          <DateField
            id="tfo-date"
            label="Date"
            required
            value={v.date}
            onChange={(x) => form.set("date", x)}
            error={form.errors["date"]}
          />
          <ReferenceSelect
            id="tfo-source"
            label="Source"
            required
            value={v.source}
            options={YARN_UPDATE_SOURCES.map((s) => ({
              id: s,
              label: s === "TFO" ? "TFO" : "Beam",
            }))}
            onChange={(x) => form.set("source", x)}
          />
          <ReferenceSelect
            id="tfo-issue"
            label="Material Issue"
            required
            value={v.materialIssueId}
            options={(issues.data ?? []).map(issueOption)}
            onChange={(x) => form.set("materialIssueId", x)}
            error={form.errors["materialIssueId"]}
          />
          <NumberField
            id="tfo-change"
            label="Change (kg, + / −)"
            required
            value={v.qtyChangeKg}
            onChange={(x) => form.set("qtyChangeKg", x)}
            error={form.errors["qtyChangeKg"]}
          />
          <TextField
            id="tfo-reason"
            label="Reason"
            required
            value={v.reason}
            onChange={(x) => form.set("reason", x)}
            error={form.errors["reason"]}
          />
        </FieldGrid>
        {selected && (
          <QuantitySummary
            rows={[
              { label: "Net Issued Now", value: selected.netIssuedKg, kind: "weight" },
              { label: "Change", value: changeQty, kind: "weight" },
              {
                label: "Net Issued After",
                value: sumQty([selected.netIssuedKg, changeQty]),
                kind: "weight",
                result: true,
                tone:
                  compareQty(sumQty([selected.netIssuedKg, changeQty]), 0) < 0
                    ? "danger"
                    : "default",
              },
            ]}
          />
        )}
      </WarpingFormDialog>
    </Register>
  );
}
