import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/erp/form-controls";
import { PRECISION, parseDecimal, roundTo, type PrecisionKind } from "@/lib/erp/numbers";
import { cn } from "@/lib/utils";

/** Plain text for an input (no thousands separators), at the kind's precision. */
function decimalText(value: number | null, kind: PrecisionKind): string {
  return value === null ? "" : roundTo(value, PRECISION[kind]).toFixed(PRECISION[kind]);
}

/**
 * Typed numeric input: the model holds `number | null`, never free text. While typing
 * the raw text is kept; valid text updates the value immediately, invalid text shows an
 * inline error and does not reach the model. On blur the value is shown at the kind's
 * precision (qty/metres/weight 3, rate/amount/percent 2, conversion 4).
 */
export function DecimalInput({
  id,
  value,
  onChange,
  kind,
  readOnly,
  label,
  invalid,
  className,
  describedBy,
}: {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  kind: PrecisionKind;
  readOnly?: boolean;
  /** Accessible name when there is no visible <label> (grid cells). */
  label?: string;
  invalid?: boolean;
  className?: string;
  describedBy?: string;
}) {
  const [text, setText] = useState(() => decimalText(value, kind));
  const [focused, setFocused] = useState(false);
  const [bad, setBad] = useState(false);

  // Follow external changes (reset, copy recipe, clone) while the user is not typing.
  useEffect(() => {
    if (!focused) {
      setText(decimalText(value, kind));
      setBad(false);
    }
  }, [value, kind, focused]);

  return (
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      readOnly={readOnly}
      aria-label={label}
      aria-invalid={invalid || bad}
      aria-describedby={describedBy}
      title={bad ? "Enter a number" : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (!bad) setText(decimalText(value, kind));
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        if (next.trim() === "") {
          setBad(false);
          onChange(null);
          return;
        }
        const parsed = parseDecimal(next);
        if (Number.isFinite(parsed)) {
          setBad(false);
          onChange(parsed);
        } else {
          setBad(true);
        }
      }}
      className={cn(
        "h-9 text-right font-mono tabular-nums",
        readOnly && "bg-muted/60",
        (invalid || bad) && "border-destructive",
        className,
      )}
    />
  );
}

export function DecimalField({
  id,
  label,
  value,
  onChange,
  kind,
  readOnly,
  error,
  hint,
  required,
  className,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  kind: PrecisionKind;
  readOnly?: boolean;
  error?: string | undefined;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <FormField
      htmlFor={id}
      label={label}
      error={error}
      hint={hint}
      {...(required ? { required } : {})}
      {...(className ? { className } : {})}
    >
      <DecimalInput
        id={id}
        value={value}
        onChange={onChange}
        kind={kind}
        {...(readOnly ? { readOnly } : {})}
        invalid={!!error}
        {...(error ? { describedBy: `${id}-error` } : {})}
      />
    </FormField>
  );
}
