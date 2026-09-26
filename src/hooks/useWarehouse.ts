/**
 * Warehouse Location Management Hooks
 * TanStack Query integration for warehouse data
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  warehouseService,
  type WarehouseZone,
  type WarehouseLocation,
  type LocationCapacityAlert,
} from "@/services/warehouse";

/**
 * Fetch all warehouse zones
 */
export function useWarehouseZones(activeOnly: boolean = true) {
  return useQuery({
    queryKey: ["warehouse_zones", activeOnly],
    queryFn: () => warehouseService.listZones(activeOnly),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/**
 * Fetch single zone by ID
 */
export function useWarehouseZone(zoneId?: string) {
  return useQuery({
    queryKey: ["warehouse_zone", zoneId],
    queryFn: () => {
      if (!zoneId) throw new Error("Zone ID required");
      return warehouseService.getZoneById(zoneId);
    },
    enabled: !!zoneId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch all warehouse locations
 */
export function useWarehouseLocations(filters?: {
  zoneId?: string;
  activeOnly?: boolean;
}) {
  return useQuery({
    queryKey: ["warehouse_locations", filters],
    queryFn: () => warehouseService.listLocations(filters),
    staleTime: 3 * 60 * 1000, // 3 min (more frequent for capacity tracking)
  });
}

/**
 * Fetch single location by code
 */
export function useWarehouseLocationByCode(code?: string) {
  return useQuery({
    queryKey: ["warehouse_location_code", code],
    queryFn: () => {
      if (!code) throw new Error("Location code required");
      return warehouseService.getLocationByCode(code);
    },
    enabled: !!code,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Fetch single location by ID
 */
export function useWarehouseLocation(locationId?: string) {
  return useQuery({
    queryKey: ["warehouse_location", locationId],
    queryFn: () => {
      if (!locationId) throw new Error("Location ID required");
      return warehouseService.getLocationById(locationId);
    },
    enabled: !!locationId,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Search locations by code with autocomplete
 */
export function useSearchLocations(codePrefix?: string) {
  return useQuery({
    queryKey: ["warehouse_locations_search", codePrefix],
    queryFn: () => {
      if (!codePrefix) return [];
      return warehouseService.searchLocationsByCode(codePrefix);
    },
    enabled: !!codePrefix && codePrefix.length > 0,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Fetch locations with available capacity
 */
export function useAvailableLocations(zoneId?: string) {
  return useQuery({
    queryKey: ["warehouse_locations_available", zoneId],
    queryFn: () => warehouseService.getAvailableLocations(zoneId),
    staleTime: 2 * 60 * 1000, // 2 min (capacity changes frequently)
  });
}

/**
 * Fetch capacity alerts (locations > 80% capacity)
 */
export function useCapacityAlerts() {
  return useQuery({
    queryKey: ["warehouse_capacity_alerts"],
    queryFn: () => warehouseService.getCapacityAlerts(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch complete warehouse layout for map rendering
 */
export function useWarehouseLayout() {
  return useQuery({
    queryKey: ["warehouse_layout"],
    queryFn: () => warehouseService.getWarehouseLayout(),
    staleTime: 3 * 60 * 1000, // 3 min
  });
}

/**
 * Mutation: Update location capacity
 * (Called from inventory transaction service)
 */
export function useUpdateLocationCapacity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      locationId,
      qtyKgChange,
      qtyMetresChange,
    }: {
      locationId: string;
      qtyKgChange?: number;
      qtyMetresChange?: number;
    }) =>
      warehouseService.updateLocationCapacity(
        locationId,
        qtyKgChange,
        qtyMetresChange,
      ),
    onSuccess: () => {
      // Invalidate all location-related queries
      queryClient.invalidateQueries({
        queryKey: ["warehouse_locations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["warehouse_location"],
      });
      queryClient.invalidateQueries({
        queryKey: ["warehouse_locations_available"],
      });
      queryClient.invalidateQueries({
        queryKey: ["warehouse_capacity_alerts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["warehouse_layout"],
      });
    },
  });
}
