/**
 * DEVELOPMENT / DEMO DATA ONLY for the Warping prototype. In memory; never written to
 * Supabase or localStorage. The same beams are the "Beam No." list used by Production.
 * Values are illustrative, not verified warping recipes.
 */
import type { WarpDetails } from "@/features/production/warping/warping-types";

/**
 * Seed operations, run in order through the demo service so each beam gets a consistent
 * movement history. `beam` is the fixed beam id (Production fixtures reference them).
 */
export type WarpingSeed =
  | { op: "inward"; beam: string; beamNo: string; beamType: string; daysAgo: number; rack: string }
  | { op: "issue"; beam: string; daysAgo: number; partyId: string }
  | { op: "material"; beam: string; daysAgo: number; yarnId: string; qtyKg: number }
  | { op: "return"; materialIndex: number; daysAgo: number; qtyKg: number }
  | { op: "produce"; beam: string; daysAgo: number; warp: WarpDetails; rack: string }
  | {
      op: "receive";
      beam: string;
      daysAgo: number;
      warp: WarpDetails;
      rack: string;
      partyId: string;
      challanNo: string;
    }
  | { op: "load"; beam: string; daysAgo: number; loomId: string };

export const DEMO_WARPING_SEEDS: WarpingSeed[] = [
  { op: "inward", beam: "bm-101", beamNo: "BM-101", beamType: "Ground", daysAgo: 32, rack: "E-01" },
  { op: "inward", beam: "bm-102", beamNo: "BM-102", beamType: "Border", daysAgo: 32, rack: "E-02" },
  { op: "inward", beam: "bm-205", beamNo: "BM-205", beamType: "Ground", daysAgo: 30, rack: "E-03" },
  { op: "inward", beam: "bm-310", beamNo: "BM-310", beamType: "Ground", daysAgo: 6, rack: "E-04" },
  { op: "inward", beam: "bm-311", beamNo: "BM-311", beamType: "Pallu", daysAgo: 6, rack: "E-05" },
  // BM-101: in-house warping → store → LOOM-33
  { op: "issue", beam: "bm-101", daysAgo: 28, partyId: "" },
  { op: "material", beam: "bm-101", daysAgo: 28, yarnId: "yn-kota-black", qtyKg: 45 },
  { op: "return", materialIndex: 0, daysAgo: 25, qtyKg: 2.5 },
  {
    op: "produce",
    beam: "bm-101",
    daysAgo: 25,
    rack: "RACK-A-01",
    warp: {
      setNo: "S-2201",
      warpYarnId: "yn-kota-black",
      countDenier: "35 D",
      totalEnds: 5444,
      lengthMetre: 1200,
    },
  },
  { op: "load", beam: "bm-101", daysAgo: 20, loomId: "mc-33" },
  // BM-102: warped by a job work party and received back
  { op: "issue", beam: "bm-102", daysAgo: 26, partyId: "jw-mahavir" },
  {
    op: "receive",
    beam: "bm-102",
    daysAgo: 22,
    rack: "RACK-A-02",
    partyId: "jw-mahavir",
    challanNo: "MBW/118",
    warp: {
      setNo: "S-2202",
      warpYarnId: "yn-zari",
      countDenier: "150 D",
      totalEnds: 224,
      lengthMetre: 1200,
    },
  },
  // BM-205: in-house → LOOM-12
  { op: "issue", beam: "bm-205", daysAgo: 14, partyId: "" },
  { op: "material", beam: "bm-205", daysAgo: 14, yarnId: "yn-mono-bright", qtyKg: 38 },
  {
    op: "produce",
    beam: "bm-205",
    daysAgo: 12,
    rack: "RACK-B-03",
    warp: {
      setNo: "S-2231",
      warpYarnId: "yn-mono-bright",
      countDenier: "21 D",
      totalEnds: 6120,
      lengthMetre: 1500,
    },
  },
  { op: "load", beam: "bm-205", daysAgo: 8, loomId: "mc-12" },
  // BM-311: at warping now, with yarn issued
  { op: "issue", beam: "bm-311", daysAgo: 3, partyId: "" },
  { op: "material", beam: "bm-311", daysAgo: 3, yarnId: "yn-poly-beige", qtyKg: 30 },
];

/** Beam master options for Production (same ids / numbers as the warping register). */
export const DEMO_BEAM_OPTIONS = DEMO_WARPING_SEEDS.flatMap((s) =>
  s.op === "inward" ? [{ id: s.beam, code: s.beamNo, name: s.beamNo }] : [],
);

/** Beam types used by the fixtures. Placeholder list — BUSINESS LIST PENDING CONFIRMATION. */
export const DEMO_BEAM_TYPES = ["Ground", "Border", "Pallu"];
