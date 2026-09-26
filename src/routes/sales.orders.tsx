import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  ShoppingCart,
  Truck,
  ShieldAlert,
  CheckCircle2,
  Search,
  FileSpreadsheet,
  PackageCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/route-guards";
import { Can } from "@/components/auth";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import { useOrders, useCreateOrder } from "@/hooks/useSales";
import { useCustomerOptions } from "@/hooks/useCustomers";
import { formatServiceError } from "@/lib/master-codes";
import { fmt } from "@/lib/costing";

export const Route = createFileRoute("/sales/orders")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Sales Orders & Dispatch — SCKT ERP" },
      {
        name: "description",
        content:
          "Sales order confirmation with credit limit governance, roll-level dispatch integration, and GST e-invoice/e-way bill payload generation.",
      },
      { property: "og:title", content: "Sales Orders — SCKT ERP" },
      {
        property: "og:description",
        content: "Sales order execution and dispatch packing list governance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesOrdersPage,
});

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  DRAFT: { label: "Draft", class: "bg-muted text-foreground" },
  CONFIRMED: {
    label: "Confirmed",
    class: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold",
  },
  ALLOCATED: {
    label: "Allocated",
    class: "bg-blue-500 hover:bg-blue-600 text-white font-semibold",
  },
  FULFILLED: { label: "Fulfilled", class: "bg-primary text-primary-foreground font-bold" },
  SHIPPED: { label: "Shipped", class: "bg-cyan-600 text-white" },
  DELIVERED: { label: "Delivered", class: "bg-green-600 text-white" },
  CANCELLED: { label: "Cancelled", class: "bg-rose-600 text-white" },
};

