import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Factory, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProductionOrders,
  useCreateProductionOrder,
  useUpdateProductionOrder,
} from "@/hooks/useProduction";
import { useCostSheetsList } from "@/hooks/useCostSheets";
import { useParties } from "@/hooks/useParties";

export const Route = createFileRoute("/production/orders")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Production Orders — SCKT ERP" },
      {
        name: "description",
        content:
          "Raise and track weaving production orders from approved cost sheets, with quantity, delivery date, priority and live progress.",
      },
      { property: "og:title", content: "Production Orders — SCKT ERP" },
      {
        property: "og:description",
        content: "Weaving production orders with live progress rolled up from job cards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const STATUS_STYLES: Record<string, string> = {
  PLANNED: "bg-muted text-foreground",
  IN_PROGRESS: "bg-primary text-primary-foreground",
  COMPLETED: "bg-emerald-600 text-white",
  ON_HOLD: "bg-amber-500 text-black",
  JOB_CARDS_ISSUED: "bg-blue-600 text-white",
};

const emptyForm = () => ({
  order_no: "",
  cost_sheet_id: "",
  design_no: "",
  party_id: "",
  quality_name: "",
  qty_metre: "",
  target_delivery_date: "",
  priority: "normal" as const,
  remarks: "",
});

function Page() {
  const { data: orders = [], isLoading } = useProductionOrders();
  const { data: costSheets = [] } = useCostSheetsList();
  const { data: parties = [] } = useParties();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const createOrder = useCreateProductionOrder();
  const updateOrder = useUpdateProductionOrder();

  const applySheet = (sheetId: string) => {
    const sheet = costSheets.find((s) => s.header.id === sheetId);
    if (sheet) {
      setForm((f) => ({
        ...f,
        cost_sheet_id: sheetId,
        design_no: sheet.header.design_no || f.design_no,
        party_id: sheet.header.party_id || f.party_id,
        quality_name: sheet.header.quality || f.quality_name,
      }));
    }
  };

  const handleCreate = async () => {
    try {
      if (!form.order_no.trim()) {
        toast.error("Order number is required");
        return;
      }
      if (!form.party_id) {
        toast.error("Party is required");
        return;
      }
      if (!form.quality_name.trim()) {
        toast.error("Quality name is required");
        return;
      }

      await createOrder.mutateAsync({
        order_no: form.order_no.trim(),
        cost_sheet_id: form.cost_sheet_id || null,
        design_no: form.design_no.trim(),
        party_id: form.party_id,
        quality_name: form.quality_name.trim(),
        qty_metre: Number(form.qty_metre) || 0,
        target_delivery_date: form.target_delivery_date || new Date().toISOString().split("T")[0],
        priority: form.priority,
        remarks: form.remarks.trim(),
      });

      setForm(emptyForm());
      setOpen(false);
      toast.success(`Production order ${form.order_no} raised`);
    } catch (error) {
      console.error("Create order error:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleSetStatus = async (id: string, status: string) => {
    try {
      await updateOrder.mutateAsync({
        id,
        updates: { status },
      });
      toast.success(`Order status updated to ${status}`);
    } catch (error) {
      console.error("Update status error:", error);
      toast.error("Failed to update order status");
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await updateOrder.mutateAsync({
        id,
        updates: { status: "ARCHIVED" },
      });
      toast.success("Order archived");
    } catch (error) {
      console.error("Archive error:", error);
      toast.error("Failed to archive order");
    }
  };

  return (
    <AppShell
      title="Production Orders"
      breadcrumb={[{ label: "Production" }, { label: "Production Orders" }]}
      actions={
        // Can wraps the whole dialog: inside DialogTrigger asChild it would swallow the click.
        <Can permission="production:create">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 gap-1 text-xs">
                <Plus className="size-3.5" /> New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-sm">Raise Production Order</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Field label="Order No.">
                  <Input
                    className="h-8 text-xs"
                    value={form.order_no}
                    onChange={(e) => setForm({ ...form, order_no: e.target.value })}
                    placeholder="PO-2603"
                  />
                </Field>
                <Field label="From Cost Sheet">
                  <Select value={form.cost_sheet_id} onValueChange={applySheet}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {costSheets.map((s) => (
                        <SelectItem key={s.header.id} value={s.header.id || ""}>
                          {s.header.sheet_no} · {s.header.design_no}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Design No.">
                  <Input
                    className="h-8 text-xs"
                    value={form.design_no}
                    onChange={(e) => setForm({ ...form, design_no: e.target.value })}
                  />
                </Field>
                <Field label="Party">
                  <Select
                    value={form.party_id}
                    onValueChange={(v) => setForm({ ...form, party_id: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent>
                      {parties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.party_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Quality">
                  <Input
                    className="h-8 text-xs"
                    value={form.quality_name}
                    onChange={(e) => setForm({ ...form, quality_name: e.target.value })}
                  />
                </Field>
                <Field label="Quantity (m)">
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    value={form.qty_metre}
                    onChange={(e) => setForm({ ...form, qty_metre: e.target.value })}
                  />
                </Field>
                <Field label="Delivery Date">
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={form.target_delivery_date}
                    onChange={(e) => setForm({ ...form, target_delivery_date: e.target.value })}
                  />
                </Field>
                <Field label="Priority">
                  <Select
                    value={form.priority}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        priority: v as any as typeof form.priority,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["low", "normal", "high", "urgent"].map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="col-span-2">
                  <Field label="Remarks">
                    <Input
                      className="h-8 text-xs"
                      value={form.remarks}
                      onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
              <DialogFooter>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleCreate}
                  disabled={createOrder.isPending}
                >
                  {createOrder.isPending ? "Creating..." : "Raise Order"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Can>
      }
    >
      <Card className="rounded-md border border-border">
        <CardContent className="p-0">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="h-8 font-semibold">Order No.</TableHead>
                <TableHead className="h-8 font-semibold">Design</TableHead>
                <TableHead className="h-8 font-semibold">Party</TableHead>
                <TableHead className="h-8 font-semibold">Quality</TableHead>
                <TableHead className="h-8 text-right font-semibold">Qty (m)</TableHead>
                <TableHead className="h-8 font-semibold">Progress</TableHead>
                <TableHead className="h-8 font-semibold">Delivery</TableHead>
                <TableHead className="h-8 font-semibold">Priority</TableHead>
                <TableHead className="h-8 font-semibold">Status</TableHead>
                <TableHead className="h-8 text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const partyName = parties.find((p) => p.id === o.party_id)?.party_name || "—";
                return (
                  <TableRow key={o.id} className="hover:bg-muted/40">
                    <TableCell className="py-2 font-mono font-bold text-primary">
                      {o.order_no}
                    </TableCell>
                    <TableCell className="py-2 font-mono">{o.design_no || "—"}</TableCell>
                    <TableCell className="py-2">{partyName}</TableCell>
                    <TableCell className="py-2">{o.quality_name || "—"}</TableCell>
                    <TableCell className="py-2 text-right font-mono">
                      {(o.qty_metre || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <Progress value={0} className="h-1.5 w-20" />
                        <span className="font-mono text-[0.6875rem] text-muted-foreground">
                          0/{o.qty_metre}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 font-mono">
                      {o.target_delivery_date || "—"}
                    </TableCell>
                    <TableCell className="py-2 capitalize">
                      {(o.priority || "normal").toLowerCase()}
                    </TableCell>
                    <TableCell className="py-2">
                      <Select
                        value={o.status || "PLANNED"}
                        onValueChange={(v) => handleSetStatus(o.id, v)}
                      >
                        <SelectTrigger className="h-6 w-32 text-[0.6875rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "PLANNED",
                            "JOB_CARDS_ISSUED",
                            "IN_PROGRESS",
                            "COMPLETED",
                            "ON_HOLD",
                          ].map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Badge
                        className={`mr-1 text-[0.625rem] ${STATUS_STYLES[o.status || "PLANNED"]}`}
                      >
                        {(o.status || "PLANNED").replace(/_/g, " ")}
                      </Badge>
                      <Can permission="production:update">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleArchive(o.id)}
                          title="Archive order"
                          disabled={updateOrder.isPending}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </Can>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                    <Factory className="mx-auto mb-2 size-8 opacity-30" />
                    <p className="text-xs font-semibold">No production orders yet.</p>
                    <p className="mt-0.5 text-[0.6875rem]">
                      Raise one from an approved{" "}
                      <Link to="/cost-sheets" className="underline">
                        cost sheet
                      </Link>
                      .
                    </p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="section-label text-[0.6875rem]">{label}</Label>
      {children}
    </div>
  );
}
