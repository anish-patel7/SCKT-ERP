import { useMemo, useState } from "react";
import { Plus, Trash2, Gauge } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useDailyProductionLogs, useRecordDailyProduction } from "@/hooks/useDailyProduction";
import { useAllJobCards } from "@/hooks/useProduction";
import type { LiveJobCard } from "@/features/production/live/loom-model";

const DOWNTIME_REASONS = [
  "Warp breakage",
  "Weft change",
  "Beam change",
  "Power failure",
  "Mechanical fault",
  "Design change",
  "No operator",
  "Other",
];

const emptyForm = () => ({
  entry_date: new Date().toISOString().slice(0, 10),
  shift: "A" as const,
  job_card_id: "",
  loom_id: "",
  metre_produced: "",
  yarn_kg_used: "",
  downtime_min: "",
  downtime_reason: "",
  remarks: "",
});

export function LiveDailyProduction() {
  const { data: dailyLogs = [] } = useDailyProductionLogs();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [dateFilter, setDateFilter] = useState("");

  const recordProduction = useRecordDailyProduction();

  // Job cards for the dropdown. (Previously read from orders[].job_cards, which the
  // orders query never selects, so the list was always empty.)
  const { data: jobCardData = [] } = useAllJobCards();
  const allJobCards = (jobCardData as LiveJobCard[]).filter((c) => c.status !== "ARCHIVED");

  const rows = useMemo(
    () =>
      [...dailyLogs]
        .filter((d) => !dateFilter || d.entry_date === dateFilter)
        .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)),
    [dailyLogs, dateFilter],
  );

  const totals = rows.reduce(
    (acc, r) => ({
      metre: acc.metre + (Number(r.metre_produced) || 0),
      kg: acc.kg + (Number(r.yarn_kg_used) || 0),
      down: acc.down + (Number(r.downtime_min) || 0),
    }),
    { metre: 0, kg: 0, down: 0 },
  );

  const handleRecord = async () => {
    try {
      if (!form.job_card_id) {
        toast.error("Select a job card");
        return;
      }
      if (!form.loom_id) {
        toast.error("Loom ID is required");
        return;
      }
      if (!form.metre_produced || Number(form.metre_produced) <= 0) {
        toast.error("Metres produced must be greater than 0");
        return;
      }
      if (!form.yarn_kg_used || Number(form.yarn_kg_used) <= 0) {
        toast.error("Yarn used must be greater than 0");
        return;
      }

      await recordProduction.mutateAsync({
        entry_date: form.entry_date,
        shift: form.shift,
        job_card_id: form.job_card_id,
        loom_id: form.loom_id,
        metre_produced: Number(form.metre_produced),
        yarn_kg_used: Number(form.yarn_kg_used),
        downtime_min: Number(form.downtime_min) || 0,
        downtime_reason: form.downtime_reason || undefined,
        remarks: form.remarks.trim() || undefined,
      });

      setForm(emptyForm());
      setOpen(false);
      toast.success("Production entry recorded");
    } catch (error) {
      console.error("Record error:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-7 w-36 text-xs"
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-7 gap-1 text-xs">
                  <Plus className="size-3.5" /> Record Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-sm">Record Daily Production</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="section-label text-[0.6875rem]">Date</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={form.entry_date}
                      onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="section-label text-[0.6875rem]">Shift</Label>
                    <Select
                      value={form.shift}
                      onValueChange={(v) => setForm({ ...form, shift: v as typeof form.shift })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["A", "B", "C"].map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            Shift {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="section-label text-[0.6875rem]">Job Card</Label>
                    <Select
                      value={form.job_card_id}
                      onValueChange={(v) => {
                        const card = allJobCards.find((c) => c.id === v);
                        setForm({
                          ...form,
                          job_card_id: v,
                          loom_id: card?.loom_id || "",
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select job card" />
                      </SelectTrigger>
                      <SelectContent>
                        {allJobCards.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.card_no || c.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="section-label text-[0.6875rem]">Metres Produced</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={form.metre_produced}
                      onChange={(e) => setForm({ ...form, metre_produced: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="section-label text-[0.6875rem]">Yarn Used (kg)</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={form.yarn_kg_used}
                      onChange={(e) => setForm({ ...form, yarn_kg_used: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="section-label text-[0.6875rem]">Downtime (min)</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={form.downtime_min}
                      onChange={(e) => setForm({ ...form, downtime_min: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="section-label text-[0.6875rem]">Downtime Reason</Label>
                    <Select
                      value={form.downtime_reason}
                      onValueChange={(v) => setForm({ ...form, downtime_reason: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOWNTIME_REASONS.map((r) => (
                          <SelectItem key={r} value={r} className="text-xs">
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
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
                    onClick={handleRecord}
                    disabled={recordProduction.isPending}
                  >
                    {recordProduction.isPending ? "Saving..." : "Save Entry"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Kpi label="Metres woven" value={totals.metre.toLocaleString()} />
        <Kpi label="Yarn consumed (kg)" value={totals.kg.toFixed(2)} />
        <Kpi label="Downtime (min)" value={totals.down.toLocaleString()} />
      </div>

      <Card className="rounded-md border border-border">
        <CardContent className="p-0">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="h-8 font-semibold">Date</TableHead>
                <TableHead className="h-8 font-semibold">Shift</TableHead>
                <TableHead className="h-8 font-semibold">Job Card</TableHead>
                <TableHead className="h-8 font-semibold">Loom</TableHead>
                <TableHead className="h-8 text-right font-semibold">Metres</TableHead>
                <TableHead className="h-8 text-right font-semibold">Yarn (kg)</TableHead>
                <TableHead className="h-8 text-right font-semibold">Downtime</TableHead>
                <TableHead className="h-8 font-semibold">Reason</TableHead>
                <TableHead className="h-8 text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => {
                const card = allJobCards.find((c) => c.id === d.job_card_id);
                return (
                  <TableRow key={d.id} className="hover:bg-muted/40">
                    <TableCell className="py-2 font-mono">{d.entry_date}</TableCell>
                    <TableCell className="py-2">{d.shift}</TableCell>
                    <TableCell className="py-2 font-mono">{card?.card_no ?? "—"}</TableCell>
                    <TableCell className="py-2 font-mono">{d.loom_id || "—"}</TableCell>
                    <TableCell className="py-2 text-right font-mono font-semibold">
                      {(d.metre_produced || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono">
                      {(d.yarn_kg_used || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono">
                      {d.downtime_min || "—"}
                    </TableCell>
                    <TableCell className="py-2">{d.downtime_reason || "—"}</TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="text-[0.6875rem] text-muted-foreground">audit-safe</span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Gauge className="mx-auto mb-2 size-8 opacity-30" />
                    <p className="text-xs font-semibold">No production entries for this filter.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 rounded-sm py-3">
      <CardHeader className="px-3">
        <CardTitle className="section-label text-[0.6875rem] font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3">
        <p className="font-mono text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
