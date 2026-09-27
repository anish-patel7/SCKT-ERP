import type { ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWarpingMode } from "@/features/production/warping/use-warping";
import type { WarpingForm } from "@/features/production/warping/use-warping-form";
import { beamLabelLines, qrSvg } from "@/features/production/warping/beam-label";
import {
  BEAM_MOVEMENT_LABEL,
  BEAM_STATUS_LABEL,
  type BeamMovementRow,
  type BeamRow,
  type BeamStatus,
} from "@/features/production/warping/warping-types";
import { formatDate } from "@/lib/erp/formatting";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<BeamStatus, string> = {
  IN_STORE: "border-emerald-500/60 text-emerald-700 dark:text-emerald-300",
  LOADED_ON_LOOM: "border-primary/60 text-primary",
  SIZING: "border-amber-500/60 text-amber-700 dark:text-amber-300",
  DEPLETED: "border-border text-muted-foreground",
};

export function BeamStatusBadge({ status }: { status: BeamStatus }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", STATUS_TONE[status])}>
      {BEAM_STATUS_LABEL[status]}
    </Badge>
  );
}

/** QR code preview (SVG generated in the browser from the beam's QR payload). */
export function BeamQrCode({ payload, className }: { payload: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`QR code ${payload}`}
      className={cn("bg-white p-1 [&_svg]:size-full", className)}
      // Library-generated SVG (paths only); the payload is encoded, not injected as markup.
      dangerouslySetInnerHTML={{ __html: qrSvg(payload) }}
    />
  );
}

/** Entry dialog with Cancel / Save and an unsaved-change guard. */
export function WarpingFormDialog<V extends Record<string, string>>({
  form,
  title,
  description,
  saving,
  onSave,
  children,
}: {
  form: WarpingForm<V>;
  title: string;
  description: string;
  saving: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  const mode = useWarpingMode();
  useBlocker({
    shouldBlockFn: () => form.isOpen && form.dirty && !confirm("Discard this unsaved entry?"),
    enableBeforeUnload: () => form.isOpen && form.dirty,
  });
  const requestClose = () => {
    if (!form.dirty || confirm("Discard this unsaved entry?")) form.close();
  };
  return (
    <Dialog open={form.isOpen} onOpenChange={(o) => !o && requestClose()}>
      <DialogContent className="flex max-h-[100dvh] w-full max-w-full flex-col gap-0 p-0 sm:max-h-[92vh] sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {form.errors["form"] && (
            <p role="alert" className="text-xs text-destructive">
              {form.errors["form"]}
            </p>
          )}
          {children}
        </div>
        <DialogFooter className="flex-row justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" size="sm" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" className="gap-1" onClick={onSave} disabled={saving || mode !== "demo"}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save (prototype)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Beam detail: fields, QR preview and the movement history. */
export function BeamDetail({ beam, history }: { beam: BeamRow; history: BeamMovementRow[] }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-col gap-3 sm:flex-row">
        <BeamQrCode payload={beam.qrCode} className="size-32 shrink-0 self-center rounded border" />
        <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1.5">
          {[
            ["Beam No.", beam.beamNo],
            ["Status", BEAM_STATUS_LABEL[beam.status]],
            ["Loom", beam.loomName || "—"],
            ["Rack / Location", beam.rack || "—"],
            ...beamLabelLines(beam),
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[0.625rem] uppercase text-muted-foreground">{k}</dt>
              <dd className="truncate font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <section aria-label="Movement history">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Movement history
        </h3>
        <ol className="space-y-1">
          {history.map((m) => (
            <li key={m.id} className="rounded border border-border px-2 py-1">
              <span className="font-mono">{m.number}</span> · {formatDate(m.date)} ·{" "}
              {BEAM_MOVEMENT_LABEL[m.kind]} → {BEAM_STATUS_LABEL[m.toStatus]}
              {m.toLoomName && ` (${m.toLoomName})`}
              {m.toRack && ` · ${m.toRack}`}
              {m.remark && <span className="text-muted-foreground"> · {m.remark}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
