import { useMemo, useState } from "react";
import { Copy, Eye, ImageIcon, Pencil, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ItemSummary, LookupOption } from "@/features/item-master/types/item-master";
import { formatDate } from "@/lib/erp/formatting";
import { cn } from "@/lib/utils";

export type ItemAction = "VIEW" | "EDIT" | "CLONE";

const ALL = "__all";

const SEARCH_FIELDS = (i: ItemSummary) => [
  i.code,
  i.productName,
  i.productType,
  i.category,
  i.group,
  i.brand,
  i.shade,
  i.hsnSac,
  i.productStatus,
  i.recordStatus === "DRAFT" ? "draft" : "saved",
];

function StatusBadges({ item }: { item: ItemSummary }) {
  return (
    <span className="flex flex-wrap gap-1">
      {item.recordStatus === "DRAFT" && (
        <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
          Draft
        </Badge>
      )}
      {item.productStatus && (
        <Badge variant={item.productStatus === "Active" ? "secondary" : "outline"}>
          {item.productStatus}
        </Badge>
      )}
    </span>
  );
}

const formatUpdated = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : `${formatDate(iso.slice(0, 10))} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

/**
 * Searchable item list used by the register and by the Find dialog. Searches code,
 * product name, type, category, group, brand, shade, HSN/SAC and status.
 */
export function ItemBrowser({
  items,
  productTypes,
  loading,
  onAction,
  canEdit,
  canClone,
  compact,
  autoFocus,
}: {
  items: ItemSummary[];
  productTypes: LookupOption[];
  loading?: boolean;
  onAction: (action: ItemAction, id: string) => void;
  canEdit: boolean;
  canClone: boolean;
  /** Fewer columns (Find dialog). */
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const rows = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const typeName = productTypes.find((t) => t.id === type)?.name;
    return items.filter((i) => {
      if (type !== ALL && i.productType !== typeName) return false;
      if (status === "DRAFT" && i.recordStatus !== "DRAFT") return false;
      if (status !== ALL && status !== "DRAFT" && i.productStatus !== status) return false;
      if (!terms.length) return true;
      const hay = SEARCH_FIELDS(i).join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [items, search, type, status, productTypes]);

  const statuses = useMemo(
    () => [...new Set(items.map((i) => i.productStatus).filter(Boolean))].sort(),
    [items],
  );

  const actions = (i: ItemSummary, labels = false) => (
    <div className="flex justify-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 gap-1 px-2 text-xs"
        aria-label={`View ${i.code}`}
        onClick={() => onAction("VIEW", i.id)}
      >
        <Eye className="size-3.5" />{" "}
        <span className={labels ? "inline" : "hidden xl:inline"}>View</span>
      </Button>
      {canEdit && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1 px-2 text-xs"
          aria-label={`Edit ${i.code}`}
          onClick={() => onAction("EDIT", i.id)}
        >
          <Pencil className="size-3.5" />{" "}
          <span className={labels ? "inline" : "hidden xl:inline"}>Edit</span>
        </Button>
      )}
      {canClone && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1 px-2 text-xs"
          aria-label={`Clone ${i.code}`}
          onClick={() => onAction("CLONE", i.id)}
        >
          <Copy className="size-3.5" />{" "}
          <span className={labels ? "inline" : "hidden xl:inline"}>Clone</span>
        </Button>
      )}
    </div>
  );

  const head = "h-9 whitespace-nowrap px-2 text-left font-semibold";
  const cell = "whitespace-nowrap px-2 py-1.5";

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:min-w-64">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search items"
            placeholder="Search name, type, category, group, brand, shade, HSN/SAC, status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm"
            autoFocus={autoFocus}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="Filter by product type" className="h-9 text-xs sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All product types</SelectItem>
              {productTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Filter by status" className="h-9 text-xs sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="DRAFT">Drafts</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-[0.6875rem] text-muted-foreground" aria-live="polite">
        {loading ? "Loading items…" : `${rows.length} of ${items.length} items`}
      </p>

      <div className="relative hidden overflow-x-auto rounded-md border border-border md:block">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="bg-muted">
            <tr>
              <th
                scope="col"
                className={cn(head, "sticky left-0 z-10 border-r border-border bg-muted")}
              >
                Item Code
              </th>
              <th scope="col" className={head}>
                Product Name
              </th>
              <th scope="col" className={head}>
                Product Type
              </th>
              <th scope="col" className={head}>
                Category
              </th>
              {!compact && (
                <th scope="col" className={head}>
                  Brand
                </th>
              )}
              <th scope="col" className={head}>
                Shade
              </th>
              {!compact && (
                <th scope="col" className={head}>
                  Primary Unit
                </th>
              )}
              <th scope="col" className={head}>
                Status
              </th>
              {!compact && (
                <th scope="col" className={head}>
                  Valid From
                </th>
              )}
              {!compact && (
                <th scope="col" className={head}>
                  Valid To
                </th>
              )}
              {!compact && (
                <th scope="col" className={head}>
                  Updated At
                </th>
              )}
              <th scope="col" className={cn(head, "text-right")}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className="hover:bg-muted/40">
                <td
                  className={cn(
                    cell,
                    "sticky left-0 z-10 border-b border-r border-border bg-card font-mono font-medium",
                  )}
                >
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:underline"
                    onClick={() => onAction("VIEW", i.id)}
                  >
                    {i.code}
                    {i.hasImage && (
                      <ImageIcon className="size-3 text-muted-foreground" aria-label="Has image" />
                    )}
                  </button>
                </td>
                <td className={cn(cell, "max-w-64 truncate border-b border-border font-medium")}>
                  {i.productName}
                </td>
                <td className={cn(cell, "border-b border-border")}>{i.productType || "—"}</td>
                <td className={cn(cell, "border-b border-border")}>{i.category || "—"}</td>
                {!compact && (
                  <td className={cn(cell, "border-b border-border")}>{i.brand || "—"}</td>
                )}
                <td className={cn(cell, "border-b border-border")}>{i.shade || "—"}</td>
                {!compact && (
                  <td className={cn(cell, "border-b border-border")}>{i.primaryUnit || "—"}</td>
                )}
                <td className={cn(cell, "border-b border-border")}>
                  <StatusBadges item={i} />
                </td>
                {!compact && (
                  <td className={cn(cell, "border-b border-border")}>{formatDate(i.validFrom)}</td>
                )}
                {!compact && (
                  <td className={cn(cell, "border-b border-border")}>
                    {i.validTo ? formatDate(i.validTo) : "Open"}
                  </td>
                )}
                {!compact && (
                  <td className={cn(cell, "border-b border-border text-muted-foreground")}>
                    {formatUpdated(i.updatedAt)}
                  </td>
                )}
                <td className={cn(cell, "border-b border-border py-0.5")}>{actions(i)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-muted-foreground">
                  No items match
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((i) => (
          <li key={i.id} className="rounded-md border border-border bg-card p-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => onAction("VIEW", i.id)}
              >
                <span className="block font-mono text-[0.6875rem] text-muted-foreground">
                  {i.code}
                </span>
                <span className="block truncate text-sm font-medium">{i.productName}</span>
              </button>
              <StatusBadges item={i} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd>{i.productType || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Category</dt>
                <dd>{i.category || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Shade</dt>
                <dd>{i.shade || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Unit</dt>
                <dd>{i.primaryUnit || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Valid</dt>
                <dd>
                  {formatDate(i.validFrom)} → {i.validTo ? formatDate(i.validTo) : "Open"}
                </dd>
              </div>
            </dl>
            <div className="mt-2 border-t border-border pt-1">{actions(i, true)}</div>
          </li>
        ))}
        {!loading && rows.length === 0 && (
          <li className="py-6 text-center text-xs text-muted-foreground">No items match</li>
        )}
      </ul>
    </div>
  );
}
