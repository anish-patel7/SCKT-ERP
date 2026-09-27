import { useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  DateField,
  FieldGrid,
  ReadOnlyField,
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
import { useProductionMasters } from "@/features/production/hooks/use-production";
import {
  masterOptions,
  partyOptions,
  useCanEnterProduction,
  useRegisterRange,
} from "@/features/production/pages/page-helpers";
import {
  useBeamMovements,
  useBeams,
  useInwardEmptyBeam,
  useIssueBeam,
  useLoadBeam,
  useProduceAndLoadBeam,
  useReceiveBeam,
  useUnloadBeam,
} from "@/features/production/warping/use-warping";
import { useWarpingForm } from "@/features/production/warping/use-warping-form";
import {
  BeamStatusBadge,
  WarpingFormDialog,
} from "@/features/production/warping/warping-components";
import { WarpEntryFields } from "@/features/production/warping/warp-entry-fields";
import { emptyWarpValues, toBeamInput } from "@/features/production/warping/warp-values";
import { DEMO_BEAM_TYPES } from "@/features/production/warping/warping-demo-data";
import {
  BEAM_STATUS_LABEL,
  type BeamMovementKind,
  type BeamMovementRow,
  type BeamRow,
  type UnloadBeamInput,
} from "@/features/production/warping/warping-types";
import { formatNumber, isWithinRange, todayIso } from "@/lib/erp/formatting";

// ---------------------------------------------------------------- columns

const col = {
  number: {
    id: "number",
    header: "Entry No.",
    value: (r: BeamMovementRow) => r.number,
    sticky: true,
    width: 7,
  },
  date: {
    id: "date",
    header: "Date",
    value: (r: BeamMovementRow) => r.date,
    kind: "date" as const,
  },
  beamNo: { id: "beamNo", header: "Beam No.", value: (r: BeamMovementRow) => r.beamNo, width: 6 },
  type: { id: "type", header: "Beam Type", value: (r: BeamMovementRow) => r.beamType, width: 6 },
  setNo: {
    id: "setNo",
    header: "Set No.",
    value: (r: BeamMovementRow) => r.setNo || null,
    width: 6,
  },
  party: { id: "party", header: "Party", value: (r: BeamMovementRow) => r.partyName, width: 10 },
  challan: {
    id: "challan",
    header: "Party Challan No.",
    value: (r: BeamMovementRow) => r.challanNo || null,
    width: 7,
  },
  toRack: {
    id: "toRack",
    header: "Rack",
    value: (r: BeamMovementRow) => r.toRack || null,
    width: 7,
  },
  toLoom: { id: "loom", header: "Loom", value: (r: BeamMovementRow) => r.toLoomName, width: 6 },
  fromLoom: {
    id: "loom",
    header: "From Loom",
    value: (r: BeamMovementRow) => r.fromLoomName,
    width: 6,
  },
  fromRack: {
    id: "fromRack",
    header: "From Rack",
    value: (r: BeamMovementRow) => r.fromRack || null,
    width: 7,
  },
  after: {
    id: "toStatus",
    header: "Beam Status After",
    value: (r: BeamMovementRow) => BEAM_STATUS_LABEL[r.toStatus],
    render: (r: BeamMovementRow) => <BeamStatusBadge status={r.toStatus} />,
    width: 8,
  },
  remark: {
    id: "remark",
    header: "Remark",
    value: (r: BeamMovementRow) => r.remark || null,
    width: 10,
    hideOnMobile: true,
  },
} satisfies Record<string, RegisterColumn<BeamMovementRow>>;

const byParty: RegisterDimension<BeamMovementRow> = {
  id: "party",
  label: "Party",
  value: (r) => r.partyName,
};
const byLoom = (from: boolean): RegisterDimension<BeamMovementRow> => ({
  id: "loom",
  label: "Loom",
  value: (r) => (from ? r.fromLoomName : r.toLoomName),
});
const byType: RegisterDimension<BeamMovementRow> = {
  id: "type",
  label: "Beam Type",
  value: (r) => r.beamType,
};

// ---------------------------------------------------------------- shared

const beamOption = (b: BeamRow) => ({
  id: b.id,
  label: b.beamNo,
  detail: [b.beamType, b.setNo && `Set ${b.setNo}`, b.warpYarnName].filter(Boolean).join(" · "),
  meta:
    b.loomName ||
    (b.lengthMetre !== null ? `${formatNumber(b.lengthMetre, "metres")} m` : b.rack || ""),
});

function BeamSummary({ beam }: { beam: BeamRow | undefined }) {
  if (!beam) return null;
  return (
    <FieldGrid cols={4}>
      <ReadOnlyField label="Status" value={BEAM_STATUS_LABEL[beam.status]} />
      <ReadOnlyField
        label="Loom / Warper"
        value={beam.loomName || (beam.status === "AT_WARPING" ? beam.partyName : "—")}
      />
      <ReadOnlyField label="Rack" value={beam.rack || "—"} />
      <ReadOnlyField
        label="Length (m)"
        value={beam.lengthMetre === null ? "—" : formatNumber(beam.lengthMetre, "metres")}
        mono
      />
    </FieldGrid>
  );
}

/** Movement register for one movement kind, with the page's entry dialog below it. */
function MovementRegisterPage({
  feature,
  kind,
  exportName,
  columns,
  dimensions,
  intro,
  onAdd,
  children,
}: {
  feature: ProductionFeatureDefinition;
  kind: BeamMovementKind;
  exportName: string;
  columns: RegisterColumn<BeamMovementRow>[];
  dimensions: RegisterDimension<BeamMovementRow>[];
  intro?: ReactNode;
  onAdd: () => void;
  children: ReactNode;
}) {
  const [range, setRange] = useRegisterRange(90);
  const list = useBeamMovements(kind);
  const canEnter = useCanEnterProduction();
  const rows = useMemo(
    () => (list.data ?? []).filter((r) => isWithinRange(r.date, range.from, range.to)),
    [list.data, range],
  );
  return (
    <ProductionPageShell feature={feature}>
      {intro && <p className="text-xs text-muted-foreground">{intro}</p>}
      <ProductionRegister
        title={feature.label}
        exportName={exportName}
        rows={rows}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Entry no., beam, set, party, loom…"
        filters={dimensions}
        groupBy={dimensions}
        onAdd={onAdd}
        canAdd={canEnter}
      />
      {children}
    </ProductionPageShell>
  );
}

const PROVISIONAL =
  "PROVISIONAL SCREEN — fields follow the beam lifecycle; final fields pending the screenshots.";

// ---------------------------------------------------------------- Empty Beam Inward

export function EmptyBeamInwardPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const { data: m } = useProductionMasters();
  const beams = useBeams();
  const inward = useInwardEmptyBeam();
  const form = useWarpingForm(() => ({
    date: todayIso(),
    beamNo: "",
    beamType: "",
    partyId: "",
    challanNo: "",
    rack: "",
    remark: "",
  }));
  const v = form.values;
  const atWarping = (beams.data ?? []).filter((b) => b.status === "AT_WARPING");
  const returning = atWarping.find((b) => b.beamNo.toLowerCase() === v.beamNo.trim().toLowerCase());
  return (
    <MovementRegisterPage
      feature={feature}
      kind="EMPTY_INWARD"
      exportName="empty-beam-inward"
      columns={[
        col.number,
        col.date,
        col.beamNo,
        col.type,
        col.party,
        col.challan,
        col.toRack,
        col.remark,
      ]}
      dimensions={[byParty, byType]}
      intro={`New empty beams, or beams returned unwarped from warping, come into store as Empty. ${PROVISIONAL}`}
      onAdd={() => form.open()}
    >
      <WarpingFormDialog
        form={form}
        title="Empty Beam Inward Entry"
        description="Registers an empty beam in store."
        saving={inward.isPending}
        onSave={() =>
          void form
            .submit(() => inward.mutateAsync(v))
            .then((ok) => ok && toast.success(`${v.beamNo.trim()} inward (frontend prototype)`))
        }
      >
        <FieldGrid cols={2}>
          <DateField
            id="ebi-date"
            label="Inward Date"
            required
            value={v.date}
            onChange={(x) => form.set("date", x)}
            error={form.errors["date"]}
          />
          <TextField
            id="ebi-beam-no"
            label="Beam No."
            required
            value={v.beamNo}
            onChange={(x) => form.set("beamNo", x)}
            error={form.errors["beamNo"]}
            hint={
              returning
                ? `Returned unwarped from ${returning.partyName}`
                : "New beam no., or a beam now at warping"
            }
          />
          <ReferenceSelect
            id="ebi-type"
            label="Beam Type"
            required={!returning}
            value={returning ? returning.beamType : v.beamType}
            options={DEMO_BEAM_TYPES.map((t) => ({ id: t, label: t }))}
            onChange={(x) => form.set("beamType", x)}
            error={form.errors["beamType"]}
            disabled={!!returning}
          />
          <ReferenceSelect
            id="ebi-party"
            label="From Party (optional)"
            value={v.partyId}
            options={partyOptions(m?.parties, "job_work")}
            onChange={(x) => form.set("partyId", x)}
            error={form.errors["partyId"]}
          />
          <TextField
            id="ebi-challan"
            label="Party Challan No."
            value={v.challanNo}
            onChange={(x) => form.set("challanNo", x)}
          />
          <TextField
            id="ebi-rack"
            label="Rack / Location"
            value={v.rack}
            onChange={(x) => form.set("rack", x)}
          />
          <TextField
            id="ebi-remark"
            label="Remark"
            value={v.remark}
            onChange={(x) => form.set("remark", x)}
          />
        </FieldGrid>
      </WarpingFormDialog>
    </MovementRegisterPage>
  );
}

