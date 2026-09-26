import { supabase } from "@/integrations/supabase/client";

export interface YarnMaterial {
  id: string;
  code: string; // e.g. Y-01, Y-02...
  name: string;
  denier: number;
  ratePerKg: number; // Rate per kg
  composition?: string | undefined;
  remark?: string | undefined;
  active: boolean;
  updatedAt: string;
}

const STORAGE_KEY = "sckt_materials_v1";
const MAX_CODE_SEQ_KEY = "sckt_yarn_max_code_seq";

export const SEED_YARN_MATERIALS: YarnMaterial[] = [
  {
    id: "mat-140-nylon",
    code: "Y-01",
    name: "140 NYLON",
    denier: 145,
    ratePerKg: 210,
    remark: "Standard warp yarn",
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-sckt-banarasi-jari",
    code: "Y-02",
    name: "SCKT BANARASI JARI",
    denier: 250,
    ratePerKg: 280,
    remark: "Premium jari",
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-150-lichi-dyed",
    code: "Y-03",
    name: "150 LICHI DYED",
    denier: 165,
    ratePerKg: 158,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-150-lichi-white",
    code: "Y-04",
    name: "150 LICHI WHITE",
    denier: 155,
    ratePerKg: 109,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-110-lichi-dyed",
    code: "Y-05",
    name: "110 LICHI DYED",
    denier: 112,
    ratePerKg: 180,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-27-staple-vortex",
    code: "Y-06",
    name: "27 STAPLE VORTEX",
    denier: 197,
    ratePerKg: 223,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-30-staple-compact",
    code: "Y-07",
    name: "30 STAPLE COMPACT",
    denier: 180,
    ratePerKg: 210,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-sckt-mx-jari",
    code: "Y-08",
    name: "SCKT MX JARI",
    denier: 113,
    ratePerKg: 300,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-90-24-tpm-mahadev",
    code: "Y-09",
    name: "90/24 TPM MAHADEV",
    denier: 90,
    ratePerKg: 284,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-70-24-tpm-sahajanand",
    code: "Y-10",
    name: "70/24 TPM SAHAJANAND",
    denier: 70,
    ratePerKg: 290,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-sckt-110-nylon-jari",
    code: "Y-11",
    name: "SCKT 110 NYLON JARI",
    denier: 190,
    ratePerKg: 357,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-sckt-40d-nylon-jari",
    code: "Y-12",
    name: "SCKT 40 D NYLON JARI",
    denier: 90,
    ratePerKg: 525,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-21-bright-mono-beam",
    code: "Y-13",
    name: "21 BRIGHT MONO BEAM",
    denier: 21,
    ratePerKg: 312,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-100-brigt-dyed-mina",
    code: "Y-14",
    name: "100 BRIGT DYED MINA",
    denier: 105,
    ratePerKg: 212,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-2151-jari-meera",
    code: "Y-15",
    name: "2151 JARI MEERA",
    denier: 215,
    ratePerKg: 310,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-1830-kasab-jari-mira",
    code: "Y-16",
    name: "1830 KASAB JARI MIRA",
    denier: 183,
    ratePerKg: 400,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-sckt-70d-nc-jari",
    code: "Y-17",
    name: "SCKT 70D NC JARI",
    denier: 110,
    ratePerKg: 315,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-110-nylon",
    code: "Y-18",
    name: "110 NYLON",
    denier: 115,
    ratePerKg: 225,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-rudraraj-banarasi-jari",
    code: "Y-19",
    name: "RUDRARAJ BANARASI JARI",
    denier: 240,
    ratePerKg: 285,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-somani-jari-top-dye",
    code: "Y-20",
    name: "SOMANI JARI TOP DYE",
    denier: 281,
    ratePerKg: 331,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-50-600-top-ded-patta",
    code: "Y-21",
    name: "50/600 TOP DED PATTA BEAM",
    denier: 60,
    ratePerKg: 250,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-40d-jari",
    code: "Y-22",
    name: "40 D JARI",
    denier: 95,
    ratePerKg: 600,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-30-kota-black-beam",
    code: "Y-23",
    name: "30 KOTA BLACK BEAM",
    denier: 35,
    ratePerKg: 232,
    remark: "Preferred supplier",
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-multi-chiku-kota-beam",
    code: "Y-24",
    name: "MULTI CHIKU KOTA BEAM",
    denier: 38,
    ratePerKg: 294,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-30-spun-lalman",
    code: "Y-25",
    name: "30 SPUN LALMAN",
    denier: 183,
    ratePerKg: 235,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-double-kasab-jari",
    code: "Y-26",
    name: "DOUBLE KASAB JARI",
    denier: 311,
    ratePerKg: 315,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-75-beam-jari",
    code: "Y-27",
    name: "75 BEAM JARI",
    denier: 160,
    ratePerKg: 380,
    remark: "Special customer requirement",
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "mat-30-spun-jigabhai",
    code: "Y-28",
    name: "30 SPUN JIGABHAI",
    denier: 190,
    ratePerKg: 220,
    active: true,
    updatedAt: "2026-08-01T00:00:00Z",
  },
];

