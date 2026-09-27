import { Progress } from "@/components/ui/progress";
import { formatQty } from "@/lib/erp/formatting";

/**
 * Received ÷ planned quantity as a bar with "done / total" (the "production progress"
 * of the existing Production Orders and Job Cards screens). Preview only.
 */
export function QtyProgress({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="flex min-w-32 items-center gap-2">
      <Progress value={pct} className="h-1.5 w-16" aria-label={`${label} ${Math.round(pct)}%`} />
      <span className="whitespace-nowrap font-mono text-[0.6875rem] text-muted-foreground">
        {formatQty(done)} / {formatQty(total)}
      </span>
    </div>
  );
}
