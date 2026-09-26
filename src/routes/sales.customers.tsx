import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Users,
  CreditCard,
  AlertTriangle,
  ShieldCheck,
  Search,
  Building,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/route-guards";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { useCustomers, useCreateCustomer } from "@/hooks/useCustomers";
import { useParties } from "@/hooks/useParties";
import { fmt } from "@/lib/costing";

export const Route = createFileRoute("/sales/customers")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Customer Directory & Credit Control — SCKT ERP" },
      {
        name: "description",
        content:
          "Customer directory, credit limits, outstanding balances, credit status alerts, payment terms, and broker commission mapping.",
      },
      { property: "og:title", content: "Customers — SCKT ERP" },
      { property: "og:description", content: "Client accounts and credit limit governance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { data: customers = [], isLoading } = useCustomers({ is_active: true });
  const { data: parties = [] } = useParties();
  const createCustomer = useCreateCustomer();
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    party_id: "",
    contact_person: "",
    phone: "",
    email: "",
    credit_limit: "1000000",
    payment_terms_days: "30",
  });

  // KPI calculations
  const totalOutstanding = customers.reduce((sum, c) => sum + (c.current_credit_used || 0), 0);
  const creditExceededCount = customers.filter(
    (c) => (c.current_credit_used || 0) > (c.credit_limit || 0),
  ).length;
  const totalCreditLimit = customers.reduce((sum, c) => sum + (c.credit_limit || 0), 0);

  const filteredCustomers = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const party = parties.find((p) => p.id === c.party_id);
    return (
      (party?.party_name?.toLowerCase().includes(q) || false) ||
      (party?.party_code?.toLowerCase().includes(q) || false) ||
      (party?.city?.toLowerCase().includes(q) || false)
    );
  });

  const handleOpenCreate = () => {
    setForm({
      party_id: parties[0]?.id || "",
      contact_person: "",
      phone: "",
      email: "",
      credit_limit: "1000000",
      payment_terms_days: "30",
    });
    setOpenCreate(true);
  };

  const handleCreateCustomer = async () => {
    if (!form.party_id) {
      toast.error("Please select a party");
      return;
    }

    const creditLimit = Number(form.credit_limit) || 0;
    const terms = Number(form.payment_terms_days) || 30;

    try {
      setIsSubmitting(true);
      const party = parties.find((p) => p.id === form.party_id);
      await createCustomer.mutateAsync({
        party_id: form.party_id,
        is_active: true,
        contact_person: form.contact_person.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        credit_limit: creditLimit,
        payment_terms_days: terms,
      });

      toast.success(`Customer ${party?.party_name} added`);
      setOpenCreate(false);
      setForm({
        party_id: parties[0]?.id || "",
        contact_person: "",
        phone: "",
        email: "",
        credit_limit: "1000000",
        payment_terms_days: "30",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Customer Directory & Credit Control (M32)"
      breadcrumb={[{ label: "Sales" }, { label: "Customers" }]}
      actions={
        <Button size="sm" onClick={handleOpenCreate} className="h-7 gap-1 text-xs">
          <Plus className="size-3.5" /> New Customer
        </Button>
      }
    >
      <div className="space-y-4">
        {/* KPI Summary Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Active Accounts</span>
                <Users className="size-4 text-primary" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {customers.length} Accounts
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Verified party profiles
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Receivables</span>
                <CreditCard className="size-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-emerald-600">
                ₹{fmt(totalOutstanding, 2)}
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Across all customer ledgers
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Credit Exceeded Alerts</span>
                <AlertTriangle className="size-4 text-rose-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-rose-600">
                {creditExceededCount} Accounts
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Requires credit override
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Credit Sanctioned</span>
                <ShieldCheck className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                ₹{fmt(totalCreditLimit, 0)}
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Aggregate credit threshold
              </span>
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
              placeholder="Search customers by Name, Code, GSTIN, City, Broker..."
              className="pl-9 text-xs"
            />
          </div>
        </div>

        {/* Customer Directory Table */}
        <Card className="rounded-md border border-border">
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                  <TableHead className="h-8">Code & Name</TableHead>
                  <TableHead className="h-8">GSTIN & City</TableHead>
                  <TableHead className="h-8">Contact & Phone</TableHead>
                  <TableHead className="h-8 text-right">Credit Limit (₹)</TableHead>
                  <TableHead className="h-8 text-right">Outstanding (₹)</TableHead>
                  <TableHead className="h-8 w-32">Credit Usage</TableHead>
                  <TableHead className="h-8">Credit Status</TableHead>
                  <TableHead className="h-8">Broker & Comm %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      Loading customers...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.map((cust) => {
                  const party = parties.find((p) => p.id === cust.party_id);
                  const creditLimit = cust.credit_limit || 0;
                  const outstanding = cust.current_credit_used || 0;
                  const utilPct =
                    creditLimit > 0
                      ? (outstanding / creditLimit) * 100
                      : 0;
                  const isExceeded = outstanding > creditLimit;
                  const isNearLimit = utilPct >= 85 && !isExceeded;

                  return (
                    <TableRow key={cust.id} className="hover:bg-muted/40">
                      <TableCell className="py-2">
                        <div className="font-mono font-bold text-primary">{party?.party_code || "—"}</div>
                        <div className="font-semibold text-foreground">{party?.party_name || "—"}</div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Building className="size-3" /> {party?.city || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div>{cust.contact_person || "—"}</div>
                        <div className="text-muted-foreground flex items-center gap-1 font-mono text-[0.6875rem]">
                          <Phone className="size-3" /> {cust.phone || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono font-bold">
                        ₹{fmt(creditLimit, 0)}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono font-bold text-foreground">
                        ₹{fmt(outstanding, 2)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="space-y-1">
                          <Progress
                            value={Math.min(utilPct, 100)}
                            className={`h-1.5 ${isExceeded ? "[&>div]:bg-rose-600" : isNearLimit ? "[&>div]:bg-amber-500" : ""}`}
                          />
                          <span className="text-[0.625rem] font-mono text-muted-foreground">
                            {fmt(utilPct, 1)}% Used ({cust.payment_terms_days}d terms)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        {isExceeded ? (
                          <Badge className="bg-rose-600 hover:bg-rose-700 text-white text-[0.625rem] font-bold">
                            Credit Exceeded
                          </Badge>
                        ) : isNearLimit ? (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-black text-[0.625rem]">
                            Near Limit
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[0.625rem]">
                            Normal
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!filteredCustomers.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No customers found matching search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* New Customer Entry Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-md p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">New Customer Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Party *</Label>
              <select
                className="h-8 w-full border border-border rounded px-2 text-xs"
                value={form.party_id}
                onChange={(e) => setForm({ ...form, party_id: e.target.value })}
              >
                <option value="">Select a party</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.party_name} ({p.party_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Contact Person</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Email</Label>
                <Input
                  type="email"
                  className="h-8 text-xs"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Phone</Label>
                <Input
                  className="h-8 text-xs font-mono"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Credit Limit (₹) *</Label>
                <Input
                  type="number"
                  className="h-8 text-xs font-mono font-bold"
                  value={form.credit_limit}
                  onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Terms (Days)</Label>
                <Input
                  type="number"
                  className="h-8 text-xs font-mono"
                  value={form.payment_terms_days}
                  onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setOpenCreate(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateCustomer} disabled={isSubmitting || createCustomer.isPending}>
              {isSubmitting ? "Saving..." : "Save Customer Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
