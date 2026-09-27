import { useState } from "react";
import { ChevronRight, GitBranch, Loader2 } from "lucide-react";
import { useJobOrderTrace } from "@/features/production/hooks/use-production";
import { formatDate } from "@/lib/erp/formatting";
import { cn } from "@/lib/utils";

/** Collapsible Sales Order → … → Stock Conversion chain for one job order (demo data only). */
export function TraceabilityPanel({
  jobOrderId,
  defaultOpen = false,
}: {
  jobOrderId: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { data: stages, isLoading } = useJobOrderTrace(open ? jobOrderId : null);
  if (!jobOrderId) return null;
  return (
    <section className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/40"
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        <GitBranch className="size-3.5" />
        Traceability
      </button>
      {open && (
        <div className="border-t border-border p-3">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : !stages?.length ? (
            <p className="text-xs text-muted-foreground">No linked documents.</p>
          ) : (
            <ol className="flex flex-wrap items-start gap-x-1 gap-y-2 text-xs">
              {stages.map((stage, i) => (
                <li key={stage.stage} className="flex items-start gap-1">
                  {i > 0 && (
                    <ChevronRight className="mt-4 size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="rounded-md border border-border bg-muted/30 px-2 py-1">
                    <div className="text-[0.625rem] font-semibold uppercase text-muted-foreground">
                      {stage.stage}
                    </div>
                    <ul className="space-y-0.5">
                      {stage.documents.map((doc) => (
                        <li key={doc.id} className="whitespace-nowrap font-mono">
                          {doc.number}
                          <span className="ml-1 font-sans text-[0.625rem] text-muted-foreground">
                            {formatDate(doc.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-[0.625rem] text-muted-foreground">
            Frontend visualization of demo links only.
          </p>
        </div>
      )}
    </section>
  );
}
