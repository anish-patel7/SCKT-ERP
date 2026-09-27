/**
 * DEVELOPMENT / DEMO DATA ONLY for the Warping prototype. In memory; never written to
 * Supabase or localStorage. The same beams are the "Beam No." list used by Production.
 */
import { addDays, todayIso } from "@/lib/erp/formatting";
import type { BeamInput } from "@/features/production/warping/warping-types";

const d = (daysAgo: number) => addDays(todayIso(), -daysAgo);

type BeamSeed = { id: string; input: BeamInput; loadOn?: { loomId: string; daysAgo: number } };

/** Seeded beams (fixed ids so Production fixtures can reference them). */
export const DEMO_BEAM_SEEDS: BeamSeed[] = [
  {
    id: "bm-101",
    input: {
      date: d(25),
      beamNo: "BM-101",
      setNo: "S-2201",
      beamType: "Ground",
      warpYarnId: "yn-kota-black",
      countDenier: "35 D",
      totalEnds: 5444,
      lengthMetre: 1200,
      rack: "RACK-A-01",
      remark: "",
    },
    loadOn: { loomId: "mc-33", daysAgo: 20 },
  },
  {
    id: "bm-102",
    input: {
      date: d(22),
      beamNo: "BM-102",
      setNo: "S-2202",
      beamType: "Border",
      warpYarnId: "yn-zari",
      countDenier: "150 D",
      totalEnds: 224,
      lengthMetre: 1200,
      rack: "RACK-A-02",
      remark: "",
    },
  },
  {
    id: "bm-205",
    input: {
      date: d(12),
      beamNo: "BM-205",
      setNo: "S-2231",
      beamType: "Ground",
      warpYarnId: "yn-mono-bright",
      countDenier: "21 D",
      totalEnds: 6120,
      lengthMetre: 1500,
      rack: "RACK-B-03",
      remark: "",
    },
    loadOn: { loomId: "mc-12", daysAgo: 8 },
  },
];

/** Beam master options for Production (same ids / numbers as the warping register). */
export const DEMO_BEAM_OPTIONS = DEMO_BEAM_SEEDS.map((b) => ({
  id: b.id,
  code: b.input.beamNo,
  name: b.input.beamNo,
}));

/** Beam types used by the fixtures. Placeholder list — BUSINESS LIST PENDING CONFIRMATION. */
export const DEMO_BEAM_TYPES = ["Ground", "Border", "Pallu"];
