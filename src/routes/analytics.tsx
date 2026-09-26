import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  Zap,
  Cpu,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAnalyticsIoT } from "@/hooks/useAnalyticsIoT";
import { calculateShedSummary, type AiSuggestion, type LoomStatus } from "@/lib/analytics-store";
import { fmt } from "@/lib/costing";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/analytics")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "IoT Machine Telemetry & AI Analytics — SCKT ERP" },
      {
        name: "description",
        content:
          "Real-time IoT loom telemetry wall, live efficiency, telemetry gap detection (BR-157), energy consumption per metre, and advisory AI yarn substitution engine (BR-159).",
      },
      { property: "og:title", content: "Analytics — SCKT ERP" },
      { property: "og:description", content: "Real-time IoT telemetry and AI cost optimization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const STATUS_BADGES: Record<LoomStatus, { label: string; class: string }> = {
  running: { label: "Running", class: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold" },
  stopped: { label: "Stopped", class: "bg-amber-500 text-black font-semibold" },
  fault: { label: "Fault / Error", class: "bg-rose-600 text-white font-bold" },
  telemetry_gap: {
    label: "Telemetry Gap (BR-157)",
    class: "bg-slate-700 text-amber-400 border border-amber-500 font-mono",
  },
};

function AnalyticsPage() {
  const { data, update } = useAnalyticsIoT();
  const [activeTab, setActiveTab] = useState("telemetry");

  const summary = calculateShedSummary(data.looms);

  // BR-159 & BR-160 Advisory AI Suggestion Approval
  const handleApplyAiSuggestion = (suggestion: AiSuggestion) => {
    const updatedAi = data.aiSuggestions.map((s) => {
      if (s.id !== suggestion.id) return s;
      return { ...s, status: "applied" as const };
    });

    update((prev) => ({
      ...prev,
      aiSuggestions: updatedAi,
    }));

    toast.success(
      `AI Recommendation "${suggestion.title}" applied! Cost Sheet optimization committed with +${suggestion.margin_impact_pct}% margin impact.`,
    );
  };

  const handleRejectAiSuggestion = (id: string) => {
    update((prev) => ({
      ...prev,
      aiSuggestions: prev.aiSuggestions.map((s) =>
        s.id === id ? { ...s, status: "rejected" as const } : s,
      ),
    }));
    toast.info("AI recommendation dismissed");
  };

  return (
    <AppShell
      title="IoT Machine Telemetry & AI Layer (M36 & M37)"
      breadcrumb={[{ label: "Insights" }, { label: "Analytics" }]}
      actions={
        <Badge
          variant="outline"
          className="font-mono text-xs gap-1 bg-emerald-500/10 text-emerald-700 border-emerald-300"
        >
          <Activity className="size-3.5 text-emerald-600 animate-pulse" /> Telemetry Feed: Live 10s
        </Badge>
      }
    >
      <div className="space-y-4">
        {/* KPI Bar */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Shed Efficiency</span>
                <TrendingUp className="size-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-emerald-600">
                {summary.avgEfficiencyPct}%
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">BR-157 Gaps excluded</span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Running Looms</span>
                <Cpu className="size-4 text-primary" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {summary.runningLooms} / {summary.totalLooms} Looms
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Active weaving production
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Telemetry Gaps</span>
                <AlertTriangle className="size-4 text-amber-500" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-amber-600">
                {summary.gapLooms} Looms
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                BR-157 Sensors offline &gt;30m
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Energy Rate</span>
                <Zap className="size-4 text-amber-500" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-foreground">
                {summary.totalEnergyKwh} kWh
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">Avg 0.18 kWh / metre</span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>AI Advisory Signals</span>
                <Sparkles className="size-4 text-purple-600" />
              </div>
              <p className="mt-1 text-lg font-bold font-mono text-purple-600">
                {data.aiSuggestions.filter((s) => s.status === "pending").length} Pending
              </p>
              <span className="text-[0.6875rem] text-muted-foreground">
                BR-159 Advisory outputs
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Telemetry Grid, Downtime Pareto & AI Layer */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="telemetry" className="h-7 text-xs gap-1">
              <Cpu className="size-3.5" /> Live IoT Machine Status Wall
            </TabsTrigger>
            <TabsTrigger value="ai" className="h-7 text-xs gap-1">
              <Sparkles className="size-3.5 text-purple-600" /> AI Optimization & Predictive Layer
              (M37)
            </TabsTrigger>
            <TabsTrigger value="downtime" className="h-7 text-xs gap-1">
              <Clock className="size-3.5" /> Downtime Pareto Analytics
            </TabsTrigger>
          </TabsList>

          {/* Telemetry Wall Grid */}
          <TabsContent value="telemetry" className="space-y-3 mt-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.looms.map((loom) => {
                const badge = STATUS_BADGES[loom.status];
                return (
                  <Card
                    key={loom.loom_no}
                    className="border border-border relative overflow-hidden"
                  >
                    <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b border-border/40">
                      <div>
                        <CardTitle className="text-sm font-bold font-mono text-primary">
                          Loom {loom.loom_no}
                        </CardTitle>
                        <span className="text-[0.625rem] text-muted-foreground">
                          {loom.loom_model}
                        </span>
                      </div>
                      <Badge className={`text-[0.625rem] ${badge.class}`}>{badge.label}</Badge>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2.5">
                      {/* Telemetry Gap Alert Banner (BR-157) */}
                      {loom.status === "telemetry_gap" && (
                        <div className="rounded bg-amber-500/10 border border-amber-300 p-2 text-[0.6875rem] text-amber-800 flex items-start gap-1.5">
                          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>BR-157 Telemetry Gap Detected:</strong> Sensor offline for{" "}
                            {loom.telemetry_gap_minutes} mins. Explicitly excluded from shed
                            efficiency.
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[0.625rem] text-muted-foreground">Live RPM</span>
                          <p className="font-mono font-bold text-foreground text-sm">
                            {loom.live_rpm} RPM
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[0.625rem] text-muted-foreground">
                            Live Efficiency
                          </span>
                          <p className="font-mono font-bold text-emerald-600 text-sm">
                            {loom.live_efficiency_pct}%
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[0.625rem]">
                          <span className="text-muted-foreground">Efficiency Target (85%)</span>
                          <span className="font-mono font-semibold">
                            {loom.live_efficiency_pct}%
                          </span>
                        </div>
                        <Progress value={loom.live_efficiency_pct} className="h-1.5" />
                      </div>

                      <div className="grid grid-cols-3 gap-1 pt-1 text-[0.6875rem] font-mono border-t border-border/40">
                        <div>
                          <span className="text-[0.5625rem] text-muted-foreground block">
                            Picks
                          </span>
                          <span className="font-bold">{fmt(loom.picks_today, 0)}</span>
                        </div>
                        <div>
                          <span className="text-[0.5625rem] text-muted-foreground block">
                            Metres
                          </span>
                          <span className="font-bold">{loom.metres_today} m</span>
                        </div>
                        <div>
                          <span className="text-[0.5625rem] text-muted-foreground block">
                            Energy
                          </span>
                          <span className="font-bold">{loom.energy_kwh_per_metre} kWh/m</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[0.625rem] text-muted-foreground pt-1">
                        <span>Heat Temp: {loom.heat_temp_c}°C</span>
                        <span className="font-mono">{loom.last_telemetry_time}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* AI Layer & Predictive Maintenance (M37) */}
          <TabsContent value="ai" className="space-y-3 mt-3">
            <Card className="border border-purple-200 bg-purple-50/20 dark:bg-purple-950/10">
              <CardHeader className="p-3 pb-2 border-b border-purple-200/40">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-purple-900 dark:text-purple-300">
                  <Sparkles className="size-4 text-purple-600" /> AI Advisory & Predictive
                  Optimization (BR-159 / BR-160)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  <strong>BR-159 Compliance:</strong> AI recommendations are advisory and display
                  margin impact and confidence scores. Human authorization is required to apply
                  suggestions.
                </p>

                <div className="grid gap-3">
                  {data.aiSuggestions.map((s) => (
                    <Card key={s.id} className="border border-border bg-card">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-purple-600 text-white text-[0.625rem]">
                                {s.category.replace(/_/g, " ").toUpperCase()}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-[0.625rem] font-mono text-purple-700 border-purple-300 font-bold"
                              >
                                {s.confidence_pct}% Confidence Score
                              </Badge>
                            </div>
                            <h4 className="text-xs font-bold text-foreground mt-1">{s.title}</h4>
                          </div>
                          {s.status === "applied" ? (
                            <Badge className="bg-emerald-600 text-white text-[0.625rem]">
                              Applied
                            </Badge>
                          ) : s.status === "rejected" ? (
                            <Badge variant="outline" className="text-[0.625rem]">
                              Dismissed
                            </Badge>
                          ) : null}
                        </div>

                        <p className="text-xs text-muted-foreground">{s.description}</p>

                        <div className="rounded bg-muted/30 p-2 text-xs font-mono grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[0.5625rem] text-muted-foreground block">
                              Current Cost
                            </span>
                            <span className="font-bold">₹{s.current_cost_inr} / m</span>
                          </div>
                          <div>
                            <span className="text-[0.5625rem] text-muted-foreground block">
                              Proposed Cost
                            </span>
                            <span className="font-bold text-emerald-600">
                              ₹{s.proposed_cost_inr} / m
                            </span>
                          </div>
                          <div>
                            <span className="text-[0.5625rem] text-muted-foreground block">
                              Margin Impact
                            </span>
                            <span className="font-bold text-emerald-600">
                              +{s.margin_impact_pct}%
                            </span>
                          </div>
                        </div>

                        <div className="text-[0.6875rem] text-muted-foreground bg-purple-500/5 p-2 rounded border border-purple-200/40">
                          <strong>Calculation Basis (BR-160):</strong> {s.basis}
                        </div>

                        {s.status === "pending" && (
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectAiSuggestion(s.id)}
                              className="h-6 text-[0.6875rem]"
                            >
                              Dismiss
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApplyAiSuggestion(s)}
                              className="h-6 text-[0.6875rem] gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              <ArrowUpRight className="size-3" /> Apply Recommendation
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Downtime Pareto Analytics */}
          <TabsContent value="downtime" className="space-y-3 mt-3">
            <Card className="rounded-md border border-border">
              <CardContent className="p-0">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/60 font-semibold text-muted-foreground">
                      <TableHead className="h-8">Downtime Ref</TableHead>
                      <TableHead className="h-8">Loom #</TableHead>
                      <TableHead className="h-8">Stop Cause</TableHead>
                      <TableHead className="h-8 text-right">Duration (mins)</TableHead>
                      <TableHead className="h-8">Shift & Operator</TableHead>
                      <TableHead className="h-8">Start Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.downtimeLogs.map((dt) => (
                      <TableRow key={dt.id} className="hover:bg-muted/40">
                        <TableCell className="py-2 font-mono font-bold text-primary">
                          {dt.id}
                        </TableCell>
                        <TableCell className="py-2 font-mono font-semibold">
                          Loom {dt.loom_no}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className="font-mono text-[0.625rem] capitalize">
                            {dt.stop_cause.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono font-bold text-rose-600">
                          {dt.duration_minutes} mins
                        </TableCell>
                        <TableCell className="py-2 font-semibold">
                          Shift {dt.shift} ({dt.operator})
                        </TableCell>
                        <TableCell className="py-2 font-mono text-muted-foreground">
                          {dt.start_time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
