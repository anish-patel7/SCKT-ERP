import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { warehousesService } from "@/services/warehouses";
import type { Database } from "@/integrations/supabase/types";

type Warehouse = Database["public"]["Tables"]["warehouses"]["Row"];

export function useWarehouses(includeInactive = false) {
  return useQuery({
    queryKey: ["warehouses", { includeInactive }],
    queryFn: () => warehousesService.listWarehouses(includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNextWarehouseCode(enabled: boolean) {
  return useQuery({
    queryKey: ["warehouses", "next_code"],
    queryFn: () => warehousesService.nextWarehouseCode(),
    enabled,
    staleTime: 0,
  });
}

export function useWarehouseById(id: string) {
  return useQuery({
    queryKey: ["warehouses", id],
    queryFn: () => warehousesService.getWarehouseById(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWarehouseByCode(code: string) {
  return useQuery({
    queryKey: ["warehouses", "code", code],
    queryFn: () => warehousesService.getWarehouseByCode(code),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => warehousesService.createWarehouse(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

export function useUpdateWarehouse(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => warehousesService.updateWarehouse(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", id] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

export function useSetWarehouseStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: "Active" | "Inactive") => warehousesService.setWarehouseStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", id] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

export function useSearchWarehouses(query: string, limit = 10) {
  return useQuery({
    queryKey: ["warehouses", "search", query, limit],
    queryFn: () => warehousesService.searchWarehouses(query, limit),
    staleTime: 2 * 60 * 1000,
  });
}

export function useWarehousesByType(warehouseType: string, includeInactive = false) {
  return useQuery({
    queryKey: ["warehouses", "type", warehouseType, { includeInactive }],
    queryFn: () => warehousesService.getWarehousesByType(warehouseType, includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}

// useWarehouseCapacityUtilization removed: it had no callers and called a service method that
// does not exist (see the TODO for getWarehouseCapacityUtilization in services/warehouses.ts).
