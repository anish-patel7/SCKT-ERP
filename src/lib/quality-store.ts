// Phase 6 — Quality Assurance & Inspection Store (M35)

export type DefectType =
  "warp_float" | "weft_slub" | "broken_end" | "oil_stain" | "hole" | "tension_variation";

export type QualityGrade = "Grade A" | "Grade B" | "Grade C" | "Hold";

export interface DefectEntry {
  id: string;
  defect_type: DefectType;
  size_inches: number;
  points_scored: number; // 1 to 4 pts
  yard_position: number;
  x_position_inch: number;
}

export interface InspectionRecord {
  id: string;
  inspection_no: string;
  roll_id: string;
  roll_no: string;
  item_code: string;
  design_no: string;
  loom_no: string;
  shift: "A" | "B" | "C";
  operator_name: string;
  roll_length_yd: number;
  roll_width_inch: number;
  defects: DefectEntry[];
  total_raw_points: number;
  capped_points: number; // BR-155 cap max 4 pts per linear yard
  points_per_100_sq_yd: number; // Formula: (Capped Points * 3600) / (Roll Length Yd * Roll Width Inch)
  system_grade: QualityGrade;
  manual_grade_override: QualityGrade | null;
  override_reason: string | null;
  status: "verified" | "pending_supervisor";
  verified_by: string | null;
  created_at: string;
}

export interface ShadeApproval {
  id: string;
  lab_dip_no: string;
  customer_name: string;
  design_no: string;
  shade_name: string;
  hex_color: string;
  delta_e_value: number;
  status: "approved" | "rejected" | "pending_buyer";
  buyer_remarks: string;
  created_at: string;
}

export interface LabTest {
  id: string;
  test_no: string;
  roll_no: string;
  gsm_actual: number;
  gsm_spec: number;
  tear_strength_warp: number;
  tear_strength_weft: number;
  shrinkage_pct: number;
  status: "pass" | "fail";
  tested_at: string;
}

export interface QualityData {
  inspections: InspectionRecord[];
  shadeDips: ShadeApproval[];
  labTests: LabTest[];
}

const STORAGE_KEY = "weaveone_quality_v1";

export function calculatePointsForDefect(sizeInches: number, type: DefectType): number {
  if (type === "hole") return 4;
  if (sizeInches <= 3) return 1;
  if (sizeInches <= 6) return 2;
  if (sizeInches <= 9) return 3;
  return 4;
}

/**
 * 4-Point System Scoring Engine (M35)
 * Enforces BR-155: Max 4 points per linear yard.
 * Enforces Acceptance Criteria 2: Points per 100 sq yd = (Capped Points * 3600) / (Length Yd * Width Inch).
 */
export function calculate4PointScore(
  lengthYd: number,
  widthInch: number,
  defects: DefectEntry[],
): {
  totalRawPoints: number;
  cappedPoints: number;
  pointsPer100SqYd: number;
  systemGrade: QualityGrade;
} {
  const totalRawPoints = defects.reduce((sum, d) => sum + d.points_scored, 0);

  // Group defects by linear yard position for BR-155 capping (max 4 pts per yard)
  const yardPointsMap: Record<number, number> = {};
  for (const d of defects) {
    const yardIndex = Math.floor(d.yard_position);
    yardPointsMap[yardIndex] = (yardPointsMap[yardIndex] || 0) + d.points_scored;
  }

  let cappedPoints = 0;
  for (const pts of Object.values(yardPointsMap)) {
    cappedPoints += Math.min(pts, 4); // BR-155: cap at 4 points per linear yard
  }

  // Acceptance Criteria 2 Formula: Points / 100 sq yd = (Capped Points * 3600) / (Length Yd * Width Inch)
  const areaSqYd = (lengthYd * widthInch) / 36;
  const pointsPer100SqYd = areaSqYd > 0 ? (cappedPoints / areaSqYd) * 100 : 0;

  // Grade Assignment: <= 20.0 = Grade A, 20.1 - 40.0 = Grade B, > 40.0 = Grade C
  let systemGrade: QualityGrade = "Grade A";
  if (pointsPer100SqYd > 40) {
    systemGrade = "Grade C";
  } else if (pointsPer100SqYd > 20) {
    systemGrade = "Grade B";
  }

  return {
    totalRawPoints,
    cappedPoints,
    pointsPer100SqYd: Number(pointsPer100SqYd.toFixed(1)),
    systemGrade,
  };
}

