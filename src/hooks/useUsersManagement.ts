import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersService, type ProfileStatus, type UserProfileUpdate } from "@/services/users";
import { toast } from "sonner";
import { invalidateAccess } from "@/hooks/usePermissions";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useUsers(filters?: { status?: string }) {
  return useQuery({
    queryKey: ["users", filters ?? {}],
    queryFn: () => usersService.listUsers(filters),
    staleTime: 60 * 1000,
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: () => usersService.getCurrentUser(),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: () => usersService.getUserById(userId),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}

function useInvalidateUser() {
  const queryClient = useQueryClient();
  return (userId: string) => {
    void queryClient.invalidateQueries({ queryKey: ["user", userId] });
    void queryClient.invalidateQueries({ queryKey: ["users"] });
    void queryClient.invalidateQueries({ queryKey: ["current-user"] });
    invalidateAccess(queryClient);
  };
}

export function useUpdateUser() {
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: UserProfileUpdate }) =>
      usersService.updateUser(userId, updates),
    onSuccess: (_, { userId }) => {
      invalidate(userId);
      toast.success("User updated successfully");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update user")),
  });
}

export function useUpdateUserStatus() {
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: ProfileStatus }) =>
      usersService.updateUserStatus(userId, status),
    onSuccess: (_, { userId }) => {
      invalidate(userId);
      toast.success("User status updated");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to update user status")),
  });
}

export function useApproveUser() {
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: (userId: string) => usersService.approveUser(userId),
    onSuccess: (_, userId) => {
      invalidate(userId);
      toast.success("User approved");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to approve user")),
  });
}

export function useRejectUser() {
  const invalidate = useInvalidateUser();
  return useMutation({
    mutationFn: (userId: string) => usersService.rejectUser(userId),
    onSuccess: (_, userId) => {
      invalidate(userId);
      toast.success("User rejected");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to reject user")),
  });
}

export function useCurrentUserIsAdmin() {
  return useQuery({
    queryKey: ["current-user-is-admin"],
    queryFn: () => usersService.isCurrentUserAdmin(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCurrentUserHasPermission(permissionCode: string) {
  return useQuery({
    queryKey: ["current-user-permission", permissionCode],
    queryFn: () => usersService.currentUserHasPermission(permissionCode),
    staleTime: 5 * 60 * 1000,
    enabled: !!permissionCode,
  });
}
