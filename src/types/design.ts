export interface Feeder {
  id: string;
  beamColourId: string;
  feederNumber: string;
  colorName: string;
  oldNumber?: string | undefined;
  pick?: number | undefined;
  card?: number | undefined;
  displayOrder: number;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface BeamColour {
  id: string;
  designId: string;
  beamColour: string;
  displayOrder: number;
  feeders: Feeder[];
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface Design {
  id: string;
  designNumber: string;
  designName: string;
  dn?: string | undefined;
  dnCode?: string | undefined;
  reed?: number | undefined;
  pick?: number | undefined;
  cards?: number | undefined;
  patti?: number | undefined;
  totalDC?: number | undefined;
  totalCut?: number | undefined;
  work?: string | undefined;
  blueApt?: string | undefined;
  description?: string | undefined;
  remarks?: string | undefined;
  image?: string | undefined;
  createdAt?: string | undefined;
  updatedAt: string;
}

export interface DesignWithDetails extends Design {
  beamColours: BeamColour[];
}

export interface DesignFilter {
  query: string;
  work?: string | undefined;
  sortBy: "designNumber" | "designName" | "updatedAt" | "reed" | "pick";
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface FeederCrossReferenceItem {
  id: string;
  designId: string;
  designNumber: string;
  designName: string;
  beamColourId: string;
  beamColour: string;
  feederId: string;
  feederNumber: string;
  colorName: string;
  oldNumber: string;
  work?: string | undefined;
  image?: string | undefined;
}
