import { num } from "@/features/production/pages/page-helpers";
import { todayIso } from "@/lib/erp/formatting";
import type { BeamInput } from "@/features/production/warping/warping-types";

/** Form values shared by Beam Production / Receive / Production Loading entries. */
export type WarpValues = {
  date: string;
  beamNo: string;
  beamType: string;
  setNo: string;
  warpYarnId: string;
  countDenier: string;
  totalEnds: string;
  lengthMetre: string;
  rack: string;
  remark: string;
  partyId: string;
  challanNo: string;
  loomId: string;
};

export const emptyWarpValues = (): WarpValues => ({
  date: todayIso(),
  beamNo: "",
  beamType: "",
  setNo: "",
  warpYarnId: "",
  countDenier: "",
  totalEnds: "",
  lengthMetre: "",
  rack: "",
  remark: "",
  partyId: "",
  challanNo: "",
  loomId: "",
});

export const toBeamInput = (v: WarpValues): BeamInput => ({
  date: v.date,
  beamNo: v.beamNo,
  beamType: v.beamType,
  setNo: v.setNo,
  warpYarnId: v.warpYarnId,
  countDenier: v.countDenier,
  totalEnds: num(v.totalEnds),
  lengthMetre: num(v.lengthMetre),
  rack: v.rack,
  remark: v.remark,
});
