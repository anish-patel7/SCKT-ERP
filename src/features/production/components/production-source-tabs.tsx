import { useState, type ReactNode } from "react";
import { useSearch } from "@tanstack/react-router";
import { Database, FlaskConical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProductionMode } from "@/features/production/hooks/use-production";

/**
 * One canonical screen, two clearly labelled data sources:
 * - "Workflow" — the consolidated legacy-ERP workflow on the frontend prototype adapter;
 * - "Database records" — the pre-existing live Supabase register, kept working unchanged
 *   until the backend phase merges both (BUSINESS RELATIONSHIP TO VALIDATE).
 * Opens on the database tab when asked (?source=database, used by the old URLs) or when
 * the prototype adapter is disabled.
 */
export function ProductionSourceTabs({
  liveLabel,
  liveNote,
  live,
  children,
}: {
  liveLabel: string;
  liveNote: ReactNode;
  live: ReactNode;
  children: ReactNode;
}) {
  const search = useSearch({ strict: false }) as { source?: unknown };
  const mode = useProductionMode();
  const [tab, setTab] = useState(
    search.source === "database" || mode !== "demo" ? "database" : "workflow",
  );
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1">
        <TabsList className="h-auto w-max">
          <TabsTrigger value="workflow" className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
            <FlaskConical className="size-3.5" /> Workflow (prototype)
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
            <Database className="size-3.5" /> {liveLabel} (database)
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="workflow" className="mt-0 space-y-3">
        {children}
      </TabsContent>
      <TabsContent value="database" className="mt-0 space-y-3">
        <p
          role="note"
          className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <Database className="mt-0.5 size-4 shrink-0" />
          <span>{liveNote}</span>
        </p>
        {live}
      </TabsContent>
    </Tabs>
  );
}