// ---------------------------------------------------------------- Beam Issue (Empty Beam)

const IN_HOUSE = "__in_house";

export function BeamIssuePage({ feature }: { feature: ProductionFeatureDefinition }) {
  const { data: m } = useProductionMasters();
  const beams = useBeams();
  const issue = useIssueBeam();
  const form = useWarpingForm(() => ({
    date: todayIso(),
    beamId: "",
    partyId: IN_HOUSE,
    remark: "",
  }));
  const v = form.values;
  const empty = (beams.data ?? []).filter((b) => b.status === "EMPTY");
  const beam = beams.data?.find((b) => b.id === v.beamId);
  return (
    <MovementRegisterPage
      feature={feature}
      kind="ISSUED_FOR_WARPING"
      exportName="beam-issue"
      columns={[col.number, col.date, col.beamNo, col.type, col.party, col.fromRack, col.remark]}
      dimensions={[byParty, byType]}
      intro={`An empty beam is issued for warping — in-house or to a job work warper. ${PROVISIONAL}`}
      onAdd={() => form.open()}
    >
      <WarpingFormDialog
        form={form}
        title="Beam Issue Entry (Empty Beam)"
        description="The beam shows as At Warping until Beam Production / Beam Receive."
        saving={issue.isPending}
        onSave={() =>
          void form
            .submit(() =>
              issue.mutateAsync({ ...v, partyId: v.partyId === IN_HOUSE ? "" : v.partyId }),
            )
            .then(
              (ok) => ok && toast.success(`${beam?.beamNo ?? "Beam"} issued (frontend prototype)`),
            )
        }
      >
        <FieldGrid cols={2}>
          <DateField
            id="bi-date"
            label="Issue Date"
            required
            value={v.date}
            onChange={(x) => form.set("date", x)}
            error={form.errors["date"]}
          />
          <ReferenceSelect
            id="bi-beam"
            label="Empty Beam"
            required
            value={v.beamId}
            options={empty.map(beamOption)}
            onChange={(x) => form.set("beamId", x)}
            error={form.errors["beamId"]}
            placeholder={empty.length ? "Select beam…" : "No empty beams in store"}
          />
          <ReferenceSelect
            id="bi-party"
            label="Issue To"
            required
            value={v.partyId}
            options={[
              { id: IN_HOUSE, label: "In-house warping" },
              ...partyOptions(m?.parties, "job_work"),
            ]}
            onChange={(x) => form.set("partyId", x)}
            error={form.errors["partyId"]}
          />
          <TextField
            id="bi-remark"
            label="Remark"
            value={v.remark}
            onChange={(x) => form.set("remark", x)}
          />
        </FieldGrid>
        <BeamSummary beam={beam} />
      </WarpingFormDialog>
    </MovementRegisterPage>
  );
}

