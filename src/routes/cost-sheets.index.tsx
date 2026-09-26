import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Search,
  Eye,
  Copy,
  Sparkles,
  Loader2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtCurr, computeCostSheet } from "@/lib/costing";
import { useCostSheetsList, useDuplicateCostSheet } from "@/hooks/useCostSheets";

export const Route = createFileRoute("/cost-sheets/")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Cost Sheets — SCKT ERP" },
      {
        name: "description",
        content:
          "Browse, filter and open fabric cost sheets with warp, weft, wastage, process and card costs frozen per version.",
      },
      { property: "og:title", content: "Cost Sheets — WeaveOne" },
      {
        property: "og:description",
        content: "Every fabric costing, versioned and attributable, in one register.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CostSheetList,
});

function CostSheetList() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: costSheets = [], isLoading } = useCostSheetsList();
  const { mutate: duplicateSheet } = useDuplicateCostSheet();

  const filteredSheets = costSheets.filter((cs) => {
    const queryMatch =
      !q.trim() ||
      cs.header.sheet_no.toLowerCase().includes(q.toLowerCase()) ||
      (cs.header.design_no && cs.header.design_no.toLowerCase().includes(q.toLowerCase())) ||
      (cs.header.party_name && cs.header.party_name.toLowerCase().includes(q.toLowerCase())) ||
      (cs.header.quality && cs.header.quality.toLowerCase().includes(q.toLowerCase()));

    const statusMatch = statusFilter === "all" || cs.header.status === statusFilter;

    return queryMatch && statusMatch;
  });

  const handleDuplicate = (id: string, sheetNo: string) => {
    duplicateSheet(
      { originalId: id, newSheetNo: `${sheetNo}-DUP` },
      {
        onSuccess: (dup) => {
          navigate({ to: "/cost-sheets/$id", params: { id: dup.header.id } });
        },
      },
    );
  };

  return (
    <AppShell
      title="Fabric Cost Sheets"
      breadcrumb={[{ label: "Cost Sheets" }]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="h-7 gap-1 text-xs">
            <Link to="/cost-sheets/new">
              <Plus className="size-3.5" /> New Cost Sheet
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading cost sheets...</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Search & Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search sheet no, design no, party name, quality..."
                  className="pl-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Status Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>

                <Badge variant="secondary" className="text-xs">
                  {filteredSheets.length} Cost Sheets
                </Badge>
              </div>
            </div>

            {/* Cost Sheets Table */}
            <Card className="rounded-md border border-border">
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead className="h-8 font-semibold">Sheet No.</TableHead>
                      <TableHead className="h-8 font-semibold">Design No.</TableHead>
                      <TableHead className="h-8 font-semibold">Party / Customer</TableHead>
                      <TableHead className="h-8 font-semibold">Quality / Fabric</TableHead>
                      <TableHead className="h-8 font-semibold text-center">Version</TableHead>
                      <TableHead className="h-8 font-semibold">Status</TableHead>
                      <TableHead className="h-8 font-semibold text-right">
                        Selling Rate / Cost
                      </TableHead>
                      <TableHead className="h-8 text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSheets.map((cs) => {
                      const totals = computeCostSheet({
                        lines: cs.lines,
                        charges: cs.charges,
                        wastage_pct: cs.header.wastage_pct,
                        card_rate: cs.header.card_rate,
                        number_of_cards: cs.header.number_of_cards,
                        kg_divisor: cs.header.kg_divisor,
                        card_divisor: cs.header.card_divisor,
                      });

                      return (
                        <TableRow key={cs.header.id} className="hover:bg-muted/40">
                          <TableCell className="py-2 font-mono font-bold text-primary">
                            <Link
                              to="/cost-sheets/$id"
                              params={{ id: cs.header.id }}
                              className="hover:underline"
                            >
                              {cs.header.sheet_no}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2 font-mono font-semibold text-foreground">
                            {cs.header.design_no || "—"}
                          </TableCell>
                          <TableCell className="py-2">{cs.header.party_name || "—"}</TableCell>
                          <TableCell className="py-2 font-medium">{cs.header.quality || "—"}</TableCell>
                          <TableCell className="py-2 text-center font-mono font-bold">
                            v{cs.header.version}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant={cs.header.status === "approved" ? "default" : "outline"}
                              className={`text-[0.625rem] capitalize ${
                                cs.header.status === "approved"
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : ""
                              }`}
                            >
                              {cs.header.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-right font-mono font-extrabold text-foreground text-sm">
                            {fmtCurr(totals.saleRate)}
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-foreground"
                                title="View / Edit"
                              >
                                <Link to="/cost-sheets/$id" params={{ id: cs.header.id }}>
                                  <Eye className="size-3.5" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleDuplicate(cs.header.id, cs.header.sheet_no)}
                                title="Duplicate"
                              >
                                <Copy className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filteredSheets.length && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                          <Sparkles className="mx-auto size-8 text-muted-foreground/30 mb-2" />
                          <p className="text-xs font-semibold">No cost sheets match this query.</p>
                          <p className="text-[0.6875rem] text-muted-foreground mt-0.5">
                            Try clearing search filters or create a new cost sheet.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
