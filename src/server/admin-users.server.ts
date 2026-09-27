/**
 * Server-only: Admin "Add User". Creates the Supabase Auth account with the service-role
 * client, completes the profile and assigns roles. Never import from client code; the
 * server function in src/services/adminUsers.functions.ts loads this module lazily.
 *
 * Authorization is checked here against the caller's own RBAC permissions, because the
 * service-role client bypasses RLS and the profiles guard trigger:
 *   user_management:create       required to create any user
 *   user_management:approve      created user is ACTIVE / ADMIN_APPROVED; otherwise the
 *                                account waits in PENDING_APPROVAL (status INACTIVE)
 *   user_management:assign_role  required to assign roles at creation
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CreateUserInputSchema,
  type CreatedUser,
  type ValidCreateUserInput,
} from "@/lib/validators/admin-users";
import { SYSTEM_PERMISSIONS } from "@/lib/access-control";
import { PROFILE_BASE_ROLE_CODES } from "@/services/access";

export type AdminUserErrorCode = "FORBIDDEN" | "CONFLICT" | "INVALID" | "FAILED";

export class AdminUserError extends Error {
  constructor(
    public readonly code: AdminUserErrorCode,
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "AdminUserError";
  }
}

export type Caller = { id: string; email: string | null };

export type RoleRow = { id: string; role_code: string; is_active: boolean | null };

export type ProfileFields = {
  email: string;
  full_name: string;
  employee_id: string | null;
  department: string | null;
  designation: string | null;
  mobile: string | null;
  primary_role_id: string;
  status: "ACTIVE" | "INACTIVE";
  approval_status: "ADMIN_APPROVED" | "PENDING_APPROVAL";
  creation_method: "ADMIN_CREATED";
  approved_by: string | null;
  approved_at: string | null;
  require_password_change: boolean;
  updated_at: string;
};

type GatewayError = { message: string; code?: string | undefined; status?: number | undefined };

/** Backend operations used by createUserAsAdmin (Supabase in production, a fake in tests). */
export type AdminUserGateway = {
  callerHasPermission(code: string): Promise<boolean>;
  loadRoles(ids: string[]): Promise<RoleRow[]>;
  createAuthUser(input: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<{ id: string } | { error: GatewayError }>;
  saveProfile(userId: string, fields: ProfileFields): Promise<GatewayError | null>;
  assignRoles(userId: string, roleIds: string[]): Promise<GatewayError | null>;
  deleteAuthUser(userId: string): Promise<GatewayError | null>;
  audit(entry: {
    entityId: string;
    action: string;
    details: string;
    caller: Caller;
  }): Promise<void>;
};

function isDuplicateEmail(error: GatewayError): boolean {
  return (
    error.code === "email_exists" ||
    error.code === "user_already_exists" ||
    /already (been )?registered|already exists/i.test(error.message)
  );
}

function profileError(error: GatewayError): AdminUserError {
  if (error.code === "23505" && /employee_id/i.test(error.message)) {
    return new AdminUserError("CONFLICT", "This employee ID is already in use", "employee_id");
  }
  return new AdminUserError("FAILED", `Failed to save the user profile: ${error.message}`);
}

export async function createUserAsAdmin(
  gateway: AdminUserGateway,
  caller: Caller,
  rawInput: unknown,
  now: () => Date = () => new Date(),
): Promise<CreatedUser> {
  const parsed = CreateUserInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AdminUserError(
      "INVALID",
      issue?.message ?? "Invalid user details",
      issue?.path[0]?.toString(),
    );
  }
  const input: ValidCreateUserInput = parsed.data;

  const [canCreate, canApprove, canAssign] = await Promise.all([
    gateway.callerHasPermission(SYSTEM_PERMISSIONS.usersCreate),
    gateway.callerHasPermission(SYSTEM_PERMISSIONS.usersApprove),
    gateway.callerHasPermission(SYSTEM_PERMISSIONS.usersAssignRole),
  ]);
  if (!canCreate) {
    throw new AdminUserError(
      "FORBIDDEN",
      `Not authorized to create users (requires ${SYSTEM_PERMISSIONS.usersCreate})`,
    );
  }

  const roleIds = [...new Set(input.role_ids)];
  if (roleIds.length > 0 && !canAssign) {
    throw new AdminUserError(
      "FORBIDDEN",
      `Not authorized to assign roles (requires ${SYSTEM_PERMISSIONS.usersAssignRole})`,
      "role_ids",
    );
  }
  const roles = roleIds.length > 0 ? await gateway.loadRoles(roleIds) : [];
  const byId = new Map(roles.map((r) => [r.id, r]));
  for (const id of roleIds) {
    const role = byId.get(id);
    if (!role || role.is_active === false) {
      throw new AdminUserError(
        "INVALID",
        "Selected role does not exist or is inactive",
        "role_ids",
      );
    }
  }

  const created = await gateway.createAuthUser({
    email: input.email,
    password: input.password,
    fullName: input.full_name,
  });
  if ("error" in created) {
    if (isDuplicateEmail(created.error)) {
      throw new AdminUserError("CONFLICT", "A user with this email already exists", "email");
    }
    throw new AdminUserError("FAILED", `Failed to create the account: ${created.error.message}`);
  }
  const userId = created.id;

  // The account exists from here on: undo it if the rest of the setup fails, so a
  // half-configured login is never left behind.
  const rollback = async (cause: AdminUserError): Promise<never> => {
    const deleteError = await gateway.deleteAuthUser(userId);
    if (deleteError) {
      console.error(`Admin user creation rollback failed for ${userId}:`, deleteError.message);
      throw new AdminUserError(
        "FAILED",
        `${cause.message}. The new account (${input.email}) could not be removed automatically; deactivate it from Users & Roles.`,
        cause.field,
      );
    }
    throw cause;
  };

  const timestamp = now().toISOString();
  const primaryCode = roleIds[0] ? byId.get(roleIds[0])?.role_code.toLowerCase() : undefined;
  const fields: ProfileFields = {
    email: input.email,
    full_name: input.full_name,
    employee_id: input.employee_id,
    department: input.department,
    designation: input.designation,
    mobile: input.mobile,
    // Fallback base role, used only while the user has no explicit role assignment.
    primary_role_id:
      primaryCode && (PROFILE_BASE_ROLE_CODES as readonly string[]).includes(primaryCode)
        ? primaryCode
        : "viewer",
    status: canApprove ? "ACTIVE" : "INACTIVE",
    approval_status: canApprove ? "ADMIN_APPROVED" : "PENDING_APPROVAL",
    creation_method: "ADMIN_CREATED",
    approved_by: canApprove ? (caller.email ?? caller.id) : null,
    approved_at: canApprove ? timestamp : null,
    require_password_change: true,
    updated_at: timestamp,
  };

  const saveError = await gateway.saveProfile(userId, fields);
  if (saveError) await rollback(profileError(saveError));

  if (roleIds.length > 0) {
    const assignError = await gateway.assignRoles(userId, roleIds);
    if (assignError) {
      await rollback(
        new AdminUserError("FAILED", `Failed to assign roles: ${assignError.message}`, "role_ids"),
      );
    }
  }

  const roleCodes = roleIds.map((id) => byId.get(id)?.role_code ?? id);
  await gateway.audit({
    entityId: userId,
    action: "USER_CREATED",
    details:
      `Created ${input.email} (${fields.approval_status}); ` +
      `roles: ${roleCodes.length ? roleCodes.join(", ") : "none (profile fallback)"}`,
    caller,
  });

  return {
    id: userId,
    email: input.email,
    status: fields.status,
    approval_status: fields.approval_status,
    role_ids: roleIds,
  };
}

