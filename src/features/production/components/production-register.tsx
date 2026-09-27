import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  Layers,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateRange } from "@/features/production/types/production";
import { formatDate, formatNumber, plainNumber } from "@/features/production/utils/formatting";
import { sumAmount, sumQty, type PrecisionKind } from "@/features/production/utils/quantities";
import { downloadCsv, printTable, type ExportTable } from "@/features/production/utils/export";
import { cn } from "@/lib/utils";

export type ColumnKind = "text" | "date" | PrecisionKind;

export type RegisterColumn<T> = {
  id: string;
  header: string;
  /** Raw value used for search, export, grouping and totals. */
  value: (row: T) => string | number | null;
  kind?: ColumnKind;
  /** Custom cell content (defaults to the formatted value). */
  render?: (row: T) => ReactNode;
  /** Keep visible while scrolling sideways (use for the document number). */
  sticky?: boolean;
  /** Sum this numeric column in group summaries. */
  total?: boolean;
  /** Minimum width in rem. */
  width?: number;
  /** Hide from the mobile card. */
  hideOnMobile?: boolean;
};

export type RegisterDimension<T> = { id: string; label: string; value: (row: T) => string };

function display<T>(column: RegisterColumn<T>, row: T): string {
  const raw = column.value(row);
  if (raw === null || raw === "") return "—";
  const kind = column.kind ?? "text";
  if (kind === "date") return formatDate(String(raw));
  if (kind === "text") return String(raw);
  return formatNumber(Number(raw), kind);
}

function exportCell<T>(column: RegisterColumn<T>, row: T): string {
  const raw = column.value(row);
  if (raw === null) return "";
  const kind = column.kind ?? "text";
  if (kind === "date") return formatDate(String(raw));
  if (kind === "text") return String(raw);
  return plainNumber(Number(raw), kind);
}

const numericKind = (kind: ColumnKind | undefined): kind is PrecisionKind =>
  kind === "qty" || kind === "metres" || kind === "rate" || kind === "amount";

export function DateRangeFilter({
  range,
  onChange,
  idPrefix,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-from`} className="text-xs">
          From Date
        </Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          value={range.from}
          max={range.to || undefined}
          onChange={(e) => onChange({ ...range, from: e.target.value })}
          className="h-9 sm:w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-to`} className="text-xs">
          To Date
        </Label>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          value={range.to}
          min={range.from || undefined}
          onChange={(e) => onChange({ ...range, to: e.target.value })}
          className="h-9 sm:w-40"
        />
      </div>
    </div>
  );
}

const PAGE_SIZE = 25;
const ALL = "__all__";

/**
 * Standard production transaction register. Pages supply columns and data; the register
 * provides date range, search, context filters, group summary, pagination, print, CSV and
 * responsive table / card layouts. Group summaries are frontend-derived previews.
 */
