import { supabase } from "@/integrations/supabase/client";

export async function logAudit(action: string, entityId: string, details: string) {
  try {
    await (supabase.from as any)("audit_log").insert({
      entity: "warehouse",
      entity_id: entityId,
      action,
      details,
      actor_name: "Demo Admin",
    });
  } catch {
    // Ignore audit log error if offline
  }
}

export type WarehouseType =
  | "Raw Material"
  | "Yarn"
  | "Beam"
  | "Grey Fabric"
  | "Finished Goods"
  | "Chemical"
  | "Packing Material"
  | "General"
  | "Third Party"
  | "Other";

export const WAREHOUSE_TYPES: WarehouseType[] = [
  "Raw Material",
  "Yarn",
  "Beam",
  "Grey Fabric",
  "Finished Goods",
  "Chemical",
  "Packing Material",
  "General",
  "Third Party",
  "Other",
];

export interface WarehouseRecord {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  warehouseTypeOther?: string | undefined;
  addressLine1?: string | undefined;
  addressLine2?: string | undefined;
  area?: string | undefined;
  city?: string | undefined;
  district?: string | undefined;
  state?: string | undefined;
  pincode?: string | undefined;
  country?: string | undefined;
  contactPerson?: string | undefined;
  mobile?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  remarks?: string | undefined;
  status: "Active" | "Deactive";
  locationsCount?: number | undefined;
  createdBy?: string | undefined;
  createdAt: string;
  updatedBy?: string | undefined;
  updatedAt: string;
}

