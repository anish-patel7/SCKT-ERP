import type { ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
import { Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { DocumentForm } from "@/features/production/hooks/use-document-form";
import { useProductionMode } from "@/features/production/hooks/use-production";
import { cn } from "@/lib/utils";

const SIZES = {
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
  xl: "sm:max-w-6xl",
} as const;

/**
 * Entry form shell: document sections in a scrollable body and a fixed action footer
 * (Cancel · Save Draft · Save / Post Demo). Warns before closing or navigating away
 * with unsaved changes. There is no Delete for posted documents.
 */
export function ProductionFormDialog<V>({
  form,
  title,
  description,
  size = "lg",
  allowDraft = true,
  children,
}: {
  form: DocumentForm<V>;
  title: string;
  description?: string;
  size?: keyof typeof SIZES;
  allowDraft?: boolean;
  children: ReactNode;
}) {
  const mode = useProductionMode();
  useBlocker({
    shouldBlockFn: () =>
      form.isOpen && form.dirty && !confirm("Discard unsaved changes to this document?"),
    enableBeforeUnload: () => form.isOpen && form.dirty,
  });
  const disabled = form.saving || mode !== "demo";

  return (
    <Dialog open={form.isOpen} onOpenChange={(open) => !open && form.close()}>
      <DialogContent
        className={cn(
          "flex max-h-[100dvh] w-full max-w-full flex-col gap-0 p-0 sm:max-h-[92vh]",
          SIZES[size],
        )}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {title}
            <Badge variant="outline" className="text-[0.625rem]">
              {form.draftId ? "Editing draft" : "New"}
            </Badge>
            {form.dirty && (
              <Badge className="bg-amber-500 text-[0.625rem] text-black">Unsaved changes</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {description ??
              "Frontend demo entry. Validation here helps data entry; the backend will validate again."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">{children}</div>

        <DialogFooter className="flex-row flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 sm:space-x-0">
          {form.errors["form"] && (
            <p role="alert" className="mr-auto w-full text-xs text-destructive sm:w-auto">
              {form.errors["form"]}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => form.close()}
            disabled={form.saving}
          >
            Cancel
          </Button>
          {allowDraft && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              onClick={() => void form.saveDraft()}
              disabled={disabled}
            >
              <Save className="size-3.5" /> Save Draft
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="gap-1"
            onClick={() => void form.post()}
            disabled={disabled}
          >
            {form.saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Save / Post Demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