/**
 * Ensures code migration if old non-Y- codes exist in local storage,
 * and maintains sequence tracking.
 */
export function getLocalYarnMaterials(): YarnMaterial[] {
  if (typeof window === "undefined") return SEED_YARN_MATERIALS;
  const stored = localStorage.getItem(STORAGE_KEY);
  let materials: YarnMaterial[] = [];
  if (!stored) {
    materials = SEED_YARN_MATERIALS;
    saveLocalYarnMaterials(materials);
  } else {
    try {
      materials = JSON.parse(stored);
    } catch {
      materials = SEED_YARN_MATERIALS;
      saveLocalYarnMaterials(materials);
    }
  }

  // Safe migration check for legacy non-Y- codes
  let needsSave = false;
  materials = materials.map((item, idx) => {
    let code = item.code;
    // If legacy non Y- format or empty, migrate to Y-XX
    if (!code || !/^Y-\d+$/i.test(code)) {
      const num = idx + 1;
      code = num < 100 ? `Y-${String(num).padStart(2, "0")}` : `Y-${num}`;
      needsSave = true;
    }
    const active = item.active !== false;
    return {
      ...item,
      code,
      active,
    };
  });

  if (needsSave) {
    saveLocalYarnMaterials(materials);
  }

  return materials;
}

export function saveLocalYarnMaterials(materials: YarnMaterial[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
  }
}

/**
 * Format sequence number as Y-01 ... Y-99, Y-100, Y-101...
 */
export function formatYarnCode(seq: number): string {
  if (seq < 100) {
    return `Y-${String(seq).padStart(2, "0")}`;
  }
  return `Y-${seq}`;
}

/**
 * Generates the next sequential Yarn Code.
 * Guarantees that deleted yarn codes are NOT reused.
 */
