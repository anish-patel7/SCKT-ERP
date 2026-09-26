import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/system/audit")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Audit History — SCKT ERP" },
      {
        name: "description",
        content:
          "Complete audit trail of cost sheet creation, edits, approvals and master data changes with actor and timestamp.",
      },
      { property: "og:title", content: "Audit History — SCKT ERP" },
      { property: "og:description", content: "Who changed what, and when — defensibly recorded." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { data: entries, isLoading, error, refetch } = useAuditLog();
  const data = entries ?? [];

  return (
    <AppShell
      title="Audit History"
      breadcrumb={[{ label: "System", to: "/system" }, { label: "Audit History" }]}
    >
      <Card className="gap-0 rounded-sm py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="h-8 w-44">When</TableHead>
                <TableHead className="h-8 w-32">Entity</TableHead>
                <TableHead className="h-8 w-40">Action</TableHead>
                <TableHead className="h-8">Details</TableHead>
                <TableHead className="h-8 w-52">Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={5} className="space-y-2 py-8 text-center text-sm">
                    <p className="text-destructive">
                      Failed to load audit history: {error.message}
                    </p>
                    <Button size="sm" variant="outline" onClick={() => void refetch()}>
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="num py-1.5">
                    {new Date(a.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-1.5">{a.entity}</TableCell>
                  <TableCell className="py-1.5">{a.action}</TableCell>
                  <TableCell className="py-1.5">{a.details ?? "—"}</TableCell>
                  <TableCell className="py-1.5 text-muted-foreground">
                    {a.actor_name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && !error && !data.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No audit entries yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
