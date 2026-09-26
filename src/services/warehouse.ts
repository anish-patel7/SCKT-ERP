/**
 * Warehouse Location Management Service
 * Handles zones, locations, and capacity tracking
 */

import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ValidationError, InventoryError } from "./inventory";

// Types
export interface WarehouseZone {
  id: string;
  name: string;
  description?: string;
  color_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarehouseLocation {
  id: string;
  code: string;
  name: string;
  zone_id: string;
  zone?: WarehouseZone;
  capacity_kg?: number;
  capacity_metres?: number;
  current_qty_kg: number;
  current_qty_metres: number;
  is_active: boolean;
  coordinates: { x: number; y: number };
  created_at: string;
  updated_at: string;
}

export interface LocationCapacityAlert {
  location_id: string;
  code: string;
  name: string;
  used_kg?: number;
  capacity_kg?: number;
  used_metres?: number;
  capacity_metres?: number;
  usage_percentage: number;
  is_full: boolean;
}

// Schemas
const ZoneSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color_code: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  is_active: z.boolean().default(true),
});

const LocationSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  zone_id: z.string().uuid(),
  capacity_kg: z.number().positive().optional(),
  capacity_metres: z.number().positive().optional(),
  coordinates: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
  }),
  is_active: z.boolean().default(true),
});

