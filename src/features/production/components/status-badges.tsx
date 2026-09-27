import { Badge } from "@/components/ui/badge";
import type { DocumentStatus, OperationalStatus } from "@/features/production/types/production";
import { cn } from "@/lib/utils";

const DOCUMENT: Record<DocumentStatus, string> = {
  DRAFT: "border-slate-400 text-slate-600 dark:text-slate-300",
  POSTED: "border-sky-500 text-sky-700 dark:text-sky-300",
  CANCELLED: "border-rose-500 text-rose-700 line-through dark:text-rose-300",
};

const OPERATIONAL: Record<OperationalStatus, string> = {
  Pending: "bg-amber-500 text-black",
  Close: "bg-emerald-600 text-white",
  Clear: "bg-slate-500 text-white",
};

/** Lifecycle of the document (DRAFT / POSTED / CANCELLED). */
export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant="outline" className={cn("text-[0.625rem] font-semibold", DOCUMENT[status])}>
      {status}
    </Badge>
  );
}

/** Business status of the quantity (Pending / Close / Clear); separate from the document status. */
export function OperationalStatusBadge({ status }: { status: OperationalStatus }) {
  return (
    <Badge className={cn("text-[0.625rem] font-semibold", OPERATIONAL[status])}>{status}</Badge>
  );
}