export function ProductionRegister<T>({
  title,
  exportName,
  rows,
  isLoading,
  error,
  onRefresh,
  range,
  onRangeChange,
  columns,
  rowKey,
  filters = [],
  groupBy = [],
  searchPlaceholder = "Search…",
  onAdd,
  addLabel = "Add New",
  canAdd = true,
  onView,
  rowActions,
  mobileBadges,
  toolbarExtra,
}: {
  title: string;
  exportName: string;
  rows: T[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  columns: RegisterColumn<T>[];
  rowKey: (row: T) => string;
  filters?: RegisterDimension<T>[];
  groupBy?: RegisterDimension<T>[];
  searchPlaceholder?: string;
  onAdd?: () => void;
  addLabel?: string;
  canAdd?: boolean;
  onView?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  mobileBadges?: (row: T) => ReactNode;
  toolbarExtra?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [groupId, setGroupId] = useState<string>("");
  const [summary, setSummary] = useState(false);
  const [page, setPage] = useState(0);

  const filterOptions = useMemo(
    () =>
      filters.map((f) => ({
        ...f,
        options: [...new Set((rows ?? []).map(f.value))].filter(Boolean).sort(),
      })),
    [filters, rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      for (const f of filters) {
        const selected = filterValues[f.id];
        if (selected && selected !== ALL && f.value(row) !== selected) return false;
      }
      if (!term) return true;
      return columns.some((c) => display(c, row).toLowerCase().includes(term));
    });
  }, [rows, search, filterValues, filters, columns]);

  const group = groupBy.find((g) => g.id === groupId) ?? groupBy[0];
  const totalColumns = columns.filter((c) => c.total && numericKind(c.kind));
  const grouped = useMemo(() => {
    if (!group) return [];
    const map = new Map<string, T[]>();
    for (const row of filtered) {
      const key = group.value(row) || "—";
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, list]) => ({
        key,
        count: list.length,
        totals: totalColumns.map((c) => {
          const values = list.map((r) => Number(c.value(r) ?? 0));
          return c.kind === "amount" ? sumAmount(values) : sumQty(values);
        }),
      }));
  }, [filtered, group, totalColumns]);

  const showSummary = summary && !!group;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const activeFilters = !!search || Object.values(filterValues).some((v) => v && v !== ALL);

  const exportTable = (): ExportTable =>
    showSummary && group
      ? {
          columns: [
            { header: group.label },
            { header: "Transactions", align: "right" },
            ...totalColumns.map((c) => ({ header: c.header, align: "right" as const })),
          ],
          rows: grouped.map((g) => [
            g.key,
            String(g.count),
            ...g.totals.map((t, i) => plainNumber(t, totalColumns[i]!.kind as PrecisionKind)),
          ]),
        }
      : {
          columns: columns.map((c) => ({
            header: c.header,
            ...(numericKind(c.kind) ? { align: "right" as const } : {}),
          })),
          rows: filtered.map((row) => columns.map((c) => exportCell(c, row))),
        };

  const subtitle = `${formatDate(range.from)} – ${formatDate(range.to)}${
    showSummary && group ? ` · grouped by ${group.label}` : ""
  } · frontend demo data`;

  const resetFilters = () => {
    setSearch("");
    setFilterValues({});
    setPage(0);
  };

  return (
    <div className="space-y-3">
      <Card className="border border-border">
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <DateRangeFilter
              range={range}
              onChange={(r) => {
                onRangeChange(r);
                setPage(0);
              }}
              idPrefix={`${exportName}-range`}
            />
            <div className="min-w-0 flex-1 space-y-1 lg:min-w-56">
              <Label htmlFor={`${exportName}-search`} className="text-xs">
                Search
              </Label>
              <Input
                id={`${exportName}-search`}
                value={search}
                placeholder={searchPlaceholder}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="h-9"
              />
            </div>
            {filterOptions.map((f) => (
              <div key={f.id} className="space-y-1 lg:w-44">
                <Label htmlFor={`${exportName}-f-${f.id}`} className="text-xs">
                  {f.label}
                </Label>
                <Select
                  value={filterValues[f.id] ?? ALL}
                  onValueChange={(v) => {
                    setFilterValues((prev) => ({ ...prev, [f.id]: v }));
                    setPage(0);
                  }}
                >
                  <SelectTrigger id={`${exportName}-f-${f.id}`} className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All</SelectItem>
                    {f.options.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onRefresh}>
              <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} /> Refresh
            </Button>
            {onAdd && canAdd && (
              <Button size="sm" className="h-8 gap-1" onClick={onAdd}>
                <Plus className="size-3.5" /> {addLabel}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={() => {
                if (!printTable(title, subtitle, exportTable())) {
                  toast.error("Allow pop-ups for this site to print");
                }
              }}
              disabled={filtered.length === 0}
            >
              <Printer className="size-3.5" /> Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={() =>
                downloadCsv(`${exportName}-${range.from}-to-${range.to}`, exportTable())
              }
              disabled={filtered.length === 0}
            >
              <FileDown className="size-3.5" /> Export CSV
            </Button>
            {groupBy.length > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={summary ? "default" : "outline"}
                  className="h-8 gap-1"
                  aria-pressed={summary}
                  onClick={() => setSummary((v) => !v)}
                >
                  <Layers className="size-3.5" /> Group Summary
                </Button>
                {summary && (
                  <Select value={group?.id ?? ""} onValueChange={setGroupId}>
                    <SelectTrigger className="h-8 w-40 text-xs" aria-label="Group by">
                      <SelectValue placeholder="Group by" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupBy.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          By {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            {activeFilters && (
              <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={resetFilters}>
                <RotateCcw className="size-3.5" /> Reset Filters
              </Button>
            )}
            {toolbarExtra}
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} record{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center text-sm">
            <p className="text-destructive">Unable to load records: {error.message}</p>
            <Button size="sm" variant="outline" onClick={onRefresh}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : isLoading && !rows ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {rows?.length ? "No records match these filters." : "No records in this date range."}
          </CardContent>
        </Card>
      ) : showSummary && group ? (
        <GroupSummaryTable
          label={group.label}
          groups={grouped}
          totalColumns={totalColumns.map((c) => ({
            header: c.header,
            kind: c.kind as PrecisionKind,
          }))}
        />
      ) : (
        <>
          <DesktopTable
            columns={columns}
            rows={visible}
            rowKey={rowKey}
            {...(onView ? { onView } : {})}
            {...(rowActions ? { rowActions } : {})}
          />
          <MobileCards
            columns={columns}
            rows={visible}
            rowKey={rowKey}
            {...(onView ? { onView } : {})}
            {...(rowActions ? { rowActions } : {})}
            {...(mobileBadges ? { mobileBadges } : {})}
          />
          {pageCount > 1 && (
            <nav className="flex items-center justify-end gap-2 text-xs" aria-label="Pagination">
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span>
                Page {currentPage + 1} of {pageCount}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function DesktopTable<T>({
  columns,
  rows,
  rowKey,
  onView,
  rowActions,
}: {
  columns: RegisterColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onView?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
}) {
  const hasActions = !!onView || !!rowActions;
  return (
    <div className="relative hidden max-h-[calc(100vh-17rem)] overflow-auto rounded-md border border-border md:block">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                style={{ minWidth: `${c.width ?? 7}rem` }}
                className={cn(
                  "sticky top-0 z-20 h-9 whitespace-nowrap border-b border-border bg-muted px-2 text-left font-semibold",
                  numericKind(c.kind) && "text-right",
                  c.sticky && "left-0 z-30 border-r",
                )}
              >
                {c.header}
              </th>
            ))}
            {hasActions && (
              <th
                scope="col"
                className="sticky right-0 top-0 z-30 h-9 border-b border-l border-border bg-muted px-2 text-right font-semibold"
              >
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="group/row">
              {columns.map((c) => (
                <td
                  key={c.id}
                  className={cn(
                    "h-9 whitespace-nowrap border-b border-border px-2 group-hover/row:bg-muted/50",
                    numericKind(c.kind) && "text-right font-mono tabular-nums",
                    c.sticky &&
                      "sticky left-0 z-10 border-r bg-background font-medium group-hover/row:bg-muted",
                  )}
                >
                  {c.render ? c.render(row) : display(c, row)}
                </td>
              ))}
              {hasActions && (
                <td className="sticky right-0 z-10 h-9 border-b border-l border-border bg-background px-2 group-hover/row:bg-muted">
                  <div className="flex items-center justify-end gap-1">
                    {rowActions?.(row)}
                    {onView && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => onView(row)}
                      >
                        <Eye className="size-3.5" /> View
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileCards<T>({
  columns,
  rows,
  rowKey,
  onView,
  rowActions,
  mobileBadges,
}: {
  columns: RegisterColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onView?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  mobileBadges?: (row: T) => ReactNode;
}) {
  const [titleColumn, ...rest] = columns;
  const fields = rest.filter((c) => !c.hideOnMobile);
  return (
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => (
        <li key={rowKey(row)} className="rounded-md border border-border bg-card p-3 text-xs">
          <div className="mb-2 flex items-start justify-between gap-2">
            <span className="font-mono text-sm font-semibold">
              {titleColumn ? display(titleColumn, row) : ""}
            </span>
            <div className="flex flex-wrap justify-end gap-1">{mobileBadges?.(row)}</div>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {fields.map((c) => (
              <div key={c.id} className="min-w-0">
                <dt className="text-[0.625rem] uppercase text-muted-foreground">{c.header}</dt>
                <dd className={cn("truncate", numericKind(c.kind) && "font-mono tabular-nums")}>
                  {c.render ? c.render(row) : display(c, row)}
                </dd>
              </div>
            ))}
          </dl>
          {(onView || rowActions) && (
            <div className="mt-2 flex flex-wrap justify-end gap-1 border-t border-border pt-2">
              {rowActions?.(row)}
              {onView && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => onView(row)}
                >
                  <Eye className="size-3.5" /> View
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function GroupSummaryTable({
  label,
  groups,
  totalColumns,
}: {
  label: string;
  groups: { key: string; count: number; totals: number[] }[];
  totalColumns: { header: string; kind: PrecisionKind }[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <caption className="sr-only">Group summary by {label}</caption>
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="h-9 px-2 text-left font-semibold">
              {label}
            </th>
            <th scope="col" className="h-9 px-2 text-right font-semibold">
              Transactions
            </th>
            {totalColumns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className="h-9 whitespace-nowrap px-2 text-right font-semibold"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-t border-border">
              <td className="h-9 px-2 font-medium">{g.key}</td>
              <td className="h-9 px-2 text-right font-mono">{g.count}</td>
              {g.totals.map((t, i) => (
                <td
                  key={totalColumns[i]!.header}
                  className="h-9 px-2 text-right font-mono tabular-nums"
                >
                  {formatNumber(t, totalColumns[i]!.kind)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-2 py-1 text-[0.625rem] text-muted-foreground">
        Frontend-derived summary of the filtered demo records.
      </p>
    </div>
  );
}
