import { useMemo, useState } from "react";
import { ArrowRightLeft, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField, FieldGrid, ReferenceSelect, TextField } from "@/components/erp/form-controls";
import type { ProductionFeatureDefinition } from "@/features/production/config/production-features";
import { ProductionPageShell } from "@/features/production/components/production-page-shell";
import {
  ProductionRegister,
  type RegisterColumn,
} from "@/features/production/components/production-register";
import { useProductionMasters } from "@/features/production/hooks/use-production";
import { useCanEnterProduction, useRegisterRange } from "@/features/production/pages/page-helpers";
import { WarpEntryFields } from "@/features/production/warping/warp-entry-fields";
import { emptyWarpValues, toBeamInput } from "@/features/production/warping/warp-values";
import {
  useBeamMovements,
  useBeams,
  useMoveBeam,
  useProduceBeam,
} from "@/features/production/warping/use-warping";
import { useWarpingForm } from "@/features/production/warping/use-warping-form";
import {
  BeamDetail,
  BeamQrCode,
  BeamStatusBadge,
  WarpingFormDialog,
} from "@/features/production/warping/warping-components";
import { printBeamLabel } from "@/features/production/warping/beam-label";
import {
  BEAM_STATUS_LABEL,
  type BeamRow,
  type MoveBeamInput,
} from "@/features/production/warping/warping-types";
import { isWithinRange, todayIso } from "@/lib/erp/formatting";

const BEAM_COLUMNS: RegisterColumn<BeamRow>[] = [
  { id: "beamNo", header: "Beam No.", value: (r) => r.beamNo, sticky: true, width: 7 },
  {
    id: "status",
    header: "Status",
    value: (r) => BEAM_STATUS_LABEL[r.status],
    render: (r) => <BeamStatusBadge status={r.status} />,
    width: 9,
  },
  { id: "type", header: "Beam Type", value: (r) => r.beamType, width: 6 },
  { id: "setNo", header: "Set No.", value: (r) => r.setNo || null, width: 6 },
  { id: "yarn", header: "Warp Yarn", value: (r) => r.warpYarnName || null, width: 10 },
  { id: "count", header: "Count / Denier", value: (r) => r.countDenier || null, width: 6 },
  { id: "ends", header: "Total Ends", value: (r) => r.totalEnds, width: 6 },
  { id: "length", header: "Length (m)", value: (r) => r.lengthMetre, kind: "metres", total: true },
  { id: "rack", header: "Rack / Location", value: (r) => r.rack || null, width: 7 },
  {
    id: "where",
    header: "Loom / Warper",
    value: (r) =>
      r.status === "LOADED_ON_LOOM" ? r.loomName : r.status === "AT_WARPING" ? r.partyName : null,
    width: 8,
  },
  { id: "warped", header: "Warped On", value: (r) => r.warpedOn, kind: "date", hideOnMobile: true },
  { id: "moved", header: "Last Movement", value: (r) => r.lastMovedOn, kind: "date" },
];

type MoveValues = { date: string; toStatus: string; rack: string; remark: string };
const emptyMove = (): MoveValues => ({
  date: todayIso(),
  toStatus: "IN_STORE",
  rack: "",
  remark: "",
});

/**
 * Beam Production Entry — the old "New Warped Beam Entry" + the beam register (every
 * beam, every status), with the old "Update Beam Location & Status", QR code and thermal
 * label, on the prototype adapter.
 */
