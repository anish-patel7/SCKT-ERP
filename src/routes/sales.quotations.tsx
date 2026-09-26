import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  FileText,
  CheckCircle2,
  ArrowRight,
  Search,
  Percent,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/route-guards";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuotations, useCreateQuotation } from "@/hooks/useSales";
import { useCostSheetsList } from "@/hooks/useCostSheets";
import { useParties } from "@/hooks/useParties";
import { computeCostSheet, fmt } from "@/lib/costing";
import { type QuoteStatus } from "@/lib/sales-store";

export const Route = createFileRoute("/sales/quotations")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Quotations — SCKT ERP" },
      {
        name: "description",
        content:
          "Quotation builder with margin visibility, cost sheet binding, approval validation, and 1-click sales order conversion.",
      },
      { property: "og:title", content: "Quotations — SCKT ERP" },
      { property: "og:description", content: "Quotation builder with exact margin visibility." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuotationsPage,
});

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  DRAFT: { label: "Draft", class: "bg-muted text-foreground" },
  SENT: { label: "Sent to Client", class: "bg-blue-600 text-white" },
  ACCEPTED: {
    label: "Approved",
    class: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold",
  },
  REJECTED: { label: "Rejected", class: "bg-rose-600 text-white" },
};

function QuotationsPage() {
  const { data: quotations = [] } = useQuotations();
  const { data: costSheets = [] } = useCostSheetsList();
  const { data: customers = [] } = useParties();
  const createQuotation = useCreateQuotation();

  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  // Form state
  const [form, setForm] = useState({
    customer_id: "",
    cost_sheet_id: "",
    qty_metre: "5000",
    quoted_rate: "175",
    valid_days: "30",
  });

  const approvedCostSheets = costSheets.filter((cs: any) => cs.header.status === "approved");

  const filteredQuotes = quotations.filter((q: any) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (
      q.quotation_no.toLowerCase().includes(s) ||
      q.customer_id.toLowerCase().includes(s)
    );
  });

  const handleOpenCreate = () => {
    setForm({
      customer_id: customers[0]?.id || "",
      cost_sheet_id: approvedCostSheets[0]?.header.id || costSheets[0]?.header.id || "",
      qty_metre: "5000",
      quoted_rate: "175",
      valid_days: "30",
    });
    setOpenCreate(true);
  };

  const handleCreateQuotation = async () => {
    const cust = customers.find((c: any) => c.id === form.customer_id);
    const cs = costSheets.find((c: any) => c.header.id === form.cost_sheet_id);

    if (!cust || !cs) {
      toast.error("Please select a valid customer and cost sheet");
      return;
    }

    // PRD Acceptance Criteria 1: Refuse quotation against un-approved cost sheets
    if (cs.header.status !== "approved") {
      toast.error(
        `Quotation Refused! Cost Sheet is in "${cs.header.status}" status. Approved cost sheets only.`,
      );
      return;
    }

    const qty = Number(form.qty_metre) || 0;
    const rate = Number(form.quoted_rate) || 175;
    const totalAmount = qty * rate;

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + (Number(form.valid_days) || 30));

    const quotationData = {
      quotation_no: `QT-${Math.floor(2603 + quotations.length)}`,
      customer_id: cust.id,
      quoted_date: new Date().toISOString().slice(0, 10),
      valid_till: validUntilDate.toISOString().slice(0, 10),
      subtotal_amount: totalAmount,
      discount_percent: 0,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: totalAmount,
      status: "ACCEPTED",
      remarks: `Cost Sheet: ${cs.header.sheet_no}`,
    };

    const items = [
      {
        line_number: 1,
        fabric_quality_name: cs.header.quality || "Fabric",
        qty_metre: qty,
        rate_per_metre: rate,
        line_total: totalAmount,
      },
    ];

    try {
      await createQuotation.mutateAsync({
        quotation: quotationData,
        items: items,
      });

      toast.success(`Quotation ${quotationData.quotation_no} created`);
      setOpenCreate(false);
      setForm({
        customer_id: "",
        cost_sheet_id: "",
        qty_metre: "5000",
        quoted_rate: "175",
        valid_days: "30",
      });
    } catch (error) {
      console.error("Create quotation error:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create quotation");
      }
    }
  };

  const handleConvertToOrder = (quote: any) => {
    toast.info("Sales order creation workflow — coming in next phase");
  };

  return (
    <AppShell
      title="Quotation Builder (M32)"
      breadcrumb={[{ label: "Sales" }, { label: "Quotations" }]}
      actions={
        <Button size="sm" onClick={handleOpenCreate} className="h-7 gap-1 text-xs">
          <Plus className="size-3.5" /> New Quotation
        </Button>
      }
    >
      <div className="space-y-4">
        {/* KPI Summary */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Quotations</span>
                <FileText className="size-4 text-primary" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {quotations.length}
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">Active quotations</span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Approved Quotes</span>
                <CheckCircle2 className="size-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-emerald-600">
                {quotations.filter((q: any) => q.status === "ACCEPTED").length} Approved
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Ready for sales order conversion
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Draft Quotes</span>
                <Percent className="size-4 text-amber-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {quotations.filter((q: any) => q.status === "DRAFT").length} Draft
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Pending approval
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Quoted Pipeline Value</span>
                <span className="font-bold text-foreground">INR</span>
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                ₹
                {fmt(
                  quotations.reduce((sum: number, q: any) => sum + (q.total_amount || 0), 0),
                  0,
                )}
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">Total pipeline value</span>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quotations by Quote #, Customer, Cost Sheet, Item..."
              className="pl-9 text-xs"
            />
          </div>
        </div>

        {/* Quotation Table */}
        <Card className="rounded-md border border-border">
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                  <TableHead className="h-8">Quote #</TableHead>
                  <TableHead className="h-8">Customer</TableHead>
                  <TableHead className="h-8">Quoted Date</TableHead>
                  <TableHead className="h-8 text-right">Subtotal (₹)</TableHead>
                  <TableHead className="h-8 text-right">Total Value (₹)</TableHead>
                  <TableHead className="h-8">Valid Until</TableHead>
                  <TableHead className="h-8">Status</TableHead>
                  <TableHead className="h-8 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((q: any) => {
                  const cust = customers.find((c: any) => c.id === q.customer_id);
                  const badge = STATUS_BADGES[q.status] || { label: q.status, class: "bg-muted" };
                  return (
                    <TableRow key={q.id} className="hover:bg-muted/40">
                      <TableCell className="py-2 font-mono font-bold text-primary">
                        {q.quotation_no}
                      </TableCell>
                      <TableCell className="py-2 font-semibold text-foreground">
                        {cust?.party_name || "—"}
                      </TableCell>
                      <TableCell className="py-2 font-mono text-muted-foreground">
                        {q.quoted_date}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono">
                        ₹{fmt(q.subtotal_amount || 0, 2)}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono font-bold text-foreground">
                        ₹{fmt(q.total_amount || 0, 2)}
                      </TableCell>
                      <TableCell className="py-2 font-mono text-muted-foreground">
                        {q.valid_till}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge className={`text-[0.625rem] ${badge.class}`}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        {q.status === "ACCEPTED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConvertToOrder(q)}
                            className="h-6 text-[0.6875rem] gap-1 px-2"
                          >
                            <ArrowRight className="size-3" /> Convert to SO
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!filteredQuotes.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No quotations found matching search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* New Quotation Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-md p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">New Quotation Builder</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Customer *</Label>
              <Select
                value={form.customer_id}
                onValueChange={(v) => setForm({ ...form, customer_id: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.party_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Cost Sheet Reference (Approved Only) *</Label>
              <Select
                value={form.cost_sheet_id}
                onValueChange={(v) => setForm({ ...form, cost_sheet_id: v })}
              >
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue placeholder="Select cost sheet" />
                </SelectTrigger>
                <SelectContent>
                  {costSheets.map((cs: any) => (
                    <SelectItem key={cs.header.id} value={cs.header.id} className="text-xs">
                      {cs.header.sheet_no} — {cs.header.quality} ({cs.header.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[0.625rem] text-muted-foreground flex items-center gap-1 mt-0.5">
                <AlertCircle className="size-3 text-amber-500" /> Approved cost sheets only
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Target Quantity (meters) *</Label>
                <Input
                  type="number"
                  className="h-8 text-xs font-mono font-bold"
                  value={form.qty_metre}
                  onChange={(e) => setForm({ ...form, qty_metre: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Quoted Rate / metre (₹) *</Label>
                <Input
                  type="number"
                  className="h-8 text-xs font-mono font-bold text-emerald-600"
                  value={form.quoted_rate}
                  onChange={(e) => setForm({ ...form, quoted_rate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Quotation Validity (Days)</Label>
              <Input
                type="number"
                className="h-8 text-xs font-mono"
                value={form.valid_days}
                onChange={(e) => setForm({ ...form, valid_days: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setOpenCreate(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateQuotation} disabled={createQuotation.isPending}>
              {createQuotation.isPending ? "Creating..." : "Create Quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
