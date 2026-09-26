import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { permissionsService } from "@/services/permissions";
import { auditService } from "@/services/audit";
import { accessService, assertNotLastAdmin } from "@/services/access";

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// Values allowed by the profiles_status CHECK constraint.
export const PROFILE_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

const Timestamp = z.string().datetime({ offset: true });

// Mirrors public.profiles. primary_role_id holds a role code (VARCHAR) in the current schema.
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  full_name: z.string().nullable(),
  employee_id: z.string().nullable().default(null),
  department: z.string().nullable().default(null),
  designation: z.string().nullable().default(null),
  mobile: z.string().nullable().default(null),
  status: z.string().nullable().default(null),
  approval_status: z.string().nullable().default(null),
  primary_role_id: z.string().nullable().default(null),
  approved_by: z.string().nullable().default(null),
  approved_at: Timestamp.nullable().default(null),
  last_login: Timestamp.nullable().default(null),
  created_at: Timestamp,
  updated_at: Timestamp,
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export type UserProfileUpdate = Partial<
  Pick<UserProfile, "full_name" | "employee_id" | "department" | "designation" | "mobile">
>;

async function requireSessionUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new UnauthorizedError("Not authenticated");
  }
  return user;
}

export const usersService = {
  async listUsers(filters?: { status?: string }): Promise<UserProfile[]> {
    let query = supabase.from("profiles").select("*");
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query.order("full_name", { ascending: true });
    if (error) {
      throw new UserError(`Failed to fetch users: ${error.message}`);
    }

    return z.array(UserProfileSchema).parse(data ?? []);
  },

  async getUserById(userId: string): Promise<UserProfile> {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) {
      throw new UserError(`Failed to fetch user: ${error.message}`);
    }
    return UserProfileSchema.parse(data);
  },

  async getCurrentUser(): Promise<UserProfile> {
    const user = await requireSessionUser();
    return this.getUserById(user.id);
  },

  async updateUser(userId: string, updates: UserProfileUpdate): Promise<UserProfile> {
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw new UserError(`Failed to update user: ${error.message}`);
    }
    return UserProfileSchema.parse(data);
  },

  async updateUserStatus(userId: string, status: ProfileStatus): Promise<UserProfile> {
    if (!PROFILE_STATUSES.includes(status)) {
      throw new UserError(`Invalid status: ${status}`);
    }
    if (status !== "ACTIVE") {
      await assertNotLastAdmin(userId, "deactivate this user");
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw new UserError(`Failed to update user status: ${error.message}`);
    }
    await auditService.record("user", userId, `USER_STATUS_${status}`, `Status set to ${status}`);
    return UserProfileSchema.parse(data);
  },

  async approveUser(userId: string): Promise<UserProfile> {
    const approver = await requireSessionUser();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        status: "ACTIVE",
        approval_status: "APPROVED",
        approved_by: approver.email ?? approver.id,
        approved_at: now,
        updated_at: now,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw new UserError(`Failed to approve user: ${error.message}`);
    }
    await auditService.record("user", userId, "USER_APPROVED", "Access request approved");
    return UserProfileSchema.parse(data);
  },

  async rejectUser(userId: string): Promise<UserProfile> {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        status: "INACTIVE",
        approval_status: "REJECTED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw new UserError(`Failed to reject user: ${error.message}`);
    }
    await auditService.record("user", userId, "USER_REJECTED", "Access request rejected");
    return UserProfileSchema.parse(data);
  },

  async isCurrentUserAdmin(): Promise<boolean> {
    const user = await requireSessionUser();
    return (await accessService.getEffectiveAccess(user.id)).isAdmin;
  },

  async currentUserHasPermission(permissionCode: string): Promise<boolean> {
    const user = await requireSessionUser();
    return permissionsService.userHasPermission(user.id, permissionCode);
  },
};
