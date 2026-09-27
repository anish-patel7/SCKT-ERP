import { useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FilePlus2, FlaskConical, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  itemMasterKeys,
  useDeleteItemDraft,
  useItemList,
  useItemLookups,
  useItemMasterAccess,
  useSaveItem,
} from "@/features/item-master/hooks/use-item-master";
import { useItemEditor } from "@/features/item-master/hooks/use-item-editor";
import { getItemMasterService } from "@/features/item-master/services";
import { ItemValidationError } from "@/features/item-master/services/item-master-service";
import type { ItemMode } from "@/features/item-master/types/item-master";
import {
  cloneItemInput,
  emptyItemInput,
  tabOfError,
  toInput,
  validateItem,
} from "@/features/item-master/utils/item-model";
import { printItem } from "@/features/item-master/utils/item-print";
import type { ItemTabId } from "@/features/item-master/config/item-tabs";
import { ItemBrowser, type ItemAction } from "@/features/item-master/components/item-browser";
import {
  ItemWorkspace,
  type WorkspaceAction,
} from "@/features/item-master/components/item-workspace";
import { ItemBasicTab } from "@/features/item-master/components/item-basic-tab";
import { ItemWeftTab } from "@/features/item-master/components/item-weft-tab";
import { ItemWarpTab } from "@/features/item-master/components/item-warp-tab";
import { ItemSetupTab } from "@/features/item-master/components/item-setup-tab";
import { ItemStatusTab } from "@/features/item-master/components/item-status-tab";
import {
  ItemAttachmentsDialog,
  ItemImageDialog,
} from "@/features/item-master/components/item-media-dialogs";

/** Row of the pre-existing generic Masters list for type "item" (shown read-only). */
export type LegacyItemRow = { id: string; code: string; name: string; description?: string | null };

const DISCARD = "Discard unsaved changes to this item?";

function PrototypeBanner({ mode }: { mode: "demo" | "unavailable" }) {
  if (mode === "unavailable") {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      >
        <Unplug className="mt-0.5 size-4 shrink-0" />
        <p>
          The new Item Master is not connected to the database yet. It is available in frontend
          prototype mode only; entries are disabled here.
        </p>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-semibold">Frontend prototype mode.</span> Items are sample data kept
        in this browser tab only. Nothing is saved to the database; reloading restores the samples.
      </p>
    </div>
  );
}

