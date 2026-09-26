import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { requireAuth } from "@/lib/route-guards";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useLooms, useCreateLoom, useUpdateLoomStatus } from "@/hooks/useLooms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/production/looms")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Loom Planning — SCKT ERP" },
      {
        name: "description",
        content:
          "Allocate weaving orders to looms, track utilisation, changeovers and maintenance on a live planning board.",
      },
      { property: "og:title", content: "Loom Planning — SCKT ERP" },
      {
        property: "og:description",
        content: "Loom allocation board with utilisation and changeover visibility.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const STATUS_TONE: Record<string, string> = {
  RUNNING: "border-primary/60 bg-primary/10",
  IDLE: "border-border bg-card",
  MAINTENANCE: "border-amber-500/60 bg-amber-500/10",
  BLOCKED: "border-red-500/60 bg-red-500/10",
  DECOMMISSIONED: "border-gray-500/60 bg-gray-500/10",
};

function Page() {
  const { data: looms = [] } = useLooms();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    loom_no: "",
    loom_type: "Jacquard",
    panna_inch: "",
    remarks: "",
  });

  const createLoom = useCreateLoom();
  const updateLoomStatus = useUpdateLoomStatus();

  const handleAddLoom = async () => {
    try {
      if (!form.loom_no.trim()) {
        toast.error("Loom number is required");
        return;
      }
      if (!form.panna_inch || Number(form.panna_inch) <= 0) {
        toast.error("Panna inch must be greater than 0");
        return;
      }

      await createLoom.mutateAsync({
        loom_no: form.loom_no.trim(),
        loom_type: form.loom_type,
        panna_inch: Number(form.panna_inch),
        remarks: form.remarks.trim() || undefined,
      });

      setForm({ loom_no: "", loom_type: "Jacquard", panna_inch: "", remarks: "" });
      setOpen(false);
      toast.success(`Loom ${form.loom_no} added`);
    } catch (error) {
      console.error("Add loom error:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleSetStatus = async (loomId: string, status: string) => {
    try {
      await updateLoomStatus.mutateAsync({
        id: loomId,
        updates: { status },
      });
      toast.success(`Loom status updated to ${status}`);
    } catch (error) {
      console.error("Update status error:", error);
      toast.error("Failed to update loom status");
    }
  };

  const running = useMemo(
    () => looms.filter((l) => l.status === "RUNNING").length,
    [looms]
  );
  const utilisation = looms.length > 0 ? Math.round((running / looms.length) * 100) : 0;

  return (
    <AppShell
      title="Loom Planning"
      breadcrumb={[{ label: "Production" }, { label: "Loom Planning" }]}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[0.6875rem]">
            Utilisation {utilisation}% · {running}/{looms.length} running
          </Badge>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 gap-1 text-xs">
                <Plus className="size-3.5" /> Add Loom
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm">Add Loom</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="section-label text-[0.6875rem]">Loom No.</Label>
                  <Input
                    className="h-8 text-xs"
                    value={form.loom_no}
                    onChange={(e) => setForm({ ...form, loom_no: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="section-label text-[0.6875rem]">Type</Label>
                  <Select
                    value={form.loom_type}
                    onValueChange={(v) => setForm({ ...form, loom_type: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Jacquard", "Rapier", "Airjet", "Powerloom", "Handloom"].map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="section-label text-[0.6875rem]">Panna (inch)</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    value={form.panna_inch}
                    onChange={(e) => setForm({ ...form, panna_inch: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="section-label text-[0.6875rem]">Remarks</Label>
                  <Input
                    className="h-8 text-xs"
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleAddLoom}
                  disabled={createLoom.isPending}
                >
                  {createLoom.isPending ? "Adding..." : "Add Loom"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {looms.map((l) => (
          <Card key={l.id} className={cn("gap-2 rounded-sm border py-3", STATUS_TONE[l.status || "IDLE"])}>
            <CardHeader className="flex flex-row items-center justify-between px-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className="font-mono font-bold">{l.loom_no}</span>
                <span className="text-[0.6875rem] font-normal text-muted-foreground">
                  {l.loom_type} · {(l.panna_inch || 0).toFixed(1)}"
                </span>
              </CardTitle>
              <span className="text-[0.6875rem] text-muted-foreground">ID: {l.id?.slice(0, 8)}</span>
            </CardHeader>
            <CardContent className="space-y-2 px-3 text-xs">
              <div className="space-y-1">
                <Label className="section-label text-[0.6875rem]">Status</Label>
                <Select
                  value={l.status || "IDLE"}
                  onValueChange={(v) => handleSetStatus(l.id, v)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["IDLE", "RUNNING", "MAINTENANCE", "BLOCKED"] as const).map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[0.6875rem] text-muted-foreground">
                {l.remarks || "No remarks"}
              </p>
              {l.job_cards && l.job_cards.length > 0 && (
                <p className="text-[0.6875rem] font-semibold">
                  {l.job_cards.length} job card(s) active
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {looms.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No looms configured yet — add your first loom.
          </p>
        )}
      </div>
    </AppShell>
  );
}