const SEED: QualityData = {
  inspections: [
    {
      id: "insp-001",
      inspection_no: "INS-9901",
      roll_id: "rol-1001",
      roll_no: "ROL-9901",
      item_code: "ITEM-001",
      design_no: "D-015",
      loom_no: "L-01",
      shift: "A",
      operator_name: "Ramesh Kumar",
      roll_length_yd: 100,
      roll_width_inch: 44,
      defects: [
        {
          id: "d1",
          defect_type: "weft_slub",
          size_inches: 2,
          points_scored: 1,
          yard_position: 12,
          x_position_inch: 14,
        },
        {
          id: "d2",
          defect_type: "warp_float",
          size_inches: 5,
          points_scored: 2,
          yard_position: 34,
          x_position_inch: 28,
        },
        {
          id: "d3",
          defect_type: "broken_end",
          size_inches: 8,
          points_scored: 3,
          yard_position: 68,
          x_position_inch: 10,
        },
      ],
      total_raw_points: 6,
      capped_points: 6,
      points_per_100_sq_yd: 4.9, // (6 * 3600) / (100 * 44) = 4.9 -> Grade A
      system_grade: "Grade A",
      manual_grade_override: null,
      override_reason: null,
      status: "verified",
      verified_by: "Quality Manager",
      created_at: "2026-08-05T14:30:00Z",
    },
    {
      id: "insp-002",
      inspection_no: "INS-9902",
      roll_id: "rol-1002",
      roll_no: "ROL-9902",
      item_code: "ITEM-001",
      design_no: "D-015",
      loom_no: "L-01",
      shift: "B",
      operator_name: "Suresh Patel",
      roll_length_yd: 100,
      roll_width_inch: 44,
      defects: [
        {
          id: "d4",
          defect_type: "oil_stain",
          size_inches: 12,
          points_scored: 4,
          yard_position: 15,
          x_position_inch: 22,
        },
        {
          id: "d5",
          defect_type: "hole",
          size_inches: 1,
          points_scored: 4,
          yard_position: 42,
          x_position_inch: 30,
        },
        {
          id: "d6",
          defect_type: "weft_slub",
          size_inches: 7,
          points_scored: 3,
          yard_position: 55,
          x_position_inch: 18,
        },
        {
          id: "d7",
          defect_type: "tension_variation",
          size_inches: 10,
          points_scored: 4,
          yard_position: 80,
          x_position_inch: 12,
        },
        {
          id: "d8",
          defect_type: "broken_end",
          size_inches: 8,
          points_scored: 3,
          yard_position: 90,
          x_position_inch: 35,
        },
      ],
      total_raw_points: 18,
      capped_points: 18,
      points_per_100_sq_yd: 14.7, // Grade A
      system_grade: "Grade A",
      manual_grade_override: null,
      override_reason: null,
      status: "verified",
      verified_by: "Quality Supervisor",
      created_at: "2026-08-06T16:00:00Z",
    },
    {
      id: "insp-003",
      inspection_no: "INS-9903",
      roll_id: "rol-1003",
      roll_no: "ROL-9903",
      item_code: "ITEM-002",
      design_no: "D-022",
      loom_no: "L-02",
      shift: "C",
      operator_name: "Mahesh Verma",
      roll_length_yd: 100,
      roll_width_inch: 44,
      defects: [
        {
          id: "d9",
          defect_type: "oil_stain",
          size_inches: 14,
          points_scored: 4,
          yard_position: 20,
          x_position_inch: 15,
        },
        {
          id: "d10",
          defect_type: "hole",
          size_inches: 2,
          points_scored: 4,
          yard_position: 20,
          x_position_inch: 25,
        },
        {
          id: "d11",
          defect_type: "hole",
          size_inches: 2,
          points_scored: 4,
          yard_position: 20,
          x_position_inch: 35,
        }, // Multiple defects in yard 20 capped at 4 (BR-155)
      ],
      total_raw_points: 12,
      capped_points: 4, // BR-155 Capped at 4 for yard 20
      points_per_100_sq_yd: 3.3,
      system_grade: "Hold",
      manual_grade_override: null,
      override_reason: "Oil contamination under inspection (BR-153 Hold)",
      status: "pending_supervisor",
      verified_by: null,
      created_at: "2026-08-07T09:30:00Z",
    },
  ],
  shadeDips: [
    {
      id: "shd-001",
      lab_dip_no: "LIP-8801",
      customer_name: "Shree Fabrics Pvt Ltd",
      design_no: "D-015",
      shade_name: "Royal Navy Blue #44",
      hex_color: "#1e3a8a",
      delta_e_value: 0.42, // Under 1.0 is approved
      status: "approved",
      buyer_remarks: "Approved by buyer lab team",
      created_at: "2026-08-01T11:00:00Z",
    },
    {
      id: "shd-002",
      lab_dip_no: "LIP-8802",
      customer_name: "Ravi Textiles",
      design_no: "D-022",
      shade_name: "Metallic Banarasi Gold #12",
      hex_color: "#d97706",
      delta_e_value: 0.85,
      status: "pending_buyer",
      buyer_remarks: "Sent lab swatch card to buyer for sign-off",
      created_at: "2026-08-04T15:20:00Z",
    },
  ],
  labTests: [
    {
      id: "lab-001",
      test_no: "LAB-7701",
      roll_no: "ROL-9901",
      gsm_actual: 145,
      gsm_spec: 142,
      tear_strength_warp: 38,
      tear_strength_weft: 34,
      shrinkage_pct: 1.2,
      status: "pass",
      tested_at: "2026-08-05T16:00:00Z",
    },
    {
      id: "lab-002",
      test_no: "LAB-7702",
      roll_no: "ROL-9903",
      gsm_actual: 160,
      gsm_spec: 142,
      tear_strength_warp: 28,
      tear_strength_weft: 25,
      shrinkage_pct: 3.8,
      status: "fail",
      tested_at: "2026-08-07T11:00:00Z",
    },
  ],
};

export function getQuality(): QualityData {
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

export function saveQuality(data: QualityData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}
