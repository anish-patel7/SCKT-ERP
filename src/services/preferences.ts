import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];
type PreferencesUpdate = Database["public"]["Tables"]["user_preferences"]["Update"];

class PreferencesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreferencesError";
  }
}

// Default preferences fallback
const DEFAULT_PREFERENCES: Partial<UserPreferences> = {
  preferred_language: "en",
  theme: "light",
  card_zoom_level: 1.0,
  sidebar_collapsed: false,
  notification_enabled: true,
  notification_sound: false,
  dashboard_layout: "grid",
  dashboard_columns: 3,
  items_per_page: 25,
  default_sort_direction: "asc",
  keyboard_shortcuts_enabled: true,
  auto_refresh_enabled: false,
  auto_refresh_interval: 300,
  export_format: "csv",
};

export const preferencesService = {
  async getCurrentUserPreferences(): Promise<UserPreferences> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new PreferencesError("Not authenticated");
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found, create default preferences
        return {
          id: "",
          user_id: user.id,
          ...DEFAULT_PREFERENCES,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as UserPreferences;
      }
      throw new PreferencesError(`Failed to fetch preferences: ${error.message}`);
    }

    return data as UserPreferences;
  },

  async getPreferencesByUserId(userId: string): Promise<UserPreferences> {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      throw new PreferencesError(`Failed to fetch preferences: ${error.message}`);
    }

    return data as UserPreferences;
  },

  async updatePreferences(userId: string, updates: PreferencesUpdate): Promise<UserPreferences> {
    const { data, error } = await supabase
      .from("user_preferences")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw new PreferencesError(`Failed to update preferences: ${error.message}`);
    }

    return data as UserPreferences;
  },

  async updateCurrentUserPreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new PreferencesError("Not authenticated");
    }

    return this.updatePreferences(user.id, updates as PreferencesUpdate);
  },

  async setLanguage(language: string): Promise<UserPreferences> {
    return this.updateCurrentUserPreferences({ preferred_language: language as any });
  },

  async setTheme(theme: "light" | "dark" | "auto"): Promise<UserPreferences> {
    return this.updateCurrentUserPreferences({ theme });
  },

  async setCardZoom(zoomLevel: number): Promise<UserPreferences> {
    const clamped = Math.max(0.6, Math.min(2.2, zoomLevel));
    return this.updateCurrentUserPreferences({ card_zoom_level: clamped as any });
  },

  async setSidebarCollapsed(collapsed: boolean): Promise<UserPreferences> {
    return this.updateCurrentUserPreferences({ sidebar_collapsed: collapsed });
  },

  async setDashboardLayout(layout: "grid" | "list" | "compact"): Promise<UserPreferences> {
    return this.updateCurrentUserPreferences({ dashboard_layout: layout as any });
  },

  async setItemsPerPage(count: number): Promise<UserPreferences> {
    const clamped = Math.max(10, Math.min(100, count));
    return this.updateCurrentUserPreferences({ items_per_page: clamped });
  },

  async setAutoRefresh(enabled: boolean, intervalSeconds?: number): Promise<UserPreferences> {
    const updates: PreferencesUpdate = {
      auto_refresh_enabled: enabled,
    };
    if (intervalSeconds) {
      updates.auto_refresh_interval = intervalSeconds;
    }
    return this.updateCurrentUserPreferences(updates);
  },

  async setNotifications(enabled: boolean, sound?: boolean): Promise<UserPreferences> {
    const updates: PreferencesUpdate = { notification_enabled: enabled };
    if (sound !== undefined) {
      updates.notification_sound = sound;
    }
    return this.updateCurrentUserPreferences(updates);
  },

  async setFavoriteModules(modules: string[]): Promise<UserPreferences> {
    return this.updateCurrentUserPreferences({ favorite_modules: modules });
  },

  async setCustomSettings(settings: Record<string, any>): Promise<UserPreferences> {
    return this.updateCurrentUserPreferences({ custom_settings: settings });
  },

  // Utility: Get a single preference value
  async getPreference<K extends keyof UserPreferences>(
    key: K,
  ): Promise<UserPreferences[K] | null> {
    try {
      const prefs = await this.getCurrentUserPreferences();
      return prefs[key] || null;
    } catch {
      return null;
    }
  },

  // Utility: Bulk set multiple preferences
  async setPreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    return this.updateCurrentUserPreferences(updates);
  },
};
