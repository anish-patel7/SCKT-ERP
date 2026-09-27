import { FileClock, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useDeleteProductionDraft,
  usePostProductionDraft,
  useProductionDrafts,
} from "@/features/production/hooks/use-production";
import type {
  InputOf,
  ProductionDraft,
  ProductionKind,
} from "@/features/production/types/production";

/**
 * Unposted drafts of one document type. Drafts carry no quantity effect; they receive a
 * number only when posted. Posted documents are never deleted (reversal will be a backend action).
 */
export function DraftsPanel<K extends ProductionKind>({
  kind,
  describe,
  onEdit,
}: {
  kind: K;
  describe: (input: InputOf<K>) => string;
  onEdit: (draft: ProductionDraft<K>) => void;
}) {
  const { data: drafts } = useProductionDrafts(kind);
  const post = usePostProductionDraft(kind);
  const remove = useDeleteProductionDraft(kind);
  if (!drafts?.length) return null;
  return (
    <section
      aria-label="Drafts"
      className="rounded-md border border-dashed border-slate-400 bg-muted/30 p-3 text-xs"
    >
      <h3 className="mb-2 flex items-center gap-1 font-semibold">
        <FileClock className="size-3.5" /> Drafts ({drafts.length}) — not posted, no quantity effect
      </h3>
      <ul className="divide-y divide-border">
        {drafts.map((draft) => (
          <li key={draft.id} className="flex flex-wrap items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1 truncate">{describe(draft.input)}</span>
            <span className="text-muted-foreground">
              saved {new Date(draft.savedAt).toLocaleTimeString()}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => onEdit(draft)}
            >
              <Pencil className="size-3" /> Edit Draft
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={post.isPending}
              onClick={() => post.mutate(draft.id)}
            >
              <Send className="size-3" /> Post
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-destructive"
              onClick={() => {
                if (confirm("Delete this draft?")) remove.mutate(draft.id);
              }}
            >
              <Trash2 className="size-3" /> Delete Draft
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
