import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requireAuth } from "@/lib/route-guards";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmt } from "@/lib/costing";

export const Route = createFileRoute("/approvals")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Approvals — SCKT ERP" },
      {
        name: "description",
        content:
          "Approve or reject submitted fabric cost sheets and keep a one-click answer to who authorised each price.",
      },
      { property: "og:title", content: "Approvals — SCKT ERP" },
      {
        property: "og:description",
        content: "Cost sheet approval queue with full approver attribution.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Approvals,
});

function Approvals() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["approvals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cost_sheets")
        .select("id,sheet_no,design_no,party_name,status,final_cost,updated_at")
        .in("status", ["draft", "pending"])
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const setStatus = async (id: string, status: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("cost_sheets")
      .update({
        status,
        approved_by: status === "approved" ? (u.user?.id ?? null) : null,
        approved_at: status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_log").insert({
      entity: "cost_sheet",
      entity_id: id,
      action: `status:${status}`,
      actor_id: u.user?.id ?? null,
      actor_name: u.user?.email ?? null,
    });
    toast.success(`Marked ${status}`);
    qc.invalidateQueries({ queryKey: ["approvals"] });
  };

  return (
    <AppShell title="Approvals" breadcrumb={[{ label: "Approvals" }]}>
      <Card className="gap-0 rounded-sm py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="h-8">Sheet</TableHead>
                <TableHead className="h-8">Design</TableHead>
                <TableHead className="h-8">Party</TableHead>
                <TableHead className="h-8">Status</TableHead>
                <TableHead className="h-8 text-right">Final cost</TableHead>
                <TableHead className="h-8 text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
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
                  <TableCell className="py-1.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[0.6875rem]"
                        onClick={() => setStatus(s.id, "rejected")}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 px-2 text-[0.6875rem]"
                        onClick={() => setStatus(s.id, "approved")}
                      >
                        Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!data.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nothing awaiting a decision.
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