// ---------------------------------------------------------------- Beam Receive

export function BeamReceivePage({ feature }: { feature: ProductionFeatureDefinition }) {
  const { data: m } = useProductionMasters();
  const beams = useBeams();
  const receive = useReceiveBeam();
  const form = useWarpingForm(emptyWarpValues);
  const v = form.values;
  const candidates = (beams.data ?? []).filter(
    (b) => b.status === "EMPTY" || (b.status === "AT_WARPING" && b.partyId !== ""),
  );
  return (
    <MovementRegisterPage
      feature={feature}
      kind="RECEIVED"
      exportName="beam-receive"
      columns={[
        col.number,
        col.date,
        col.beamNo,
        col.type,
        col.setNo,
        col.party,
        col.challan,
        col.toRack,
        col.remark,
      ]}
      dimensions={[byParty, byType]}
      intro={`Warped beams received from a job work warper go to store. ${PROVISIONAL}`}
      onAdd={() => form.open()}
    >
      <WarpingFormDialog
        form={form}
        title="Beam Receive Entry"
        description="Receives a warped beam from a job work party into store."
        saving={receive.isPending}
        onSave={() =>
          void form
            .submit(() =>
              receive.mutateAsync({
                ...toBeamInput(v),
                partyId: v.partyId,
                challanNo: v.challanNo,
              }),
            )
            .then((ok) => ok && toast.success(`${v.beamNo.trim()} received (frontend prototype)`))
        }
      >
        <WarpEntryFields
          form={form}
          idPrefix="br"
          dateLabel="Receive Date"
          candidates={candidates}
          yarns={m?.yarns}
          extra={
            <>
              <ReferenceSelect
                id="br-party"
                label="Party"
                required
                value={v.partyId}
                options={partyOptions(m?.parties, "job_work")}
                onChange={(x) => form.set("partyId", x)}
                error={form.errors["partyId"]}
              />
              <TextField
                id="br-challan"
                label="Party Challan No."
                value={v.challanNo}
                onChange={(x) => form.set("challanNo", x)}
              />
            </>
          }
        />
      </WarpingFormDialog>
    </MovementRegisterPage>
  );
}