export default function BeamProductionPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const [range, setRange] = useRegisterRange(365);
  const beams = useBeams();
  const movements = useBeamMovements();
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const produce = useProduceBeam();
  const moveBeam = useMoveBeam();
  const form = useWarpingForm(emptyWarpValues);
  const move = useWarpingForm(emptyMove);
  const [moving, setMoving] = useState<BeamRow | null>(null);
  const [viewing, setViewing] = useState<BeamRow | null>(null);
  const [label, setLabel] = useState<BeamRow | null>(null);
  const v = form.values;
  const e = form.errors;

  const rows = useMemo(
    () => (beams.data ?? []).filter((b) => isWithinRange(b.lastMovedOn, range.from, range.to)),
    [beams.data, range],
  );

  const candidates = (beams.data ?? []).filter(
    (b) => b.status === "EMPTY" || b.status === "AT_WARPING",
  );
  const save = () =>
    void form
      .submit(() => produce.mutateAsync(toBeamInput(v)))
      .then((ok) => ok && toast.success(`Beam ${v.beamNo.trim()} saved in frontend prototype`));

  const saveMove = () => {
    if (!moving) return;
    const mv = move.values;
    void move
      .submit(() =>
        moveBeam.mutateAsync({
          beamId: moving.id,
          date: mv.date,
          toStatus: mv.toStatus as MoveBeamInput["toStatus"],
          rack: mv.rack,
          remark: mv.remark,
        }),
      )
      .then((ok) => ok && toast.success(`${moving.beamNo} updated in frontend prototype`));
  };

  return (
    <ProductionPageShell feature={feature}>
      <ProductionRegister
        title="Beam Register"
        exportName="beam-register"
        rows={rows}
        isLoading={beams.isFetching}
        error={beams.error}
        onRefresh={() => void beams.refetch()}
        range={range}
        onRangeChange={setRange}
        columns={BEAM_COLUMNS}
        rowKey={(r) => r.id}
        searchPlaceholder="Beam no., set no., yarn, rack, loom, warper…"
        filters={[
          { id: "status", label: "Status", value: (r) => BEAM_STATUS_LABEL[r.status] },
          { id: "type", label: "Beam Type", value: (r) => r.beamType },
        ]}
        groupBy={[
          { id: "status", label: "Status", value: (r) => BEAM_STATUS_LABEL[r.status] },
          { id: "type", label: "Beam Type", value: (r) => r.beamType },
          { id: "yarn", label: "Warp Yarn", value: (r) => r.warpYarnName },
        ]}
        onAdd={() => form.open()}
        addLabel="Beam Production"
        canAdd={canEnter}
        onView={setViewing}
        mobileBadges={(r) => <BeamStatusBadge status={r.status} />}
        rowActions={(r) => (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              aria-label={`QR label for ${r.beamNo}`}
              onClick={() => setLabel(r)}
            >
              <QrCode className="size-3.5" /> Label
            </Button>
            {canEnter && r.status !== "LOADED_ON_LOOM" && r.status !== "AT_WARPING" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                aria-label={`Update location and status of ${r.beamNo}`}
                onClick={() => {
                  setMoving(r);
                  move.open({ toStatus: r.status, rack: r.rack });
                }}
              >
                <ArrowRightLeft className="size-3.5" /> Location
              </Button>
            )}
          </>
        )}
      />

      <WarpingFormDialog
        form={form}
        title="New Warped Beam Entry"
        description="In-house warping: the beam goes to store with its warp set. Numbers are demo only; the backend will assign them."
        saving={produce.isPending}
        onSave={save}
      >
        <WarpEntryFields
          form={form}
          idPrefix="bp"
          dateLabel="Production Date"
          candidates={candidates}
          yarns={m?.yarns}
        />
      </WarpingFormDialog>

      <WarpingFormDialog
        form={move}
        title={`Update Beam Location & Status${moving ? ` — ${moving.beamNo}` : ""}`}
        description="Rack moves, sizing, or back to empty. Loading on a loom is done in Beam Loading Entry."
        saving={moveBeam.isPending}
        onSave={saveMove}
      >
        <FieldGrid cols={2}>
          <DateField
            id="bm-date"
            label="Date"
            required
            value={move.values.date}
            onChange={(x) => move.set("date", x)}
            error={move.errors["date"]}
          />
          <ReferenceSelect
            id="bm-status"
            label="Beam Status"
            required
            value={move.values.toStatus}
            options={(moving?.status === "EMPTY"
              ? (["EMPTY"] as const)
              : (["IN_STORE", "SIZING", "EMPTY"] as const)
            ).map((s) => ({
              id: s,
              label: BEAM_STATUS_LABEL[s],
            }))}
            onChange={(x) => move.set("toStatus", x)}
            error={move.errors["beamId"] ?? move.errors["toStatus"]}
          />
          <TextField
            id="bm-rack"
            label="Rack / Location"
            value={move.values.rack}
            onChange={(x) => move.set("rack", x)}
          />
          <TextField
            id="bm-remark"
            label="Remark"
            value={move.values.remark}
            onChange={(x) => move.set("remark", x)}
          />
        </FieldGrid>
      </WarpingFormDialog>

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">Beam {viewing.beamNo}</DialogTitle>
                <DialogDescription className="text-xs">
                  Frontend prototype record ({viewing.number}).
                </DialogDescription>
              </DialogHeader>
              <BeamDetail
                beam={viewing}
                history={(movements.data ?? []).filter((x) => x.beamId === viewing.id).reverse()}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={label !== null} onOpenChange={(o) => !o && setLabel(null)}>
        <DialogContent className="max-w-xs">
          {label && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-1.5 text-sm">
                  <QrCode className="size-4" /> Beam QR Label
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Prints on a 50 × 75 mm thermal label (size pending confirmation).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-center text-xs">
                <BeamQrCode payload={label.qrCode} className="mx-auto size-36" />
                <p className="font-mono text-base font-bold">{label.beamNo}</p>
                <p>
                  {label.setNo ? `Set ${label.setNo} · ` : ""}
                  {label.beamType}
                </p>
                <p className="text-muted-foreground">{label.qrCode}</p>
              </div>
              <DialogFooter>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    if (!printBeamLabel(label)) toast.error("Allow pop-ups to print the label");
                  }}
                >
                  <QrCode className="size-3.5" /> Print Thermal Label
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ProductionPageShell>
  );
}