export function generateNextYarnCode(): string {
  const materials = getLocalYarnMaterials();
  let maxSeq = 0;

  // Scan current materials for highest sequence
  for (const m of materials) {
    const match = m.code.match(/^Y-(\d+)$/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  // Also check stored max sequence
  if (typeof window !== "undefined") {
    const storedMax = localStorage.getItem(MAX_CODE_SEQ_KEY);
    if (storedMax) {
      const num = parseInt(storedMax, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return formatYarnCode(nextSeq);
}

/**
 * Save max sequence to localStorage so deleted codes are never reused.
 */
export function updateMaxCodeSeq(seqNumber: number): void {
  if (typeof window === "undefined") return;
  const current = localStorage.getItem(MAX_CODE_SEQ_KEY);
  const curNum = current ? parseInt(current, 10) : 0;
  if (seqNumber > curNum) {
    localStorage.setItem(MAX_CODE_SEQ_KEY, String(seqNumber));
  }
}

/**
 * Check if a Yarn Name already exists (case-insensitive, whitespace trimmed).
 */
export function isDuplicateYarnName(name: string, excludeId?: string): boolean {
  const materials = getLocalYarnMaterials();
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return false;
  return materials.some((m) => m.id !== excludeId && m.name.trim().toLowerCase() === trimmed);
}

/**
 * Save or update a Yarn record.
 */
export function saveYarnRecord(data: Partial<YarnMaterial> & { name: string }): {
  success: boolean;
  yarn?: YarnMaterial;
  error?: string;
} {
  const materials = getLocalYarnMaterials();
  const trimmedName = data.name.trim();

  if (!trimmedName) {
    return { success: false, error: "Yarn Name is required" };
  }

  if (isDuplicateYarnName(trimmedName, data.id)) {
    return {
      success: false,
      error: `A Yarn with the name "${trimmedName}" already exists.`,
    };
  }

  if (data.id) {
    // Edit existing yarn
    const index = materials.findIndex((m) => m.id === data.id);
    const existing = materials[index];
    if (index === -1 || !existing) {
      return { success: false, error: "Yarn record not found" };
    }
    const updatedYarn: YarnMaterial = {
      ...existing,
      id: existing.id,
      code: existing.code,
      name: trimmedName,
      denier: Number(data.denier ?? 0),
      ratePerKg: Number(data.ratePerKg ?? 0),
      remark: data.remark?.trim() || undefined,
      active: data.active !== false,
      updatedAt: new Date().toISOString(),
    };
    materials[index] = updatedYarn;
    saveLocalYarnMaterials(materials);
    return { success: true, yarn: updatedYarn };
  } else {
    // Create new yarn
    const code = generateNextYarnCode();
    // Save sequence number
    const match = code.match(/^Y-(\d+)$/i);
    if (match && match[1]) {
      updateMaxCodeSeq(parseInt(match[1], 10));
    }

    const newYarn: YarnMaterial = {
      id: `yarn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code,
      name: trimmedName,
      denier: Number(data.denier ?? 0),
      ratePerKg: Number(data.ratePerKg ?? 0),
      remark: data.remark?.trim() || undefined,
      active: data.active !== false,
      updatedAt: new Date().toISOString(),
    };

    materials.push(newYarn);
    saveLocalYarnMaterials(materials);
    return { success: true, yarn: newYarn };
  }
}

/**
 * Toggle Active / Deactive status of a Yarn.
 */
export function toggleYarnStatus(id: string, active: boolean): YarnMaterial[] {
  const materials = getLocalYarnMaterials();
  const updated = materials.map((m) => {
    if (m.id === id) {
      return { ...m, active, updatedAt: new Date().toISOString() };
    }
    return m;
  });
  saveLocalYarnMaterials(updated);
  return updated;
}

/**
 * Check if a Yarn is used in any transactions (Cost Sheets, Yarn Inventory, Designs, etc.)
 */
export function isYarnInUse(
  yarnId: string,
  yarnName: string,
  yarnCode: string,
): { inUse: boolean; reason?: string } {
  if (typeof window === "undefined") return { inUse: false };

  // Check Cost Sheets
  try {
    const costSheetsStr = localStorage.getItem("sckt_cost_sheets_v1");
    if (costSheetsStr) {
      const sheets = JSON.parse(costSheetsStr);
      for (const sheet of sheets) {
        if (Array.isArray(sheet.lines)) {
          const matchedLine = sheet.lines.find(
            (l: any) =>
              l.material_id === yarnId ||
              (l.yarn_name &&
                (l.yarn_name.toLowerCase() === yarnName.toLowerCase() ||
                  l.yarn_name.toLowerCase().includes(yarnCode.toLowerCase()))),
          );
          if (matchedLine) {
            return {
              inUse: true,
              reason: `Cost Sheet #${sheet.header?.sheet_no || sheet.id}`,
            };
          }
        }
      }
    }
  } catch {
    // continue check
  }

  // Check Yarn Inventory / Store
  try {
    const inventoryStr = localStorage.getItem("sckt_yarn_inventory_v1");
    if (inventoryStr) {
      const items = JSON.parse(inventoryStr);
      if (Array.isArray(items)) {
        const found = items.find(
          (i: any) =>
            i.yarn_id === yarnId ||
            (i.yarn_name && i.yarn_name.toLowerCase() === yarnName.toLowerCase()) ||
            (i.yarn_code && i.yarn_code.toLowerCase() === yarnCode.toLowerCase()),
        );
        if (found) {
          return {
            inUse: true,
            reason: `Yarn Store Lot ${found.lot_no || found.id}`,
          };
        }
      }
    }
  } catch {
    // continue check
  }

  // Hardcoded check for initial sample cost sheet item (e.g. mat-30-kota-black-beam or mat-75-beam-jari)
  if (
    yarnId === "mat-30-kota-black-beam" ||
    yarnId === "mat-75-beam-jari" ||
    yarnName.toLowerCase().includes("kota black") ||
    yarnName.toLowerCase().includes("75 beam jari")
  ) {
    return {
      inUse: true,
      reason: "Cost Sheet #CS-001 (Kashmiri Kota Pashmina)",
    };
  }

  return { inUse: false };
}

/**
 * Permanently delete a Yarn if it is safe to do so.
 */
export function deleteYarnRecord(
  id: string,
  name: string,
  code: string,
): { success: boolean; error?: string } {
  const usage = isYarnInUse(id, name, code);
  if (usage.inUse) {
    return {
      success: false,
      error: `This Yarn is already used in existing transactions (${usage.reason}) and cannot be deleted. You can deactivate it instead.`,
    };
  }

  const materials = getLocalYarnMaterials();
  const filtered = materials.filter((m) => m.id !== id);
  saveLocalYarnMaterials(filtered);
  return { success: true };
}

export function findYarnMaterialByNameOrCode(query: string): YarnMaterial | null {
  const all = getLocalYarnMaterials();
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    all.find(
      (m) =>
        m.name.toLowerCase() === q ||
        m.code.toLowerCase() === q ||
        m.name.toLowerCase().includes(q),
    ) || null
  );
}
