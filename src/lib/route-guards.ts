import { isRedirect, redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { accessRequirementFor } from "@/lib/access-control";
import { currentAccessQuery } from "@/hooks/usePermissions";
import { hasPermission } from "@/services/access";

/** Redirects to /auth when there is no authenticated Supabase user. */
export async function requireAuth(): Promise<{ userId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw redirect({ to: "/auth" });
  }

  return { userId: user.id };
}

/**
 * Requires at least one of the given permission codes.
 * Unauthenticated → /auth; inactive profile → signed out to /auth; lacking permission → /.
 */
export async function requirePermission(
  queryClient: QueryClient,
  anyOf: readonly string[],
): Promise<void> {
  await requireAuth();

  try {
    const access = await queryClient.ensureQueryData(currentAccessQuery);
    if (!access) throw redirect({ to: "/auth" });
    if (access.blocked) {
      await supabase.auth.signOut();
      queryClient.removeQueries({ queryKey: ["effective-access"] });
      throw redirect({ to: "/auth" });
    }
    if (!anyOf.some((code) => hasPermission(access, code))) {
      throw redirect({ to: "/" });
    }
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("Permission check failed:", error);
    throw redirect({ to: "/" });
  }
}

/** Enforces the central route → permission map for a pathname (no-op for open routes). */
export async function requireRouteAccess(queryClient: QueryClient, pathname: string) {
  const requirement = accessRequirementFor(pathname);
  if (requirement) {
    await requirePermission(queryClient, requirement.anyOf);
  }
}
