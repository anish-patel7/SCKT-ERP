import type { ReactNode } from "react";
import {
  ArrowLeft,
  Copy,
  FilePlus2,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Printer,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ItemSession } from "@/features/item-master/hooks/use-item-editor";
import type {
  ItemMasterLookups,
  ItemValidationErrors,
} from "@/features/item-master/types/item-master";
import { tabOfError } from "@/features/item-master/utils/item-model";
import { ITEM_TABS, type ItemTabId } from "@/features/item-master/config/item-tabs";
import { cn } from "@/lib/utils";

export type WorkspaceAction =
  | "back"
  | "clone"
  | "new"
  | "edit"
  | "saveDraft"
  | "save"
  | "cancel"
  | "find"
  | "print"
  | "attachments"
  | "image"
  | "deleteDraft";

const MODE_LABEL = { VIEW: "View", NEW: "New", EDIT: "Edit", CLONE: "Clone (new draft)" } as const;

export function ItemWorkspace({
  session,
  lookups,
  errors,
  dirty,
  saving,
  tab,
  onTabChange,
  onAction,
  allowed,
  children,
}: {
  session: ItemSession;
  lookups: ItemMasterLookups;
  errors: ItemValidationErrors;
  dirty: boolean;
  saving: boolean;
  tab: ItemTabId;
  onTabChange: (tab: ItemTabId) => void;
  onAction: (action: WorkspaceAction) => void;
  allowed: Partial<Record<WorkspaceAction, boolean>>;
  /** Tab panels keyed by tab id. */
  children: Record<ItemTabId, ReactNode>;
}) {
  const { mode, record, input } = session;
  const editing = mode !== "VIEW";
  const productType = lookups.productTypes.find((t) => t.id === input.basic.productTypeId)?.name;
  const productStatus = lookups.productStatuses.find(
    (s) => s.id === input.status.productStatusId,
  )?.name;
  const errorCount = (id: ItemTabId) =>
    Object.keys(errors).filter((p) => tabOfError(p) === id).length;

  const btn = (
    action: WorkspaceAction,
    label: string,
    icon: ReactNode,
    variant: "default" | "outline" | "ghost" = "outline",
    className?: string,
  ) =>
    allowed[action] ? (
      <Button
        type="button"
        size="sm"
        variant={variant}
        className={cn("h-9 gap-1 text-xs", className)}
        disabled={saving}
        onClick={() => onAction(action)}
      >
        {icon} {label}
      </Button>
    ) : null;

  const secondary: [WorkspaceAction, string, ReactNode][] = [
    ["new", "New", <FilePlus2 key="i" className="size-3.5" />],
    ["clone", "Clone", <Copy key="i" className="size-3.5" />],
    ["find", "Find", <Search key="i" className="size-3.5" />],
    ["print", "Print", <Printer key="i" className="size-3.5" />],
    [
      "attachments",
      `Attachments (${input.attachments.length})`,
      <Paperclip key="i" className="size-3.5" />,
    ],
    ["image", "Image", <ImageIcon key="i" className="size-3.5" />],
    ["deleteDraft", "Delete Draft", <Trash2 key="i" className="size-3.5" />],
  ];

  return (
    <div className="space-y-3 pb-2">
      <header className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-fit gap-1 px-2 text-xs"
          onClick={() => onAction("back")}
        >
          <ArrowLeft className="size-3.5" /> Register
        </Button>
        <button
          type="button"
          onClick={() => onAction("image")}
          className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40"
          aria-label={input.image ? "Item image (open)" : "No item image (open image panel)"}
        >
          {input.image ? (
            <img src={input.image.url} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.6875rem] text-muted-foreground">
            {record && mode !== "CLONE" ? record.code : "New item — code assigned on save"}
          </p>
          <h2 className="truncate text-base font-semibold">
            {input.basic.productName || "Untitled item"}
          </h2>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant={editing ? "default" : "secondary"}>{MODE_LABEL[mode]}</Badge>
            {record?.recordStatus === "DRAFT" && mode !== "CLONE" && (
              <Badge
                variant="outline"
                className="border-amber-400 text-amber-700 dark:text-amber-300"
              >
                Draft
              </Badge>
            )}
            {productType && <Badge variant="outline">{productType}</Badge>}
            {productStatus && <Badge variant="outline">Status: {productStatus}</Badge>}
            {dirty && (
              <Badge variant="outline" className="border-destructive/60 text-destructive">
                Unsaved changes
              </Badge>
            )}
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => onTabChange(v as ItemTabId)}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1">
            {ITEM_TABS.map((t) => {
              const n = errorCount(t.id);
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
                >
                  {t.label}
                  {n > 0 && (
                    <span className="rounded-full bg-destructive px-1.5 text-[0.625rem] text-destructive-foreground">
                      {n}
                      <span className="sr-only"> errors</span>
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        {ITEM_TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-2">
            {children[t.id]}
          </TabsContent>
        ))}
      </Tabs>

      <div
        role="toolbar"
        aria-label="Item actions"
        className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-4 py-2 backdrop-blur"
      >
        <div className="hidden flex-wrap gap-2 lg:flex">
          {secondary.map(([a, label, icon]) => (
            <span key={a} className="contents">
              {btn(
                a,
                label,
                icon,
                a === "deleteDraft" ? "ghost" : "outline",
                a === "deleteDraft" ? "text-destructive" : undefined,
              )}
            </span>
          ))}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1 text-xs lg:hidden"
            >
              <MoreHorizontal className="size-3.5" /> More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {secondary
              .filter(([a]) => allowed[a])
              .map(([a, label, icon]) => (
                <DropdownMenuItem
                  key={a}
                  disabled={saving}
                  onSelect={() => onAction(a)}
                  className={cn("gap-2 text-sm", a === "deleteDraft" && "text-destructive")}
                >
                  {icon} {label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {btn("cancel", editing ? "Cancel" : "Close", <X className="size-3.5" />, "ghost")}
          {btn("edit", "Edit", <Pencil className="size-3.5" />, "default")}
          {btn(
            "saveDraft",
            "Save Draft",
            saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />,
          )}
          {btn(
            "save",
            "Save",
            saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />,
            "default",
          )}
        </div>
      </div>
    </div>
  );
}
