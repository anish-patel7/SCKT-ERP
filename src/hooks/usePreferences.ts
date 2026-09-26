import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { preferencesService } from "@/services/preferences";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];

export function usePreferences() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: preferences,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["preferences", user?.id],
    queryFn: () => preferencesService.getCurrentUserPreferences(),
    enabled: !authLoading && !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<UserPreferences>) =>
      preferencesService.updateCurrentUserPreferences(updates),
    onSuccess: (updatedPreferences) => {
      queryClient.setQueryData(["preferences", user?.id], updatedPreferences);
    },
  });

  const setLanguageMutation = useMutation({
    mutationFn: (language: string) => preferencesService.setLanguage(language),
    onSuccess: (updatedPreferences) => {
      queryClient.setQueryData(["preferences", user?.id], updatedPreferences);
    },
  });

  const setThemeMutation = useMutation({
    mutationFn: (theme: "light" | "dark" | "auto") => preferencesService.setTheme(theme),
    onSuccess: (updatedPreferences) => {
      queryClient.setQueryData(["preferences", user?.id], updatedPreferences);
    },
  });

  const setCardZoomMutation = useMutation({
    mutationFn: (zoom: number) => preferencesService.setCardZoom(zoom),
    onSuccess: (updatedPreferences) => {
      queryClient.setQueryData(["preferences", user?.id], updatedPreferences);
    },
  });

  return {
    preferences,
    user,
    isLoading: authLoading || isLoading,
    error,
    updatePreferences: updateMutation.mutate,
    setLanguage: setLanguageMutation.mutate,
    setTheme: setThemeMutation.mutate,
    setCardZoom: setCardZoomMutation.mutate,
    isPending:
      updateMutation.isPending ||
      setLanguageMutation.isPending ||
      setThemeMutation.isPending ||
      setCardZoomMutation.isPending,
  };
}

export function useLanguagePreference() {
  const { preferences, setLanguage } = usePreferences();

  return {
    language: preferences?.preferred_language || "en",
    setLanguage,
  };
}

export function useThemePreference() {
  const { preferences, setTheme } = usePreferences();

  return {
    theme: preferences?.theme || "light",
    setTheme,
  };
}

export function useCardZoomPreference() {
  const { preferences, setCardZoom } = usePreferences();

  return {
    zoom: preferences?.card_zoom_level || 1.0,
    setZoom: setCardZoom,
  };
}

export function useSidebarPreference() {
  const { preferences, updatePreferences } = usePreferences();

  return {
    isCollapsed: preferences?.sidebar_collapsed || false,
    setCollapsed: (collapsed: boolean) =>
      updatePreferences({ sidebar_collapsed: collapsed } as any),
  };
}

export function useDashboardPreference() {
  const { preferences, updatePreferences } = usePreferences();

  return {
    layout: preferences?.dashboard_layout || "grid",
    columns: preferences?.dashboard_columns || 3,
    setLayout: (layout: "grid" | "list" | "compact") =>
      updatePreferences({ dashboard_layout: layout } as any),
    setColumns: (columns: number) => updatePreferences({ dashboard_columns: columns } as any),
  };
}

export function usePaginationPreference() {
  const { preferences, updatePreferences } = usePreferences();

  return {
    itemsPerPage: preferences?.items_per_page || 25,
    setItemsPerPage: (count: number) =>
      updatePreferences({ items_per_page: count } as any),
  };
}

export function useAutoRefreshPreference() {
  const { preferences, updatePreferences } = usePreferences();

  return {
    enabled: preferences?.auto_refresh_enabled || false,
    interval: preferences?.auto_refresh_interval || 300,
    setEnabled: (enabled: boolean) =>
      updatePreferences({ auto_refresh_enabled: enabled } as any),
    setInterval: (seconds: number) =>
      updatePreferences({ auto_refresh_interval: seconds } as any),
  };
}

export function useNotificationPreferences() {
  const { preferences, updatePreferences } = usePreferences();

  return {
    enabled: preferences?.notification_enabled || true,
    sound: preferences?.notification_sound || false,
    setEnabled: (enabled: boolean) =>
      updatePreferences({ notification_enabled: enabled } as any),
    setSound: (sound: boolean) => updatePreferences({ notification_sound: sound } as any),
  };
}
