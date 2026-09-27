import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { RegisterColumn } from "@/features/production/components/production-register";
import { TraceabilityPanel } from "@/features/production/components/traceability-panel";
import { formatDate, formatNumber } from "@/lib/erp/formatting";
import { Undo2 } from "lucide-react";

function cell<T>(column: RegisterColumn<T>, row: T): ReactNode {
  if (column.render) return column.render(row);
  const raw = column.value(row);
  if (raw === null || raw === "") return "—";
  const kind = column.kind ?? "text";
  if (kind === "date") return formatDate(String(raw));
  if (kind === "text") return String(raw);
  return formatNumber(Number(raw), kind);
}

/** Read-only view of a posted document with its traceability chain. */
export function RecordViewDialog<T>({
  row,
  title,
  columns,
  jobOrderId,
  onClose,
  children,
}: {
  row: T | null;
  title: (row: T) => string;
  columns: RegisterColumn<T>[];
  jobOrderId?: (row: T) => string | null;
  onClose: () => void;
  children?: (row: T) => ReactNode;
}) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {row !== null && (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono">{title(row)}</DialogTitle>
              <DialogDescription className="text-xs">
                Posted demo document. Posted documents are not edited or deleted; corrections will
                be a controlled reversal handled by the backend.
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              {columns.map((c) => (
                <div key={c.id} className="min-w-0 border-b border-border/60 pb-1">
                  <dt className="text-[0.6875rem] text-muted-foreground">{c.header}</dt>
                  <dd className="truncate">{cell(c, row)}</dd>
                </div>
              ))}
            </dl>
            {children?.(row)}
            {jobOrderId && <TraceabilityPanel jobOrderId={jobOrderId(row)} defaultOpen />}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Reversal of posted documents will be a controlled backend action"
                className="gap-1"
              >
                <Undo2 className="size-3.5" /> Reverse — Future Backend Action
              </Button>
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
