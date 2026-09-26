import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profilesService } from "@/services/profiles";
import type { Profile, ProfileUpdate } from "@/lib/validators/auth";

/**
 * Query for current user's profile
 */
export function useCurrentProfile() {
  return useQuery({
    queryKey: ["profile", "current"],
    queryFn: () => profilesService.getCurrentProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Query for profile by ID
 */
export function useProfile(id: string) {
  return useQuery({
    queryKey: ["profile", id],
    queryFn: () => profilesService.getById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

/**
 * Query for profile by email
 */
export function useProfileByEmail(email: string) {
  return useQuery({
    queryKey: ["profile", "email", email],
    queryFn: () => profilesService.getByEmail(email),
    staleTime: 5 * 60 * 1000,
    enabled: !!email,
  });
}

/**
 * Query for all profiles
 */
export function useProfiles(filters?: {
  status?: string;
  approval_status?: string;
  role?: string;
}) {
  return useQuery({
    queryKey: ["profiles", filters],
    queryFn: () => profilesService.list(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Mutation for updating profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ProfileUpdate }) =>
      profilesService.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile", data.id] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "current"] });
    },
  });
}

/**
 * Mutation for locking account
 */
export function useLockAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      profilesService.lockAccount(id, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile", data.id] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

/**
 * Mutation for unlocking account
 */
export function useUnlockAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => profilesService.unlockAccount(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile", data.id] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

/**
 * Mutation for requiring password change
 */
export function useRequirePasswordChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => profilesService.requirePasswordChange(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile", data.id] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}