/**
 * Production gateway. `userClient` carries the caller's JWT (permission checks run as the
 * caller, through the same user_has_permission() used by RLS); `adminClient` uses the
 * service-role key for the Auth Admin API and the writes that follow.
 */
export function supabaseAdminUserGateway(
  userClient: SupabaseClient,
  adminClient: SupabaseClient,
  callerId: string,
): AdminUserGateway {
  return {
    async callerHasPermission(code) {
      const { data, error } = await userClient.rpc("user_has_permission_v2", {
        _user_id: callerId,
        _permission_code: code,
      });
      if (error) throw new AdminUserError("FAILED", `Permission check failed: ${error.message}`);
      return data === true;
    },

    async loadRoles(ids) {
      const { data, error } = await adminClient
        .from("role_definitions")
        .select("id, role_code, is_active")
        .in("id", ids);
      if (error) throw new AdminUserError("FAILED", `Failed to load roles: ${error.message}`);
      return (data ?? []) as RoleRow[];
    },

    async createAuthUser({ email, password, fullName }) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        // The administrator vouches for the address; no confirmation email is sent.
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error || !data.user) {
        return {
          error: {
            message: error?.message ?? "No user returned",
            code: error?.code,
            status: error?.status,
          },
        };
      }
      return { id: data.user.id };
    },

    async saveProfile(userId, fields) {
      // Upsert: the signup trigger normally creates the row, but never blocks on failure.
      const { error } = await adminClient
        .from("profiles")
        .upsert({ id: userId, ...fields }, { onConflict: "id" });
      return error ? { message: error.message, code: error.code } : null;
    },

    async assignRoles(userId, roleIds) {
      const { error } = await adminClient.from("user_roles_mapping").insert(
        roleIds.map((roleId, i) => ({
          user_id: userId,
          role_id: roleId,
          is_primary: i === 0,
          is_active: true,
        })),
      );
      return error ? { message: error.message, code: error.code } : null;
    },

    async deleteAuthUser(userId) {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      return error ? { message: error.message } : null;
    },

    async audit({ entityId, action, details, caller }) {
      const { error } = await adminClient.from("audit_log").insert({
        entity: "user",
        entity_id: entityId,
        action,
        details,
        actor_id: caller.id,
        actor_name: caller.email,
      });
      if (error) console.error("Audit log write failed:", error.message);
    },
  };
}
