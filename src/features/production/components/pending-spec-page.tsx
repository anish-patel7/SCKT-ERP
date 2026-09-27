import { ClipboardList, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ProductionFeatureDefinition } from "@/features/production/config/production-features";

/** Route shell for screens whose fields have not been specified yet. No fields are invented. */
export function PendingSpecPage({ feature }: { feature: ProductionFeatureDefinition }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="h-8 gap-1" disabled>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1"
          disabled
          title="Available once the workflow is specified"
        >
          <Plus className="size-3.5" /> Add New
        </Button>
      </div>
      <Card className="border border-dashed border-border">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Workflow specification pending</h2>
          <p className="max-w-md text-xs text-muted-foreground">
            The fields, register columns and quantity rules for <strong>{feature.label}</strong>{" "}
            have not been supplied yet. This screen will be built once the screenshots /
            requirements are available.
          </p>
          <p className="font-mono text-[0.625rem] text-muted-foreground">
            future permission resource: {feature.futurePermissionResource}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
