import { supabase } from "@/integrations/supabase/client";
import type { DesignWithDetails, FeederCrossReferenceItem, DesignFilter } from "@/types/design";

const STORAGE_KEY = "sckt_designs_v1";
const DRAFT_KEY = "sckt_design_draft";

const SEED_DESIGNS: DesignWithDetails[] = [
  {
    id: "des-015-uuid-0001",
    designNumber: "D-015",
    designName: "Kashmiri Pashmina",
    dn: "DN-440",
    dnCode: "DN-440-KASH",
    reed: 120,
    patti: 12,
    totalDC: 14400,
    totalCut: 4,
    work: "Jacquard Pashmina",
    blueApt: "Blue-99 / APT-A",
    description: "Premium Kashmiri Pashmina weave with intricate Jacquard floral patterns.",
    remarks: "Approved for high-end boutique range.",
    image:
      "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600&auto=format&fit=crop&q=80",
    createdAt: "2026-08-01T10:00:00Z",
    updatedAt: "2026-08-08T12:00:00Z",
    beamColours: [
      {
        id: "bc-015-1",
        designId: "des-015-uuid-0001",
        beamColour: "50/600 P.Blue Poly",
        displayOrder: 1,
        feeders: [
          {
            id: "fdr-015-1-1",
            beamColourId: "bc-015-1",
            feederNumber: "FDR-1",
            pick: 160,
            card: 64,
            colorName: "110/72 N.Blue",
            oldNumber: "5831",
            displayOrder: 1,
          },
          {
            id: "fdr-015-1-2",
            beamColourId: "bc-015-1",
            feederNumber: "FDR-2",
            pick: 160,
            card: 64,
            colorName: "110/72 N.Blue",
            oldNumber: "5832",
            displayOrder: 2,
          },
          {
            id: "fdr-015-1-3",
            beamColourId: "bc-015-1",
            feederNumber: "FDR-3",
            pick: 150,
            card: 64,
            colorName: "1650 Dev Banarasi",
            oldNumber: "5833",
            displayOrder: 3,
          },
        ],
      },
      {
        id: "bc-015-2",
        designId: "des-015-uuid-0001",
        beamColour: "50/600 Firozi",
        displayOrder: 2,
        feeders: [
          {
            id: "fdr-015-2-1",
            beamColourId: "bc-015-2",
            feederNumber: "FDR-1",
            pick: 160,
            card: 64,
            colorName: "Ms 9 Water",
            oldNumber: "5834",
            displayOrder: 1,
          },
          {
            id: "fdr-015-2-2",
            beamColourId: "bc-015-2",
            feederNumber: "FDR-2",
            pick: 160,
            card: 64,
            colorName: "110/72 Red",
            oldNumber: "5835",
            displayOrder: 2,
          },
          {
            id: "fdr-015-2-3",
            beamColourId: "bc-015-2",
            feederNumber: "FDR-3",
            pick: 150,
            card: 64,
            colorName: "110/72 Mustard",
            oldNumber: "5836",
            displayOrder: 3,
          },
        ],
      },
    ],
  },
  {
    id: "des-012-uuid-0002",
    designName: "Silk Brocade Royal",
    designNumber: "D-012",
    dn: "DN-310",
    dnCode: "DN-310-ROYAL",
    reed: 140,
    patti: 16,
    totalDC: 18000,
    totalCut: 6,
    work: "Brocade Work",
    blueApt: "APT-B",
    description: "Royal Silk Brocade pattern featuring metallic gold weave accents.",
    remarks: "Requires slow loom speed.",
    image:
      "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&auto=format&fit=crop&q=80",
    createdAt: "2026-07-15T08:30:00Z",
    updatedAt: "2026-08-05T14:20:00Z",
    beamColours: [
      {
        id: "bc-012-1",
        designId: "des-012-uuid-0002",
        beamColour: "50/600 Gold Lurex",
        displayOrder: 1,
        feeders: [
          {
            id: "fdr-012-1-1",
            beamColourId: "bc-012-1",
            feederNumber: "FDR-1",
            pick: 180,
            card: 96,
            colorName: "Lurex Gold Metallic",
            oldNumber: "7011",
            displayOrder: 1,
          },
          {
            id: "fdr-012-1-2",
            beamColourId: "bc-012-1",
            feederNumber: "FDR-2",
            pick: 180,
            card: 96,
            colorName: "Viscose 30s Red",
            oldNumber: "7012",
            displayOrder: 2,
          },
        ],
      },
    ],
  },
  {
    id: "des-008-uuid-0003",
    designName: "Jacquard Floral Garden",
    designNumber: "D-008",
    dn: "DN-180",
    dnCode: "DN-180-FLORAL",
    reed: 100,
    patti: 8,
    totalDC: 9600,
    totalCut: 2,
    work: "Floral Motif",
    blueApt: "Blue-12",
    description: "Multi-colored floral jacquard motif for dress materials.",
    remarks: "Standard export quality.",
    image:
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=80",
    createdAt: "2026-06-20T11:15:00Z",
    updatedAt: "2026-07-28T09:45:00Z",
    beamColours: [
      {
        id: "bc-008-1",
        designId: "des-008-uuid-0003",
        beamColour: "50/600 P.Green Poly",
        displayOrder: 1,
        feeders: [
          {
            id: "fdr-008-1-1",
            beamColourId: "bc-008-1",
            feederNumber: "FDR-1",
            pick: 120,
            card: 48,
            colorName: "110/72 Emerald Green",
            oldNumber: "4201",
            displayOrder: 1,
          },
          {
            id: "fdr-008-1-2",
            beamColourId: "bc-008-1",
            feederNumber: "FDR-2",
            pick: 120,
            card: 48,
            colorName: "110/72 Parrot Green",
            oldNumber: "4202",
            displayOrder: 2,
          },
        ],
      },
    ],
  },
];

