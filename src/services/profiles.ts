import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileError";
  }
}

export const profilesService = {
  async getCurrentUserProfile(): Promise<Profile> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ProfileError("Not authenticated");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found, return default profile for new user
        return {
          id: user.id,
          email: user.email || "",
          first_name: "",
          last_name: "",
          display_name: user.email || "User",
          mobile: null,
          employee_id: null,
          department: null,
          designation: null,
          primary_role_id: "viewer",
          additional_role_ids: [],
          status: "ACTIVE",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_login: null,
          failed_login_attempts: 0,
          is_locked: false,
        } as Profile;
      }
      throw new ProfileError(`Failed to fetch profile: ${error.message}`);
    }

    return data as Profile;
  },

  async getProfileById(userId: string): Promise<Profile> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      throw new ProfileError(`Failed to fetch profile: ${error.message}`);
    }

    return data as Profile;
  },

  async getProfileByEmail(email: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new ProfileError(`Failed to fetch profile: ${error.message}`);
    }

    return data as Profile;
  },

  async listProfiles(limit = 100, offset = 0): Promise<Profile[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new ProfileError(`Failed to fetch profiles: ${error.message}`);
    }

    return (data || []) as Profile[];
  },

  async updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile> {
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw new ProfileError(`Failed to update profile: ${error.message}`);
    }

    return data as Profile;
  },

  async updateCurrentUserProfile(updates: Partial<Profile>): Promise<Profile> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ProfileError("Not authenticated");
    }

    // Only allow updating safe fields
    const safeUpdates: ProfileUpdate = {};
    const allowedFields = [
      "first_name",
      "last_name",
      "display_name",
      "mobile",
      "department",
      "designation",
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        (safeUpdates as any)[key] = value;
      }
    }

    safeUpdates.updated_at = new Date().toISOString();

    return this.updateProfile(user.id, safeUpdates);
  },

  async updateProfileRole(
    userId: string,
    primaryRole: string,
    additionalRoles?: string[],
  ): Promise<Profile> {
    const updates: ProfileUpdate = {
      primary_role_id: primaryRole,
      updated_at: new Date().toISOString(),
    };

    if (additionalRoles) {
      updates.additional_role_ids = additionalRoles;
    }

    return this.updateProfile(userId, updates);
  },

  async updateProfileStatus(userId: string, status: string): Promise<Profile> {
    return this.updateProfile(userId, {
      status: status as any,
      updated_at: new Date().toISOString(),
    });
  },

  async recordLogin(userId: string): Promise<Profile> {
    // Reset failed attempts on successful login
    return this.updateProfile(userId, {
      last_login: new Date().toISOString(),
      failed_login_attempts: 0,
      is_locked: false,
      updated_at: new Date().toISOString(),
    });
  },

  async recordFailedLogin(userId: string): Promise<Profile> {
    const { data: profile } = await supabase
      .from("profiles")
      .select("failed_login_attempts")
      .eq("id", userId)
      .single();

    const attempts = (profile?.failed_login_attempts || 0) + 1;
    const isLocked = attempts >= 5;

    return this.updateProfile(userId, {
      failed_login_attempts: attempts,
      is_locked: isLocked,
      updated_at: new Date().toISOString(),
    });
  },

  async lockProfile(userId: string): Promise<Profile> {
    return this.updateProfile(userId, {
      is_locked: true,
      status: "LOCKED" as any,
      updated_at: new Date().toISOString(),
    });
  },

  async unlockProfile(userId: string): Promise<Profile> {
    return this.updateProfile(userId, {
      is_locked: false,
      failed_login_attempts: 0,
      status: "ACTIVE" as any,
      updated_at: new Date().toISOString(),
    });
  },

  async searchProfiles(query: string, limit = 20): Promise<Profile[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(
        `email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,employee_id.ilike.%${query}%`,
      )
      .limit(limit);

    if (error) {
      throw new ProfileError(`Search failed: ${error.message}`);
    }

    return (data || []) as Profile[];
  },

  async getProfilesByRole(roleId: string, limit = 100): Promise<Profile[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("primary_role_id", roleId)
      .limit(limit);

    if (error) {
      throw new ProfileError(`Failed to fetch profiles by role: ${error.message}`);
    }

    return (data || []) as Profile[];
  },
};
