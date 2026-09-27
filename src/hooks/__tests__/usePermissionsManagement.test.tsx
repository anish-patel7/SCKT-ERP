// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRolePermissions, useUpdateRolePermissions } from "@/hooks/usePermissionsManagement";
import { permissionsService, type Permission } from "@/services/permissions";

vi.mock("@/services/permissions", () => ({
  permissionsService: {
    getRolePermissions: vi.fn(),
    updateRolePermissions: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ROLE_ID = "11111111-1111-4111-8111-111111111111";
const perm = (id: string, code: string): Permission => {
  const [module = "", action = ""] = code.split(":");
  return {
    id,
    permission_code: code,
    permission_name: code,
    description: null,
    module,
    action,
    is_system: true,
    is_active: true,
    created_at: null,
    updated_at: null,
  } as Permission;
};
const SALES_READ = perm("22222222-2222-4222-8222-222222222222", "sales:read");
const SALES_CREATE = perm("33333333-3333-4333-8333-333333333333", "sales:create");

const service = vi.mocked(permissionsService);
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderSave() {
  return renderHook(
    () => ({ grants: useRolePermissions(ROLE_ID), save: useUpdateRolePermissions() }),
    { wrapper },
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  service.getRolePermissions.mockResolvedValue([SALES_READ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useUpdateRolePermissions", () => {
  it("resolves only after the saved grants have been reloaded", async () => {
    const { result } = renderSave();
    await waitFor(() => expect(result.current.grants.data).toEqual([SALES_READ]));

    service.updateRolePermissions.mockResolvedValue(undefined);
    // A slow reload: mutateAsync must still wait for it.
    service.getRolePermissions.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([SALES_READ, SALES_CREATE]), 50)),
    );
    await act(() =>
      result.current.save.mutateAsync({
        roleId: ROLE_ID,
        permissionIds: [SALES_READ.id, SALES_CREATE.id],
      }),
    );

    expect(service.updateRolePermissions).toHaveBeenCalledWith(ROLE_ID, [
      SALES_READ.id,
      SALES_CREATE.id,
    ]);
    // Reloaded before mutateAsync resolved, so the page never shows the old grants.
    expect(queryClient.getQueryData(["role-permissions", ROLE_ID])).toEqual([
      SALES_READ,
      SALES_CREATE,
    ]);
    expect(toast.success).toHaveBeenCalledWith("Permissions updated successfully");
  });

  it("invalidates effective access so the sidebar and guards refresh", async () => {
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderSave();
    service.updateRolePermissions.mockResolvedValue(undefined);
    await act(() => result.current.save.mutateAsync({ roleId: ROLE_ID, permissionIds: [] }));
    const keys = spy.mock.calls.map(([filters]) => filters?.queryKey?.[0]);
    expect(keys).toEqual(expect.arrayContaining(["effective-access", "access-overview"]));
  });

  it("surfaces a failed save and reloads the actual backend state", async () => {
    const { result } = renderSave();
    await waitFor(() => expect(result.current.grants.isSuccess).toBe(true));
    const fetchesBefore = service.getRolePermissions.mock.calls.length;
    service.updateRolePermissions.mockRejectedValue(
      new Error("Granted new permissions but failed to revoke removed ones: denied"),
    );

    await act(async () => {
      await expect(
        result.current.save.mutateAsync({ roleId: ROLE_ID, permissionIds: [] }),
      ).rejects.toThrow("failed to revoke");
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Granted new permissions but failed to revoke removed ones: denied",
    );
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(service.getRolePermissions.mock.calls.length).toBeGreaterThan(fetchesBefore),
    );
  });
});
