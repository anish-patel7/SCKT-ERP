import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { partiesService, PartyError, ValidationError, NotFoundError } from "@/services/parties";
import type { Database } from "@/integrations/supabase/types";

type Party = Database["public"]["Tables"]["parties"]["Row"];
type SubParty = Database["public"]["Tables"]["party_sub_parties"]["Row"];

export function useParties(includeInactive = false) {
  return useQuery({
    queryKey: ["parties", { includeInactive }],
    queryFn: () => partiesService.listParties(includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePartyById(id: string) {
  return useQuery({
    queryKey: ["parties", id],
    queryFn: () => partiesService.getPartyById(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePartyByCode(code: string) {
  return useQuery({
    queryKey: ["parties", "code", code],
    queryFn: () => partiesService.getPartyByCode(code),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => partiesService.createParty(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
    },
  });
}

export function useUpdateParty(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => partiesService.updateParty(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties", id] });
      queryClient.invalidateQueries({ queryKey: ["parties"] });
    },
  });
}

export function useSetPartyStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: "Active" | "Inactive") => partiesService.setPartyStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties", id] });
      queryClient.invalidateQueries({ queryKey: ["parties"] });
    },
  });
}

export function useSearchParties(query: string, limit = 10) {
  return useQuery({
    queryKey: ["parties", "search", query, limit],
    queryFn: () => partiesService.searchParties(query, limit),
    staleTime: 2 * 60 * 1000,
  });
}

// Sub-parties hooks

export function useSubPartiesByPartyId(partyId: string, activeOnly = false) {
  return useQuery({
    queryKey: ["subParties", partyId, { activeOnly }],
    queryFn: () => partiesService.listSubPartiesByPartyId(partyId, activeOnly),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubPartyById(id: string) {
  return useQuery({
    queryKey: ["subParties", id],
    queryFn: () => partiesService.getSubPartyById(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSubParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => partiesService.createSubParty(input),
    onSuccess: (newSubParty) => {
      queryClient.invalidateQueries({ queryKey: ["subParties", newSubParty.party_id] });
    },
  });
}

export function useUpdateSubParty(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: unknown) => partiesService.updateSubParty(id, updates),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["subParties", id] });
      queryClient.invalidateQueries({ queryKey: ["subParties", updated.party_id] });
    },
  });
}

export function useSetSubPartyStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: "Active" | "Inactive") =>
      partiesService.setSubPartyStatus(id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["subParties", id] });
      queryClient.invalidateQueries({ queryKey: ["subParties", updated.party_id] });
    },
  });
}

export function useSetSubPartyAsDefault(partyId: string, subPartyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => partiesService.setSubPartyAsDefault(partyId, subPartyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subParties", partyId] });
    },
  });
}
