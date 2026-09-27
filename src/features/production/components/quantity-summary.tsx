import { formatNumber } from "@/features/production/utils/formatting";
import type { PrecisionKind } from "@/features/production/utils/quantities";
import { cn } from "@/lib/utils";

export type QuantitySummaryRow = {
  label: string;
  value: number | null;
  kind?: PrecisionKind;
  /** Visually separate a result row (e.g. Balance After). */
  result?: boolean;
  tone?: "default" | "warning" | "danger" | "success";
};

const TONES = {
  default: "",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-destructive",
  success: "text-emerald-700 dark:text-emerald-300",
} as const;

/**
 * Linked quantity breakdown for issue / receive / return forms.
 * Values are a UI preview; FINAL BACKEND MUST RECALCULATE AND VALIDATE THEM.
 */
export function QuantitySummary({
  title = "Quantity Summary",
  rows,
  className,
}: {
  title?: string;
  rows: QuantitySummaryRow[];
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("rounded-md border border-border bg-muted/30 p-3 text-sm", className)}
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              "flex items-baseline justify-between gap-4",
              row.result && "mt-1 border-t border-border pt-1 font-semibold",
              TONES[row.tone ?? "default"],
            )}
          >
            <dt>{row.label}</dt>
            <dd className="font-mono tabular-nums">{formatNumber(row.value, row.kind ?? "qty")}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[0.625rem] text-muted-foreground">
        Preview only — the backend will recalculate and validate these quantities.
      </p>
    </section>
  );
}
