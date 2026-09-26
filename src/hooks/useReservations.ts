/**
 * STEP 14 Phase 5: Stock Reservation Hooks
 * TanStack Query hooks for reservation management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reservationsService } from "@/services/reservations";
import type {
  StockReservation,
  ReservationWithItem,
  ReservationApprovalRequest,
} from "@/services/reservations";

/**
 * Get pending reservations for manager approval
 */
export function usePendingReservations() {
  return useQuery({
    queryKey: ["pending_reservations"],
    queryFn: () => reservationsService.getPendingReservations(),
    staleTime: 1 * 60 * 1000, // 1 min
  });
}

/**
 * Get active reservations for a specific item
 */
export function useReservationsByItem(itemId?: string) {
  return useQuery({
    queryKey: ["reservations_by_item", itemId],
    queryFn: () => (itemId ? reservationsService.getReservationsByItem(itemId) : null),
    enabled: !!itemId,
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

/**
 * Get current user's reservations
 */
export function useUserReservations(userEmail?: string) {
  return useQuery({
    queryKey: ["user_reservations", userEmail],
    queryFn: () => (userEmail ? reservationsService.getUserReservations(userEmail) : null),
    enabled: !!userEmail,
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

/**
 * Get reservation summary for an item
 */
export function useReservationSummary(itemId?: string) {
  return useQuery({
    queryKey: ["reservation_summary", itemId],
    queryFn: () =>
      itemId
        ? reservationsService.getReservationSummary(itemId)
        : null,
    enabled: !!itemId,
    staleTime: 3 * 60 * 1000, // 3 min
  });
}

/**
 * Create a new reservation
 */
export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => reservationsService.createReservation(data),
    onSuccess: (reservation) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["reservations_by_item"] });
      queryClient.invalidateQueries({
        queryKey: ["reservation_summary", reservation.item_id],
      });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
    },
  });
}

/**
 * Approve a reservation (manager action)
 */
export function useApproveReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) =>
      reservationsService.approveReservation(reservationId),
    onSuccess: (reservation) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["pending_reservations"] });
      queryClient.invalidateQueries({
        queryKey: ["reservations_by_item", reservation.item_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["reservation_summary", reservation.item_id],
      });
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
    },
  });
}

/**
 * Reject a reservation (manager action)
 */
export function useRejectReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reservationId,
      rejectionReason,
    }: {
      reservationId: string;
      rejectionReason: string;
    }) => reservationsService.rejectReservation(reservationId, rejectionReason),
    onSuccess: (reservation) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["pending_reservations"] });
      queryClient.invalidateQueries({
        queryKey: ["reservations_by_item", reservation.item_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["reservation_summary", reservation.item_id],
      });
    },
  });
}

/**
 * Cancel a reservation (user action)
 */
export function useCancelReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) =>
      reservationsService.cancelReservation(reservationId),
    onSuccess: (reservation) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["user_reservations"] });
      queryClient.invalidateQueries({
        queryKey: ["reservations_by_item", reservation.item_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["reservation_summary", reservation.item_id],
      });
    },
  });
}
