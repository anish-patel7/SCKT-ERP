import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { productionService, type ProductionOrder, type ProductionOrderUpdate } from "@/services/production";
import { getProduction, saveProduction, type ProductionData } from "@/lib/production-store";

// Backward compatibility: Old hook for existing localStorage-based routes
const EMPTY: ProductionData = { orders: [], looms: [], jobCards: [], daily: [] };

export function useProduction() {
  const [data, setData] = useState<ProductionData>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(getProduction());
    setReady(true);
  }, []);

  const update = useCallback((fn: (prev: ProductionData) => ProductionData) => {
    setData((prev) => {
      const next = fn(prev);
      saveProduction(next);
      return next;
    });
  }, []);

  return { data, ready, update };
}

// List orders
export function useProductionOrders(filters?: {
  status?: string;
  priority?: string;
  party_id?: string;
  date_range?: { from: string; to: string };
}) {
  return useQuery({
    queryKey: ["production_orders", filters],
    queryFn: () => productionService.listProductionOrders(filters),
    staleTime: 5 * 60 * 1000,
  });
}

// Single order
export function useProductionOrder(id: string) {
  return useQuery({
    queryKey: ["production_order", id],
    queryFn: () => productionService.getProductionOrder(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

// Create order
export function useCreateProductionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => productionService.createProductionOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
    },
  });
}

// Update order
export function useUpdateProductionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: unknown }) =>
      productionService.updateProductionOrder(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["production_order", id] });
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
    },
  });
}

// Start production
export function useStartProduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productionService.startProduction(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["production_order", id] });
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
    },
  });
}

// Complete production
export function useCompleteProduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      productionService.completeProduction(id, qty),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["production_order", id] });
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
    },
  });
}

// Hold production
export function useHoldProduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      productionService.holdProduction(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["production_order", id] });
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
    },
  });
}

// Issue job cards (atomic)
export function useIssueJobCards() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ order_id, count }: { order_id: string; count: number }) =>
      productionService.issueJobCards(order_id, count),
    onSuccess: (_, { order_id }) => {
      queryClient.invalidateQueries({ queryKey: ["production_order", order_id] });
      queryClient.invalidateQueries({ queryKey: ["job_cards", order_id] });
    },
  });
}

// Job cards by order
export function useJobCardsByOrder(order_id: string) {
  return useQuery({
    queryKey: ["job_cards", order_id],
    queryFn: () => productionService.getJobCardsByOrder(order_id),
    staleTime: 5 * 60 * 1000,
    enabled: !!order_id,
  });
}

// Job card details
export function useJobCardDetails(job_card_id: string) {
  return useQuery({
    queryKey: ["job_card", job_card_id],
    queryFn: () => productionService.getJobCardDetails(job_card_id),
    staleTime: 5 * 60 * 1000,
    enabled: !!job_card_id,
  });
}

// Update job card
export function useUpdateJobCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: unknown }) =>
      productionService.updateJobCard(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job_card", data.id] });
      if (data.production_order_id) {
        queryClient.invalidateQueries({ queryKey: ["job_cards", data.production_order_id] });
      }
    },
  });
}

// Complete job card
export function useCompleteJobCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productionService.completeJobCard(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job_card", data.id] });
      if (data.production_order_id) {
        queryClient.invalidateQueries({ queryKey: ["job_cards", data.production_order_id] });
      }
    },
  });
}

// Order progress
export function useOrderProgress(order_id: string) {
  return useQuery({
    queryKey: ["order_progress", order_id],
    queryFn: () => productionService.getOrderProgress(order_id),
    staleTime: 2 * 60 * 1000,
    enabled: !!order_id,
  });
}

// Create individual job card
export function useCreateJobCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => productionService.createJobCard(data as any),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["all_job_cards"] });
      if (data.production_order_id) {
        queryClient.invalidateQueries({ queryKey: ["job_cards", data.production_order_id] });
      }
    },
  });
}

// Fetch all job cards
export function useAllJobCards() {
  return useQuery({
    queryKey: ["all_job_cards"],
    queryFn: () => productionService.getAllJobCards(),
    staleTime: 5 * 60 * 1000,
  });
}

// Delete job card (soft-delete)
export function useDeleteJobCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productionService.deleteJobCard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_job_cards"] });
    },
  });
}
