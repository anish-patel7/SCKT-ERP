import { useId, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-[0.6875rem] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type BaseFieldProps = {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
};

export function DateField({
  value,
  onChange,
  ...field
}: BaseFieldProps & { value: string; onChange: (value: string) => void }) {
  return (
    <FormField htmlFor={field.id} {...field}>
      <Input
        id={field.id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!field.error}
        aria-describedby={field.error ? `${field.id}-error` : undefined}
        className="h-9"
      />
    </FormField>
  );
}

/** Decimal input kept as text while typing; parsed with parseDecimal on save. */
export function NumberField({
  value,
  onChange,
  readOnly,
  ...field
}: BaseFieldProps & { value: string; onChange?: (value: string) => void; readOnly?: boolean }) {
  return (
    <FormField htmlFor={field.id} {...field}>
      <Input
        id={field.id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        aria-invalid={!!field.error}
        aria-describedby={field.error ? `${field.id}-error` : undefined}
        className={cn("h-9 text-right font-mono tabular-nums", readOnly && "bg-muted/60")}
      />
    </FormField>
  );
}

export function TextField({
  value,
  onChange,
  multiline,
  ...field
}: BaseFieldProps & { value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return (
    <FormField htmlFor={field.id} {...field}>
      {multiline ? (
        <Textarea
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="min-h-9 text-sm"
        />
      ) : (
        <Input
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!field.error}
          aria-describedby={field.error ? `${field.id}-error` : undefined}
          className="h-9"
        />
      )}
    </FormField>
  );
}

/** Value shown for context (derived or copied from a linked document); not editable. */
export function ReadOnlyField({
  label,
  value,
  className,
  mono,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          "flex min-h-9 items-center truncate rounded-md border border-dashed border-border bg-muted/40 px-3 text-sm",
          mono && "font-mono tabular-nums",
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export type ReferenceOption = {
  id: string;
  label: string;
  /** Secondary text shown under the label and searched too. */
  detail?: string;
  /** Right-aligned hint (e.g. outstanding quantity). */
  meta?: string;
  disabled?: boolean;
};

/** Searchable single selector for masters and linked documents. */
export function ReferenceSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  ...field
}: BaseFieldProps & {
  value: string;
  onChange: (id: string) => void;
  options: ReferenceOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find((o) => o.id === value);
  return (
    <FormField htmlFor={field.id} {...field}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={field.id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-invalid={!!field.error}
            aria-describedby={field.error ? `${field.id}-error` : undefined}
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-between px-3 text-left text-sm font-normal",
              !selected && "text-muted-foreground",
              field.error && "border-destructive",
            )}
          >
            <span className="truncate">{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0"
          align="start"
        >
          <Command
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder="Search…" className="h-9 text-sm" />
            <CommandList id={listId} className="max-h-64">
              <CommandEmpty>No matches</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`${o.label} ${o.detail ?? ""} ${o.id}`}
                    disabled={o.disabled}
                    onSelect={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        o.id === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.detail && (
                        <span className="block truncate text-[0.6875rem] text-muted-foreground">
                          {o.detail}
                        </span>
                      )}
                    </span>
                    {o.meta && (
                      <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
                        {o.meta}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FormField>
  );
}

/** Card-like block grouping related form fields. */
export function FormSection({
  title,
  description,
  children,
  className,
  actions,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("rounded-md border border-border bg-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
          {description && <p className="text-[0.6875rem] text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

/** Responsive field grid: 1 column on phones, 2 on tablets, up to 4 on desktop. */
export function FieldGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2",
        cols === 3 && "lg:grid-cols-3",
        cols === 4 && "lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}