export function ItemMasterView({ legacyRows }: { legacyRows: LegacyItemRow[] }) {
  const qc = useQueryClient();
  const access = useItemMasterAccess();
  const { data: lookups } = useItemLookups();
  const list = useItemList();
  const editor = useItemEditor();
  const saveItem = useSaveItem();
  const deleteDraft = useDeleteItemDraft();
  const [tab, setTab] = useState<ItemTabId>("basic");
  const [dialog, setDialog] = useState<null | "image" | "attachments" | "find">(null);
  const { session, dirty } = editor;

  useBlocker({
    shouldBlockFn: () => dirty && !confirm(DISCARD),
    enableBeforeUnload: () => dirty,
  });
  const guard = () => !dirty || confirm(DISCARD);

  const openItem = async (action: ItemAction, id: string) => {
    if (!guard()) return;
    try {
      const record = await qc.fetchQuery({
        queryKey: itemMasterKeys.item(id),
        queryFn: () => getItemMasterService().getItem(id),
      });
      if (!record) throw new Error("Item not found");
      if (action === "CLONE") {
        editor.start("CLONE", cloneItemInput(toInput(record)), null);
        toast.info(`Cloned ${record.code} into a new draft — review the product name`);
      } else {
        editor.start(action, toInput(record), record);
      }
      setTab("basic");
      setDialog(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the item");
    }
  };

  const startNew = () => {
    if (!guard()) return;
    editor.start("NEW", emptyItemInput(), null);
    setTab("basic");
  };

  const persist = async (asDraft: boolean) => {
    if (!session) return;
    const level = asDraft ? "draft" : "save";
    const errs = validateItem(session.input, level);
    const first = Object.keys(errs)[0];
    editor.showErrors(level);
    if (first) {
      setTab(tabOfError(first));
      toast.error(`Check ${Object.keys(errs).length} field(s) before saving`);
      return;
    }
    try {
      const record = await saveItem.mutateAsync({
        input: session.input,
        id: session.record?.id,
        asDraft,
      });
      const next: ItemMode = asDraft ? "EDIT" : "VIEW";
      editor.start(next, toInput(record), record);
      toast.success(
        asDraft
          ? `Draft saved in frontend prototype (${record.code})`
          : `${record.code} saved in frontend prototype — not in the database`,
      );
    } catch (e) {
      if (e instanceof ItemValidationError) {
        const p = Object.keys(e.errors)[0];
        if (p) setTab(tabOfError(p));
      }
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };

  const onWorkspaceAction = (action: WorkspaceAction) => {
    if (!session || !lookups) return;
    const { record, input, mode } = session;
    switch (action) {
      case "back":
        if (guard()) editor.close();
        return;
      case "new":
        startNew();
        return;
      case "clone":
        if (record) void openItem("CLONE", record.id);
        return;
      case "edit":
        editor.setMode("EDIT");
        return;
      case "saveDraft":
        void persist(true);
        return;
      case "save":
        void persist(false);
        return;
      case "cancel":
        if (!guard()) return;
        if (mode === "EDIT" && record) editor.start("VIEW", toInput(record), record);
        else editor.close();
        return;
      case "find":
        setDialog("find");
        return;
      case "print":
        if (!printItem(record && mode !== "CLONE" ? record.code : "New item", input, lookups)) {
          toast.error("Allow pop-ups to print");
        }
        return;
      case "attachments":
      case "image":
        setDialog(action);
        return;
      case "deleteDraft":
        if (!record || !confirm(`Delete draft ${record.code}? This cannot be undone.`)) return;
        deleteDraft.mutate(record.id, {
          onSuccess: () => {
            editor.close();
            toast.success("Draft deleted from the frontend prototype");
          },
          onError: (e) => toast.error(e.message),
        });
        return;
    }
  };

  const items = list.data ?? [];
  const readOnly = !session || session.mode === "VIEW";
  const record = session?.record ?? null;
  const allowed: Partial<Record<WorkspaceAction, boolean>> = session
    ? {
        new: access.canCreate,
        clone: access.canCreate && !!record && session.mode !== "CLONE",
        edit: session.mode === "VIEW" && access.canUpdate,
        saveDraft: !readOnly && record?.recordStatus !== "SAVED",
        save: !readOnly,
        cancel: true,
        find: true,
        print: true,
        attachments: true,
        image: true,
        deleteDraft:
          access.mode === "demo" &&
          !!record &&
          session.mode !== "CLONE" &&
          record.recordStatus === "DRAFT" &&
          record.origin === "session",
      }
    : {};

  const findDialog = (
    <Dialog open={dialog === "find"} onOpenChange={(o) => !o && setDialog(null)}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find Item</DialogTitle>
          <DialogDescription>
            Search the Item Master and open an item to view or edit.
          </DialogDescription>
        </DialogHeader>
        <ItemBrowser
          items={items}
          productTypes={lookups?.productTypes ?? []}
          loading={list.isLoading}
          onAction={(a, id) => void openItem(a, id)}
          canEdit={access.canUpdate}
          canClone={access.canCreate}
          compact
          autoFocus
        />
      </DialogContent>
    </Dialog>
  );

  if (session && lookups) {
    const tabProps = {
      value: session.input,
      update: editor.update,
      readOnly,
      errors: editor.errors,
      lookups,
    };
    return (
      <div className="space-y-3">
        <PrototypeBanner mode={access.mode} />
        <ItemWorkspace
          session={session}
          lookups={lookups}
          errors={editor.errors}
          dirty={dirty}
          saving={saveItem.isPending || deleteDraft.isPending}
          tab={tab}
          onTabChange={setTab}
          onAction={onWorkspaceAction}
          allowed={allowed}
        >
          {{
            basic: <ItemBasicTab {...tabProps} />,
            weft: <ItemWeftTab {...tabProps} items={items} currentId={record?.id ?? null} />,
            warp: <ItemWarpTab {...tabProps} />,
            setup: <ItemSetupTab {...tabProps} />,
            status: <ItemStatusTab {...tabProps} />,
          }}
        </ItemWorkspace>
        <ItemImageDialog
          open={dialog === "image"}
          onOpenChange={(o) => !o && setDialog(null)}
          image={session.input.image}
          onChange={(image) =>
            editor.update((d) => {
              d.image = image;
            })
          }
          readOnly={readOnly}
        />
        <ItemAttachmentsDialog
          open={dialog === "attachments"}
          onOpenChange={(o) => !o && setDialog(null)}
          attachments={session.input.attachments}
          onChange={(attachments) =>
            editor.update((d) => {
              d.attachments = attachments;
            })
          }
          readOnly={readOnly}
        />
        {findDialog}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PrototypeBanner mode={access.mode} />
      <section className="space-y-2 rounded-md border border-border bg-card p-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Item Register</h2>
            <p className="text-[0.6875rem] text-muted-foreground">
              Products with their weft / warp BOM, setup and status configuration
            </p>
          </div>
          {access.canCreate && (
            <Button size="sm" className="h-9 gap-1 text-xs" onClick={startNew}>
              <FilePlus2 className="size-3.5" /> New Item
            </Button>
          )}
        </header>
        <ItemBrowser
          items={items}
          productTypes={lookups?.productTypes ?? []}
          loading={list.isLoading}
          onAction={(a, id) => void openItem(a, id)}
          canEdit={access.canUpdate}
          canClone={access.canCreate}
        />
      </section>

      {legacyRows.length > 0 && (
        <Collapsible className="rounded-md border border-border bg-card">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold">
            <span>
              Existing item list ({legacyRows.length}) — read-only
              <span className="block font-normal text-muted-foreground">
                From the current Masters table; to be migrated into the new Item Master in the
                backend phase.
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="divide-y divide-border border-t border-border text-xs">
              {legacyRows.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3">
                  <span className="w-28 shrink-0 font-mono text-muted-foreground">{r.code}</span>
                  <span className="font-medium">{r.name}</span>
                  {r.description && (
                    <span className="text-muted-foreground sm:ml-auto">{r.description}</span>
                  )}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