function SalesOrdersPage() {
  const { data: orders = [] } = useOrders();
  // Orders reference customers.id; names and default address come from the linked party.
  const { options: customers, nameById: customerNames } = useCustomerOptions({ is_active: true });
  const createOrder = useCreateOrder();

  const [search, setSearch] = useState("");
  const [openCreateOrder, setOpenCreateOrder] = useState(false);
  const [openDispatch, setOpenDispatch] = useState(false);
  const [openCreditOverride, setOpenCreditOverride] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Form states
  const [orderForm, setOrderForm] = useState({
    customer_id: "",
    quality: "Kashmiri Kota Pashmina",
    qty_metre: "3000",
    rate_per_metre: "170",
    delivery_date: "",
    broker_name: "Rajeshwar Trading Co.",
    shipping_address: "",
    billing_address: "",
  });

  const [creditOverrideReason, setCreditOverrideReason] = useState("");
  const [creditOverrideApproved, setCreditOverrideApproved] = useState(false);

  // Dispatch form state
  const [dispatchForm, setDispatchForm] = useState({
    transporter_name: "V-Trans India Ltd",
    lr_no: "LR-998810",
    vehicle_no: "GJ-05-BX-4810",
  });

  const filteredOrders = orders.filter((o: any) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    const custName = customerNames.get(o.customer_id) ?? "";
    return (
      o.order_no.toLowerCase().includes(s) ||
      custName.toLowerCase().includes(s)
    );
  });

  const handleOpenCreateOrder = () => {
    const today = new Date();
    today.setDate(today.getDate() + 30);

    const first = customers[0];
    setOrderForm({
      customer_id: first?.id ?? "",
      quality: "Kashmiri Kota Pashmina",
      qty_metre: "3000",
      rate_per_metre: "170",
      delivery_date: today.toISOString().slice(0, 10),
      broker_name: "Direct",
      shipping_address: first?.address ?? "",
      billing_address: first?.address ?? "",
    });
    setOpenCreateOrder(true);
  };

  const handleConfirmOrder = async () => {
    const cust = customers.find((c) => c.id === orderForm.customer_id);
    if (!cust) {
      toast.error("Please select a valid customer");
      return;
    }

    const qty = Number(orderForm.qty_metre) || 0;
    const rate = Number(orderForm.rate_per_metre) || 0;
    const missing = [
      !orderForm.quality.trim() && "fabric quality",
      !(qty > 0) && "order quantity",
      !(rate > 0) && "rate per metre",
      !orderForm.delivery_date && "delivery date",
      !orderForm.shipping_address.trim() && "shipping address",
      !orderForm.billing_address.trim() && "billing address",
    ].filter(Boolean);
    if (missing.length > 0) {
      toast.error(`Please enter: ${missing.join(", ")}`);
      return;
    }
    const subtotal = qty * rate;
    const totalAmount = subtotal;

    // Credit limit governance would go here (deferred - not in canonical schema yet)
    if (!creditOverrideApproved) {
      // TODO: Implement credit limit check when customer credit fields are available
    }

    // Create order
    const orderData = {
      order_no: `SO-${Math.floor(2603 + orders.length)}`,
      customer_id: cust.id,
      order_date: new Date().toISOString().slice(0, 10),
      delivery_date: orderForm.delivery_date,
      subtotal_amount: subtotal,
      discount_percent: 0,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: totalAmount,
      status: "CONFIRMED",
      shipping_address: orderForm.shipping_address.trim(),
      billing_address: orderForm.billing_address.trim(),
      customer_name_snapshot: cust.name,
      broker_name_snapshot: orderForm.broker_name.trim() || undefined,
      remarks: `Quality: ${orderForm.quality}`,
    } as unknown;

    const items = [
      {
        line_number: 1,
        fabric_quality_name: orderForm.quality,
        qty_metre: qty,
        rate_per_metre: rate,
        line_total: totalAmount,
        qty_reserved: 0,
        qty_allocated: 0,
        qty_shipped: 0,
        qty_dispatched: 0,
      } as unknown,
    ];

    try {
      await createOrder.mutateAsync({
        order: orderData,
        items: items,
      });

      toast.success(`Sales Order confirmed successfully`);
      setOpenCreateOrder(false);
      setCreditOverrideApproved(false);
      setOrderForm({
        customer_id: "",
        quality: "Kashmiri Kota Pashmina",
        qty_metre: "3000",
        rate_per_metre: "170",
        delivery_date: "",
        broker_name: "Direct",
        shipping_address: "",
        billing_address: "",
      });
    } catch (error) {
      console.error("Create order error:", error);
      toast.error(`Unable to confirm sales order: ${formatServiceError(error)}`);
    }
  };

  const handleApproveCreditOverride = () => {
    if (!creditOverrideReason.trim()) {
      toast.error("Audit reason required for credit limit override");
      return;
    }

    setCreditOverrideApproved(true);
    toast.success("Credit override authorized. Confirming order...");
    setOpenCreditOverride(false);
    handleConfirmOrder();
    setCreditOverrideReason("");
  };

  const handleOpenDispatch = (order: any) => {
    setSelectedOrder(order);
    setDispatchForm({
      transporter_name: "V-Trans India Ltd",
      lr_no: "LR-998810",
      vehicle_no: "GJ-05-BX-4810",
    });
    setOpenDispatch(true);
  };

  const handleExecuteDispatch = () => {
    if (!selectedOrder) {
      toast.error("No order selected");
      return;
    }

    toast.info("Dispatch packing list generation — coming in next phase");
    setOpenDispatch(false);
  };

  return (
    <AppShell
      title="Sales Orders & Dispatch Governance (M32)"
      breadcrumb={[{ label: "Sales" }, { label: "Sales Orders" }]}
      actions={
        <Can permission="sales:create">
          <Button size="sm" onClick={handleOpenCreateOrder} className="h-7 gap-1 text-xs">
            <Plus className="size-3.5" /> Confirm Sales Order
          </Button>
        </Can>
      }
    >
      <div className="space-y-4">
        {/* KPI Top Bar */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Active Sales Orders</span>
                <ShoppingCart className="size-4 text-primary" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {orders.length} Orders
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Confirmed & in-execution
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Confirmed Orders</span>
                <CheckCircle2 className="size-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-emerald-600">
                {orders.filter((o: any) => o.status === "CONFIRMED").length} Ready
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Ready for dispatch
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Order Value</span>
                <span className="font-bold text-foreground">INR</span>
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                ₹
                {fmt(
                  orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0),
                  0,
                )}
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Cumulative sales commitment
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Draft Orders</span>
                <AlertTriangle className="size-4 text-amber-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {orders.filter((o: any) => o.status === "DRAFT").length} Draft
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Pending confirmation
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Sales Orders Register & Dispatches */}
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="orders" className="h-7 text-xs gap-1">
              <ShoppingCart className="size-3.5" /> Sales Orders
            </TabsTrigger>
            <TabsTrigger value="dispatches" className="h-7 text-xs gap-1">
              <Truck className="size-3.5" /> Dispatch & Packing Lists
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-3 mt-3">
            {/* Filter Bar */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sales orders by Order #, Customer, Quality, Broker..."
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            {/* Sales Order Table */}
            <Card className="rounded-md border border-border">
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                      <TableHead className="h-8">Order #</TableHead>
                      <TableHead className="h-8">Customer Name</TableHead>
                      <TableHead className="h-8">Quality / Specs</TableHead>
                      <TableHead className="h-8 text-right">Order Qty (m)</TableHead>
                      <TableHead className="h-8 text-right">Rate / m</TableHead>
                      <TableHead className="h-8 text-right">Total Value (₹)</TableHead>
                      <TableHead className="h-8 w-32">Fulfillment</TableHead>
                      <TableHead className="h-8">Delivery Date</TableHead>
                      <TableHead className="h-8">Status</TableHead>
                      <TableHead className="h-8 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((o: any) => {
                      const custName = customerNames.get(o.customer_id) ?? "—";
                      const badge = STATUS_BADGES[o.status] || { label: o.status, class: "bg-muted" };
                      return (
                        <TableRow key={o.id} className="hover:bg-muted/40">
                          <TableCell className="py-2 font-mono font-bold text-primary">
                            {o.order_no}
                          </TableCell>
                          <TableCell className="py-2 font-semibold text-foreground">
                            {custName}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="font-semibold">Order</div>
                            <div className="text-[0.6875rem] text-muted-foreground">
                              {o.order_date}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-right font-mono font-bold">
                            {fmt(o.subtotal_amount || 0, 0)} m
                          </TableCell>
                          <TableCell className="py-2 text-right font-mono">
                            ₹{fmt(o.total_amount || 0, 2)}
                          </TableCell>
                          <TableCell className="py-2 text-right font-mono font-bold text-foreground">
                            ₹{fmt(o.total_amount || 0, 2)}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="space-y-1">
                              <Progress value={50} className="h-1.5" />
                              <span className="text-[0.625rem] font-mono text-muted-foreground">
                                50%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 font-mono text-muted-foreground">
                            {o.delivery_date}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge className={`text-[0.625rem] ${badge.class}`}>
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            {o.status !== "DELIVERED" && o.status !== "CANCELLED" && (
                              <Can permission="sales:update">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenDispatch(o)}
                                  className="h-6 text-[0.6875rem] gap-1 px-2"
                                >
                                  <Truck className="size-3" /> Dispatch
                                </Button>
                              </Can>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filteredOrders.length && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                          No sales orders found matching search criteria.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dispatches Tab */}
          <TabsContent value="dispatches" className="space-y-3 mt-3">
            <Card className="rounded-md border border-border">
              <CardContent className="p-8">
                <div className="text-center space-y-2">
                  <Truck className="size-12 text-muted-foreground mx-auto" />
                  <p className="text-sm font-semibold text-foreground">Dispatch Packing Lists</p>
                  <p className="text-xs text-muted-foreground">
                    Roll-level dispatch generation and E-Way bill creation — coming in next phase
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm Sales Order Dialog */}
      <Dialog open={openCreateOrder} onOpenChange={setOpenCreateOrder}>
        <DialogContent className="max-w-md p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Confirm Sales Order</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Customer Account *</Label>
              <Select
                value={orderForm.customer_id}
                onValueChange={(v) => {
                  const address = customers.find((c) => c.id === v)?.address ?? "";
                  setOrderForm({
                    ...orderForm,
                    customer_id: v,
                    shipping_address: address,
                    billing_address: address,
                  });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Fabric Quality / Specs *</Label>
              <Input
                className="h-8 text-xs font-semibold"
                value={orderForm.quality}
                onChange={(e) => setOrderForm({ ...orderForm, quality: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Order Qty (meters) *</Label>
                <Input
                  type="number"
                  className="h-8 text-xs font-mono font-bold"
                  value={orderForm.qty_metre}
                  onChange={(e) => setOrderForm({ ...orderForm, qty_metre: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Rate / metre (₹) *</Label>
                <Input
                  type="number"
                  className="h-8 text-xs font-mono font-bold text-emerald-600"
                  value={orderForm.rate_per_metre}
                  onChange={(e) => setOrderForm({ ...orderForm, rate_per_metre: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Target Delivery Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs font-mono"
                  value={orderForm.delivery_date}
                  onChange={(e) => setOrderForm({ ...orderForm, delivery_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Mapped Broker</Label>
                <Input
                  className="h-8 text-xs"
                  value={orderForm.broker_name}
                  onChange={(e) => setOrderForm({ ...orderForm, broker_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Shipping Address *</Label>
              <Textarea
                className="min-h-[52px] text-xs"
                placeholder="Delivery address"
                value={orderForm.shipping_address}
                onChange={(e) => setOrderForm({ ...orderForm, shipping_address: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Billing Address *</Label>
              <Textarea
                className="min-h-[52px] text-xs"
                placeholder="Billing address"
                value={orderForm.billing_address}
                onChange={(e) => setOrderForm({ ...orderForm, billing_address: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setOpenCreateOrder(false)}>
              Cancel
            </Button>
            <Can permission="sales:create">
              <Button size="sm" onClick={handleConfirmOrder}>
                Confirm Sales Order
              </Button>
            </Can>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Override Audited Modal (Acceptance Criteria 2) */}
      <Dialog open={openCreditOverride} onOpenChange={setOpenCreditOverride}>
        <DialogContent className="max-w-md p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-rose-600">
              <ShieldAlert className="size-5 text-rose-600" /> Credit Limit Override Required (BR
              Acceptance Criteria 2)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded border border-rose-200 bg-rose-50 p-3 text-rose-800 text-xs space-y-1">
              <p className="font-bold">Customer Credit Limit Exceeded!</p>
              <p>
                The projected outstanding balance for{" "}
                <strong>{selectedOrder?.customer_name}</strong> exceeds their approved credit limit.
              </p>
              <p className="font-mono text-[0.6875rem]">
                Order Value: ₹{fmt(selectedOrder?.total_value_inr || 0, 0)}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Manager Audit Override Reason *</Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g. Special director approval granted via email"
                value={creditOverrideReason}
                onChange={(e) => setCreditOverrideReason(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="override_auth"
                checked={creditOverrideApproved}
                onCheckedChange={(c) => setCreditOverrideApproved(Boolean(c))}
              />
              <label htmlFor="override_auth" className="text-xs font-semibold leading-none">
                I authorize this credit override and acknowledge audit logging.
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setOpenCreditOverride(false)}>
              Cancel
            </Button>
            <Can permission="sales:update">
              <Button
                size="sm"
                disabled={!creditOverrideApproved}
                onClick={handleApproveCreditOverride}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Authorize & Confirm Order
              </Button>
            </Can>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch Dialog (Deferred) */}
      <Dialog open={openDispatch} onOpenChange={setOpenDispatch}>
        <DialogContent className="max-w-lg p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <PackageCheck className="size-4 text-emerald-600" /> Create Dispatch & Packing List
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 py-2">
              <div className="rounded border border-border bg-muted/30 p-2.5 font-mono text-xs space-y-1">
                <div className="font-bold text-primary">
                  {selectedOrder.order_no}
                </div>
                <div>
                  Status: {selectedOrder.status} · Total: ₹{fmt(selectedOrder.total_amount || 0, 0)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Transporter Name</Label>
                  <Input
                    className="h-8 text-xs"
                    value={dispatchForm.transporter_name}
                    onChange={(e) =>
                      setDispatchForm({ ...dispatchForm, transporter_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">LR / Bilty Number</Label>
                  <Input
                    className="h-8 text-xs font-mono"
                    value={dispatchForm.lr_no}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, lr_no: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Vehicle Number</Label>
                  <Input
                    className="h-8 text-xs font-mono"
                    value={dispatchForm.vehicle_no}
                    onChange={(e) =>
                      setDispatchForm({ ...dispatchForm, vehicle_no: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setOpenDispatch(false)}>
              Cancel
            </Button>
            <Can permission="sales:update">
              <Button size="sm" onClick={handleExecuteDispatch}>
                Create Dispatch
              </Button>
            </Can>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
