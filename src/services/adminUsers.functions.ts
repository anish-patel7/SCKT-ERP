/**
 * Server function for Admin "Add User". This file ships to the client bundle as an RPC
 * stub; the handler body and the service-role client only run on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CreateUserInputSchema, type CreatedUser } from "@/lib/validators/admin-users";

export type CreateUserResult =
  | { ok: true; user: CreatedUser }
  | { ok: false; code: string; message: string; field: string | null };

export const createUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateUserInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<CreateUserResult> => {
    const { AdminUserError, createUserAsAdmin, supabaseAdminUserGateway } =
      await import("@/server/admin-users.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    try {
      const user = await createUserAsAdmin(
        supabaseAdminUserGateway(context.supabase, supabaseAdmin, context.userId),
        { id: context.userId, email },
        data,
      );
      return { ok: true, user };
    } catch (error) {
      if (error instanceof AdminUserError) {
        return { ok: false, code: error.code, message: error.message, field: error.field ?? null };
      }
      console.error("Admin user creation failed:", error);
      return {
        ok: false,
        code: "FAILED",
        message: error instanceof Error ? error.message : "User creation failed",
        field: null,
      };
    }
  });
