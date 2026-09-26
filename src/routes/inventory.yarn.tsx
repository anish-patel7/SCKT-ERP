import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Package,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Layers,
  Search,
  History,
} from "lucide-react";
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

export const Route = createFileRoute("/inventory/yarn")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Yarn Store — SCKT ERP" },
      {
        name: "description",
        content:
          "Perpetual lot-wise yarn inventory tracking, bin locations, valuation, reorder level alerts, and FIFO issues.",
      },
      { property: "og:title", content: "Yarn Store — SCKT ERP" },
      {
        property: "og:description",
        content: "Yarn stock management with negative stock prevention and FIFO issue guidance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: YarnStorePage,
});

function YarnStorePage() {
  const [search, setSearch] = useState("");
  const [openInward, setOpenInward] = useState(false);
  const [openBatchInward, setOpenBatchInward] = useState(false);
  const [openIssue, setOpenIssue] = useState(false);
  const [openReservation, setOpenReservation] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedItemData, setSelectedItemData] = useState<any>(null);

  // Queries
  const { data: items = [], isLoading: itemsLoading } = useInventoryItems({
    itemType: "yarn",
    isActive: true,
  });
  const { data: balances = [] } = useInventoryBalances();

  // Analytics
  const yarnBalances = balances.filter((b) => {
    const item = items.find((i) => i.id === b.item_id);
    return item?.item_type === "yarn";
  });

  const totalYarnKg = yarnBalances.reduce((sum, b) => sum + b.available_qty, 0);
  const totalValuation = yarnBalances.reduce((sum, b) => sum + b.total_cost, 0);
  const reorderAlertsCount = items.filter(
    (item) => item.item_type === "yarn" && (item.available_qty || 0) < 100,
  ).length;

  const filteredYarn = items.filter((item) => {
    if (item.item_type !== "yarn") return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (item.lot_no?.toLowerCase().includes(q)) ||
      (item.item_code?.toLowerCase().includes(q)) ||
      (item.item_name?.toLowerCase().includes(q)) ||
      (item.current_location?.toLowerCase().includes(q))
    );
  });

  const handleOpenIssue = (itemId: string) => {
    setSelectedItemId(itemId);
    setOpenIssue(true);
  };

  const handleOpenReservation = (item: any, availableQty: number) => {
    setSelectedItemData({ ...item, availableQty });
    setOpenReservation(true);
  };

  return (
    <AppShell
      title="Yarn Store & Inventory (M30)"
      breadcrumb={[{ label: "Inventory" }, { label: "Yarn Store" }]}
      actions={
        <Can permission="inventory:write">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setOpenInward(true)} className="h-7 gap-1 text-xs">
              <Plus className="size-3.5" /> Single Item
            </Button>
            <Button size="sm" onClick={() => setOpenBatchInward(true)} className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700">
              <Layers className="size-3.5" /> Batch Receipt
            </Button>
          </div>
        </Can>
      }
    >
      <div className="space-y-4">
        {/* Analytics Top Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Available Yarn Stock</span>
                <Package className="size-4 text-primary" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {fmt(totalYarnKg, 0)} kg
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Across {items.filter((i) => i.item_type === "yarn").length} items
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Stock Valuation (Weighted)</span>
                <span className="font-semibold text-emerald-600">INR ₹</span>
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                ₹{fmt(totalValuation, 2)}
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">Average Cost Valuation</span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Reorder Alerts</span>
                <AlertTriangle className="size-4 text-amber-500" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-amber-600">
                {reorderAlertsCount} Items
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Below 100 unit threshold
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Items in Stock</span>
                <History className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {items.filter((i) => i.item_type === "yarn").length}
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Active inventory master
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Perpetual Stock Table & Transaction History */}
        <Tabs defaultValue="stock" className="w-full">
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="stock" className="h-7 text-xs gap-1">
              <Layers className="size-3.5" /> Perpetual Stock
            </TabsTrigger>
            <TabsTrigger value="history" className="h-7 text-xs gap-1">
              <History className="size-3.5" /> Transaction History
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
                  placeholder="Search by Item Code, Name, Lot #, Location..."
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            {/* Yarn Stock Table */}
            <Card className="rounded-md border border-border">
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                      <TableHead className="h-8">Code</TableHead>
                      <TableHead className="h-8">Name & Details</TableHead>
                      <TableHead className="h-8">Lot / Ref</TableHead>
                      <TableHead className="h-8">Location</TableHead>
                      <TableHead className="h-8 text-right">Available (kg)</TableHead>
                      <TableHead className="h-8 text-right">Rate / kg</TableHead>
                      <TableHead className="h-8 text-right">Valuation (₹)</TableHead>
                      <TableHead className="h-8 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          Loading yarn items...
                        </TableCell>
                      </TableRow>
                    ) : filteredYarn.length > 0 ? (
                      filteredYarn.map((item) => {
                        const balance = balances.find((b) => b.item_id === item.id);
                        const availableQty = balance?.available_qty || 0;
                        const valuation = balance?.total_cost || 0;
                        const isLowStock = availableQty < 100;
                        return (
                          <TableRow key={item.id} className="hover:bg-muted/40">
                            <TableCell className="py-2 font-mono font-bold text-primary">
                              {item.item_code}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="font-semibold text-foreground">{item.item_name}</div>
                              {item.yarn_code && (
                                <div className="text-[0.6875rem] text-muted-foreground">
                                  {item.yarn_code}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-2 font-mono text-[0.6875rem]">
                              {item.lot_no || "-"}
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
                              {fmt(availableQty, 2)} kg
                              {isLowStock && (
                                <div className="text-[0.625rem] text-amber-600 font-normal">
                                  Low Stock
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right font-mono">
                              ₹{fmt(item.rate_per_unit || 0, 2)}
                            </TableCell>
                            <TableCell className="py-2 text-right font-mono font-bold text-foreground">
                              ₹{fmt(valuation, 2)}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Can permission="inventory:write">
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenReservation(item, availableQty)}
                                    className="h-6 text-[0.6875rem] gap-1 px-2"
                                  >
                                    <ArrowDownRight className="size-3" /> Reserve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenIssue(item.id)}
                                    className="h-6 text-[0.6875rem] gap-1 px-2"
                                  >
                                    <ArrowUpRight className="size-3" /> Issue
                                  </Button>
                                </div>
                              </Can>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          {search ? "No yarn items match the search." : "No yarn items found."}
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
        itemType="yarn"
        onSuccess={() => {
          setOpenInward(false);
        }}
      />

      <BatchInwardDialog
        isOpen={openBatchInward}
        onClose={() => setOpenBatchInward(false)}
        itemType="yarn"
        onSuccess={() => {
          setOpenBatchInward(false);
        }}
      />

      <IssueDialog
        isOpen={openIssue}
        onClose={() => {
          setOpenIssue(false);
          setSelectedItemId("");
        }}
        itemType="yarn"
        onSuccess={() => {
          setOpenIssue(false);
          setSelectedItemId("");
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
          unit={selectedItemData.total_unit || "kg"}
        />
      )}
    </AppShell>
  );
}
