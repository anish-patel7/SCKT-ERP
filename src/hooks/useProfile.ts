import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profilesService } from "@/services/profiles";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: profile,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profilesService.getCurrentUserProfile(),
    enabled: !authLoading && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Profile>) => profilesService.updateCurrentUserProfile(updates),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(["profile", user?.id], updatedProfile);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ primaryRole, additionalRoles }: { primaryRole: string; additionalRoles?: string[] }) =>
      profilesService.updateProfileRole(user?.id || "", primaryRole, additionalRoles),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(["profile", user?.id], updatedProfile);
    },
  });

  return {
    profile,
    user,
    isLoading: authLoading || isLoading,
    error,
    updateProfile: updateMutation.mutate,
    updateRole: updateRoleMutation.mutate,
    isPending: updateMutation.isPending || updateRoleMutation.isPending,
  };
}

export function useProfileById(userId: string) {
  const {
    data: profile,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => profilesService.getProfileById(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return { profile, error, isLoading };
}

export function useProfiles(limit = 100) {
  const {
    data: profiles,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => profilesService.listProfiles(limit),
    staleTime: 10 * 60 * 1000,
  });

  return { profiles: profiles || [], error, isLoading };
}

export function useProfilesByRole(roleId: string) {
  const {
    data: profiles,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["profiles_by_role", roleId],
    queryFn: () => profilesService.getProfilesByRole(roleId),
    enabled: !!roleId,
    staleTime: 10 * 60 * 1000,
  });

  return { profiles: profiles || [], error, isLoading };
}

export function useSearchProfiles(query: string) {
  const {
    data: results,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["search_profiles", query],
    queryFn: () => profilesService.searchProfiles(query),
    enabled: query.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  return { results: results || [], error, isLoading };
}