export function getLocalDesigns(): DesignWithDetails[] {
  if (typeof window === "undefined") return SEED_DESIGNS;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DESIGNS));
    return SEED_DESIGNS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return SEED_DESIGNS;
  }
}

export function saveLocalDesigns(designs: DesignWithDetails[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
  }
}

export async function logAudit(action: string, entityId: string, details: string) {
  try {
    await supabase.from("audit_log").insert({
      entity: "design",
      entity_id: entityId,
      action,
      details,
      actor_name: "Demo Admin",
    });
  } catch {
    // Ignore audit log error if offline
  }
}

export function getFilteredDesigns(filter: DesignFilter): {
  items: DesignWithDetails[];
  total: number;
  totalPages: number;
} {
  let all = getLocalDesigns();

  // Search filter across Design Number, Name, DN, DN Code, Beam Colour, Feeder Color, Old Number, Work, Reed, Pick
  const q = filter.query.trim().toLowerCase();
  if (q) {
    all = all.filter((d) => {
      const matchBasic =
        d.designNumber.toLowerCase().includes(q) ||
        d.designName.toLowerCase().includes(q) ||
        (d.dn && d.dn.toLowerCase().includes(q)) ||
        (d.dnCode && d.dnCode.toLowerCase().includes(q)) ||
        (d.work && d.work.toLowerCase().includes(q)) ||
        (d.reed && String(d.reed).includes(q)) ||
        (d.pick && String(d.pick).includes(q));

      if (matchBasic) return true;

      // Check beam colours and feeders
      return d.beamColours.some(
        (bc) =>
          bc.beamColour.toLowerCase().includes(q) ||
          bc.feeders.some(
            (f) =>
              f.colorName.toLowerCase().includes(q) ||
              (f.oldNumber && f.oldNumber.toLowerCase().includes(q)) ||
              f.feederNumber.toLowerCase().includes(q),
          ),
      );
    });
  }

  // Work filter
  if (filter.work && filter.work !== "all") {
    all = all.filter((d) => d.work === filter.work);
  }

  // Sorting
  all.sort((a, b) => {
    let valA: any = a[filter.sortBy] ?? "";
    let valB: any = b[filter.sortBy] ?? "";

    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return filter.sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return filter.sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const total = all.length;
  const pageSize = filter.pageSize || 8;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const page = Math.min(Math.max(1, filter.page), totalPages);
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  return { items, total, totalPages };
}

export function getDesignById(id: string): DesignWithDetails | null {
  const all = getLocalDesigns();
  return all.find((d) => d.id === id) || null;
}

export function saveDesign(
  designData: Omit<DesignWithDetails, "id" | "createdAt" | "updatedAt"> & {
    id?: string | undefined;
  },
): DesignWithDetails {
  const all = getLocalDesigns();
  const now = new Date().toISOString();

  // Validate unique design number
  const existingWithNum = all.find(
    (d) =>
      d.designNumber.toLowerCase() === designData.designNumber.trim().toLowerCase() &&
      d.id !== designData.id,
  );
  if (existingWithNum) {
    throw new Error(`Design Number "${designData.designNumber}" already exists. Must be unique.`);
  }

  // Process beam colours & auto-number feeders
  const processedBeamColours = (designData.beamColours || []).map((bc, bcIdx) => {
    const bcId = bc.id || `bc-${Date.now()}-${bcIdx}`;
    const processedFeeders = (bc.feeders || []).map((f, fIdx) => ({
      ...f,
      id: f.id || `fdr-${Date.now()}-${fIdx}`,
      beamColourId: bcId,
      feederNumber: `FDR-${fIdx + 1}`,
      displayOrder: fIdx + 1,
    }));

    return {
      ...bc,
      id: bcId,
      displayOrder: bcIdx + 1,
      feeders: processedFeeders,
    };
  });

  let savedDesign: DesignWithDetails;

  if (designData.id) {
    // Update
    const idx = all.findIndex((d) => d.id === designData.id);
    if (idx === -1) throw new Error("Design not found for editing");

    savedDesign = {
      ...all[idx],
      ...designData,
      id: designData.id,
      designNumber: designData.designNumber.trim(),
      designName: designData.designName.trim(),
      updatedAt: now,
      beamColours: processedBeamColours,
    };
    all[idx] = savedDesign;
    logAudit("Design Edited", savedDesign.id, `Updated design ${savedDesign.designNumber}`);
  } else {
    // Create new
    savedDesign = {
      ...designData,
      id: `des-${Date.now()}`,
      designNumber: designData.designNumber.trim(),
      designName: designData.designName.trim(),
      createdAt: now,
      updatedAt: now,
      beamColours: processedBeamColours,
    };
    all.unshift(savedDesign);
    logAudit("Design Created", savedDesign.id, `Created new design ${savedDesign.designNumber}`);
  }

  saveLocalDesigns(all);

  // Clear auto-save draft if saving completed
  if (typeof window !== "undefined") {
    localStorage.removeItem(DRAFT_KEY);
  }

  return savedDesign;
}

export function cloneDesign(
  originalId: string,
  newDesignNumber: string,
  newDesignName: string,
): DesignWithDetails {
  const original = getDesignById(originalId);
  if (!original) throw new Error("Original design not found to clone");

  const cleanNum = newDesignNumber.trim();
  if (!cleanNum) throw new Error("New Design Number is required for cloning");

  const all = getLocalDesigns();
  if (all.some((d) => d.designNumber.toLowerCase() === cleanNum.toLowerCase())) {
    throw new Error(
      `Design Number "${cleanNum}" already exists. Please choose a different Design Number.`,
    );
  }

  const now = new Date().toISOString();
  const newDesignId = `des-clone-${Date.now()}`;

  // Deep copy beam colours and feeders with fresh IDs
  const clonedBeamColours = original.beamColours.map((bc, bcIdx) => {
    const newBcId = `bc-clone-${Date.now()}-${bcIdx}`;
    const clonedFeeders = bc.feeders.map((f, fIdx) => ({
      ...f,
      id: `fdr-clone-${Date.now()}-${fIdx}`,
      beamColourId: newBcId,
      feederNumber: `FDR-${fIdx + 1}`,
      displayOrder: fIdx + 1,
    }));

    return {
      ...bc,
      id: newBcId,
      designId: newDesignId,
      displayOrder: bcIdx + 1,
      feeders: clonedFeeders,
    };
  });

  const clonedDesign: DesignWithDetails = {
    ...original,
    id: newDesignId,
    designNumber: cleanNum,
    designName: newDesignName.trim() || `${original.designName} (Copy)`,
    createdAt: now,
    updatedAt: now,
    beamColours: clonedBeamColours,
  };

  all.unshift(clonedDesign);
  saveLocalDesigns(all);
  logAudit(
    "Design Cloned",
    clonedDesign.id,
    `Cloned from ${original.designNumber} to ${clonedDesign.designNumber}`,
  );

  return clonedDesign;
}

export function deleteDesign(id: string): void {
  let all = getLocalDesigns();
  const target = all.find((d) => d.id === id);
  if (!target) return;

  all = all.filter((d) => d.id !== id);
  saveLocalDesigns(all);
  logAudit("Design Deleted", id, `Deleted design ${target.designNumber}`);
}

export function searchFeederCrossReference(query: string): FeederCrossReferenceItem[] {
  const all = getLocalDesigns();
  const q = query.trim().toLowerCase();
  const results: FeederCrossReferenceItem[] = [];

  for (const d of all) {
    for (const bc of d.beamColours) {
      for (const f of bc.feeders) {
        const matches =
          !q ||
          d.designNumber.toLowerCase().includes(q) ||
          d.designName.toLowerCase().includes(q) ||
          bc.beamColour.toLowerCase().includes(q) ||
          f.colorName.toLowerCase().includes(q) ||
          (f.oldNumber && f.oldNumber.toLowerCase().includes(q)) ||
          f.feederNumber.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: `${d.id}-${bc.id}-${f.id}`,
            designId: d.id,
            designNumber: d.designNumber,
            designName: d.designName,
            beamColourId: bc.id,
            beamColour: bc.beamColour,
            feederId: f.id,
            feederNumber: f.feederNumber,
            colorName: f.colorName,
            oldNumber: f.oldNumber || "—",
            work: d.work,
            image: d.image,
          });
        }
      }
    }
  }

  return results;
}

export function saveDraft(draftData: Partial<DesignWithDetails>): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
  }
}

export function getDraft(): Partial<DesignWithDetails> | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(DRAFT_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(DRAFT_KEY);
  }
}
