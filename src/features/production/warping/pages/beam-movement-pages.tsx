import { useMemo } from "react";
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
} from "@/features/production/components/production-register";
import { useProductionMasters } from "@/features/production/hooks/use-production";
import {
  masterOptions,
  useCanEnterProduction,
  useRegisterRange,
} from "@/features/production/pages/page-helpers";
import {
  useBeamMovements,
  useBeams,
  useLoadBeam,
  useUnloadBeam,
} from "@/features/production/warping/use-warping";
import { useWarpingForm } from "@/features/production/warping/use-warping-form";
import {
  BeamStatusBadge,
  WarpingFormDialog,
} from "@/features/production/warping/warping-components";
import {
  BEAM_STATUS_LABEL,
  type BeamMovementRow,
  type BeamRow,
  type UnloadBeamInput,
} from "@/features/production/warping/warping-types";
import { formatNumber, isWithinRange, todayIso } from "@/lib/erp/formatting";

const common: RegisterColumn<BeamMovementRow>[] = [
  { id: "number", header: "Entry No.", value: (r) => r.number, sticky: true, width: 7 },
  { id: "date", header: "Date", value: (r) => r.date, kind: "date" },
  { id: "beamNo", header: "Beam No.", value: (r) => r.beamNo, width: 6 },
  { id: "setNo", header: "Set No.", value: (r) => r.setNo, width: 6 },
  { id: "type", header: "Beam Type", value: (r) => r.beamType, width: 6 },
];
const remark: RegisterColumn<BeamMovementRow> = {
  id: "remark",
  header: "Remark",
  value: (r) => r.remark || null,
  width: 10,
  hideOnMobile: true,
};

const LOADING_COLUMNS: RegisterColumn<BeamMovementRow>[] = [
  ...common,
  { id: "loom", header: "Loom", value: (r) => r.toLoomName, width: 6 },
  { id: "fromRack", header: "From Rack", value: (r) => r.fromRack || null, width: 7 },
  remark,
];

const UNLOAD_COLUMNS: RegisterColumn<BeamMovementRow>[] = [
  ...common,
  { id: "loom", header: "From Loom", value: (r) => r.fromLoomName, width: 6 },
  {
    id: "toStatus",
    header: "Beam Status After",
    value: (r) => BEAM_STATUS_LABEL[r.toStatus],
    render: (r) => <BeamStatusBadge status={r.toStatus} />,
    width: 8,
  },
  { id: "toRack", header: "To Rack", value: (r) => r.toRack || null, width: 7 },
  remark,
];

const beamOption = (b: BeamRow) => ({
  id: b.id,
  label: b.beamNo,
  detail: `Set ${b.setNo} · ${b.beamType} · ${b.warpYarnName}`,
  meta: b.loomName || `${formatNumber(b.lengthMetre, "metres")} m`,
});

function useMovementRows(kind: "LOADED" | "UNLOADED") {
  const [range, setRange] = useRegisterRange(90);
  const list = useBeamMovements(kind);
  const rows = useMemo(
    () => (list.data ?? []).filter((r) => isWithinRange(r.date, range.from, range.to)),
    [list.data, range],
  );
  return { list, rows, range, setRange };
}

function BeamSummary({ beam }: { beam: BeamRow | undefined }) {
  if (!beam) return null;
  return (
    <FieldGrid cols={4}>
      <ReadOnlyField label="Status" value={BEAM_STATUS_LABEL[beam.status]} />
      <ReadOnlyField label="Loom" value={beam.loomName || "—"} />
      <ReadOnlyField label="Rack" value={beam.rack || "—"} />
      <ReadOnlyField label="Length (m)" value={formatNumber(beam.lengthMetre, "metres")} mono />
    </FieldGrid>
  );
}

/** Beam Loading Entry — the old "Loaded on Loom / loom allocation" as a movement document. */
export function BeamLoadingPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const { list, rows, range, setRange } = useMovementRows("LOADED");
  const beams = useBeams();
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const load = useLoadBeam();
  const form = useWarpingForm(() => ({ date: todayIso(), beamId: "", loomId: "", remark: "" }));
  const v = form.values;
  const inStore = (beams.data ?? []).filter((b) => b.status === "IN_STORE");
  const beam = beams.data?.find((b) => b.id === v.beamId);

  return (
    <ProductionPageShell feature={feature}>
      <p className="text-xs text-muted-foreground">
        Looms are managed on{" "}
        <Link to="/production/looms" className="text-primary hover:underline">
          Loom Planning
        </Link>
        . Only beams in store can be loaded.
      </p>
      <ProductionRegister
        title={feature.label}
        exportName="beam-loading"
        rows={rows}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={LOADING_COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="Entry no., beam, set, loom…"
        filters={[{ id: "loom", label: "Loom", value: (r) => r.toLoomName }]}
        groupBy={[
          { id: "loom", label: "Loom", value: (r) => r.toLoomName },
          { id: "type", label: "Beam Type", value: (r) => r.beamType },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
      />
      <WarpingFormDialog
        form={form}
        title="Beam Loading Entry"
        description="Loads an in-store beam on a loom."
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
            placeholder={inStore.length ? "Select beam…" : "No beams in store"}
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
    </ProductionPageShell>
  );
}

/** Beam Unload Entry — the old status / location movement for a loaded beam. */
export function BeamUnloadingPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const { list, rows, range, setRange } = useMovementRows("UNLOADED");
  const beams = useBeams();
  const canEnter = useCanEnterProduction();
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
    <ProductionPageShell feature={feature}>
      <ProductionRegister
        title={feature.label}
        exportName="beam-unload"
        rows={rows}
        isLoading={list.isFetching}
        error={list.error}
        onRefresh={() => void list.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={UNLOAD_COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="Entry no., beam, set, loom…"
        filters={[
          { id: "loom", label: "Loom", value: (r) => r.fromLoomName },
          { id: "status", label: "Status After", value: (r) => BEAM_STATUS_LABEL[r.toStatus] },
        ]}
        groupBy={[
          { id: "loom", label: "Loom", value: (r) => r.fromLoomName },
          { id: "status", label: "Status After", value: (r) => BEAM_STATUS_LABEL[r.toStatus] },
        ]}
        onAdd={() => form.open()}
        canAdd={canEnter}
      />
      <WarpingFormDialog
        form={form}
        title="Beam Unload Entry"
        description="Takes a beam off its loom and records where it goes. Remaining length is not calculated (rule pending confirmation)."
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
            options={(["IN_STORE", "SIZING", "DEPLETED"] as const).map((s) => ({
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
    </ProductionPageShell>
  );
}
