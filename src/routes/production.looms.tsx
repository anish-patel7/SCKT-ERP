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
import { useQueryClient } from "@tanstack/react-query";
import {
  useLooms,
  useCreateLoom,
  useUpdateLoomStatus,
  useAssignJobCard,
  useUnassignJobCard,
} from "@/hooks/useLooms";
import { useAllJobCards } from "@/hooks/useProduction";
import { LoomCard } from "@/features/production/live/loom-card";
import {
  INACTIVE_STATUS,
  toastError,
  type LiveJobCard,
  type LiveLoom,
} from "@/features/production/live/loom-model";

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

function Page() {
  const { data: loomData = [] } = useLooms();
  const looms = loomData as LiveLoom[];
  const { data: jobCardData = [] } = useAllJobCards();
  const jobCards = jobCardData as LiveJobCard[];
  const qc = useQueryClient();
  const assignJobCard = useAssignJobCard();
  const unassignJobCard = useUnassignJobCard();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");
  const inactiveCount = looms.filter((l) => l.status === INACTIVE_STATUS).length;
  const visible = looms.filter((l) =>
    filter === "all" ? true : (l.status === INACTIVE_STATUS) === (filter === "inactive"),
  );
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

  const running = useMemo(() => looms.filter((l) => l.status === "RUNNING").length, [looms]);
  const activeCount = looms.length - inactiveCount;
  // Utilisation over active looms (decommissioned looms excluded).
  const utilisation = activeCount > 0 ? Math.round((running / activeCount) * 100) : 0;

  return (
    <AppShell
      title="Loom Planning"
      breadcrumb={[{ label: "Production" }, { label: "Loom Planning" }]}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[0.6875rem]">
            Utilisation {utilisation}% · {running}/{activeCount} running
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
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter looms">
        {(
          [
            ["all", `All (${looms.length})`],
            ["active", `Active (${looms.length - inactiveCount})`],
            ["inactive", `Inactive (${inactiveCount})`],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={filter === id ? "default" : "outline"}
            className="h-7 text-xs"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((l) => (
          <LoomCard
            key={l.id}
            loom={l}
            jobCards={jobCards}
            busy={
              updateLoomStatus.isPending || assignJobCard.isPending || unassignJobCard.isPending
            }
            onStatus={(status) => void handleSetStatus(l.id, status)}
            onAssign={(jobCardId) =>
              assignJobCard.mutate(
                { loom_id: l.id, job_card_id: jobCardId },
                {
                  onSuccess: () => {
                    void qc.invalidateQueries({ queryKey: ["all_job_cards"] });
                    toast.success(`Job card allocated to ${l.loom_no}`);
                  },
                  onError: toastError("Allocate job card"),
                },
              )
            }
            onRelease={() =>
              unassignJobCard.mutate(l.id, {
                onSuccess: () => toast.success(`${l.loom_no} released`),
                onError: toastError("Release loom"),
              })
            }
          />
        ))}
        {visible.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {looms.length === 0
              ? "No looms configured yet — add your first loom."
              : "No looms match this filter."}
          </p>
        )}
      </div>
    </AppShell>
  );
}