// ---------------------------------------------------------------- Beam Production Loading

export function BeamProductionLoadingPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const { data: m } = useProductionMasters();
  const beams = useBeams();
  const produceLoad = useProduceAndLoadBeam();
  const form = useWarpingForm(emptyWarpValues);
  const v = form.values;
  const candidates = (beams.data ?? []).filter(
    (b) => b.status === "EMPTY" || (b.status === "AT_WARPING" && b.partyId === ""),
  );
  return (
    <MovementRegisterPage
      feature={feature}
      kind="PRODUCED_LOADED"
      exportName="beam-production-loading"
      columns={[col.number, col.date, col.beamNo, col.type, col.setNo, col.toLoom, col.remark]}
      dimensions={[byLoom(false), byType]}
      intro={`A beam produced in-house and loaded straight on a loom, in one entry. ${PROVISIONAL}`}
      onAdd={() => form.open()}
    >
      <WarpingFormDialog
        form={form}
        title="Beam Production Loading Entry"
        description="Records the warp and loads the beam on a loom without going to store."
        saving={produceLoad.isPending}
        onSave={() =>
          void form
            .submit(() => produceLoad.mutateAsync({ ...toBeamInput(v), loomId: v.loomId }))
            .then(
              (ok) =>
                ok && toast.success(`${v.beamNo.trim()} produced and loaded (frontend prototype)`),
            )
        }
      >
        <WarpEntryFields
          form={form}
          idPrefix="bpl"
          dateLabel="Production Date"
          candidates={candidates}
          yarns={m?.yarns}
          showRack={false}
          extra={
            <ReferenceSelect
              id="bpl-loom"
              label="Load on Loom"
              required
              value={v.loomId}
              options={masterOptions(m?.machines)}
              onChange={(x) => form.set("loomId", x)}
              error={form.errors["loomId"]}
            />
          }
        />
      </WarpingFormDialog>
    </MovementRegisterPage>
  );
}

// ---------------------------------------------------------------- Beam Loading

