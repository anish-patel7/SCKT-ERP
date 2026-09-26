import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  useAllRoles,
  useAssignRoleToUser,
  useRemoveRoleFromUser,
  useSetPrimaryRole,
} from "@/hooks/useRolesManagement";
import { useUpdateUserStatus } from "@/hooks/useUsersManagement";
import { usePermissions } from "@/hooks/usePermissions";
import {
  actionLabel,
  actionSortIndex,
  groupSortIndex,
  moduleLabel,
} from "@/lib/access-control";
import {
  resolveAccess,
  type EffectiveAccess,
  type RbacSnapshot,
} from "@/services/access";
import type { UserProfile } from "@/services/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MANAGE_ROLES_PERMISSION,
  STATUS_BADGES,
} from "@/components/users/constants";
import { AlertTriangle, Loader2, Star, X } from "lucide-react";

type GroupedPermissions = {
  group: string;
  resources: { resource: string; actions: string[] }[];
}[];

function groupEffective(access: EffectiveAccess): GroupedPermissions {
  const groups = new Map<string, Map<string, Set<string>>>();
  for (const p of access.permissions) {
    const { group, resource } = moduleLabel(p.module);
    const resources = groups.get(group) ?? new Map<string, Set<string>>();
    const actions = resources.get(resource) ?? new Set<string>();
    actions.add(p.action);
    resources.set(resource, actions);
    groups.set(group, resources);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => groupSortIndex(a) - groupSortIndex(b))
    .map(([group, resources]) => ({
      group,
      resources: [...resources.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([resource, actions]) => ({
          resource,
          actions: [...actions].sort(
            (a, b) => actionSortIndex(a) - actionSortIndex(b),
          ),
        })),
    }));
}

