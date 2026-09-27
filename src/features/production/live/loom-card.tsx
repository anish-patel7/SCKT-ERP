import { useState } from "react";
import { Link2, Link2Off, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Can } from "@/components/auth";
import { QtyProgress } from "@/features/production/components/qty-progress";
import { formatNumber } from "@/lib/erp/formatting";
import { cn } from "@/lib/utils";
import {
  INACTIVE_STATUS,
  wovenMetres,
  type LiveJobCard,
  type LiveLoom,
} from "@/features/production/live/loom-model";

const OPERATING_STATUSES = ["IDLE", "RUNNING", "MAINTENANCE", "BLOCKED"] as const;

const STATUS_TONE: Record<string, string> = {
  RUNNING: "border-primary/60 bg-primary/10",
  IDLE: "border-border bg-card",
  MAINTENANCE: "border-amber-500/60 bg-amber-500/10",
  BLOCKED: "border-red-500/60 bg-red-500/10",
  DECOMMISSIONED: "border-gray-500/60 bg-gray-500/10 opacity-80",
};

const NONE = "__none";

/**
 * One loom on the planning board: status, activate / deactivate (soft — status
 * DECOMMISSIONED, never deleted) and job card allocation, all through the existing
 * loom service methods.
 */
export function LoomCard({
  loom,
  jobCards,
  busy,
  onStatus,
  onAssign,
  onRelease,
}: {
  loom: LiveLoom;
  jobCards: LiveJobCard[];
  busy: boolean;
  onStatus: (status: string) => void;
  onAssign: (jobCardId: string) => void;
  onRelease: () => void;
}) {
  const [pick, setPick] = useState(NONE);
  const inactive = loom.status === INACTIVE_STATUS;
  const current = jobCards.find((c) => c.id === loom.current_job_card_id) ?? null;
  const assignable = jobCards.filter(
    (c) =>
      !["COMPLETED", "ARCHIVED"].includes(c.status ?? "") && (!c.loom_id || c.loom_id === loom.id),
  );

  return (
    <Card
      className={cn("min-w-0 gap-2 rounded-sm border py-3", STATUS_TONE[loom.status || "IDLE"])}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-3">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm">
          <span className="font-mono font-bold">{loom.loom_no}</span>
          <span className="truncate text-[0.6875rem] font-normal text-muted-foreground">
            {loom.loom_type} · {formatNumber(loom.panna_inch ?? 0, "rate")}"
          </span>
        </CardTitle>
        <Can permission="production:update">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[0.6875rem]"
            disabled={busy || (!inactive && !!current)}
            title={!inactive && current ? "Release the job card before deactivating" : undefined}
            onClick={() => {
              if (inactive) onStatus("IDLE");
              else if (confirm(`Deactivate loom ${loom.loom_no}? It stays on record.`)) {
                onStatus(INACTIVE_STATUS);
              }
            }}
          >
            {inactive ? <Power className="size-3.5" /> : <PowerOff className="size-3.5" />}
            {inactive ? "Activate" : "Deactivate"}
          </Button>
        </Can>
      </CardHeader>
      <CardContent className="space-y-2 px-3 text-xs">
        {inactive ? (
          <p className="font-semibold text-muted-foreground">Inactive (decommissioned)</p>
        ) : (
          <div className="space-y-1">
            <Label htmlFor={`loom-status-${loom.id}`} className="section-label text-[0.6875rem]">
              Status
            </Label>
            <Select value={loom.status || "IDLE"} onValueChange={onStatus} disabled={busy}>
              <SelectTrigger id={`loom-status-${loom.id}`} className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1 rounded-md border border-border/70 bg-background/60 p-2">
          <p className="section-label text-[0.6875rem]">Job card / order allocation</p>
          {current ? (
            <div className="space-y-1.5">
              <p>
                <span className="font-mono font-semibold">{current.card_no}</span>
                {current.production_orders?.order_no && (
                  <span className="text-muted-foreground">
                    {" "}
                    · Order {current.production_orders.order_no}
                  </span>
                )}
              </p>
              <QtyProgress
                done={wovenMetres(current)}
                total={current.qty_metre ?? 0}
                label="Woven progress"
              />
              <Can permission="production:update">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-[0.6875rem]"
                  disabled={busy}
                  onClick={onRelease}
                >
                  <Link2Off className="size-3.5" /> Release
                </Button>
              </Can>
            </div>
          ) : inactive ? (
            <p className="text-muted-foreground">Activate the loom to allocate work.</p>
          ) : (
            <Can
              permission="production:update"
              fallback={<p className="text-muted-foreground">No job card allocated</p>}
            >
              <div className="flex gap-1.5">
                <Select value={pick} onValueChange={setPick} disabled={busy}>
                  <SelectTrigger
                    aria-label={`Job card for loom ${loom.loom_no}`}
                    className="h-7 min-w-0 flex-1 text-xs"
                  >
                    <SelectValue placeholder="Select job card" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE} className="text-xs">
                      Select job card…
                    </SelectItem>
                    {assignable.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.card_no}
                        {c.production_orders?.order_no ? ` · ${c.production_orders.order_no}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-7 gap-1 text-[0.6875rem]"
                  disabled={busy || pick === NONE}
                  onClick={() => {
                    onAssign(pick);
                    setPick(NONE);
                  }}
                >
                  <Link2 className="size-3.5" /> Allocate
                </Button>
              </div>
            </Can>
          )}
        </div>

        <p className="text-[0.6875rem] text-muted-foreground">{loom.remarks || "No remarks"}</p>
      </CardContent>
    </Card>
  );
}