export interface WarehouseLocationRecord {
  id: string;
  warehouseId: string;
  locationCode: string;
  locationName: string;
  description?: string | undefined;
  status: "Active" | "Deactive";
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY_WAREHOUSES = "sckt_warehouses_v1";
const STORAGE_KEY_LOCATIONS = "sckt_warehouse_locations_v1";
const MAX_SEQ_KEY = "sckt_wh_max_seq";

// Seed Warehouses
const SEED_WAREHOUSES: WarehouseRecord[] = [
  {
    id: "wh-001",
    warehouseCode: "WH-01",
    warehouseName: "Main Factory Warehouse",
    warehouseType: "General",
    addressLine1: "Ring Road Industrial Estate",
    addressLine2: "Puna Kumbharia Road",
    area: "Central Zone",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pincode: "395006",
    country: "India",
    contactPerson: "Rajesh Shah",
    mobile: "9825101010",
    phone: "0261-2345678",
    email: "wh.main@sckt.com",
    remarks: "Primary factory raw material and operational storage hub.",
    status: "Active",
    createdAt: "2026-01-10T08:00:00Z",
    updatedAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "wh-002",
    warehouseCode: "WH-02",
    warehouseName: "Yarn Warehouse",
    warehouseType: "Yarn",
    addressLine1: "GIDC Bhatar Road",
    addressLine2: "Plot No. 42",
    area: "Bhatar",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pincode: "395007",
    country: "India",
    contactPerson: "Kishore Patel",
    mobile: "9825202020",
    phone: "0261-2345679",
    email: "yarn.store@sckt.com",
    remarks: "Temperature-controlled yarn package and cone storage.",
    status: "Active",
    createdAt: "2026-01-15T09:30:00Z",
    updatedAt: "2026-08-05T11:20:00Z",
  },
  {
    id: "wh-003",
    warehouseCode: "WH-03",
    warehouseName: "Grey Fabric Warehouse",
    warehouseType: "Grey Fabric",
    addressLine1: "GIDC Pandesara",
    addressLine2: "Road No. 3",
    area: "Pandesara",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pincode: "395022",
    country: "India",
    contactPerson: "Ramesh Varma",
    mobile: "9825303030",
    phone: "0261-2345680",
    email: "grey.store@sckt.com",
    remarks: "Storage for loom-state grey fabric rolls prior to processing.",
    status: "Active",
    createdAt: "2026-02-01T11:00:00Z",
    updatedAt: "2026-08-08T14:15:00Z",
  },
  {
    id: "wh-004",
    warehouseCode: "WH-04",
    warehouseName: "Finished Goods Warehouse",
    warehouseType: "Finished Goods",
    addressLine1: "Kadodara Char Rasta",
    addressLine2: "NH 48 Bypass",
    area: "Kadodara",
    city: "Surat",
    district: "Surat",
    state: "Gujarat",
    pincode: "394327",
    country: "India",
    contactPerson: "Mukesh Mehta",
    mobile: "9825404040",
    phone: "0261-2345681",
    email: "fg.store@sckt.com",
    remarks: "Central finished goods dispatch and packing facility.",
    status: "Active",
    createdAt: "2026-02-15T14:00:00Z",
    updatedAt: "2026-08-10T16:45:00Z",
  },
];

// Seed Locations
const SEED_LOCATIONS: WarehouseLocationRecord[] = [
  // WH-01 Locations
  {
    id: "loc-001-1",
    warehouseId: "wh-001",
    locationCode: "LOC-01",
    locationName: "Ground Floor",
    description: "General raw material staging area",
    status: "Active",
    createdAt: "2026-01-10T08:00:00Z",
    updatedAt: "2026-01-10T08:00:00Z",
  },
  {
    id: "loc-001-2",
    warehouseId: "wh-001",
    locationCode: "LOC-02",
    locationName: "First Floor",
    description: "Sizing & beam storage zone",
    status: "Active",
    createdAt: "2026-01-10T08:00:00Z",
    updatedAt: "2026-01-10T08:00:00Z",
  },
  {
    id: "loc-001-3",
    warehouseId: "wh-001",
    locationCode: "LOC-03",
    locationName: "Section A",
    description: "Heavy warp yarn racks",
    status: "Active",
    createdAt: "2026-01-10T08:00:00Z",
    updatedAt: "2026-01-10T08:00:00Z",
  },
  {
    id: "loc-001-4",
    warehouseId: "wh-001",
    locationCode: "LOC-04",
    locationName: "Section B",
    description: "Weft yarn and spare parts section",
    status: "Active",
    createdAt: "2026-01-10T08:00:00Z",
    updatedAt: "2026-01-10T08:00:00Z",
  },
  {
    id: "loc-001-5",
    warehouseId: "wh-001",
    locationCode: "LOC-05",
    locationName: "Staging Area",
    description: "Inward inspection & unloading bay",
    status: "Active",
    createdAt: "2026-01-10T08:00:00Z",
    updatedAt: "2026-01-10T08:00:00Z",
  },

  // WH-02 Locations
  {
    id: "loc-002-1",
    warehouseId: "wh-002",
    locationCode: "LOC-01",
    locationName: "Ground Floor",
    description: "Filament & polyester yarn section",
    status: "Active",
    createdAt: "2026-01-15T09:30:00Z",
    updatedAt: "2026-01-15T09:30:00Z",
  },
  {
    id: "loc-002-2",
    warehouseId: "wh-002",
    locationCode: "LOC-02",
    locationName: "First Floor",
    description: "Cotton & spun yarn racks",
    status: "Active",
    createdAt: "2026-01-15T09:30:00Z",
    updatedAt: "2026-01-15T09:30:00Z",
  },
  {
    id: "loc-002-3",
    warehouseId: "wh-002",
    locationCode: "LOC-03",
    locationName: "Jari Section",
    description: "Banarasi & metallic lurex jari vault",
    status: "Active",
    createdAt: "2026-01-15T09:30:00Z",
    updatedAt: "2026-01-15T09:30:00Z",
  },
  {
    id: "loc-002-4",
    warehouseId: "wh-002",
    locationCode: "LOC-04",
    locationName: "Nylon Section",
    description: "High tenacity mono-filament section",
    status: "Active",
    createdAt: "2026-01-15T09:30:00Z",
    updatedAt: "2026-01-15T09:30:00Z",
  },

  // WH-03 Locations
  {
    id: "loc-003-1",
    warehouseId: "wh-003",
    locationCode: "LOC-01",
    locationName: "Folding Area",
    description: "Loom roll folding & checking space",
    status: "Active",
    createdAt: "2026-02-01T11:00:00Z",
    updatedAt: "2026-02-01T11:00:00Z",
  },
  {
    id: "loc-003-2",
    warehouseId: "wh-003",
    locationCode: "LOC-02",
    locationName: "Roll Storage",
    description: "Palletized grey roll racks",
    status: "Active",
    createdAt: "2026-02-01T11:00:00Z",
    updatedAt: "2026-02-01T11:00:00Z",
  },
  {
    id: "loc-003-3",
    warehouseId: "wh-003",
    locationCode: "LOC-03",
    locationName: "Inspection Section",
    description: "Grading & defect marking area",
    status: "Active",
    createdAt: "2026-02-01T11:00:00Z",
    updatedAt: "2026-02-01T11:00:00Z",
  },

  // WH-04 Locations
  {
    id: "loc-004-1",
    warehouseId: "wh-004",
    locationCode: "LOC-01",
    locationName: "Packing Rack A",
    description: "Export finished goods packing rack",
    status: "Active",
    createdAt: "2026-02-15T14:00:00Z",
    updatedAt: "2026-02-15T14:00:00Z",
  },
  {
    id: "loc-004-2",
    warehouseId: "wh-004",
    locationCode: "LOC-02",
    locationName: "Dispatch Bay 1",
    description: "Lorry loading & dispatch bay",
    status: "Active",
    createdAt: "2026-02-15T14:00:00Z",
    updatedAt: "2026-02-15T14:00:00Z",
  },
];

/**
 * Get all local warehouse records with location counts.
 */
export function getLocalWarehouses(): WarehouseRecord[] {
  if (typeof window === "undefined") return SEED_WAREHOUSES;

  let warehouses: WarehouseRecord[] = SEED_WAREHOUSES;
  const storedWh = localStorage.getItem(STORAGE_KEY_WAREHOUSES);
  if (storedWh) {
    try {
      warehouses = JSON.parse(storedWh);
    } catch {
      warehouses = SEED_WAREHOUSES;
    }
  } else {
    localStorage.setItem(STORAGE_KEY_WAREHOUSES, JSON.stringify(SEED_WAREHOUSES));
  }

  const locations = getLocalWarehouseLocations();

  // Attach dynamic location counts
  return warehouses.map((wh) => {
    const count = locations.filter((loc) => loc.warehouseId === wh.id).length;
    return { ...wh, locationsCount: count };
  });
}

/**
 * Save warehouse records to localStorage.
 */
export function saveLocalWarehouses(data: WarehouseRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_WAREHOUSES, JSON.stringify(data));
}

