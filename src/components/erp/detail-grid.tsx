import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type DetailColumn<L> = {
  id: string;
  header: string;
  /** Minimum width in rem on desktop. */
  width?: number;
  align?: "left" | "right";
  /** Keep this identifier column visible while the lines scroll sideways. */
  sticky?: boolean;
  render: (line: L, index: number) => ReactNode;
};

/**
 * Editable document lines: a horizontally scrollable table on desktop, one card per
 * line on phones. Cell editors are supplied by the page. Only one layout is rendered at a
 * time so every cell editor (and its id / label) exists once.
 */
export function DetailGrid<L>({
  columns,
  lines,
  lineKey,
  onRemove,
  emptyText,
  lineLabel = "Line",
}: {
  columns: DetailColumn<L>[];
  lines: L[];
  lineKey: (line: L, index: number) => string;
  onRemove?: (index: number) => void;
  emptyText: string;
  lineLabel?: string;
}) {
  const mobile = useIsMobile();
  if (lines.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
        {emptyText}
      </p>
    );
  }
  if (!mobile) {
    return (
      <div className="relative overflow-x-auto rounded-md border border-border">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="h-8 w-8 border-b border-border px-2 text-left">
                #
              </th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  style={{ minWidth: `${c.width ?? 6}rem` }}
                  className={cn(
                    "h-8 whitespace-nowrap border-b border-border px-2 font-semibold",
                    c.align === "right" ? "text-right" : "text-left",
                    c.sticky && "sticky left-0 z-10 border-r bg-muted",
                  )}
                >
                  {c.header}
                </th>
              ))}
              {onRemove && (
                <th scope="col" className="h-8 w-10 border-b border-border">
                  <span className="sr-only">Remove</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={lineKey(line, i)} className="align-top">
                <td className="border-b border-border px-2 py-1.5 text-muted-foreground">
                  {i + 1}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      "border-b border-border px-2 py-1.5",
                      c.align === "right" && "text-right font-mono tabular-nums",
                      c.sticky && "sticky left-0 z-10 border-r bg-card font-medium",
                    )}
                  >
                    {c.render(line, i)}
                  </td>
                ))}
                {onRemove && (
                  <td className="border-b border-border px-1 py-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive"
                      aria-label={`Remove ${lineLabel.toLowerCase()} ${i + 1}`}
                      onClick={() => onRemove(i)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {lines.map((line, i) => (
        <li key={lineKey(line, i)} className="rounded-md border border-border p-2 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">
              {lineLabel} {i + 1}
            </span>
            {onRemove && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs text-destructive"
                onClick={() => onRemove(i)}
              >
                <Trash2 className="size-3.5" /> Remove
              </Button>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
            {columns.map((c) => (
              <div key={c.id} className="min-w-0">
                <dt className="text-[0.625rem] uppercase text-muted-foreground">{c.header}</dt>
                <dd className={cn(c.align === "right" && "font-mono tabular-nums")}>
                  {c.render(line, i)}
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
