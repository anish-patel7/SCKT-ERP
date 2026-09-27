import { DecimalInput } from "@/components/erp/decimal-field";
import { ReadOnlyField } from "@/components/erp/form-controls";
import { formatNumber } from "@/lib/erp/formatting";
import type { PrecisionKind } from "@/lib/erp/numbers";
import { cn } from "@/lib/utils";

/** Numeric grid cell: labelled for screen readers, error shown under the input. */
export function NumberCell({
  id,
  label,
  value,
  onChange,
  kind,
  readOnly,
  error,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  kind: PrecisionKind;
  readOnly: boolean;
  error?: string | undefined;
}) {
  return (
    <div className="min-w-0">
      <DecimalInput
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        kind={kind}
        readOnly={readOnly}
        invalid={!!error}
        {...(error ? { describedBy: `${id}-error` } : {})}
        className="h-8 text-xs"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-0.5 text-[0.625rem] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Safe summary (plain sum) or a pending, user-entered figure. */
export function SummaryValue({
  label,
  value,
  kind,
  note,
  className,
}: {
  label: string;
  value: number | null;
  kind: PrecisionKind;
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <ReadOnlyField label={label} value={value === null ? "" : formatNumber(value, kind)} mono />
      {note && <p className="mt-0.5 text-[0.625rem] text-muted-foreground">{note}</p>}
    </div>
  );
}
