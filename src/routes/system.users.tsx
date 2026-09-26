import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  useUsers,
  useUpdateUserStatus,
  useApproveUser,
  useRejectUser,
} from "@/hooks/useUsersManagement";
import {
  useAccessOverview,
  useAssignRoleToUser,
  useRemoveRoleFromUser,
  useSetPrimaryRole,
} from "@/hooks/useRolesManagement";
import { requireAuth } from "@/lib/route-guards";
import { actionLabel, actionSortIndex, groupSortIndex, moduleLabel } from "@/lib/access-control";
import { resolveAccess, type EffectiveAccess, type RbacSnapshot } from "@/services/access";
import type { UserProfile } from "@/services/users";
import { Can } from "@/components/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Shield, UserCheck, Clock, Loader2, Info, Star, X } from "lucide-react";

export const Route = createFileRoute("/system/users")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Users & Access — SCKT ERP" },
      { name: "description", content: "Manage SCKT ERP users and their Roles / Access Groups." },
      { property: "og:title", content: "Users & Access — SCKT ERP" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: UsersPage,
});

const STATUS_BADGES: Record<string, string> = {
  ACTIVE: "bg-emerald-600 text-white",
  INACTIVE: "bg-slate-500 text-white",
  SUSPENDED: "bg-rose-600 text-white",
  LOCKED: "bg-orange-600 text-white",
};