export const warehouseService = {
  /**
   * List all warehouse zones
   */
  async listZones(activeOnly: boolean = true): Promise<WarehouseZone[]> {
    let query = supabase.from("warehouse_zones").select("*");

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query.order("name", { ascending: true });

    if (error) {
      throw new InventoryError(`Failed to fetch zones: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Get single zone by ID
   */
  async getZoneById(zoneId: string): Promise<WarehouseZone> {
    const { data, error } = await supabase
      .from("warehouse_zones")
      .select("*")
      .eq("id", zoneId)
      .single();

    if (error) {
      throw new InventoryError(`Zone not found: ${zoneId}`);
    }

    return data as WarehouseZone;
  },

  /**
   * List all warehouse locations with optional zone filtering
   */
  async listLocations(
    filters?: { zoneId?: string; activeOnly?: boolean },
  ): Promise<WarehouseLocation[]> {
    let query = supabase
      .from("warehouse_locations")
      .select("*, warehouse_zones(*)");

    if (filters?.zoneId) {
      query = query.eq("zone_id", filters.zoneId);
    }

    if (filters?.activeOnly !== false) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query.order("code", { ascending: true });

    if (error) {
      throw new InventoryError(`Failed to fetch locations: ${error.message}`);
    }

    return (
      data?.map((item: any) => ({
        ...item,
        zone: item.warehouse_zones || undefined,
      })) || []
    );
  },

  /**
   * Get single location by code
   */
  async getLocationByCode(code: string): Promise<WarehouseLocation> {
    const { data, error } = await supabase
      .from("warehouse_locations")
      .select("*, warehouse_zones(*)")
      .eq("code", code)
      .eq("is_active", true)
      .single();

    if (error) {
      throw new InventoryError(`Location not found: ${code}`);
    }

    return {
      ...(data as any),
      zone: (data as any).warehouse_zones || undefined,
    } as WarehouseLocation;
  },

  /**
   * Get single location by ID
   */
  async getLocationById(locationId: string): Promise<WarehouseLocation> {
    const { data, error } = await supabase
      .from("warehouse_locations")
      .select("*, warehouse_zones(*)")
      .eq("id", locationId)
      .single();

    if (error) {
      throw new InventoryError(`Location not found: ${locationId}`);
    }

    return {
      ...(data as any),
      zone: (data as any).warehouse_zones || undefined,
    } as WarehouseLocation;
  },

  /**
   * Search locations by code with autocomplete
   */
  async searchLocationsByCode(
    codePrefix: string,
    limit: number = 10,
  ): Promise<WarehouseLocation[]> {
    const { data, error } = await supabase
      .from("warehouse_locations")
      .select("*, warehouse_zones(*)")
      .ilike("code", `${codePrefix}%`)
      .eq("is_active", true)
      .limit(limit)
      .order("code", { ascending: true });

    if (error) {
      throw new InventoryError(`Search failed: ${error.message}`);
    }

    return (
      data?.map((item: any) => ({
        ...item,
        zone: item.warehouse_zones || undefined,
      })) || []
    );
  },

  /**
   * Get locations with available capacity
   * Returns only locations that have free space
   */
  async getAvailableLocations(
    zoneId?: string,
  ): Promise<WarehouseLocation[]> {
    let query = supabase
      .from("warehouse_locations")
      .select("*, warehouse_zones(*)")
      .eq("is_active", true);

    if (zoneId) {
      query = query.eq("zone_id", zoneId);
    }

    const { data, error } = await query.order("code", { ascending: true });

    if (error) {
      throw new InventoryError(`Failed to fetch locations: ${error.message}`);
    }

    // Filter for available capacity
    const locations =
      data?.map((item: any) => ({
        ...item,
        zone: item.warehouse_zones || undefined,
      })) || [];

    return locations.filter((loc: WarehouseLocation) => {
      // Has available capacity if:
      // - For weight: current_qty_kg < capacity_kg
      // - For length: current_qty_metres < capacity_metres
      // - At least one capacity type is defined
      if (loc.capacity_kg) {
        return loc.current_qty_kg < loc.capacity_kg;
      }
      if (loc.capacity_metres) {
        return loc.current_qty_metres < loc.capacity_metres;
      }
      return true; // No capacity limit defined
    });
  },

  /**
   * Get capacity alerts for all locations
   * Returns locations exceeding 80% capacity
   */
  async getCapacityAlerts(): Promise<LocationCapacityAlert[]> {
    const locations = await this.listLocations({ activeOnly: true });

    return locations
      .map((loc) => {
        const alerts: LocationCapacityAlert[] = [];

        // Check weight capacity
        if (loc.capacity_kg && loc.capacity_kg > 0) {
          const percentageKg =
            (loc.current_qty_kg / loc.capacity_kg) * 100;
          if (percentageKg >= 80) {
            alerts.push({
              location_id: loc.id,
              code: loc.code,
              name: loc.name,
              used_kg: loc.current_qty_kg,
              capacity_kg: loc.capacity_kg,
              usage_percentage: Math.round(percentageKg),
              is_full: percentageKg >= 100,
            });
          }
        }

        // Check length capacity
        if (loc.capacity_metres && loc.capacity_metres > 0) {
          const percentageM =
            (loc.current_qty_metres / loc.capacity_metres) * 100;
          if (percentageM >= 80) {
            alerts.push({
              location_id: loc.id,
              code: loc.code,
              name: loc.name,
              used_metres: loc.current_qty_metres,
              capacity_metres: loc.capacity_metres,
              usage_percentage: Math.round(percentageM),
              is_full: percentageM >= 100,
            });
          }
        }

        return alerts;
      })
      .flat();
  },

  /**
   * Update location capacity (called from inventory transactions)
   * Incrementally updates current quantities
   */
  async updateLocationCapacity(
    locationId: string,
    qtyKgChange?: number,
    qtyMetresChange?: number,
  ): Promise<WarehouseLocation> {
    const location = await this.getLocationById(locationId);

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (qtyKgChange !== undefined) {
      const newQtyKg = location.current_qty_kg + qtyKgChange;
      if (newQtyKg < 0) {
        throw new ValidationError(
          "quantity",
          "Insufficient stock at location",
        );
      }
      updates.current_qty_kg = Math.max(0, newQtyKg);
    }

    if (qtyMetresChange !== undefined) {
      const newQtyM = location.current_qty_metres + qtyMetresChange;
      if (newQtyM < 0) {
        throw new ValidationError(
          "quantity",
          "Insufficient stock at location",
        );
      }
      updates.current_qty_metres = Math.max(0, newQtyM);
    }

    const { data, error } = await supabase
      .from("warehouse_locations")
      .update(updates)
      .eq("id", locationId)
      .select("*, warehouse_zones(*)")
      .single();

    if (error) {
      throw new InventoryError(
        `Failed to update location capacity: ${error.message}`,
      );
    }

    return {
      ...(data as any),
      zone: (data as any).warehouse_zones || undefined,
    } as WarehouseLocation;
  },

  /**
   * Get warehouse layout data for map rendering
   * Organizes locations by zone with coordinates
   */
  async getWarehouseLayout(): Promise<{
    zones: WarehouseZone[];
    locations: WarehouseLocation[];
    bounds: { width: number; height: number };
  }> {
    const zones = await this.listZones(true);
    const locations = await this.listLocations({ activeOnly: true });

    // Calculate bounds from coordinates
    let maxX = 0,
      maxY = 0;
    locations.forEach((loc) => {
      if (loc.coordinates.x > maxX) maxX = loc.coordinates.x;
      if (loc.coordinates.y > maxY) maxY = loc.coordinates.y;
    });

    return {
      zones,
      locations,
      bounds: {
        width: Math.max(600, maxX + 100),
        height: Math.max(400, maxY + 100),
      },
    };
  },

  /**
   * Get capacity color for visualization
   * Green (empty) → Yellow (partial) → Red (full)
   */
  getCapacityColor(
    usedQty: number,
    capacity: number,
  ): string {
    if (capacity <= 0) return "#94a3b8"; // Gray for no limit
    const percentage = (usedQty / capacity) * 100;

    if (percentage <= 20) return "#10b981"; // Green
    if (percentage <= 50) return "#eab308"; // Yellow
    if (percentage <= 80) return "#f97316"; // Orange
    return "#ef4444"; // Red
  },
};
