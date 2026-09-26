import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ModulePlaceholder({
  title,
  moduleId,
  phase,
  purpose,
  breadcrumb,
  features,
}: {
  title: string;
  moduleId: string;
  phase: number;
  purpose: string;
  breadcrumb: { label: string; to?: string }[];
  features: string[];
}) {
  return (
    <AppShell
      title={title}
      breadcrumb={breadcrumb}
      actions={
        <Badge variant="outline" className="text-[0.6875rem]">
          {moduleId} · Phase {phase}
        </Badge>
      }
    >
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2 gap-3 rounded-sm py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">Scope</CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            <p>{purpose}</p>
            <ul className="mt-3 space-y-1.5">
              {features.map((f) => (
                <li key={f} className="flex gap-2 border-b border-dashed pb-1.5 last:border-0">
                  <span className="text-primary">›</span>
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="gap-3 rounded-sm py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">Delivery status</CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            <p>
              This screen is scaffolded from the PRD and reserved for the Phase {phase} build. The
              data model extends the Phase 1 schema — no rebuild required.
            </p>
            <p className="mt-3 section-label">Depends on</p>
            <p className="text-foreground">Phase 1 masters, cost sheets and approvals.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
