import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmt } from "@/lib/costing";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "SCKT — Shree Chehar Krupa Textile" },
      {
        name: "description",
        content:
          "Dashboard for SCKT Shree Chehar Krupa Textile: fabric cost sheets, yarn rate masters, approvals and production readiness.",
      },
      { property: "og:title", content: "SCKT — Shree Chehar Krupa Textile" },
      {
        property: "og:description",
        content:
          "Cost sheets, yarn masters, approvals and loom-agnostic production data in one operational system of record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="gap-1 rounded-sm py-3">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="section-label">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="num text-xl font-semibold">{value}</p>
        {sub && <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [sheets, materials, masters] = await Promise.all([
        supabase
          .from("cost_sheets")
          .select("id,sheet_no,design_no,party_name,status,final_cost,updated_at")
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase.from("materials").select("id,rate_per_kg", { count: "exact" }),
        supabase.from("masters").select("id", { count: "exact", head: true }),
      ]);
      return {
        sheets: sheets.data ?? [],
        materialCount: materials.count ?? 0,
        avgRate:
          (materials.data ?? []).reduce((a, m) => a + Number(m.rate_per_kg), 0) /
          Math.max(1, materials.data?.length ?? 1),
        masterCount: masters.count ?? 0,
      };
    },
  });

  const pending = (data?.sheets ?? []).filter((s) => s.status === "pending").length;

  return (
    <AppShell
      title="Dashboard"
      actions={
        <Button asChild size="sm" className="h-7 text-xs">
          <Link to="/cost-sheets/new">New cost sheet</Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Cost sheets"
          value={String(data?.sheets.length ?? 0)}
          sub="Most recent activity"
        />
        <Kpi label="Pending approval" value={String(pending)} sub="Awaiting authorised approver" />
        <Kpi label="Yarn" value={String(data?.materialCount ?? 0)} sub="Single rate source" />
        <Kpi
          label="Avg yarn rate"
          value={`₹ ${fmt(data?.avgRate ?? 0)}`}
          sub="Across active material master"
        />
      </div>

      <Card className="mt-3 gap-0 rounded-sm py-0">
        <CardHeader className="flex-row items-center justify-between border-b px-4 py-2.5">
          <CardTitle className="text-sm">Recent cost sheets</CardTitle>
          <Link to="/cost-sheets" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="h-8">Sheet</TableHead>
                <TableHead className="h-8">Design</TableHead>
                <TableHead className="h-8">Party</TableHead>
                <TableHead className="h-8">Status</TableHead>
                <TableHead className="h-8 text-right">Final cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.sheets ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="py-1.5 font-medium">
                    <Link to="/cost-sheets/$id" params={{ id: s.id }} className="hover:underline">
                      {s.sheet_no}
                    </Link>
                  </TableCell>
                  <TableCell className="py-1.5">{s.design_no ?? "—"}</TableCell>
                  <TableCell className="py-1.5">{s.party_name ?? "—"}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="outline" className="text-[0.625rem] capitalize">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="num py-1.5 text-right">
                    {fmt(Number(s.final_cost))}
                  </TableCell>
                </TableRow>
              ))}
              {!data?.sheets.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    No cost sheets yet — create the first one.
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
