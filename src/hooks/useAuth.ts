import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function getSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Record login activity if user is authenticated
        if (session?.user?.id) {
          try {
            await profilesService.recordLogin(session.user.id);
          } catch (err) {
            console.error("Failed to record login:", err);
          }
        }
      }
    }

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Record login on auth state change
        if (_event === "SIGNED_IN" && session?.user?.id) {
          try {
            profilesService.recordLogin(session.user.id).catch((err) => {
              console.error("Failed to record login:", err);
            });
          } catch (err) {
            console.error("Failed to record login:", err);
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { session, user, loading };
}

export async function signInWithPassword(email: string, password: string) {
  try {
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Record successful login
    if (result.data?.user?.id) {
      try {
        await profilesService.recordLogin(result.data.user.id);
      } catch (err) {
        console.error("Failed to record login:", err);
      }
    }

    return result;
  } catch (err) {
    // Record failed login attempt
    const userEmail = email.toLowerCase();
    const existingProfile = await profilesService.getProfileByEmail(userEmail);
    if (existingProfile?.id) {
      try {
        await profilesService.recordFailedLogin(existingProfile.id);
      } catch (recordErr) {
        console.error("Failed to record failed login:", recordErr);
      }
    }
    throw err;
  }
}

export async function signOut() {
  return await supabase.auth.signOut();
}
