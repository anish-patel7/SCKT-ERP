import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Printer, Trash2, ClipboardList, Building2, MapPin } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllJobCards, useCreateJobCard, useUpdateJobCard, useDeleteJobCard } from "@/hooks/useProduction";
import { useProductionOrders } from "@/hooks/useProduction";
import { useLooms } from "@/hooks/useLooms";
import { useParties, useSubPartiesByPartyId } from "@/hooks/useParties";
import { PartySubPartySelect } from "@/components/party-sub-party-select";

export const Route = createFileRoute("/production/job-cards")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Job Cards — SCKT ERP" },
      {
        name: "description",
        content:
          "Issue digital job cards against production orders and looms, with feeder colourway notes and live woven progress.",
      },
      { property: "og:title", content: "Job Cards — SCKT ERP" },
      {
        property: "og:description",
        content: "Digital job card vouchers issued from priced, approved costings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const emptyForm = () => ({
  card_no: "",
  production_order_id: "",
  loom_id: "none",
  party_id: "",
  sub_party_id: "",
  qty_metre: "",
  feeder_notes: "",
  remarks: "",
});

function Page() {
  const { data: jobCards = [] } = useAllJobCards();
  const { data: orders = [] } = useProductionOrders();
  const { data: looms = [] } = useLooms();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const { data: allParties = [] } = useParties();
  const { data: allSubParties = [] } = useSubPartiesByPartyId(form.party_id);

  const createJobCard = useCreateJobCard();
  const updateJobCard = useUpdateJobCard();
  const deleteJobCard = useDeleteJobCard();

  const handleCreateCard = async () => {
    try {
      if (!form.card_no.trim()) {
        toast.error("Card number is required");
        return;
      }
      if (!form.production_order_id) {
        toast.error("Select a production order");
        return;
      }
      if (!form.qty_metre || Number(form.qty_metre) <= 0) {
        toast.error("Quantity must be greater than 0");
        return;
      }

      await createJobCard.mutateAsync({
        card_no: form.card_no.trim(),
        production_order_id: form.production_order_id,
        qty_metre: Number(form.qty_metre),
        party_id: form.party_id || undefined,
        sub_party_id: form.sub_party_id || undefined,
        loom_id: form.loom_id === "none" ? null : form.loom_id || null,
        feeder_notes: form.feeder_notes.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
      });

      setForm(emptyForm());
      setOpen(false);
      toast.success(`Job card ${form.card_no} issued`);
    } catch (error) {
      console.error("Create card error:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleSetStatus = async (cardId: string, status: string) => {
    try {
      await updateJobCard.mutateAsync({
        id: cardId,
        updates: { status },
      });
      toast.success("Status updated");
    } catch (error) {
      console.error("Update status error:", error);
      toast.error("Failed to update status");
    }
  };

  const handleSetLoom = async (cardId: string, loomId: string) => {
    try {
      await updateJobCard.mutateAsync({
        id: cardId,
        updates: { loom_id: loomId === "none" ? null : loomId },
      });
      toast.success("Loom assigned");
    } catch (error) {
      console.error("Update loom error:", error);
      toast.error("Failed to update loom");
    }
  };

  const handleDelete = async (cardId: string) => {
    try {
      await deleteJobCard.mutateAsync(cardId);
      toast.success("Job card deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete job card");
    }
  };

  return (
    <AppShell
      title="Job Cards"
      breadcrumb={[{ label: "Production" }, { label: "Job Cards" }]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => window.print()}
          >
            <Printer className="size-3.5" /> Print
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 gap-1 text-xs font-semibold">
                <Plus className="size-3.5" /> Issue Job Card
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold">Issue Job Card</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="section-label text-[0.6875rem]">Card No. *</Label>
                    <Input
                      className="h-8 text-xs font-mono font-bold"
                      value={form.card_no}
                      onChange={(e) => setForm({ ...form, card_no: e.target.value })}
                      placeholder="e.g. JC-101"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="section-label text-[0.6875rem]">Production Order *</Label>
                    <Select
                      value={form.production_order_id}
                      onValueChange={(v) => setForm({ ...form, production_order_id: v })}
                    >
                      <SelectTrigger className="h-8 text-xs font-medium">
                        <SelectValue placeholder="Select order" />
                      </SelectTrigger>
                      <SelectContent>
                        {orders.map((o) => (
                          <SelectItem key={o.id} value={o.id} className="text-xs">
                            {o.order_no} · {o.design_no}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Cascading Party & Sub Party Selection */}
                <div className="border border-border rounded-md p-3 bg-muted/30">
                  <Label className="text-xs font-bold text-primary mb-2 block uppercase tracking-wider">
                    Job Party & Sub Party (Job Work Location)
                  </Label>
                  <PartySubPartySelect
                    partyType="Job Party"
                    selectedPartyId={form.party_id}
                    selectedSubPartyId={form.sub_party_id}
                    onPartyChange={(pId) => setForm((prev) => ({ ...prev, party_id: pId }))}
                    onSubPartyChange={(spId) =>
                      setForm((prev) => ({ ...prev, sub_party_id: spId }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="section-label text-[0.6875rem]">Loom</Label>
                    <Select
                      value={form.loom_id}
                      onValueChange={(v) => setForm({ ...form, loom_id: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">
                          Unassigned
                        </SelectItem>
                        {looms.map((l) => (
                          <SelectItem key={l.id} value={l.id} className="text-xs">
                            {l.loom_no} · {l.loom_type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="section-label text-[0.6875rem]">Quantity (m) *</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs font-mono"
                      value={form.qty_metre}
                      onChange={(e) => setForm({ ...form, qty_metre: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="section-label text-[0.6875rem]">Feeder Colourway</Label>
                  <Input
                    className="h-8 text-xs"
                    value={form.feeder_notes}
                    onChange={(e) => setForm({ ...form, feeder_notes: e.target.value })}
                    placeholder="F1 Black · F2 Jari"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  size="sm"
                  className="h-8 text-xs font-semibold"
                  onClick={handleCreateCard}
                  disabled={createJobCard.isPending}
                >
                  {createJobCard.isPending ? "Issuing..." : "Issue Card"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <Card className="rounded-md border border-border">
        <CardContent className="p-0">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                <TableHead className="h-8">Card No.</TableHead>
                <TableHead className="h-8">Order</TableHead>
                <TableHead className="h-8">Job Party & Sub Party</TableHead>
                <TableHead className="h-8">Loom</TableHead>
                <TableHead className="h-8 text-right">Qty (m)</TableHead>
                <TableHead className="h-8">Woven Progress</TableHead>
                <TableHead className="h-8">Issued</TableHead>
                <TableHead className="h-8">Status</TableHead>
                <TableHead className="h-8 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobCards.filter((c) => c.status !== "ARCHIVED").map((c: any) => {
                const order = orders.find((o) => o.id === c.production_order_id);
                const done = (c.daily_production || []).reduce(
                  (sum: number, log: any) => sum + (log.metre_produced || 0),
                  0,
                );
                const progress = c.qty_metre > 0 ? Math.round((done / c.qty_metre) * 100) : 0;

                const partyObj = c.party_id ? allParties.find((p) => p.id === c.party_id) : null;
                const subPartyObj = c.sub_party_id
                  ? allSubParties.find((sp) => sp.id === c.sub_party_id)
                  : null;

                const partyName = partyObj?.party_name || "—";
                const subPartyName = subPartyObj?.sub_party_name || "—";

                return (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell className="py-2 font-mono font-bold text-primary">
                      {c.card_no}
                    </TableCell>
                    <TableCell className="py-2 font-mono">{order?.order_no ?? "—"}</TableCell>

                    {/* Job Party & Sub Party Column */}
                    <TableCell className="py-2">
                      <div>
                        <span className="font-semibold text-foreground block flex items-center gap-1">
                          <Building2 className="size-3 text-primary" /> {partyName}
                        </span>
                        <span className="text-[0.6875rem] text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3 text-emerald-600" /> {subPartyName}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-2">
                      <Select value={c.loom_id ?? "none"} onValueChange={(v) => handleSetLoom(c.id, v)}>
                        <SelectTrigger className="h-6 w-28 text-[0.6875rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">
                            Unassigned
                          </SelectItem>
                          {looms.map((l) => (
                            <SelectItem key={l.id} value={l.id} className="text-xs">
                              {l.loom_no}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono font-semibold">
                      {c.qty_metre.toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 w-16" />
                        <span className="font-mono text-[0.6875rem] text-muted-foreground">
                          {done}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 font-mono text-muted-foreground">
                      {c.issued_date?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      <Select
                        value={c.status || "OPEN"}
                        onValueChange={(v) => handleSetStatus(c.id, v)}
                      >
                        <SelectTrigger className="h-6 w-24 text-[0.6875rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED"] as const).map((s) => (
                            <SelectItem key={s} value={s} className="text-xs capitalize">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Badge variant="outline" className="mr-1 text-[0.625rem] capitalize">
                        {c.status || "OPEN"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(c.id)}
                        title="Delete job card"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {jobCards.filter((c) => c.status !== "ARCHIVED").length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    <ClipboardList className="mx-auto mb-2 size-8 opacity-30" />
                    <p className="text-xs font-semibold">No job cards issued.</p>
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
