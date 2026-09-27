import { describe, expect, it, vi } from "vitest";
import {
  AdminUserError,
  createUserAsAdmin,
  type AdminUserGateway,
  type ProfileFields,
  type RoleRow,
} from "@/server/admin-users.server";

const CALLER = { id: "aaaaaaaa-0000-4000-8000-00000000000a", email: "admin@sckt.test" };
const NEW_ID = "bbbbbbbb-0000-4000-8000-00000000000b";
const MANAGER: RoleRow = {
  id: "cccccccc-0000-4000-8000-000000000001",
  role_code: "manager",
  is_active: true,
};
const SALES_VIEWER: RoleRow = {
  id: "cccccccc-0000-4000-8000-000000000002",
  role_code: "sales_viewer",
  is_active: true,
};
const OLD_ROLE: RoleRow = {
  id: "cccccccc-0000-4000-8000-000000000003",
  role_code: "old",
  is_active: false,
};
const NOW = () => new Date("2026-09-27T10:00:00.000Z");

const VALID = {
  email: "  New.User@Example.com ",
  full_name: "New User",
  password: "S3cure-initial",
  employee_id: "E-100",
  department: "",
  designation: "Weaver",
  mobile: "",
};

function fakeGateway(permissions: string[], overrides: Partial<AdminUserGateway> = {}) {
  const calls = {
    created: [] as { email: string; password: string; fullName: string }[],
    profiles: [] as { userId: string; fields: ProfileFields }[],
    roles: [] as { userId: string; roleIds: string[] }[],
    deleted: [] as string[],
    audits: [] as { action: string; details: string }[],
  };
  const gateway: AdminUserGateway = {
    callerHasPermission: vi.fn(async (code: string) => permissions.includes(code)),
    loadRoles: vi.fn(async (ids: string[]) =>
      [MANAGER, SALES_VIEWER, OLD_ROLE].filter((r) => ids.includes(r.id)),
    ),
    createAuthUser: vi.fn(async (input) => {
      calls.created.push(input);
      return { id: NEW_ID };
    }),
    saveProfile: vi.fn(async (userId, fields) => {
      calls.profiles.push({ userId, fields });
      return null;
    }),
    assignRoles: vi.fn(async (userId, roleIds) => {
      calls.roles.push({ userId, roleIds });
      return null;
    }),
    deleteAuthUser: vi.fn(async (userId) => {
      calls.deleted.push(userId);
      return null;
    }),
    audit: vi.fn(async ({ action, details }) => {
      calls.audits.push({ action, details });
    }),
    ...overrides,
  };
  return { gateway, calls };
}

const ALL = ["user_management:create", "user_management:approve", "user_management:assign_role"];

async function expectError(promise: Promise<unknown>): Promise<AdminUserError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AdminUserError);
  return error as AdminUserError;
}

describe("createUserAsAdmin — authorization", () => {
  it("rejects callers without user_management:create before touching Auth", async () => {
    const { gateway, calls } = fakeGateway(["user_management:read", "user_management:update"]);
    const error = await expectError(createUserAsAdmin(gateway, CALLER, VALID, NOW));
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toContain("user_management:create");
    expect(calls.created).toEqual([]);
  });

  it("rejects role assignment without user_management:assign_role", async () => {
    const { gateway, calls } = fakeGateway(["user_management:create"]);
    const error = await expectError(
      createUserAsAdmin(gateway, CALLER, { ...VALID, role_ids: [MANAGER.id] }, NOW),
    );
    expect(error).toMatchObject({ code: "FORBIDDEN", field: "role_ids" });
    expect(calls.created).toEqual([]);
  });

  it("creates a pending, inactive user when the caller cannot approve", async () => {
    const { gateway, calls } = fakeGateway(["user_management:create"]);
    const user = await createUserAsAdmin(gateway, CALLER, VALID, NOW);
    expect(user).toMatchObject({ status: "INACTIVE", approval_status: "PENDING_APPROVAL" });
    expect(calls.profiles[0]?.fields).toMatchObject({
      status: "INACTIVE",
      approval_status: "PENDING_APPROVAL",
      approved_by: null,
      approved_at: null,
      primary_role_id: "viewer",
    });
    expect(calls.roles).toEqual([]);
  });
});

