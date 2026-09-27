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
import {
  DateField,
  FieldGrid,
  FormSection,
  NumberField,
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
  num,
  useCanEnterProduction,
  useRegisterRange,
} from "@/features/production/pages/page-helpers";
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
import { DEMO_BEAM_TYPES } from "@/features/production/warping/warping-demo-data";
import {
  BEAM_STATUS_LABEL,
  type BeamRow,
  type MoveBeamInput,
} from "@/features/production/warping/warping-types";
import { isWithinRange, todayIso } from "@/lib/erp/formatting";

const BEAM_COLUMNS: RegisterColumn<BeamRow>[] = [
  { id: "beamNo", header: "Beam No.", value: (r) => r.beamNo, sticky: true, width: 7 },
  { id: "number", header: "Production No.", value: (r) => r.number, width: 8, hideOnMobile: true },
  { id: "date", header: "Production Date", value: (r) => r.date, kind: "date" },
  { id: "setNo", header: "Set No.", value: (r) => r.setNo, width: 6 },
  { id: "type", header: "Beam Type", value: (r) => r.beamType, width: 6 },
  { id: "yarn", header: "Warp Yarn", value: (r) => r.warpYarnName, width: 10 },
  { id: "count", header: "Count / Denier", value: (r) => r.countDenier || null, width: 6 },
  { id: "ends", header: "Total Ends", value: (r) => r.totalEnds, width: 6 },
  { id: "length", header: "Length (m)", value: (r) => r.lengthMetre, kind: "metres", total: true },
  { id: "rack", header: "Rack / Location", value: (r) => r.rack || null, width: 7 },
  {
    id: "status",
    header: "Status",
    value: (r) => BEAM_STATUS_LABEL[r.status],
    render: (r) => <BeamStatusBadge status={r.status} />,
    width: 8,
  },
  { id: "loom", header: "Loom", value: (r) => r.loomName || null, width: 6 },
  {
    id: "moved",
    header: "Last Movement",
    value: (r) => r.lastMovedOn,
    kind: "date",
    hideOnMobile: true,
  },
];

type BeamValues = {
  date: string;
  beamNo: string;
  setNo: string;
  beamType: string;
  warpYarnId: string;
  countDenier: string;
  totalEnds: string;
  lengthMetre: string;
  rack: string;
  remark: string;
};
const emptyBeam = (): BeamValues => ({
  date: todayIso(),
  beamNo: "",
  setNo: "",
  beamType: "",
  warpYarnId: "",
  countDenier: "",
  totalEnds: "",
  lengthMetre: "",
  rack: "",
  remark: "",
});

type MoveValues = { date: string; toStatus: string; rack: string; remark: string };
const emptyMove = (): MoveValues => ({
  date: todayIso(),
  toStatus: "IN_STORE",
  rack: "",
  remark: "",
});

/**
 * Beam Production Entry — the old "New Warped Beam Entry" + beam register, with the old
 * "Update Beam Location & Status", QR code and thermal label, on the prototype adapter.
 */
export default function BeamProductionPage({ feature }: { feature: ProductionFeatureDefinition }) {
  const [range, setRange] = useRegisterRange(90);
  const beams = useBeams();
  const movements = useBeamMovements();
  const { data: m } = useProductionMasters();
  const canEnter = useCanEnterProduction();
  const produce = useProduceBeam();
  const moveBeam = useMoveBeam();
  const form = useWarpingForm(emptyBeam);
  const move = useWarpingForm(emptyMove);
  const [moving, setMoving] = useState<BeamRow | null>(null);
  const [viewing, setViewing] = useState<BeamRow | null>(null);
  const [label, setLabel] = useState<BeamRow | null>(null);
  const v = form.values;
  const e = form.errors;

  const rows = useMemo(
    () => (beams.data ?? []).filter((b) => isWithinRange(b.date, range.from, range.to)),
    [beams.data, range],
  );

  const save = () =>
    void form
      .submit(() =>
        produce.mutateAsync({
          date: v.date,
          beamNo: v.beamNo,
          setNo: v.setNo,
          beamType: v.beamType,
          warpYarnId: v.warpYarnId,
          countDenier: v.countDenier.trim(),
          totalEnds: num(v.totalEnds),
          lengthMetre: num(v.lengthMetre),
          rack: v.rack,
          remark: v.remark,
        }),
      )
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
        searchPlaceholder="Beam no., set no., yarn, rack, loom…"
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
        addLabel="New Warped Beam"
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
            {canEnter && r.status !== "LOADED_ON_LOOM" && (
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
        description="Records a produced warp beam in store. Numbers are demo only; the backend will assign them."
        saving={produce.isPending}
        onSave={save}
      >
        <FormSection title="Beam">
          <FieldGrid>
            <DateField
              id="bp-date"
              label="Production Date"
              required
              value={v.date}
              onChange={(x) => form.set("date", x)}
              error={e["date"]}
            />
            <TextField
              id="bp-beam-no"
              label="Beam No."
              required
              value={v.beamNo}
              onChange={(x) => form.set("beamNo", x)}
              error={e["beamNo"]}
            />
            <TextField
              id="bp-set-no"
              label="Set No."
              required
              value={v.setNo}
              onChange={(x) => form.set("setNo", x)}
              error={e["setNo"]}
            />
            <ReferenceSelect
              id="bp-type"
              label="Beam Type"
              required
              value={v.beamType}
              options={DEMO_BEAM_TYPES.map((t) => ({ id: t, label: t }))}
              onChange={(x) => form.set("beamType", x)}
              error={e["beamType"]}
              hint="Placeholder list — pending confirmation"
            />
          </FieldGrid>
        </FormSection>
        <FormSection title="Warp">
          <FieldGrid>
            <ReferenceSelect
              id="bp-yarn"
              label="Warp Yarn"
              required
              value={v.warpYarnId}
              options={masterOptions(m?.yarns)}
              onChange={(x) => form.set("warpYarnId", x)}
              error={e["warpYarnId"]}
            />
            <TextField
              id="bp-count"
              label="Count / Denier"
              value={v.countDenier}
              onChange={(x) => form.set("countDenier", x)}
            />
            <NumberField
              id="bp-ends"
              label="Total Ends"
              required
              value={v.totalEnds}
              onChange={(x) => form.set("totalEnds", x)}
              error={e["totalEnds"]}
            />
            <NumberField
              id="bp-length"
              label="Length (m)"
              required
              value={v.lengthMetre}
              onChange={(x) => form.set("lengthMetre", x)}
              error={e["lengthMetre"]}
            />
            <TextField
              id="bp-rack"
              label="Rack / Location"
              value={v.rack}
              onChange={(x) => form.set("rack", x)}
            />
            <TextField
              id="bp-remark"
              label="Remark"
              value={v.remark}
              onChange={(x) => form.set("remark", x)}
            />
          </FieldGrid>
        </FormSection>
      </WarpingFormDialog>

      <WarpingFormDialog
        form={move}
        title={`Update Beam Location & Status${moving ? ` — ${moving.beamNo}` : ""}`}
        description="Rack moves and sizing / depleted status. Loading on a loom is done in Beam Loading Entry."
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
            options={(["IN_STORE", "SIZING", "DEPLETED"] as const).map((s) => ({
              id: s,
              label: BEAM_STATUS_LABEL[s],
            }))}
            onChange={(x) => move.set("toStatus", x)}
            error={move.errors["beamId"]}
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
                  Set {label.setNo} · {label.beamType}
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
