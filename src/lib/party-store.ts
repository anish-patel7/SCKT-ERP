import { supabase } from "@/integrations/supabase/client";

export type PartyType = "Purchase Party" | "Sell Party" | "Job Party";

export interface PartyRecord {
  id: string;
  partyCode: string;
  partyName: string;
  partyType?: PartyType | undefined;
  officeName: string;
  addressLine1: string;
  addressLine2?: string | undefined;
  area?: string | undefined;
  city: string;
  district?: string | undefined;
  state: string;
  pinCode: string;
  country: string;
  contactPerson?: string | undefined;
  designation?: string | undefined;
  mobile?: string | undefined;
  alternateMobile?: string | undefined;
  email?: string | undefined;
  whatsappNumber?: string | undefined;
  gstin?: string | undefined;
  pan?: string | undefined;
  jobWorkApplicable: "Yes" | "No";
  jobWorkRemarks?: string | undefined;
  remarks?: string | undefined;
  status: "Active" | "Inactive";
  transactionCount?: number | undefined;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | undefined;
  updatedBy?: string | undefined;
}

export const LOCATION_TYPES = [
  "Head Office",
  "Branch Office",
  "Factory",
  "Manufacturing Unit",
  "Warehouse",
  "Godown",
  "Job Work Unit",
  "Billing Office",
  "Delivery Location",
  "Other",
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

export interface SubPartyRecord {
  id: string;
  partyId: string;
  subPartyCode: string;
  subPartyName: string;
  partyType: PartyType;
  locationType: LocationType | string;
  locationTypeOther?: string | undefined;
  addressLine1: string;
  addressLine2?: string | undefined;
  area?: string | undefined;
  city: string;
  district?: string | undefined;
  state: string;
  pinCode?: string | undefined;
  country?: string | undefined;
  gstin?: string | undefined;
  pan?: string | undefined;
  contactPerson?: string | undefined;
  mobile?: string | undefined;
  alternateMobile?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  alternateEmail?: string | undefined;
  billingAddress?: string | undefined;
  shippingAddress?: string | undefined;
  deliveryAddress?: string | undefined;
  isDefault: boolean;
  status: "Active" | "Inactive";
  remarks?: string | undefined;
  internalNotes?: string | undefined;
  transactionCount?: number | undefined;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | undefined;
  updatedBy?: string | undefined;
}

const STORAGE_KEY_PARTIES = "weaveone_parties_v1";
const STORAGE_KEY_SUB_PARTIES = "weaveone_sub_parties_v1";

// Seed Parties Across Categories
export const SEED_PARTIES: PartyRecord[] = [
  {
    id: "party-001",
    partyCode: "PTY-001",
    partyName: "Shree Ram Textiles",
    partyType: "Job Party",
    officeName: "Shree Ram Dyeing & Finishing Unit",
    addressLine1: "Plot 102, Ring Road Industrial Estate",
    addressLine2: "Near Sahara Market",
    area: "Ring Road",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pinCode: "395002",
    country: "India",
    contactPerson: "Ramesh Patel",
    designation: "General Manager",
    mobile: "9825012345",
    alternateMobile: "9825099999",
    email: "ramesh@shreeramtextiles.com",
    whatsappNumber: "9825012345",
    gstin: "24AAACS1234F1Z5",
    pan: "AAACS1234F",
    jobWorkApplicable: "Yes",
    jobWorkRemarks: "Specialized in Banarasi Jari Dyeing & Sizing",
    remarks: "Preferred Job Worker for high-grade Kota Jacquard weaving",
    status: "Active",
    transactionCount: 5,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "party-002",
    partyCode: "PTY-002",
    partyName: "Vardhman Job Weavers",
    partyType: "Job Party",
    officeName: "Vardhman Weaving Division",
    addressLine1: "Sector 4, MIDC Power Loom Zone",
    area: "Bhiwandi West",
    city: "Bhiwandi",
    district: "Thane",
    state: "Maharashtra",
    pinCode: "421302",
    country: "India",
    contactPerson: "Anil Sharma",
    designation: "Plant Head",
    mobile: "9819098765",
    email: "anil@vardhmanweavers.in",
    whatsappNumber: "9819098765",
    gstin: "27AABCV5678G1Z2",
    pan: "AABCV5678G",
    jobWorkApplicable: "Yes",
    jobWorkRemarks: "High-speed airjet loom job work capacity 50,000m/month",
    remarks: "Reliable production turnaround time",
    status: "Active",
    transactionCount: 2,
    createdAt: "2026-08-02T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "party-003",
    partyCode: "PTY-003",
    partyName: "Kothari Processing House",
    partyType: "Job Party",
    officeName: "Kothari Processors Pvt Ltd",
    addressLine1: "GIDC Narol Industrial Park",
    area: "Narol",
    city: "Ahmedabad",
    district: "Ahmedabad",
    state: "Gujarat",
    pinCode: "382405",
    country: "India",
    contactPerson: "Vijay Kothari",
    designation: "Managing Director",
    mobile: "9898011223",
    email: "vijay@kothariprocess.com",
    whatsappNumber: "9898011223",
    gstin: "24AAACK9876E1Z9",
    pan: "AAACK9876E",
    jobWorkApplicable: "Yes",
    jobWorkRemarks: "RFD processing & soft finish master",
    remarks: "Authorized finishing vendor",
    status: "Active",
    transactionCount: 0,
    createdAt: "2026-08-03T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "party-004",
    partyCode: "PTY-P01",
    partyName: "ABC Textiles Pvt. Ltd.",
    partyType: "Purchase Party",
    officeName: "ABC Corporate Office",
    addressLine1: "101 Textile Tower, Ashram Road",
    area: "Navrangpura",
    city: "Ahmedabad",
    district: "Ahmedabad",
    state: "Gujarat",
    pinCode: "380009",
    country: "India",
    contactPerson: "Rajesh Shah",
    designation: "Procurement Director",
    mobile: "9879012345",
    email: "procurement@abctextiles.com",
    gstin: "24AAACA9999F1Z1",
    pan: "AAACA9999F",
    jobWorkApplicable: "No",
    status: "Active",
    transactionCount: 8,
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "party-005",
    partyCode: "PTY-P02",
    partyName: "Reliable Yarn Mills",
    partyType: "Purchase Party",
    officeName: "Reliable Sales Division",
    addressLine1: "Plot 45, GIDC Industrial Estate",
    city: "Silvassa",
    district: "Dadra & Nagar Haveli",
    state: "Dadra and Nagar Haveli",
    pinCode: "396230",
    country: "India",
    contactPerson: "Suresh Jain",
    mobile: "9824055555",
    email: "sales@reliableyarn.com",
    gstin: "26AAACR1111E1Z0",
    pan: "AAACR1111E",
    jobWorkApplicable: "No",
    status: "Active",
    transactionCount: 3,
    createdAt: "2026-08-05T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "party-006",
    partyCode: "PTY-S01",
    partyName: "XYZ Fabrics",
    partyType: "Sell Party",
    officeName: "XYZ Commercial Hub",
    addressLine1: "302 Millennium Market",
    area: "Ring Road",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pinCode: "395002",
    country: "India",
    contactPerson: "Dinesh Verma",
    mobile: "9825188888",
    email: "orders@xyzfabrics.com",
    gstin: "24AAACX5555D1Z4",
    pan: "AAACX5555D",
    jobWorkApplicable: "No",
    status: "Active",
    transactionCount: 12,
    createdAt: "2026-08-06T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "party-007",
    partyCode: "PTY-S02",
    partyName: "Metro Fashion House",
    partyType: "Sell Party",
    officeName: "Metro Trade Center",
    addressLine1: "504 Commercial Towers, Lower Parel",
    city: "Mumbai",
    district: "Mumbai",
    state: "Maharashtra",
    pinCode: "400013",
    country: "India",
    contactPerson: "Priya Mehta",
    mobile: "9819177777",
    email: "priya@metrofashion.in",
    gstin: "27AAACM4444C1Z3",
    pan: "AAACM4444C",
    jobWorkApplicable: "No",
    status: "Active",
    transactionCount: 4,
    createdAt: "2026-08-07T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
];

// Seed Sub Parties for Parent Parties
export const SEED_SUB_PARTIES: SubPartyRecord[] = [
  // Sub Parties for Job Party 001 (Shree Ram Textiles)
  {
    id: "sub-001-1",
    partyId: "party-001",
    subPartyCode: "PTY-001-01",
    subPartyName: "Unit 1 – Surat Weaving Division",
    partyType: "Job Party",
    locationType: "Factory",
    addressLine1: "Plot 102, Ring Road Industrial Estate",
    addressLine2: "Near Sahara Market",
    area: "Ring Road",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pinCode: "395002",
    country: "India",
    gstin: "24AAACS1234F1Z5",
    pan: "AAACS1234F",
    contactPerson: "Ramesh Patel",
    mobile: "9825012345",
    phone: "0261-2554411",
    email: "unit1@shreeramtextiles.com",
    billingAddress: "Plot 102, Ring Road Industrial Estate, Surat, Gujarat 395002",
    shippingAddress: "Plot 102, Ring Road Industrial Estate, Surat, Gujarat 395002",
    deliveryAddress: "Plot 102, Ring Road Industrial Estate, Surat, Gujarat 395002",
    isDefault: true,
    status: "Active",
    remarks: "Main weaving plant for Jacquard quality",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "sub-001-2",
    partyId: "party-001",
    subPartyCode: "PTY-001-02",
    subPartyName: "Unit 2 – Navsari Dyeing Unit",
    partyType: "Job Party",
    locationType: "Job Work Unit",
    addressLine1: "GIDC Industrial Zone, Sector 2",
    area: "GIDC",
    city: "Navsari",
    district: "Navsari",
    state: "Gujarat",
    pinCode: "396445",
    country: "India",
    gstin: "24AAACS1234F2Z4",
    pan: "AAACS1234F",
    contactPerson: "Mahesh Desai",
    mobile: "9825098765",
    email: "unit2@shreeramtextiles.com",
    billingAddress: "GIDC Industrial Zone, Sector 2, Navsari, Gujarat 396445",
    shippingAddress: "GIDC Industrial Zone, Sector 2, Navsari, Gujarat 396445",
    deliveryAddress: "GIDC Industrial Zone, Sector 2, Navsari, Gujarat 396445",
    isDefault: false,
    status: "Active",
    remarks: "High capacity yarn sizing & dyeing unit",
    createdAt: "2026-08-02T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "sub-001-3",
    partyId: "party-001",
    subPartyCode: "PTY-001-03",
    subPartyName: "Unit 3 – Ankleshwar Processing",
    partyType: "Job Party",
    locationType: "Manufacturing Unit",
    addressLine1: "Plot 88, Phase 2 GIDC",
    city: "Ankleshwar",
    district: "Bharuch",
    state: "Gujarat",
    pinCode: "393002",
    country: "India",
    gstin: "24AAACS1234F3Z3",
    pan: "AAACS1234F",
    contactPerson: "Ketan Trivedi",
    mobile: "9825066666",
    email: "unit3@shreeramtextiles.com",
    isDefault: false,
    status: "Active",
    remarks: "Finishing & calendering unit",
    createdAt: "2026-08-03T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },

  // Sub Parties for Job Party 002 (Vardhman Job Weavers)
  {
    id: "sub-002-1",
    partyId: "party-002",
    subPartyCode: "PTY-002-01",
    subPartyName: "Bhiwandi Plant #1",
    partyType: "Job Party",
    locationType: "Job Work Unit",
    addressLine1: "Sector 4, MIDC Power Loom Zone",
    area: "Bhiwandi West",
    city: "Bhiwandi",
    district: "Thane",
    state: "Maharashtra",
    pinCode: "421302",
    country: "India",
    gstin: "27AABCV5678G1Z2",
    pan: "AABCV5678G",
    contactPerson: "Anil Sharma",
    mobile: "9819098765",
    email: "anil@vardhmanweavers.in",
    isDefault: true,
    status: "Active",
    createdAt: "2026-08-02T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },

  // Sub Parties for Job Party 003 (Kothari Processing House)
  {
    id: "sub-003-1",
    partyId: "party-003",
    subPartyCode: "PTY-003-01",
    subPartyName: "Narol Processing Plant",
    partyType: "Job Party",
    locationType: "Factory",
    addressLine1: "GIDC Narol Industrial Park",
    area: "Narol",
    city: "Ahmedabad",
    district: "Ahmedabad",
    state: "Gujarat",
    pinCode: "382405",
    country: "India",
    gstin: "24AAACK9876E1Z9",
    pan: "AAACK9876E",
    contactPerson: "Vijay Kothari",
    mobile: "9898011223",
    email: "vijay@kothariprocess.com",
    isDefault: true,
    status: "Active",
    createdAt: "2026-08-03T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },

  // Sub Parties for Purchase Party 004 (ABC Textiles Pvt. Ltd.)
  {
    id: "sub-004-1",
    partyId: "party-004",
    subPartyCode: "PTY-P01-01",
    subPartyName: "Ahmedabad Office",
    partyType: "Purchase Party",
    locationType: "Head Office",
    addressLine1: "101 Textile Tower, Ashram Road",
    area: "Navrangpura",
    city: "Ahmedabad",
    district: "Ahmedabad",
    state: "Gujarat",
    pinCode: "380009",
    country: "India",
    gstin: "24AAACA9999F1Z1",
    pan: "AAACA9999F",
    contactPerson: "Rajesh Shah",
    mobile: "9879012345",
    email: "ahmedabad@abctextiles.com",
    billingAddress: "101 Textile Tower, Ashram Road, Ahmedabad, Gujarat 380009",
    isDefault: true,
    status: "Active",
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "sub-004-2",
    partyId: "party-004",
    subPartyCode: "PTY-P01-02",
    subPartyName: "Surat Office",
    partyType: "Purchase Party",
    locationType: "Branch Office",
    addressLine1: "405 Reshamwala Market, Ring Road",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pinCode: "395002",
    country: "India",
    gstin: "24AAACA9999F2Z0",
    pan: "AAACA9999F",
    contactPerson: "Bhaven Joshi",
    mobile: "9825133333",
    email: "surat@abctextiles.com",
    isDefault: false,
    status: "Active",
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "sub-004-3",
    partyId: "party-004",
    subPartyCode: "PTY-P01-03",
    subPartyName: "Mumbai Office",
    partyType: "Purchase Party",
    locationType: "Billing Office",
    addressLine1: "202 Cotton Exchange Building, Kalbadevi",
    city: "Mumbai",
    district: "Mumbai",
    state: "Maharashtra",
    pinCode: "400002",
    country: "India",
    gstin: "27AAACA9999F3Z9",
    pan: "AAACA9999F",
    contactPerson: "Kiran Rane",
    mobile: "9819022222",
    email: "mumbai@abctextiles.com",
    isDefault: false,
    status: "Active",
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },

  // Sub Parties for Purchase Party 005 (Reliable Yarn Mills)
  {
    id: "sub-005-1",
    partyId: "party-005",
    subPartyCode: "PTY-P02-01",
    subPartyName: "Central Warehouse",
    partyType: "Purchase Party",
    locationType: "Warehouse",
    addressLine1: "Plot 45, GIDC Industrial Estate",
    city: "Silvassa",
    district: "Dadra & Nagar Haveli",
    state: "Dadra and Nagar Haveli",
    pinCode: "396230",
    country: "India",
    gstin: "26AAACR1111E1Z0",
    pan: "AAACR1111E",
    contactPerson: "Suresh Jain",
    mobile: "9824055555",
    email: "sales@reliableyarn.com",
    isDefault: true,
    status: "Active",
    createdAt: "2026-08-05T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },

  // Sub Parties for Sell Party 006 (XYZ Fabrics)
  {
    id: "sub-006-1",
    partyId: "party-006",
    subPartyCode: "PTY-S01-01",
    subPartyName: "Head Office",
    partyType: "Sell Party",
    locationType: "Head Office",
    addressLine1: "302 Millennium Market",
    area: "Ring Road",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pinCode: "395002",
    country: "India",
    gstin: "24AAACX5555D1Z4",
    pan: "AAACX5555D",
    contactPerson: "Dinesh Verma",
    mobile: "9825188888",
    email: "ho@xyzfabrics.com",
    isDefault: true,
    status: "Active",
    createdAt: "2026-08-06T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "sub-006-2",
    partyId: "party-006",
    subPartyCode: "PTY-S01-02",
    subPartyName: "Surat Branch",
    partyType: "Sell Party",
    locationType: "Branch Office",
    addressLine1: "G-12 Sahara Market",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pinCode: "395002",
    country: "India",
    gstin: "24AAACX5555D2Z3",
    pan: "AAACX5555D",
    contactPerson: "Deepak Patel",
    mobile: "9825177777",
    email: "surat@xyzfabrics.com",
    isDefault: false,
    status: "Active",
    createdAt: "2026-08-06T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
  {
    id: "sub-006-3",
    partyId: "party-006",
    subPartyCode: "PTY-S01-03",
    subPartyName: "Delhi Branch",
    partyType: "Sell Party",
    locationType: "Delivery Location",
    addressLine1: "15 Chandni Chowk Commercial Complex",
    city: "New Delhi",
    district: "Central Delhi",
    state: "Delhi",
    pinCode: "110006",
    country: "India",
    gstin: "07AAACX5555D3Z2",
    pan: "AAACX5555D",
    contactPerson: "Rohit Bansal",
    mobile: "9811099999",
    email: "delhi@xyzfabrics.com",
    isDefault: false,
    status: "Active",
    createdAt: "2026-08-06T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },

  // Sub Parties for Sell Party 007 (Metro Fashion House)
  {
    id: "sub-007-1",
    partyId: "party-007",
    subPartyCode: "PTY-S02-01",
    subPartyName: "Commercial Hub",
    partyType: "Sell Party",
    locationType: "Billing Office",
    addressLine1: "504 Commercial Towers, Lower Parel",
    city: "Mumbai",
    district: "Mumbai",
    state: "Maharashtra",
    pinCode: "400013",
    country: "India",
    gstin: "27AAACM4444C1Z3",
    pan: "AAACM4444C",
    contactPerson: "Priya Mehta",
    mobile: "9819177777",
    email: "priya@metrofashion.in",
    isDefault: true,
    status: "Active",
    createdAt: "2026-08-07T00:00:00Z",
    updatedAt: "2026-08-08T00:00:00Z",
  },
];

// Validation Helper Functions
export function validateGSTIN(gstin: string): boolean {
  if (!gstin.trim()) return true; // optional
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin.trim().toUpperCase());
}

export function validatePAN(pan: string): boolean {
  if (!pan.trim()) return true; // optional
  const regex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return regex.test(pan.trim().toUpperCase());
}

export function validateMobile(mobile: string): boolean {
  if (!mobile.trim()) return true; // optional
  const regex = /^[6-9]\d{9}$/;
  return regex.test(mobile.trim());
}

export function validatePIN(pin: string): boolean {
  if (!pin.trim()) return true;
  const regex = /^\d{6}$/;
  return regex.test(pin.trim());
}

export function validateEmail(email: string): boolean {
  if (!email.trim()) return true;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

// Local Storage Handlers for Parties
export function getLocalParties(): PartyRecord[] {
  if (typeof window === "undefined") return SEED_PARTIES;
  const stored = localStorage.getItem(STORAGE_KEY_PARTIES);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_PARTIES, JSON.stringify(SEED_PARTIES));
    return SEED_PARTIES;
  }
  try {
    const list: PartyRecord[] = JSON.parse(stored);
    // Ensure every record has a partyType for backward compatibility
    return list.map((p) => ({
      ...p,
      partyType:
        p.partyType ||
        (p.partyCode.startsWith("PTY-P")
          ? "Purchase Party"
          : p.partyCode.startsWith("PTY-S")
            ? "Sell Party"
            : "Job Party"),
    }));
  } catch {
    return SEED_PARTIES;
  }
}

export function saveLocalParties(parties: PartyRecord[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_PARTIES, JSON.stringify(parties));
  }
}

// Local Storage Handlers for Sub Parties
export function getLocalSubParties(): SubPartyRecord[] {
  if (typeof window === "undefined") return SEED_SUB_PARTIES;
  const stored = localStorage.getItem(STORAGE_KEY_SUB_PARTIES);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_SUB_PARTIES, JSON.stringify(SEED_SUB_PARTIES));
    return SEED_SUB_PARTIES;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return SEED_SUB_PARTIES;
  }
}

export function saveLocalSubParties(subParties: SubPartyRecord[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SUB_PARTIES, JSON.stringify(subParties));
  }
}

export function getSubPartiesByPartyId(partyId: string, activeOnly = false): SubPartyRecord[] {
  const all = getLocalSubParties();
  return all.filter((sp) => sp.partyId === partyId && (!activeOnly || sp.status === "Active"));
}

export function generateNextPartyCode(partyType: PartyType = "Job Party"): string {
  const parties = getLocalParties();
  const prefix =
    partyType === "Purchase Party" ? "PTY-P" : partyType === "Sell Party" ? "PTY-S" : "PTY-";

  let maxNum = 0;
  parties.forEach((p) => {
    if (partyType === "Job Party" && p.partyCode.match(/^PTY-\d+$/i)) {
      const match = p.partyCode.match(/^PTY-(\d+)$/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    } else if (partyType === "Purchase Party" && p.partyCode.match(/^PTY-P\d+$/i)) {
      const match = p.partyCode.match(/^PTY-P(\d+)$/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    } else if (partyType === "Sell Party" && p.partyCode.match(/^PTY-S\d+$/i)) {
      const match = p.partyCode.match(/^PTY-S(\d+)$/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  return partyType === "Job Party"
    ? `PTY-${String(nextNum).padStart(3, "0")}`
    : `${prefix}${String(nextNum).padStart(2, "0")}`;
}

export function generateNextSubPartyCode(partyId: string): string {
  const parties = getLocalParties();
  const parent = parties.find((p) => p.id === partyId);
  const baseCode = parent ? parent.partyCode : "PTY-001";

  const subParties = getSubPartiesByPartyId(partyId);
  let maxNum = 0;

  subParties.forEach((sp) => {
    const parts = sp.subPartyCode.split("-");
    const lastPart = parts[parts.length - 1];
    if (lastPart && /^\d+$/.test(lastPart)) {
      const num = parseInt(lastPart, 10);
      if (num > maxNum) maxNum = num;
    }
  });

  const nextNum = maxNum + 1;
  return `${baseCode}-${String(nextNum).padStart(2, "0")}`;
}

// Duplicate Detection for Main Party
export function findPossibleDuplicates(
  partyName: string,
  officeName: string,
  gstin?: string,
  mobile?: string,
  excludeId?: string,
): PartyRecord | null {
  const parties = getLocalParties();
  const normName = partyName.trim().toLowerCase();
  const normOffice = officeName.trim().toLowerCase();
  const normGstin = gstin ? gstin.trim().toUpperCase() : "";
  const normMobile = mobile ? mobile.trim() : "";

  return (
    parties.find((p) => {
      if (excludeId && p.id === excludeId) return false;

      if (normGstin && p.gstin && p.gstin.toUpperCase() === normGstin) return true;
      if (normMobile && p.mobile && p.mobile === normMobile) return true;

      const pName = p.partyName.trim().toLowerCase();
      const pOffice = p.officeName.trim().toLowerCase();

      if (pName === normName && pOffice === normOffice) return true;
      if (pName === normName) return true;

      return false;
    }) || null
  );
}

// Exact Code & Fuzzy Duplicate Detection for Sub Party
export function findSubPartyExactCode(
  partyId: string,
  subPartyCode: string,
  excludeId?: string,
): SubPartyRecord | null {
  const subParties = getSubPartiesByPartyId(partyId);
  const normCode = subPartyCode.trim().toLowerCase();
  return (
    subParties.find(
      (sp) =>
        (excludeId ? sp.id !== excludeId : true) &&
        sp.subPartyCode.trim().toLowerCase() === normCode,
    ) || null
  );
}

export function findSubPartyFuzzyDuplicate(
  partyId: string,
  subPartyName: string,
  excludeId?: string,
): SubPartyRecord | null {
  const subParties = getSubPartiesByPartyId(partyId);
  const normInput = subPartyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return (
    subParties.find((sp) => {
      if (excludeId && sp.id === excludeId) return false;

      const normExisting = sp.subPartyName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (normInput === normExisting) return true;

      // Check substring similarity (e.g., "ahmedabadoffice" vs "ahmedabadbranch")
      const baseInput = normInput.replace(/(office|branch|unit|plant|factory|location|hub)/g, "");
      const baseExisting = normExisting.replace(
        /(office|branch|unit|plant|factory|location|hub)/g,
        "",
      );

      if (baseInput && baseExisting && baseInput === baseExisting) return true;

      return false;
    }) || null
  );
}

// Save Main Party Record
export function savePartyRecord(party: PartyRecord): PartyRecord {
  const parties = getLocalParties();
  const now = new Date().toISOString();

  const isNew = !party.id || party.id.startsWith("new-");
  const id = isNew ? `party-${Date.now()}` : party.id;
  const partyType = party.partyType || "Job Party";
  const partyCode = party.partyCode.trim() || generateNextPartyCode(partyType);

  const formatted: PartyRecord = {
    ...party,
    id,
    partyCode,
    partyType,
    partyName: party.partyName.trim(),
    officeName: party.officeName.trim(),
    addressLine1: party.addressLine1.trim(),
    city: party.city.trim(),
    state: party.state.trim(),
    pinCode: party.pinCode.trim(),
    country: party.country || "India",
    gstin: party.gstin ? party.gstin.trim().toUpperCase() : undefined,
    pan: party.pan ? party.pan.trim().toUpperCase() : undefined,
    status: party.status || "Active",
    jobWorkApplicable: party.jobWorkApplicable || "Yes",
    createdAt: party.createdAt || now,
    updatedAt: now,
  };

  const idx = parties.findIndex((p) => p.id === id);
  if (idx >= 0) {
    parties[idx] = formatted;
  } else {
    parties.unshift(formatted);
  }

  saveLocalParties(parties);

  // Sync to Supabase in background
  (supabase.from as any)("parties")
    .upsert({
      id: formatted.id.startsWith("party-") ? undefined : formatted.id,
      party_code: formatted.partyCode,
      party_name: formatted.partyName,
      party_type: formatted.partyType,
      office_name: formatted.officeName,
      address_line1: formatted.addressLine1,
      address_line2: formatted.addressLine2 || null,
      area: formatted.area || null,
      city: formatted.city,
      district: formatted.district || null,
      state: formatted.state,
      pin_code: formatted.pinCode,
      country: formatted.country,
      contact_person: formatted.contactPerson || null,
      designation: formatted.designation || null,
      mobile: formatted.mobile || null,
      alternate_mobile: formatted.alternateMobile || null,
      email: formatted.email || null,
      whatsapp_number: formatted.whatsappNumber || null,
      gstin: formatted.gstin || null,
      pan: formatted.pan || null,
      job_work_applicable: formatted.jobWorkApplicable,
      job_work_remarks: formatted.jobWorkRemarks || null,
      remarks: formatted.remarks || null,
      status: formatted.status,
    })
    .then();

  return formatted;
}

// Save Sub Party Record (enforcing single active default per parent party)
export function saveSubPartyRecord(
  subParty: Partial<SubPartyRecord> & { partyId: string; subPartyName: string },
): SubPartyRecord {
  const subParties = getLocalSubParties();
  const parties = getLocalParties();

  const parentParty = parties.find((p) => p.id === subParty.partyId);
  const partyType = parentParty?.partyType || subParty.partyType || "Job Party";
  const now = new Date().toISOString();

  const isNew = !subParty.id || subParty.id.startsWith("new-");
  const subId: string = isNew || !subParty.id ? `subparty-${Date.now()}` : subParty.id;
  const subPartyCode = subParty.subPartyCode?.trim() || generateNextSubPartyCode(subParty.partyId);

  let isDefault = Boolean(subParty.isDefault);
  const status = subParty.status || "Active";
  if (status === "Inactive") {
    isDefault = false; // Deactivated sub parties cannot remain default
  }

  // If this sub party is set as default, remove default from all other sub parties of the same party
  if (isDefault) {
    subParties.forEach((sp) => {
      if (sp.partyId === subParty.partyId && sp.id !== subId) {
        sp.isDefault = false;
        sp.updatedAt = now;
      }
    });
  }

  const formatted: SubPartyRecord = {
    id: subId,
    partyId: subParty.partyId,
    subPartyCode,
    subPartyName: subParty.subPartyName.trim(),
    partyType,
    locationType: subParty.locationType || "Branch Office",
    locationTypeOther: subParty.locationTypeOther ? subParty.locationTypeOther.trim() : undefined,
    addressLine1: (subParty.addressLine1 || "").trim(),
    addressLine2: subParty.addressLine2 ? subParty.addressLine2.trim() : undefined,
    area: subParty.area ? subParty.area.trim() : undefined,
    city: (subParty.city || "").trim(),
    district: subParty.district ? subParty.district.trim() : undefined,
    state: (subParty.state || "").trim(),
    pinCode: subParty.pinCode ? subParty.pinCode.trim() : undefined,
    country: subParty.country || "India",
    gstin: subParty.gstin ? subParty.gstin.trim().toUpperCase() : undefined,
    pan: subParty.pan ? subParty.pan.trim().toUpperCase() : undefined,
    contactPerson: subParty.contactPerson ? subParty.contactPerson.trim() : undefined,
    mobile: subParty.mobile ? subParty.mobile.trim() : undefined,
    alternateMobile: subParty.alternateMobile ? subParty.alternateMobile.trim() : undefined,
    phone: subParty.phone ? subParty.phone.trim() : undefined,
    email: subParty.email ? subParty.email.trim() : undefined,
    alternateEmail: subParty.alternateEmail ? subParty.alternateEmail.trim() : undefined,
    billingAddress: subParty.billingAddress ? subParty.billingAddress.trim() : undefined,
    shippingAddress: subParty.shippingAddress ? subParty.shippingAddress.trim() : undefined,
    deliveryAddress: subParty.deliveryAddress ? subParty.deliveryAddress.trim() : undefined,
    isDefault,
    status,
    remarks: subParty.remarks ? subParty.remarks.trim() : undefined,
    internalNotes: subParty.internalNotes ? subParty.internalNotes.trim() : undefined,
    transactionCount: subParty.transactionCount || 0,
    createdAt: subParty.createdAt || now,
    createdBy: subParty.createdBy,
    updatedBy: subParty.updatedBy,
    updatedAt: now,
  };

  const idx = subParties.findIndex((sp) => sp.id === subId);
  if (idx >= 0) {
    subParties[idx] = formatted;
  } else {
    subParties.unshift(formatted);
  }

  saveLocalSubParties(subParties);

  // Sync to Supabase in background
  (supabase.from as any)("party_sub_parties")
    .upsert({
      id: formatted.id.startsWith("subparty-") ? undefined : formatted.id,
      party_id: formatted.partyId,
      sub_party_code: formatted.subPartyCode,
      sub_party_name: formatted.subPartyName,
      party_type: formatted.partyType,
      location_type: formatted.locationType,
      location_type_other: formatted.locationTypeOther || null,
      address_line1: formatted.addressLine1,
      address_line2: formatted.addressLine2 || null,
      area: formatted.area || null,
      city: formatted.city,
      district: formatted.district || null,
      state: formatted.state,
      pin_code: formatted.pinCode || null,
      country: formatted.country,
      gstin: formatted.gstin || null,
      pan: formatted.pan || null,
      contact_person: formatted.contactPerson || null,
      mobile: formatted.mobile || null,
      alternate_mobile: formatted.alternateMobile || null,
      phone: formatted.phone || null,
      email: formatted.email || null,
      alternate_email: formatted.alternateEmail || null,
      billing_address: formatted.billingAddress || null,
      shipping_address: formatted.shippingAddress || null,
      delivery_address: formatted.deliveryAddress || null,
      is_default: formatted.isDefault,
      status: formatted.status,
      remarks: formatted.remarks || null,
      internal_notes: formatted.internalNotes || null,
    })
    .then();

  return formatted;
}

export function clonePartyRecord(sourceId: string): PartyRecord {
  const parties = getLocalParties();
  const source = parties.find((p) => p.id === sourceId);
  if (!source) throw new Error("Source party not found");

  const newCode = generateNextPartyCode(source.partyType || "Job Party");
  const now = new Date().toISOString();

  const cloned: PartyRecord = {
    ...source,
    id: `party-clone-${Date.now()}`,
    partyCode: newCode,
    partyName: `${source.partyName} (Unit 2)`,
    officeName: source.officeName,
    status: "Active",
    transactionCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  return cloned;
}

export function setPartyStatus(id: string, status: "Active" | "Inactive"): PartyRecord | null {
  const parties = getLocalParties();
  const target = parties.find((p) => p.id === id);
  if (!target) return null;

  target.status = status;
  target.updatedAt = new Date().toISOString();
  saveLocalParties(parties);

  return target;
}

export function setSubPartyStatus(
  id: string,
  status: "Active" | "Inactive",
): SubPartyRecord | null {
  const subParties = getLocalSubParties();
  const target = subParties.find((sp) => sp.id === id);
  if (!target) return null;

  target.status = status;
  if (status === "Inactive") {
    target.isDefault = false;
  }
  target.updatedAt = new Date().toISOString();
  saveLocalSubParties(subParties);

  return target;
}

export function setSubPartyDefault(partyId: string, subPartyId: string): SubPartyRecord | null {
  const subParties = getLocalSubParties();
  const target = subParties.find((sp) => sp.id === subPartyId && sp.partyId === partyId);
  if (!target || target.status === "Inactive") return null;

  const now = new Date().toISOString();
  subParties.forEach((sp) => {
    if (sp.partyId === partyId) {
      if (sp.id === subPartyId) {
        sp.isDefault = true;
        sp.updatedAt = now;
      } else if (sp.isDefault) {
        sp.isDefault = false;
        sp.updatedAt = now;
      }
    }
  });

  saveLocalSubParties(subParties);
  return target;
}

export function deletePartyRecord(id: string): { success: boolean; message: string } {
  const parties = getLocalParties();
  const target = parties.find((p) => p.id === id);
  if (!target) return { success: false, message: "Party not found" };

  if (target.transactionCount && target.transactionCount > 0) {
    return {
      success: false,
      message:
        "This Party is already used in transactions. It cannot be deleted. You can deactivate the Party instead.",
    };
  }

  // Also check if any sub parties are used
  const subParties = getSubPartiesByPartyId(id);
  const usedSubParty = subParties.find((sp) => sp.transactionCount && sp.transactionCount > 0);
  if (usedSubParty) {
    return {
      success: false,
      message: `A Sub Party (${usedSubParty.subPartyName}) under this Party is used in transactions. The Party cannot be deleted.`,
    };
  }

  const updatedParties = parties.filter((p) => p.id !== id);
  const updatedSubParties = getLocalSubParties().filter((sp) => sp.partyId !== id);

  saveLocalParties(updatedParties);
  saveLocalSubParties(updatedSubParties);

  return { success: true, message: "Party deleted successfully" };
}

export function deleteSubPartyRecord(id: string): { success: boolean; message: string } {
  const subParties = getLocalSubParties();
  const target = subParties.find((sp) => sp.id === id);
  if (!target) return { success: false, message: "Sub Party not found" };

  if (target.transactionCount && target.transactionCount > 0) {
    return {
      success: false,
      message:
        "This Sub Party is already used in transactions. It cannot be deleted. You can deactivate the Sub Party instead.",
    };
  }

  const updated = subParties.filter((sp) => sp.id !== id);
  saveLocalSubParties(updated);

  return { success: true, message: "Sub Party deleted successfully" };
}
