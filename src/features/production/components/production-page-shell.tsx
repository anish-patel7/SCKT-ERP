import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  featureBreadcrumb,
  type ProductionFeatureDefinition,
} from "@/features/production/config/production-features";
import {
  useProductionMode,
  useResetProductionDemo,
} from "@/features/production/hooks/use-production";
import { FlaskConical, RotateCcw, Unplug } from "lucide-react";

/** Standard Production page: AppShell, registry breadcrumb and the demo-mode notice. */
export function ProductionPageShell({
  feature,
  children,
}: {
  feature: ProductionFeatureDefinition;
  children: ReactNode;
}) {
  return (
    <AppShell title={feature.label} breadcrumb={featureBreadcrumb(feature)}>
      <div className="space-y-3">
        {feature.status === "demo" && <ProductionModeBanner />}
        {children}
      </div>
    </AppShell>
  );
}

export function ProductionModeBanner() {
  const mode = useProductionMode();
  const reset = useResetProductionDemo();
  if (mode === "unavailable") {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      >
        <Unplug className="mt-0.5 size-4 shrink-0" />
        <p>
          Production transactions are not connected to the database yet. This screen is shown for
          review; entries are disabled until the backend is implemented.
        </p>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:flex-row sm:items-center dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <FlaskConical className="size-4 shrink-0" />
      <p className="flex-1">
        <span className="font-semibold">Frontend demo mode.</span> Documents, balances and stock
        shown here are sample data kept in this browser tab only. Nothing is saved to the database;
        reloading the page restores the samples.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 gap-1 border-amber-300 bg-transparent text-xs"
        onClick={() => {
          if (confirm("Discard all demo entries and restore the sample data?")) reset();
        }}
      >
        <RotateCcw className="size-3.5" /> Reset demo data
      </Button>
    </div>
  );
}