const PENDING_APPROVAL = "PENDING_APPROVAL";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function UsersPage() {
  const { data: usersData, isLoading, error, refetch } = useUsers();
  const users = usersData ?? [];
  const { data: overview, error: overviewError } = useAccessOverview();
  const updateStatus = useUpdateUserStatus();
  const approveUser = useApproveUser();
  const rejectUser = useRejectUser();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [accessUserId, setAccessUserId] = useState<string | null>(null);

  const accessByUser = useMemo(() => {
    const map = new Map<string, EffectiveAccess>();
    if (overview) for (const u of usersData ?? []) map.set(u.id, resolveAccess(overview, u.id));
    return map;
  }, [overview, usersData]);

  const term = searchTerm.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !term ||
      (user.email?.toLowerCase().includes(term) ?? false) ||
      (user.full_name?.toLowerCase().includes(term) ?? false);
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === PENDING_APPROVAL
        ? user.approval_status === PENDING_APPROVAL
        : user.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  const activeCount = users.filter((u) => u.status === "ACTIVE").length;
  const pendingCount = users.filter((u) => u.approval_status === PENDING_APPROVAL).length;
  const accessUser = users.find((u) => u.id === accessUserId) ?? null;

  const rowBusy = (userId: string) =>
    (updateStatus.isPending && updateStatus.variables?.userId === userId) ||
    (approveUser.isPending && approveUser.variables === userId) ||
    (rejectUser.isPending && rejectUser.variables === userId);

  return (
    <AppShell
      title="Users & Access"
      breadcrumb={[{ label: "System", to: "/system" }, { label: "Users & Access" }]}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi
            label="Total Users"
            value={users.length}
            icon={<UserCheck className="size-4 text-emerald-600" />}
          />
          <Kpi
            label="Active"
            value={activeCount}
            icon={<Shield className="size-4 text-purple-600" />}
          />
          <Kpi
            label="Pending Approval"
            value={pendingCount}
            icon={<Clock className="size-4 text-amber-600" />}
          />
        </div>

        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Access comes only from Roles / Access Groups: a user holds every permission of every
            active role assigned to them. Define roles under{" "}
            <Link to="/system/roles" className="font-medium text-primary hover:underline">
              Roles / Access Groups
            </Link>
            . New accounts cannot be created from the browser (requires a secure server-side
            Supabase Admin path).
          </p>
        </div>

        {overview && overview.unavailableSources.length > 0 && (
          <p className="text-xs text-amber-700">
            Some role sources could not be read from the database (
            {overview.unavailableSources.join(", ")}); access shown may be incomplete.
          </p>
        )}
        {overviewError && (
          <p className="text-xs text-destructive">
            Role assignments could not be loaded: {overviewError.message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Users</SelectItem>
              <SelectItem value={PENDING_APPROVAL}>Pending Approval</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
              <SelectItem value="LOCKED">Locked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="space-y-2 py-8 text-center text-sm">
                <p className="text-destructive">Failed to load users: {error.message}</p>
                <Button size="sm" variant="outline" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead className="h-8">Name</TableHead>
                      <TableHead className="h-8">Email</TableHead>
                      <TableHead className="h-8">Department</TableHead>
                      <TableHead className="h-8">Status</TableHead>
                      <TableHead className="h-8">Primary Role</TableHead>
                      <TableHead className="h-8">Additional Roles</TableHead>
                      <TableHead className="h-8 text-right">Permissions</TableHead>
                      <TableHead className="h-8">Last Login</TableHead>
                      <TableHead className="h-8 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                          {users.length === 0 ? "No users found" : "No users match this filter"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => {
                        const access = accessByUser.get(user.id);
                        const primary = access?.roles.find((r) => r.id === access.primaryRoleId);
                        const additional =
                          access?.roles.filter((r) => r.id !== access.primaryRoleId) ?? [];
                        const busy = rowBusy(user.id);
                        const isPending = user.approval_status === PENDING_APPROVAL;
                        return (
                          <TableRow key={user.id} className="hover:bg-muted/40">
                            <TableCell className="py-2 font-medium">
                              {user.full_name || "—"}
                            </TableCell>
                            <TableCell className="py-2">{user.email ?? "—"}</TableCell>
                            <TableCell className="py-2 text-muted-foreground">
                              {user.department || "—"}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                className={
                                  STATUS_BADGES[user.status ?? ""] ?? "bg-slate-500 text-white"
                                }
                              >
                                {user.status ?? "UNKNOWN"}
                              </Badge>
                              {isPending && (
                                <div className="mt-0.5 text-[0.625rem] text-amber-700">
                                  Pending approval
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-2">{primary?.role_name ?? "—"}</TableCell>
                            <TableCell className="py-2 text-muted-foreground">
                              {additional.length
                                ? additional.map((r) => r.role_name).join(", ")
                                : "—"}
                            </TableCell>
                            <TableCell className="py-2 text-right font-mono">
                              {!access ? "—" : access.isAdmin ? "All" : access.permissions.length}
                            </TableCell>
                            <TableCell className="py-2 text-muted-foreground">
                              {formatDate(user.last_login)}
                            </TableCell>
                            <TableCell className="space-x-1 whitespace-nowrap py-2 text-right">
                              {busy && <Loader2 className="inline size-3 animate-spin" />}
                              <Can permission="user_management:write">
                                {isPending && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs"
                                      disabled={busy}
                                      onClick={() => approveUser.mutate(user.id)}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs text-destructive"
                                      disabled={busy}
                                      onClick={() => {
                                        if (
                                          confirm(`Reject access for ${user.email ?? "this user"}?`)
                                        ) {
                                          rejectUser.mutate(user.id);
                                        }
                                      }}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {!isPending && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    disabled={busy}
                                    onClick={() =>
                                      updateStatus.mutate({
                                        userId: user.id,
                                        status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                                      })
                                    }
                                  >
                                    {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                                  </Button>
                                )}
                              </Can>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setAccessUserId(user.id)}
                              >
                                View Access
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <UserAccessDialog
          user={accessUser}
          overview={overview ?? null}
          onClose={() => setAccessUserId(null)}
        />
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="border border-border">
      <CardContent className="p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <p className="mt-1 text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

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
          actions: [...actions].sort((a, b) => actionSortIndex(a) - actionSortIndex(b)),
        })),
    }));
}

function UserAccessDialog({
  user,
  overview,
  onClose,
}: {
  user: UserProfile | null;
  overview: RbacSnapshot | null;
  onClose: () => void;
}) {
  const assignRole = useAssignRoleToUser();
  const removeRole = useRemoveRoleFromUser();
  const setPrimary = useSetPrimaryRole();
  const updateStatus = useUpdateUserStatus();
  const [roleToAdd, setRoleToAdd] = useState("");

  const access = user && overview ? resolveAccess(overview, user.id) : null;
  const heldIds = new Set(access?.roles.map((r) => r.id) ?? []);
  const mappedIds = new Set(
    overview?.mappings
      .filter((m) => m.user_id === user?.id && m.is_active !== false)
      .map((m) => m.role_id) ?? [],
  );
  const assignable = (overview?.roles ?? []).filter(
    (r) => r.is_active !== false && !heldIds.has(r.id),
  );
  const grouped = access ? groupEffective(access) : [];
  const busy =
    assignRole.isPending || removeRole.isPending || setPrimary.isPending || updateStatus.isPending;

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user?.full_name || user?.email || "User"} — Access</DialogTitle>
          <DialogDescription>
            {user?.email ?? ""} · Status: {user?.status ?? "UNKNOWN"}
          </DialogDescription>
        </DialogHeader>

        {!overview || !access ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Roles / Access Groups
              </h3>
              {access.roles.length === 0 ? (
                <p className="text-xs text-muted-foreground">No roles assigned — no access.</p>
              ) : (
                <ul className="space-y-1">
                  {access.roles.map((role) => {
                    const isPrimary = role.id === access.primaryRoleId;
                    const viaMapping = mappedIds.has(role.id);
                    return (
                      <li key={role.id} className="flex items-center gap-2">
                        {isPrimary && <Star className="size-3.5 fill-amber-400 text-amber-500" />}
                        <span className="font-medium">{role.role_name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {role.role_code}
                        </span>
                        {isPrimary && <Badge variant="outline">Primary</Badge>}
                        {!viaMapping && (
                          <Badge variant="outline" className="text-[0.625rem]">
                            profile base role
                          </Badge>
                        )}
                        <Can permission="user_management:write">
                          <span className="ml-auto flex gap-1">
                            {!isPrimary && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                disabled={busy}
                                onClick={() =>
                                  setPrimary.mutate({ userId: access.userId, roleId: role.id })
                                }
                              >
                                Make primary
                              </Button>
                            )}
                            {viaMapping && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-destructive"
                                title="Remove role"
                                disabled={busy}
                                onClick={() => {
                                  if (confirm(`Remove ${role.role_name} from this user?`)) {
                                    removeRole.mutate({ userId: access.userId, roleId: role.id });
                                  }
                                }}
                              >
                                <X className="size-3.5" />
                              </Button>
                            )}
                          </span>
                        </Can>
                      </li>
                    );
                  })}
                </ul>
              )}
              {mappedIds.size === 0 && access.roles.length > 0 && (
                <p className="text-[0.6875rem] text-muted-foreground">
                  Access currently comes from the profile base role. Assigning a role replaces it
                  for application access (Administrator is always preserved).
                </p>
              )}
              <Can permission="user_management:write">
                <div className="flex items-center gap-2 pt-1">
                  <Select value={roleToAdd} onValueChange={setRoleToAdd}>
                    <SelectTrigger className="h-8 w-64 text-xs">
                      <SelectValue placeholder="Assign a role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assignable.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="text-xs">
                          {r.role_name} ({r.role_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!roleToAdd || busy}
                    onClick={() => {
                      assignRole.mutate(
                        {
                          userId: access.userId,
                          roleId: roleToAdd,
                          isPrimary: access.roles.length === 0,
                        },
                        { onSuccess: () => setRoleToAdd("") },
                      );
                    }}
                  >
                    Assign Role
                  </Button>
                </div>
              </Can>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Effective Permissions
              </h3>
              {access.blocked ? (
                <p className="text-xs text-amber-700">
                  User is {user?.status}; they hold no access until reactivated.
                </p>
              ) : access.isAdmin ? (
                <p className="text-xs">Administrator — full access to every function.</p>
              ) : grouped.length === 0 ? (
                <p className="text-xs text-muted-foreground">No access.</p>
              ) : (
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
              )}
            </section>

            <Can permission="user_management:write">
              <section className="flex justify-end border-t border-border pt-3">
                <Button
                  size="sm"
                  variant={user?.status === "ACTIVE" ? "destructive" : "default"}
                  disabled={busy || !user}
                  onClick={() =>
                    user &&
                    updateStatus.mutate({
                      userId: user.id,
                      status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    })
                  }
                >
                  {user?.status === "ACTIVE" ? "Deactivate User" : "Activate User"}
                </Button>
              </section>
            </Can>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
