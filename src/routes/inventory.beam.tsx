import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Layers, Search, Activity } from "lucide-react";
import { requireAuth } from "@/lib/route-guards";
import { Can } from "@/components/auth";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventoryItems, useInventoryBalances } from "@/hooks/useInventoryLedger";
import { InwardDialog, BatchInwardDialog, IssueDialog, HistoryTable, ReservationDialog } from "@/components/inventory";
import { fmt } from "@/lib/costing";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/inventory/beam")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Beam Store & Warping Register — SCKT ERP" },
      {
        name: "description",
        content:
          "Warp beam inventory tracking, warping register, on-loom management, depletion tracking, and set-wise planning.",
      },
      { property: "og:title", content: "Beam Store — SCKT ERP" },
      {
        property: "og:description",
        content: "Beam stock management with warping register and loom allocation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BeamStorePage,
});

function BeamStorePage() {
  const [search, setSearch] = useState("");
  const [openInward, setOpenInward] = useState(false);
  const [openBatchInward, setOpenBatchInward] = useState(false);
  const [openReservation, setOpenReservation] = useState(false);
  const [selectedItemData, setSelectedItemData] = useState<any>(null);

  // Queries
  const { data: items = [], isLoading: itemsLoading } = useInventoryItems({
    itemType: "beam",
    isActive: true,
  });
  const { data: balances = [] } = useInventoryBalances();

  // Analytics
  const beamBalances = balances.filter((b) => {
    const item = items.find((i) => i.id === b.item_id);
    return item?.item_type === "beam";
  });

  const totalBeamsInStock = items.filter((item) => item.item_type === "beam").length;
  const totalBeamLength = beamBalances.reduce((sum, b) => sum + b.available_qty, 0);

  const filteredBeams = items.filter((item) => {
    if (item.item_type !== "beam") return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (item.item_code?.toLowerCase().includes(q)) ||
      (item.item_name?.toLowerCase().includes(q)) ||
      (item.current_location?.toLowerCase().includes(q)) ||
      (item.set_no?.toLowerCase().includes(q))
    );
  });

  const handleOpenReservation = (item: any, availableQty: number) => {
    setSelectedItemData({ ...item, availableQty });
    setOpenReservation(true);
  };

  return (
    <AppShell
      title="Beam Store & Warping Register (M30)"
      breadcrumb={[{ label: "Inventory" }, { label: "Beam Store" }]}
      actions={
        <Can permission="inventory:write">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setOpenInward(true)} className="h-7 gap-1 text-xs">
              <Plus className="size-3.5" /> Single Beam
            </Button>
            <Button size="sm" onClick={() => setOpenBatchInward(true)} className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700">
              <Layers className="size-3.5" /> Batch Entry
            </Button>
          </div>
        </Can>
      }
    >
      <div className="space-y-4">
        {/* KPI Summary Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>In-Store Beams</span>
                <Layers className="size-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-emerald-600">
                {totalBeamsInStock} Items
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">Active inventory</span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Beam Length</span>
                <Activity className="size-4 text-blue-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-blue-600">
                {fmt(totalBeamLength, 0)} m
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">Linear metres available</span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Value</span>
                <span className="font-semibold text-emerald-600">INR ₹</span>
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                ₹{fmt(
                  beamBalances.reduce((sum, b) => sum + b.total_cost, 0),
                  2,
                )}
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">Stock valuation</span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Avg Cost per Beam</span>
                <span className="font-semibold text-amber-600">₹</span>
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-amber-600">
                ₹
                {fmt(
                  beamBalances.length > 0
                    ? beamBalances.reduce((sum, b) => sum + b.total_cost, 0) / totalBeamsInStock
                    : 0,
                  0,
                )}
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">Per beam average</span>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Beam Inventory & History */}
        <Tabs defaultValue="stock" className="w-full">
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="stock" className="h-7 text-xs gap-1">
              <Layers className="size-3.5" /> Beam Inventory
            </TabsTrigger>
            <TabsTrigger value="history" className="h-7 text-xs gap-1">
              <Activity className="size-3.5" /> Transaction History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="space-y-3 mt-3">
            {/* Search Filter Bar */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by Code, Name, Set #, Location..."
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            {/* Beam Stock Table */}
            <Card className="rounded-md border border-border">
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                      <TableHead className="h-8">Beam Code</TableHead>
                      <TableHead className="h-8">Beam Details</TableHead>
                      <TableHead className="h-8">Set / Design</TableHead>
                      <TableHead className="h-8">Location</TableHead>
                      <TableHead className="h-8 text-right">Length (m)</TableHead>
                      <TableHead className="h-8 text-right">Rate (₹/m)</TableHead>
                      <TableHead className="h-8 text-right">Value (₹)</TableHead>
                      <TableHead className="h-8 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          Loading beams...
                        </TableCell>
                      </TableRow>
                    ) : filteredBeams.length > 0 ? (
                      filteredBeams.map((item) => {
                        const balance = balances.find((b) => b.item_id === item.id);
                        const availableLength = balance?.available_qty || 0;
                        const value = balance?.total_cost || 0;
                        return (
                          <TableRow key={item.id} className="hover:bg-muted/40">
                            <TableCell className="py-2 font-mono font-bold text-primary">
                              {item.item_code}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="font-semibold text-foreground">{item.item_name}</div>
                              {item.beam_no && (
                                <div className="text-[0.6875rem] text-muted-foreground">
                                  Beam #{item.beam_no}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-2 font-mono text-[0.6875rem]">
                              {item.set_no || "-"}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className="font-mono text-[0.625rem] bg-muted/30"
                              >
                                {item.current_location || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-right font-mono font-bold">
                              {fmt(availableLength, 1)} m
                            </TableCell>
                            <TableCell className="py-2 text-right font-mono">
                              ₹{fmt(item.rate_per_unit || 0, 2)}
                            </TableCell>
                            <TableCell className="py-2 text-right font-mono font-bold text-foreground">
                              ₹{fmt(value, 2)}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Can permission="inventory:write">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenReservation(item, availableLength)}
                                  className="h-6 text-[0.6875rem] gap-1 px-2"
                                >
                                  <ArrowDownRight className="size-3" /> Reserve
                                </Button>
                              </Can>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          {search ? "No beams match the search." : "No beams found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Content */}
          <TabsContent value="history" className="space-y-3 mt-3">
            <HistoryTable limit={100} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <InwardDialog
        isOpen={openInward}
        onClose={() => setOpenInward(false)}
        itemType="beam"
        onSuccess={() => {
          setOpenInward(false);
        }}
      />

      <BatchInwardDialog
        isOpen={openBatchInward}
        onClose={() => setOpenBatchInward(false)}
        itemType="beam"
        onSuccess={() => {
          setOpenBatchInward(false);
        }}
      />

      {selectedItemData && (
        <ReservationDialog
          open={openReservation}
          onOpenChange={setOpenReservation}
          itemId={selectedItemData.id}
          itemCode={selectedItemData.item_code}
          itemName={selectedItemData.item_name}
          availableQty={selectedItemData.availableQty}
          unit={selectedItemData.total_unit || "m"}
        />
      )}
    </AppShell>
  );
}
