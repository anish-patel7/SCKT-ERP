import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { colorsService } from "@/services/colors";
import type { Database } from "@/integrations/supabase/types";

type Color = Database["public"]["Tables"]["colors"]["Row"];

export function useColors(includeInactive = false) {
  return useQuery({
    queryKey: ["colors", { includeInactive }],
    queryFn: () => colorsService.listColors(includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}

export function useColorById(id: string) {
  return useQuery({
    queryKey: ["colors", id],
    queryFn: () => colorsService.getColorById(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useColorByCode(code: string) {
  return useQuery({
    queryKey: ["colors", "code", code],
    queryFn: () => colorsService.getColorByCode(code),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateColor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => colorsService.createColor(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colors"] });
    },
  });
}

export function useUpdateColor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => colorsService.updateColor(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colors", id] });
      queryClient.invalidateQueries({ queryKey: ["colors"] });
    },
  });
}

export function useSetColorStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: "Active" | "Inactive") => colorsService.setColorStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colors", id] });
      queryClient.invalidateQueries({ queryKey: ["colors"] });
    },
  });
}

export function useSearchColors(query: string, limit = 10) {
  return useQuery({
    queryKey: ["colors", "search", query, limit],
    queryFn: () => colorsService.searchColors(query, limit),
    staleTime: 2 * 60 * 1000,
  });
}

export function useColorsByCategory(category: string, includeInactive = false) {
  return useQuery({
    queryKey: ["colors", "category", category, { includeInactive }],
    queryFn: () => colorsService.getColorsByCategory(category, includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}