/**
 * Get all local warehouse locations.
 */
export function getLocalWarehouseLocations(): WarehouseLocationRecord[] {
  if (typeof window === "undefined") return SEED_LOCATIONS;

  const storedLocs = localStorage.getItem(STORAGE_KEY_LOCATIONS);
  if (!storedLocs) {
    localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(SEED_LOCATIONS));
    return SEED_LOCATIONS;
  }
  try {
    return JSON.parse(storedLocs);
  } catch {
    return SEED_LOCATIONS;
  }
}

/**
 * Save warehouse location records to localStorage.
 */
export function saveLocalWarehouseLocations(data: WarehouseLocationRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(data));
}

/**
 * Get child locations for a specific warehouse.
 */
export function getLocationsByWarehouseId(warehouseId: string): WarehouseLocationRecord[] {
  const allLocs = getLocalWarehouseLocations();
  return allLocs.filter((loc) => loc.warehouseId === warehouseId);
}

/**
 * Generate the next automatic Warehouse Code (WH-01, WH-02, WH-03...).
 * Uses sequence tracking so deleted/deactivated codes are NEVER re-used.
 */
export function generateNextWarehouseCode(): string {
  const warehouses = getLocalWarehouses();
  let maxSeq = 0;

  for (const wh of warehouses) {
    const match = wh.warehouseCode.match(/^WH-(\d+)$/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  if (typeof window !== "undefined") {
    const storedMax = localStorage.getItem(MAX_SEQ_KEY);
    if (storedMax) {
      const num = parseInt(storedMax, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  if (typeof window !== "undefined") {
    localStorage.setItem(MAX_SEQ_KEY, String(nextSeq));
  }

  return `WH-${String(nextSeq).padStart(2, "0")}`;
}

/**
 * Check if a Warehouse Name already exists (exact match case-insensitive).
 */
export function isDuplicateWarehouseName(name: string, excludeId?: string): boolean {
  const warehouses = getLocalWarehouses();
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return false;

  return warehouses.some(
    (wh) => wh.id !== excludeId && wh.warehouseName.trim().toLowerCase() === trimmed,
  );
}

/**
 * Check for similar warehouse names for fuzzy warning dialog.
 */
export function findSimilarWarehouseName(name: string, excludeId?: string): WarehouseRecord | null {
  const warehouses = getLocalWarehouses();
  const target = name.trim().toLowerCase();
  if (target.length < 3) return null;

  for (const wh of warehouses) {
    if (wh.id === excludeId) continue;
    const existing = wh.warehouseName.trim().toLowerCase();

    if (existing === target) continue; // exact matches handled by duplicate check

    // Check substring inclusion or high similarity
    if (existing.includes(target) || target.includes(existing)) {
      return wh;
    }

    // Check token overlap
    const targetTokens = target.split(/\s+/).filter((t) => t.length > 2);
    const existingTokens = existing.split(/\s+/).filter((t) => t.length > 2);
    const common = targetTokens.filter((t) => existingTokens.includes(t));
    if (
      common.length >= 2 &&
      common.length >= Math.min(targetTokens.length, existingTokens.length)
    ) {
      return wh;
    }
  }

  return null;
}

/**
 * Save or update a Warehouse record.
 */
export function saveWarehouseRecord(
  data: Partial<WarehouseRecord> & { warehouseName: string; warehouseType: WarehouseType },
): { success: boolean; warehouse?: WarehouseRecord; error?: string } {
  const warehouses = getLocalWarehouses();
  const trimmedName = data.warehouseName.trim();

  if (!trimmedName) {
    return { success: false, error: "Warehouse Name is required." };
  }

  if (isDuplicateWarehouseName(trimmedName, data.id)) {
    return {
      success: false,
      error: `A Warehouse with the name "${trimmedName}" already exists.`,
    };
  }

  const now = new Date().toISOString();

  if (data.id) {
    // Edit existing warehouse (Code must remain read-only & unchanged!)
    const index = warehouses.findIndex((wh) => wh.id === data.id);
    const existing = warehouses[index];
    if (index === -1 || !existing) {
      return { success: false, error: "Warehouse record not found." };
    }

    const updatedWh: WarehouseRecord = {
      ...existing,
      warehouseName: trimmedName,
      warehouseType: data.warehouseType,
      warehouseTypeOther:
        data.warehouseType === "Other" ? data.warehouseTypeOther?.trim() || undefined : undefined,
      addressLine1: data.addressLine1?.trim() || undefined,
      addressLine2: data.addressLine2?.trim() || undefined,
      area: data.area?.trim() || undefined,
      city: data.city?.trim() || undefined,
      district: data.district?.trim() || undefined,
      state: data.state?.trim() || undefined,
      pincode: data.pincode?.trim() || undefined,
      country: data.country?.trim() || "India",
      contactPerson: data.contactPerson?.trim() || undefined,
      mobile: data.mobile?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      remarks: data.remarks?.trim() || undefined,
      status: data.status || existing.status,
      updatedAt: now,
    };

    warehouses[index] = updatedWh;
    saveLocalWarehouses(warehouses);
    logAudit(
      "Warehouse Updated",
      updatedWh.id,
      `Updated Warehouse ${updatedWh.warehouseCode} (${updatedWh.warehouseName})`,
    );

    // Background sync to Supabase
    (supabase.from as any)("warehouses")
      .upsert({
        id: updatedWh.id.startsWith("wh-") ? undefined : updatedWh.id,
        warehouse_code: updatedWh.warehouseCode,
        warehouse_name: updatedWh.warehouseName,
        warehouse_type: updatedWh.warehouseType,
        warehouse_type_other: updatedWh.warehouseTypeOther,
        address_line_1: updatedWh.addressLine1,
        address_line_2: updatedWh.addressLine2,
        area: updatedWh.area,
        city: updatedWh.city,
        district: updatedWh.district,
        state: updatedWh.state,
        pincode: updatedWh.pincode,
        country: updatedWh.country,
        contact_person: updatedWh.contactPerson,
        mobile: updatedWh.mobile,
        phone: updatedWh.phone,
        email: updatedWh.email,
        remarks: updatedWh.remarks,
        status: updatedWh.status,
        updated_at: now,
      })
      .then(({ error }: any) => {
        if (error) console.error("[Supabase Sync Error: warehouses upsert]", error);
      });

    return { success: true, warehouse: updatedWh };
  } else {
    // Create new Warehouse (Auto-generated WH-XX code)
    const code = generateNextWarehouseCode();

    const newWh: WarehouseRecord = {
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      warehouseCode: code,
      warehouseName: trimmedName,
      warehouseType: data.warehouseType,
      warehouseTypeOther:
        data.warehouseType === "Other" ? data.warehouseTypeOther?.trim() || undefined : undefined,
      addressLine1: data.addressLine1?.trim() || undefined,
      addressLine2: data.addressLine2?.trim() || undefined,
      area: data.area?.trim() || undefined,
      city: data.city?.trim() || undefined,
      district: data.district?.trim() || undefined,
      state: data.state?.trim() || undefined,
      pincode: data.pincode?.trim() || undefined,
      country: data.country?.trim() || "India",
      contactPerson: data.contactPerson?.trim() || undefined,
      mobile: data.mobile?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      remarks: data.remarks?.trim() || undefined,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    };

    warehouses.unshift(newWh);
    saveLocalWarehouses(warehouses);
    logAudit(
      "Warehouse Created",
      newWh.id,
      `Created Warehouse ${newWh.warehouseCode} (${newWh.warehouseName})`,
    );

    // Background sync to Supabase
    (supabase.from as any)("warehouses")
      .insert({
        warehouse_code: newWh.warehouseCode,
        warehouse_name: newWh.warehouseName,
        warehouse_type: newWh.warehouseType,
        warehouse_type_other: newWh.warehouseTypeOther,
        address_line_1: newWh.addressLine1,
        address_line_2: newWh.addressLine2,
        area: newWh.area,
        city: newWh.city,
        district: newWh.district,
        state: newWh.state,
        pincode: newWh.pincode,
        country: newWh.country,
        contact_person: newWh.contactPerson,
        mobile: newWh.mobile,
        phone: newWh.phone,
        email: newWh.email,
        remarks: newWh.remarks,
        status: newWh.status,
      })
      .then(({ error }: any) => {
        if (error) console.error("[Supabase Sync Error: warehouses insert]", error);
      });

    return { success: true, warehouse: newWh };
  }
}

/**
 * Toggle Warehouse Status between Active and Deactive.
 */
export function toggleWarehouseStatus(id: string): {
  success: boolean;
  warehouse?: WarehouseRecord;
  error?: string;
} {
  const warehouses = getLocalWarehouses();
  const index = warehouses.findIndex((wh) => wh.id === id);
  const existing = warehouses[index];

  if (index === -1 || !existing) {
    return { success: false, error: "Warehouse record not found." };
  }

  const newStatus: "Active" | "Deactive" = existing.status === "Active" ? "Deactive" : "Active";
  const updatedWh: WarehouseRecord = {
    ...existing,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  warehouses[index] = updatedWh;
  saveLocalWarehouses(warehouses);
  logAudit(
    `Warehouse ${newStatus === "Active" ? "Activated" : "Deactivated"}`,
    updatedWh.id,
    `Status changed to ${newStatus} for ${updatedWh.warehouseCode} (${updatedWh.warehouseName})`,
  );

  return { success: true, warehouse: updatedWh };
}

/**
 * Check if a Warehouse can be deleted (Safety Guard).
 */
export function canDeleteWarehouse(id: string): { allowed: boolean; reason?: string } {
  const locations = getLocationsByWarehouseId(id);
  if (locations.length > 0) {
    const sampleNames = locations
      .slice(0, 3)
      .map((l) => l.locationName)
      .join(", ");
    return {
      allowed: false,
      reason: `This Warehouse has ${locations.length} associated Location records (e.g. ${sampleNames}). A Warehouse with active child locations cannot be deleted. Please deactivate the Warehouse instead.`,
    };
  }

  return { allowed: true };
}

/**
 * Delete a Warehouse (only if safe).
 */
export function deleteWarehouseRecord(id: string): { success: boolean; error?: string } {
  const guard = canDeleteWarehouse(id);
  if (!guard.allowed) {
    return { success: false, error: guard.reason || "This Warehouse cannot be deleted." };
  }

  let warehouses = getLocalWarehouses();
  const target = warehouses.find((wh) => wh.id === id);
  if (!target) {
    return { success: false, error: "Warehouse record not found." };
  }

  warehouses = warehouses.filter((wh) => wh.id !== id);
  saveLocalWarehouses(warehouses);
  logAudit(
    "Warehouse Deleted",
    id,
    `Deleted Warehouse ${target.warehouseCode} (${target.warehouseName})`,
  );

  return { success: true };
}

/**
 * Save or update a child Warehouse Location record.
 */
export function saveWarehouseLocationRecord(
  warehouseId: string,
  locationName: string,
  description?: string,
  locationId?: string,
): { success: boolean; location?: WarehouseLocationRecord; error?: string } {
  const locations = getLocalWarehouseLocations();
  const trimmedName = locationName.trim();

  if (!trimmedName) {
    return { success: false, error: "Location Name is required." };
  }

  const warehouseLocations = locations.filter((loc) => loc.warehouseId === warehouseId);
  const now = new Date().toISOString();

  if (locationId) {
    const index = locations.findIndex((loc) => loc.id === locationId);
    const existing = locations[index];
    if (index === -1 || !existing) {
      return { success: false, error: "Location record not found." };
    }

    const updatedLoc: WarehouseLocationRecord = {
      ...existing,
      locationName: trimmedName,
      description: description?.trim() || undefined,
      updatedAt: now,
    };

    locations[index] = updatedLoc;
    saveLocalWarehouseLocations(locations);
    return { success: true, location: updatedLoc };
  } else {
    // Generate next LOC-XX code for this warehouse
    let maxSeq = 0;
    for (const loc of warehouseLocations) {
      const match = loc.locationCode.match(/^LOC-(\d+)$/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
    const code = `LOC-${String(maxSeq + 1).padStart(2, "0")}`;

    const newLoc: WarehouseLocationRecord = {
      id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      warehouseId,
      locationCode: code,
      locationName: trimmedName,
      description: description?.trim() || undefined,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    };

    locations.unshift(newLoc);
    saveLocalWarehouseLocations(locations);
    return { success: true, location: newLoc };
  }
}
