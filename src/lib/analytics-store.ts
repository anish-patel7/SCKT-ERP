// Phase 7 — Machine Telemetry, IoT, Energy & AI Layer (M36 & M37)

export type LoomStatus = "running" | "stopped" | "fault" | "telemetry_gap";

export type StopCause =
  "warp_break" | "weft_break" | "beam_out" | "mechanical_fault" | "electrical_fault" | "none";

export interface LoomTelemetry {
  loom_no: string;
  loom_model: string;
  status: LoomStatus;
  live_rpm: number;
  live_efficiency_pct: number;
  picks_today: number;
  metres_today: number;
  stop_cause: StopCause;
  energy_kwh_today: number;
  energy_kwh_per_metre: number;
  heat_temp_c: number;
  last_telemetry_time: string;
  telemetry_gap_minutes?: number | undefined; // BR-157 Telemetry Gap
}

export interface DowntimeLog {
  id: string;
  loom_no: string;
  stop_cause: StopCause;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  shift: "A" | "B" | "C";
  operator: string;
}

export interface AiSuggestion {
  id: string;
  title: string;
  category: "yarn_substitution" | "maintenance_alert" | "cost_optimization";
  description: string;
  current_cost_inr: number;
  proposed_cost_inr: number;
  margin_impact_pct: number;
  confidence_pct: number;
  basis: string; // BR-160 Basis explanation
  status: "pending" | "applied" | "rejected";
  created_at: string;
}

export interface AnalyticsData {
  looms: LoomTelemetry[];
  downtimeLogs: DowntimeLog[];
  aiSuggestions: AiSuggestion[];
}

const STORAGE_KEY = "weaveone_analytics_v1";

/**
 * Calculates Shed-wide live efficiency while enforcing BR-157:
 * Telemetry gaps must be visible as gaps and excluded from efficiency denominators.
 */
export function calculateShedSummary(looms: LoomTelemetry[]): {
  totalLooms: number;
  runningLooms: number;
  stoppedLooms: number;
  faultLooms: number;
  gapLooms: number;
  avgEfficiencyPct: number;
  totalEnergyKwh: number;
  totalMetres: number;
} {
  const totalLooms = looms.length;
  const runningLooms = looms.filter((l) => l.status === "running").length;
  const stoppedLooms = looms.filter((l) => l.status === "stopped").length;
  const faultLooms = looms.filter((l) => l.status === "fault").length;
  const gapLooms = looms.filter((l) => l.status === "telemetry_gap").length;

  // Exclude telemetry gap looms from average efficiency denominator per BR-157 & Acceptance Criteria 1
  const validLooms = looms.filter((l) => l.status !== "telemetry_gap");
  const sumEfficiency = validLooms.reduce((sum, l) => sum + l.live_efficiency_pct, 0);
  const avgEfficiencyPct = validLooms.length > 0 ? sumEfficiency / validLooms.length : 0;

  const totalEnergyKwh = looms.reduce((sum, l) => sum + l.energy_kwh_today, 0);
  const totalMetres = looms.reduce((sum, l) => sum + l.metres_today, 0);

  return {
    totalLooms,
    runningLooms,
    stoppedLooms,
    faultLooms,
    gapLooms,
    avgEfficiencyPct: Number(avgEfficiencyPct.toFixed(1)),
    totalEnergyKwh: Number(totalEnergyKwh.toFixed(1)),
    totalMetres,
  };
}