export function ManageRolesDialog({
  user,
  overview,
  onClose,
}: {
  user: UserProfile | null;
  overview: RbacSnapshot | null;
  onClose: () => void;
}) {
  const { can, access: currentAccess } = usePermissions();
  const canManage = can(MANAGE_ROLES_PERMISSION);
  const { data: roleDefinitions } = useAllRoles();
  const assignRole = useAssignRoleToUser();
  const removeRole = useRemoveRoleFromUser();
  const setPrimary = useSetPrimaryRole();
  const updateStatus = useUpdateUserStatus();
  const [roleToAdd, setRoleToAdd] = useState("");
  const [makePrimary, setMakePrimary] = useState<boolean | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);

  const access = user && overview ? resolveAccess(overview, user.id) : null;
  const userMappings =
    overview?.mappings.filter(
      (m) => m.user_id === user?.id && m.is_active !== false,
    ) ?? [];
  const mappedIds = new Set(userMappings.map((m) => m.role_id));
  const usesFallback =
    !!access && mappedIds.size === 0 && access.roles.length > 0;
  const fallbackRole = usesFallback ? access.roles[0] : undefined;
  const hasFlaggedPrimary = userMappings.some(
    (m) => m.is_primary && access?.roles.some((r) => r.id === m.role_id),
  );
  const heldIds = new Set(access?.roles.map((r) => r.id) ?? []);
  const available = (overview?.roles ?? []).filter(
    (r) => r.is_active !== false && !heldIds.has(r.id),
  );
  const isSystemRole = (roleId: string) =>
    roleDefinitions?.find((r) => r.id === roleId)?.is_system ?? false;
  const primaryRole = access?.roles.find((r) => r.id === access.primaryRoleId);
  const assignAsPrimary = makePrimary ?? mappedIds.size === 0;
  const isSelf = !!user && currentAccess?.userId === user.id;
  const grouped = access && showPermissions ? groupEffective(access) : [];
  const busy =
    assignRole.isPending ||
    removeRole.isPending ||
    setPrimary.isPending ||
    updateStatus.isPending;

  const close = () => {
    setRoleToAdd("");
    setMakePrimary(null);
    setShowPermissions(false);
    onClose();
  };

  const assign = () => {
    if (!access || !roleToAdd) return;
    const done = {
      onSuccess: () => {
        setRoleToAdd("");
        setMakePrimary(null);
      },
    };
    if (assignAsPrimary) {
      // Assigns the mapping as primary and clears is_primary on the user's other mappings.
      setPrimary.mutate({ userId: access.userId, roleId: roleToAdd }, done);
    } else {
      assignRole.mutate(
        { userId: access.userId, roleId: roleToAdd, isPrimary: false },
        done,
      );
    }
  };

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Manage Roles</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-left">
              <div className="font-medium text-foreground">
                {user?.full_name || "—"}
              </div>
              <div className="break-all">{user?.email ?? "—"}</div>
              <div className="flex items-center gap-2">
                <span>Account status:</span>
                <Badge
                  className={
                    STATUS_BADGES[user?.status ?? ""] ??
                    "bg-slate-500 text-white"
                  }
                >
                  {user?.status ?? "UNKNOWN"}
                </Badge>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {!overview || !access ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 text-sm">
            <section className="space-y-1">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Current Primary Role
              </h3>
              {primaryRole ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Star className="size-3.5 fill-amber-400 text-amber-500" />
                  <span className="font-medium">{primaryRole.role_name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {primaryRole.role_code}
                  </span>
                  {usesFallback && (
                    <Badge variant="outline" className="text-[0.625rem]">
                      profile fallback
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  None — this user has no access.
                </p>
              )}
              {!usesFallback && mappedIds.size > 0 && !hasFlaggedPrimary && (
                <p className="text-[0.6875rem] text-amber-700">
                  No assigned role is flagged primary. Use "Set Primary" on one
                  of the roles below.
                </p>
              )}
            </section>

            {usesFallback && fallbackRole && (
              <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 sm:flex-row sm:items-start dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p>
                    No explicit role assignment in{" "}
                    <span className="font-mono">user_roles_mapping</span>.
                    Access currently comes only from the profile base role
                    fallback (
                    <span className="font-mono">
                      profiles.primary_role_id = {fallbackRole.role_code}
                    </span>
                    ). Assigning any role replaces this fallback for application
                    access
                    {access.isAdmin
                      ? " (Administrator is preserved automatically)"
                      : ""}
                    .
                  </p>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={busy}
                      onClick={() =>
                        setPrimary.mutate({
                          userId: access.userId,
                          roleId: fallbackRole.id,
                        })
                      }
                    >
                      Assign {fallbackRole.role_name} explicitly
                    </Button>
                  )}
                </div>
              </div>
            )}

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Current Active Roles ({access.roles.length})
              </h3>
              {access.roles.length > 1 && (
                <p className="text-[0.6875rem] text-muted-foreground">
                  Effective permissions are the union of all roles below.
                </p>
              )}
              {access.roles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No roles assigned — no access.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {access.roles.map((role) => {
                    const isPrimary = role.id === access.primaryRoleId;
                    const viaMapping = mappedIds.has(role.id);
                    const isLastMapping = viaMapping && mappedIds.size === 1;
                    return (
                      <li
                        key={role.id}
                        className="flex flex-wrap items-center gap-2 px-3 py-2"
                      >
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          {isPrimary && (
                            <Star className="size-3.5 fill-amber-400 text-amber-500" />
                          )}
                          <span className="font-medium">{role.role_name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {role.role_code}
                          </span>
                          {isPrimary && (
                            <Badge variant="outline">Primary</Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className="text-[0.625rem]"
                          >
                            {isSystemRole(role.id) ? "System" : "Custom"}
                          </Badge>
                          {!viaMapping && (
                            <Badge
                              variant="outline"
                              className="text-[0.625rem]"
                            >
                              profile fallback
                            </Badge>
                          )}
                        </div>
                        {canManage && viaMapping && (
                          <div className="flex gap-1">
                            {(!isPrimary || !hasFlaggedPrimary) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={busy}
                                onClick={() =>
                                  setPrimary.mutate({
                                    userId: access.userId,
                                    roleId: role.id,
                                  })
                                }
                              >
                                Set Primary
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              disabled={busy}
                              onClick={() => {
                                const note = isLastMapping
                                  ? "\n\nThis is the user's only assigned role; they will fall back to the profile base role."
                                  : "";
                                if (
                                  confirm(
                                    `Remove ${role.role_name} from ${user?.email ?? "this user"}?${note}`,
                                  )
                                ) {
                                  removeRole.mutate({
                                    userId: access.userId,
                                    roleId: role.id,
                                  });
                                }
                              }}
                            >
                              <X className="size-3.5" />
                              Remove
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {canManage && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Available Roles
                </h3>
                {available.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    This user already holds every active role.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <Select value={roleToAdd} onValueChange={setRoleToAdd}>
                      <SelectTrigger className="h-9 w-full text-xs sm:w-64">
                        <SelectValue placeholder="Select a role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {available.map((r) => (
                          <SelectItem
                            key={r.id}
                            value={r.id}
                            className="text-xs"
                          >
                            {r.role_name} ({r.role_code})
                            {isSystemRole(r.id) ? "" : " · custom"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={assignAsPrimary}
                        onCheckedChange={(checked) =>
                          setMakePrimary(checked === true)
                        }
                      />
                      Make primary
                    </label>
                    <Button
                      size="sm"
                      className="h-9 text-xs"
                      disabled={!roleToAdd || busy}
                      onClick={assign}
                    >
                      {busy && <Loader2 className="size-3 animate-spin" />}
                      Assign Role
                    </Button>
                  </div>
                )}
                {isSelf && (
                  <p className="text-[0.6875rem] text-muted-foreground">
                    You are editing your own roles; your access and sidebar
                    refresh after each change.
                  </p>
                )}
              </section>
            )}

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Effective Permissions:{" "}
                  <span className="font-mono text-foreground">
                    {access.blocked
                      ? 0
                      : access.isAdmin
                        ? "All"
                        : access.permissions.length}
                  </span>
                </h3>
                {!access.blocked &&
                  !access.isAdmin &&
                  access.permissions.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setShowPermissions((v) => !v)}
                    >
                      {showPermissions
                        ? "Hide Permissions"
                        : "View Permissions"}
                    </Button>
                  )}
              </div>
              {access.blocked ? (
                <p className="text-xs text-amber-700">
                  Account is {user?.status}; the user holds no access until
                  reactivated.
                </p>
              ) : access.isAdmin ? (
                <p className="text-xs">
                  Administrator — full access to every function.
                </p>
              ) : (
                showPermissions && (
                  <div className="space-y-2">
                    {grouped.map(({ group, resources }) => (
                      <div key={group}>
                        <div className="text-xs font-semibold">{group}</div>
                        <ul className="ml-3 space-y-0.5">
                          {resources.map(({ resource, actions }) => (
                            <li key={resource} className="text-xs">
                              {resource}:{" "}
                              <span className="font-mono text-muted-foreground">
                                {actions.map(actionLabel).join(", ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )
              )}
              <p className="text-[0.6875rem] text-muted-foreground">
                Role permissions are edited in{" "}
                <Link
                  to="/system/permission-matrix"
                  className="font-medium text-primary hover:underline"
                >
                  Permission Matrix
                </Link>
                .
              </p>
            </section>

            {canManage && (
              <section className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  Account status is separate from role assignment.
                </span>
                <Button
                  size="sm"
                  variant={
                    user?.status === "ACTIVE" ? "destructive" : "default"
                  }
                  disabled={busy || !user}
                  onClick={() =>
                    user &&
                    updateStatus.mutate({
                      userId: user.id,
                      status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    })
                  }
                >
                  {user?.status === "ACTIVE"
                    ? "Deactivate User"
                    : "Activate User"}
                </Button>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