describe("createUserAsAdmin — full administrator", () => {
  it("creates an active account, completes the profile and assigns roles (primary first)", async () => {
    const { gateway, calls } = fakeGateway(ALL);
    const user = await createUserAsAdmin(
      gateway,
      CALLER,
      { ...VALID, role_ids: [MANAGER.id, SALES_VIEWER.id, MANAGER.id] },
      NOW,
    );

    expect(calls.created).toEqual([
      { email: "new.user@example.com", password: "S3cure-initial", fullName: "New User" },
    ]);
    expect(calls.profiles).toEqual([
      {
        userId: NEW_ID,
        fields: {
          email: "new.user@example.com",
          full_name: "New User",
          employee_id: "E-100",
          department: null,
          designation: "Weaver",
          mobile: null,
          primary_role_id: "manager",
          status: "ACTIVE",
          approval_status: "ADMIN_APPROVED",
          creation_method: "ADMIN_CREATED",
          approved_by: "admin@sckt.test",
          approved_at: "2026-09-27T10:00:00.000Z",
          require_password_change: true,
          updated_at: "2026-09-27T10:00:00.000Z",
        },
      },
    ]);
    expect(calls.roles).toEqual([{ userId: NEW_ID, roleIds: [MANAGER.id, SALES_VIEWER.id] }]);
    expect(calls.audits).toEqual([
      {
        action: "USER_CREATED",
        details: "Created new.user@example.com (ADMIN_APPROVED); roles: manager, sales_viewer",
      },
    ]);
    expect(user).toEqual({
      id: NEW_ID,
      email: "new.user@example.com",
      status: "ACTIVE",
      approval_status: "ADMIN_APPROVED",
      role_ids: [MANAGER.id, SALES_VIEWER.id],
    });
  });

  it("keeps the Viewer profile fallback when the primary role is a custom role", async () => {
    const { gateway, calls } = fakeGateway(ALL);
    await createUserAsAdmin(gateway, CALLER, { ...VALID, role_ids: [SALES_VIEWER.id] }, NOW);
    expect(calls.profiles[0]?.fields.primary_role_id).toBe("viewer");
  });

  it("rejects inactive or unknown roles before creating the account", async () => {
    const { gateway, calls } = fakeGateway(ALL);
    const error = await expectError(
      createUserAsAdmin(gateway, CALLER, { ...VALID, role_ids: [OLD_ROLE.id] }, NOW),
    );
    expect(error).toMatchObject({ code: "INVALID", field: "role_ids" });
    expect(calls.created).toEqual([]);
  });
});

describe("createUserAsAdmin — validation and failures", () => {
  it("validates input on the server", async () => {
    const { gateway, calls } = fakeGateway(ALL);
    const error = await expectError(
      createUserAsAdmin(gateway, CALLER, { ...VALID, password: "short" }, NOW),
    );
    expect(error).toMatchObject({ code: "INVALID", field: "password" });
    expect(gateway.callerHasPermission).not.toHaveBeenCalled();
    expect(calls.created).toEqual([]);
  });

  it("reports a duplicate email against the email field", async () => {
    const { gateway, calls } = fakeGateway(ALL, {
      createAuthUser: vi.fn(async () => ({
        error: {
          message: "A user with this email address has already been registered",
          code: "email_exists",
        },
      })),
    });
    const error = await expectError(createUserAsAdmin(gateway, CALLER, VALID, NOW));
    expect(error).toMatchObject({ code: "CONFLICT", field: "email" });
    expect(calls.profiles).toEqual([]);
  });

  it("removes the new account when the profile cannot be saved", async () => {
    const { gateway, calls } = fakeGateway(ALL, {
      saveProfile: vi.fn(async () => ({
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_employee_id_key"',
      })),
    });
    const error = await expectError(createUserAsAdmin(gateway, CALLER, VALID, NOW));
    expect(error).toMatchObject({ code: "CONFLICT", field: "employee_id" });
    expect(calls.deleted).toEqual([NEW_ID]);
    expect(calls.audits).toEqual([]);
  });

  it("removes the new account when roles cannot be assigned", async () => {
    const { gateway, calls } = fakeGateway(ALL, {
      assignRoles: vi.fn(async () => ({ message: "insert failed" })),
    });
    const error = await expectError(
      createUserAsAdmin(gateway, CALLER, { ...VALID, role_ids: [MANAGER.id] }, NOW),
    );
    expect(error.message).toContain("Failed to assign roles");
    expect(calls.deleted).toEqual([NEW_ID]);
  });

  it("says so when the rollback itself fails", async () => {
    const { gateway } = fakeGateway(ALL, {
      saveProfile: vi.fn(async () => ({ message: "boom" })),
      deleteAuthUser: vi.fn(async () => ({ message: "network" })),
    });
    const error = await expectError(createUserAsAdmin(gateway, CALLER, VALID, NOW));
    expect(error.message).toContain("could not be removed automatically");
  });
});
