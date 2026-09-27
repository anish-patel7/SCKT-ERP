import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ChecklistOption = { id: string; label: string; detail?: string };

/** Searchable checkbox list with Select All / Clear All and a selected count. */
export function ChecklistMultiSelect({
  title,
  options,
  selected,
  onChange,
  disabled,
  className,
}: {
  title: string;
  options: ChecklistOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const headingId = useId();
  const term = search.trim().toLowerCase();
  const visible = options.filter(
    (o) => o.label.toLowerCase().includes(term) || (o.detail ?? "").toLowerCase().includes(term),
  );
  const set = new Set(selected);

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex min-w-0 flex-col rounded-md border border-border", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h3
          id={headingId}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {title}
        </h3>
        <span className="text-[0.6875rem] text-muted-foreground">
          {selected.length} of {options.length} selected
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
        <Input
          aria-label={`Search ${title}`}
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 min-w-0 flex-1 text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          disabled={disabled}
          onClick={() => onChange([...new Set([...selected, ...visible.map((o) => o.id)])])}
        >
          Select All
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          disabled={disabled}
          onClick={() => {
            const hide = new Set(visible.map((o) => o.id));
            onChange(selected.filter((id) => !hide.has(id)));
          }}
        >
          Clear All
        </Button>
      </div>
      <ul className="max-h-56 space-y-0.5 overflow-y-auto p-2">
        {visible.map((o) => (
          <li key={o.id}>
            <label
              className={cn(
                "flex min-h-9 items-center gap-2 rounded px-1.5 text-sm",
                disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/50",
              )}
            >
              <Checkbox
                checked={set.has(o.id)}
                disabled={disabled}
                onCheckedChange={(c) =>
                  onChange(c === true ? [...selected, o.id] : selected.filter((id) => id !== o.id))
                }
              />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.detail && (
                <span className="font-mono text-[0.625rem] text-muted-foreground">{o.detail}</span>
              )}
            </label>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-1.5 py-2 text-xs text-muted-foreground">No matches</li>
        )}
      </ul>
    </section>
  );
}