const SEED: AnalyticsData = {
  looms: [
    {
      loom_no: "L-01",
      loom_model: "Picanol OmniPlus Summum",
      status: "running",
      live_rpm: 680,
      live_efficiency_pct: 92.4,
      picks_today: 420000,
      metres_today: 280,
      stop_cause: "none",
      energy_kwh_today: 42.5,
      energy_kwh_per_metre: 0.15,
      heat_temp_c: 38.2,
      last_telemetry_time: "Just now",
    },
    {
      loom_no: "L-02",
      loom_model: "Tsudakoma ZAX9200",
      status: "running",
      live_rpm: 650,
      live_efficiency_pct: 88.6,
      picks_today: 390000,
      metres_today: 255,
      stop_cause: "none",
      energy_kwh_today: 40.2,
      energy_kwh_per_metre: 0.16,
      heat_temp_c: 39.1,
      last_telemetry_time: "Just now",
    },
    {
      loom_no: "L-03",
      loom_model: "Itema A9500",
      status: "stopped",
      live_rpm: 0,
      live_efficiency_pct: 64.2,
      picks_today: 210000,
      metres_today: 140,
      stop_cause: "weft_break",
      energy_kwh_today: 28.0,
      energy_kwh_per_metre: 0.2,
      heat_temp_c: 36.5,
      last_telemetry_time: "2 mins ago",
    },
    {
      loom_no: "L-04",
      loom_model: "Toyota JAT810",
      status: "fault",
      live_rpm: 0,
      live_efficiency_pct: 45.0,
      picks_today: 150000,
      metres_today: 95,
      stop_cause: "electrical_fault",
      energy_kwh_today: 22.1,
      energy_kwh_per_metre: 0.23,
      heat_temp_c: 44.8,
      last_telemetry_time: "5 mins ago",
    },
    {
      loom_no: "L-05",
      loom_model: "Picanol OptiMax-i",
      status: "telemetry_gap", // BR-157 Telemetry Gap
      live_rpm: 0,
      live_efficiency_pct: 0,
      picks_today: 180000,
      metres_today: 120,
      stop_cause: "none",
      energy_kwh_today: 25.0,
      energy_kwh_per_metre: 0.21,
      heat_temp_c: 35.0,
      last_telemetry_time: "32 mins ago",
      telemetry_gap_minutes: 32,
    },
  ],
  downtimeLogs: [
    {
      id: "dt-001",
      loom_no: "L-03",
      stop_cause: "weft_break",
      start_time: "2026-08-09T14:15:00Z",
      end_time: "2026-08-09T14:27:00Z",
      duration_minutes: 12,
      shift: "A",
      operator: "Ramesh Kumar",
    },
    {
      id: "dt-002",
      loom_no: "L-04",
      stop_cause: "electrical_fault",
      start_time: "2026-08-09T13:00:00Z",
      end_time: "2026-08-09T14:10:00Z",
      duration_minutes: 70,
      shift: "A",
      operator: "Suresh Patel",
    },
    {
      id: "dt-003",
      loom_no: "L-02",
      stop_cause: "warp_break",
      start_time: "2026-08-09T11:20:00Z",
      end_time: "2026-08-09T11:35:00Z",
      duration_minutes: 15,
      shift: "A",
      operator: "Suresh Patel",
    },
  ],
  aiSuggestions: [
    {
      id: "ai-001",
      title: "Yarn Substitution: 80s Cotton Compact to 80s Micro-Denier Modal",
      category: "yarn_substitution",
      description:
        "Substitute Weft yarn on Design D-015 with Micro-Denier Modal to reduce yarn breakage by 18% while enhancing fabric lustre.",
      current_cost_inr: 142.5,
      proposed_cost_inr: 134.8,
      margin_impact_pct: 4.8,
      confidence_pct: 94,
      basis:
        "Based on 1,200 loom operating hours on Picanol Airjet looms. Modal yarn tensile strength improves weft insertion velocity by 45 m/min.",
      status: "pending",
      created_at: "2026-08-09T10:00:00Z",
    },
    {
      id: "ai-002",
      title: "Predictive Maintenance: Loom L-04 Main Motor Bearing Wear",
      category: "maintenance_alert",
      description:
        "Telemetry heat sensors detected +6.8°C thermal spike on main motor bearing. Schedule preventive lubrication before breakdown.",
      current_cost_inr: 0,
      proposed_cost_inr: 1500,
      margin_impact_pct: 12.5,
      confidence_pct: 89,
      basis:
        "Vibration and temperature telemetry anomaly model (BR-160). Prevents estimated 8 hours of catastrophic loom downtime.",
      status: "pending",
      created_at: "2026-08-09T12:30:00Z",
    },
  ],
};

export function getAnalytics(): AnalyticsData {
  if (typeof window === "undefined") return SEED;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
    return SEED;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return SEED;
  }
}

export function saveAnalytics(data: AnalyticsData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}
