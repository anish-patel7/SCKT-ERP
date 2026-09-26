-- ============================================================================
-- STEP 20 PHASE 11: Migrate localStorage UI State to Supabase
-- ============================================================================
-- Date: September 20, 2026
-- Purpose:
--   1. Create user_preferences table for UI state (language, theme, settings)
--   2. Enable syncing preferences across devices
--   3. Keep localStorage as fallback for better UX
--   4. Eventually replace all localStorage except temporary drafts
-- ============================================================================

-- ============================================================================
-- 1. CREATE user_preferences TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- UI Preferences
  preferred_language VARCHAR(10) DEFAULT 'en' CHECK (preferred_language IN ('en', 'es', 'fr', 'de', 'hi', 'gu', 'ta', 'te', 'mr', 'ml')),
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  card_zoom_level DECIMAL(3,2) DEFAULT 1.0 CHECK (card_zoom_level >= 0.6 AND card_zoom_level <= 2.2),
  
  -- UI Layout & State
  sidebar_collapsed BOOLEAN DEFAULT FALSE,
  sidebar_position VARCHAR(20) DEFAULT 'left' CHECK (sidebar_position IN ('left', 'right')),
  notification_enabled BOOLEAN DEFAULT TRUE,
  notification_sound BOOLEAN DEFAULT FALSE,
  
  -- Dashboard Customization
  dashboard_layout VARCHAR(50) DEFAULT 'grid' CHECK (dashboard_layout IN ('grid', 'list', 'compact')),
  dashboard_columns INTEGER DEFAULT 3 CHECK (dashboard_columns >= 1 AND dashboard_columns <= 6),
  favorite_modules TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g. ['inventory', 'costing', 'production']
  
  -- Data Display Preferences
  items_per_page INTEGER DEFAULT 25 CHECK (items_per_page >= 10 AND items_per_page <= 100),
  default_sort_column VARCHAR(100),
  default_sort_direction VARCHAR(10) DEFAULT 'asc' CHECK (default_sort_direction IN ('asc', 'desc')),
  
  -- Advanced Settings
  keyboard_shortcuts_enabled BOOLEAN DEFAULT TRUE,
  auto_refresh_enabled BOOLEAN DEFAULT FALSE,
  auto_refresh_interval INTEGER DEFAULT 300, -- seconds
  export_format VARCHAR(20) DEFAULT 'csv' CHECK (export_format IN ('csv', 'excel', 'pdf')),
  
  -- JSON for arbitrary preferences (future extensibility)
  custom_settings JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_modules CHECK (custom_settings IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_created_at ON public.user_preferences(created_at);

-- ============================================================================
-- 2. CREATE AUTO-PROFILE-PREFERENCES TRIGGER
-- ============================================================================

-- Function to create default preferences when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id, preferred_language)
  VALUES (NEW.id, 'en')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on profiles insert to create default preferences
DROP TRIGGER IF EXISTS on_profile_created_preferences ON public.profiles;

CREATE TRIGGER on_profile_created_preferences
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_preferences();

-- ============================================================================
-- 3. ENABLE RLS ON user_preferences TABLE
-- ============================================================================

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Admin can read all preferences" ON public.user_preferences;

-- USERS: Can read own preferences
CREATE POLICY "users_read_own_preferences"
ON public.user_preferences FOR SELECT
USING (auth.uid() = user_id);

-- USERS: Can update own preferences
CREATE POLICY "users_update_own_preferences"
ON public.user_preferences FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ADMIN: Can read all preferences
CREATE POLICY "admin_read_all_preferences"
ON public.user_preferences FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.primary_role_id = 'admin'
  )
);

-- DENY INSERT/DELETE (managed by trigger only)
CREATE POLICY "deny_insert_preferences"
ON public.user_preferences FOR INSERT
WITH CHECK (FALSE);

CREATE POLICY "deny_delete_preferences"
ON public.user_preferences FOR DELETE
USING (FALSE);

-- ============================================================================
-- 4. UPDATE TRIGGER TO MAINTAIN updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;

CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_user_preferences_timestamp();

-- ============================================================================
-- 5. SUPPORTED LANGUAGES REFERENCE TABLE (optional, for future UI)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.supported_languages (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  native_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.supported_languages (code, name, native_name, is_active) VALUES
  ('en', 'English', 'English', TRUE),
  ('es', 'Spanish', 'Español', TRUE),
  ('fr', 'French', 'Français', TRUE),
  ('de', 'German', 'Deutsch', TRUE),
  ('hi', 'Hindi', 'हिन्दी', TRUE),
  ('gu', 'Gujarati', 'ગુજરાતી', TRUE),
  ('ta', 'Tamil', 'தமிழ்', TRUE),
  ('te', 'Telugu', 'తెలుగు', TRUE),
  ('mr', 'Marathi', 'मराठी', TRUE),
  ('ml', 'Malayalam', 'മലയാളം', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- After running this migration, verify:
-- SELECT user_id, preferred_language, theme, card_zoom_level 
-- FROM public.user_preferences 
-- LIMIT 5;
--
-- All users should have default preferences with preferred_language='en'
-- New profiles should auto-create preferences with trigger

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- Status: User preferences table created and integrated
-- Next: Create preferences service, update hooks, migrate from localStorage