/** Beam Loading Entry — the old "Loaded on Loom / loom allocation" as a movement document. */
export function BeamLoadingPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const beams = useBeams();
  const { data: m } = useProductionMasters();
  const load = useLoadBeam();
  const form = useWarpingForm(() => ({ date: todayIso(), beamId: "", loomId: "", remark: "" }));
  const v = form.values;
  const inStore = (beams.data ?? []).filter((b) => b.status === "IN_STORE");
  const beam = beams.data?.find((b) => b.id === v.beamId);

  return (
    <MovementRegisterPage
      feature={feature}
      kind="LOADED"
      exportName="beam-loading"
      columns={[
        col.number,
        col.date,
        col.beamNo,
        col.setNo,
        col.type,
        col.toLoom,
        col.fromRack,
        col.remark,
      ]}
      dimensions={[byLoom(false), byType]}
      intro={
        <>
          Looms are managed on{" "}
          <Link to="/production/looms" className="text-primary hover:underline">
            Loom Planning
          </Link>
          . Only warped beams in store can be loaded.
        </>
      }
      onAdd={() => form.open()}
    >
      <WarpingFormDialog
        form={form}
        title="Beam Loading Entry"
        description="Loads a warped beam from store on a loom."
        saving={load.isPending}
        onSave={() =>
          void form
            .submit(() => load.mutateAsync(v))
            .then(
              (ok) => ok && toast.success(`${beam?.beamNo ?? "Beam"} loaded (frontend prototype)`),
            )
        }
      >
        <FieldGrid cols={2}>
          <DateField
            id="bl-date"
            label="Loading Date"
            required
            value={v.date}
            onChange={(x) => form.set("date", x)}
            error={form.errors["date"]}
          />
          <ReferenceSelect
            id="bl-beam"
            label="Beam"
            required
            value={v.beamId}
            options={inStore.map(beamOption)}
            onChange={(x) => form.set("beamId", x)}
            error={form.errors["beamId"]}
            placeholder={inStore.length ? "Select beam…" : "No warped beams in store"}
          />
          <ReferenceSelect
            id="bl-loom"
            label="Loom"
            required
            value={v.loomId}
            options={masterOptions(m?.machines)}
            onChange={(x) => form.set("loomId", x)}
            error={form.errors["loomId"]}
          />
          <TextField
            id="bl-remark"
            label="Remark"
            value={v.remark}
            onChange={(x) => form.set("remark", x)}
          />
        </FieldGrid>
        <BeamSummary beam={beam} />
      </WarpingFormDialog>
    </MovementRegisterPage>
  );
}

// ---------------------------------------------------------------- Beam Unload

/** Beam Unload Entry — the old status / location movement for a loaded beam. */
export function BeamUnloadingPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const beams = useBeams();
  const unload = useUnloadBeam();
  const form = useWarpingForm(() => ({
    date: todayIso(),
    beamId: "",
    toStatus: "IN_STORE",
    rack: "",
    remark: "",
  }));
  const v = form.values;
  const loaded = (beams.data ?? []).filter((b) => b.status === "LOADED_ON_LOOM");
  const beam = beams.data?.find((b) => b.id === v.beamId);

  return (
    <MovementRegisterPage
      feature={feature}
      kind="UNLOADED"
      exportName="beam-unload"
      columns={[
        col.number,
        col.date,
        col.beamNo,
        col.setNo,
        col.type,
        col.fromLoom,
        col.after,
        col.toRack,
        col.remark,
      ]}
      dimensions={[byLoom(true), byType]}
      onAdd={() => form.open()}
    >
      <WarpingFormDialog
        form={form}
        title="Beam Unload Entry"
        description="Takes a beam off its loom. Empty clears the warp set; remaining length is not calculated (rule pending confirmation)."
        saving={unload.isPending}
        onSave={() =>
          void form
            .submit(() =>
              unload.mutateAsync({
                beamId: v.beamId,
                date: v.date,
                toStatus: v.toStatus as UnloadBeamInput["toStatus"],
                rack: v.rack,
                remark: v.remark,
              }),
            )
            .then(
              (ok) =>
                ok && toast.success(`${beam?.beamNo ?? "Beam"} unloaded (frontend prototype)`),
            )
        }
      >
        <FieldGrid cols={2}>
          <DateField
            id="bu-date"
            label="Unload Date"
            required
            value={v.date}
            onChange={(x) => form.set("date", x)}
            error={form.errors["date"]}
          />
          <ReferenceSelect
            id="bu-beam"
            label="Beam"
            required
            value={v.beamId}
            options={loaded.map(beamOption)}
            onChange={(x) => form.set("beamId", x)}
            error={form.errors["beamId"]}
            placeholder={loaded.length ? "Select beam…" : "No beams on looms"}
          />
          <ReferenceSelect
            id="bu-status"
            label="Beam Status After"
            required
            value={v.toStatus}
            options={(["IN_STORE", "SIZING", "EMPTY"] as const).map((s) => ({
              id: s,
              label: BEAM_STATUS_LABEL[s],
            }))}
            onChange={(x) => form.set("toStatus", x)}
          />
          <TextField
            id="bu-rack"
            label="To Rack / Location"
            value={v.rack}
            onChange={(x) => form.set("rack", x)}
          />
          <TextField
            id="bu-remark"
            label="Remark"
            value={v.remark}
            onChange={(x) => form.set("remark", x)}
          />
        </FieldGrid>
        <BeamSummary beam={beam} />
      </WarpingFormDialog>
    </MovementRegisterPage>
  );
}
