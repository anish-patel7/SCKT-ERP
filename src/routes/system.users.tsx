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
  useAssignFallbackRolesExplicitly,
  type FallbackAssignment,
} from "@/hooks/useRolesManagement";
import { usePermissions } from "@/hooks/usePermissions";
import { requireAuth } from "@/lib/route-guards";
import {
  resolveAccess,
  type EffectiveAccess,
  type RoleRef,
} from "@/services/access";
import type { UserProfile } from "@/services/users";
import { ManageRolesDialog } from "@/components/users/manage-roles-dialog";
import {
  APPROVE_USERS_PERMISSION,
  CREATE_USERS_PERMISSION,
  EDIT_USERS_PERMISSION,
  MANAGE_ROLES_PERMISSION,
  STATUS_BADGES,
} from "@/components/users/constants";
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
  Shield,
  UserCheck,
  Clock,
  Loader2,
  Info,
  KeyRound,
  AlertTriangle,
  UserPlus,
} from "lucide-react";

export const Route = createFileRoute("/system/users")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Users & Roles — SCKT ERP" },
      {
        name: "description",
        content: "Manage SCKT ERP users and their Roles / Access Groups.",
      },
      { property: "og:title", content: "Users & Roles — SCKT ERP" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: UsersPage,
});

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
    if (overview)
      for (const u of usersData ?? [])
        map.set(u.id, resolveAccess(overview, u.id));
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
  const pendingCount = users.filter(
    (u) => u.approval_status === PENDING_APPROVAL,
  ).length;
  const accessUser = users.find((u) => u.id === accessUserId) ?? null;

  const { can } = usePermissions();
  const canManageRoles = can(MANAGE_ROLES_PERMISSION);
  const canEditUsers = can(EDIT_USERS_PERMISSION);
  const canApproveUsers = can(APPROVE_USERS_PERMISSION);
  const canCreateUsers = can(CREATE_USERS_PERMISSION);
  const assignFallbacks = useAssignFallbackRolesExplicitly();

  // Users whose access comes only from profiles.primary_role_id (no user_roles_mapping rows).
  const fallbackAssignments: FallbackAssignment[] = users.flatMap((u) => {
    const roles = rolesFor(u.id);
    return roles?.fallback && roles.primary
      ? [
          {
            userId: u.id,
            roleId: roles.primary.id,
            label: u.email ?? u.full_name ?? u.id,
          },
        ]
      : [];
  });

  const rowBusy = (userId: string) =>
    (updateStatus.isPending && updateStatus.variables?.userId === userId) ||
    (approveUser.isPending && approveUser.variables === userId) ||
    (rejectUser.isPending && rejectUser.variables === userId);

  return (
    <AppShell
      title="Users & Roles"
      breadcrumb={[
        { label: "System", to: "/system" },
        { label: "Users & Roles" },
      ]}
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
            Access comes only from Roles / Access Groups: a user holds every
            permission of every active role assigned to them. Define roles under{" "}
            <Link
              to="/system/roles"
              className="font-medium text-primary hover:underline"
            >
              Roles / Access Groups
            </Link>
            . New accounts cannot be created from the browser (requires a secure
            server-side Supabase Admin path).
          </p>
          {canCreateUsers && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-8 shrink-0 gap-1 text-xs"
              disabled
              title="Coming soon: requires the secure server-side Admin user creation path"
            >
              <UserPlus className="size-3.5" /> Add User
            </Button>
          )}
        </div>

        {canManageRoles && fallbackAssignments.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 sm:flex-row sm:items-center dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" />
            <p className="flex-1">
              {fallbackAssignments.length} user
              {fallbackAssignments.length === 1 ? " gets" : "s get"} access only
              from the profile fallback role, with no explicit role assignment.
              Assigning explicitly keeps each user&apos;s current role and
              access unchanged.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 text-xs"
              disabled={assignFallbacks.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Assign the current role explicitly (as primary) to ${fallbackAssignments.length} user(s)?\n\n` +
                      fallbackAssignments
                        .map((a) => {
                          const role =
                            rolesFor(a.userId)?.primary?.role_name ?? "";
                          return `• ${a.label} → ${role}`;
                        })
                        .join("\n"),
                  )
                ) {
                  assignFallbacks.mutate(fallbackAssignments);
                }
              }}
            >
              {assignFallbacks.isPending && (
                <Loader2 className="size-3 animate-spin" />
              )}
              Assign roles explicitly ({fallbackAssignments.length})
            </Button>
          </div>
        )}

        {overview && overview.unavailableSources.length > 0 && (
          <p className="text-xs text-amber-700">
            Some role sources could not be read from the database (
            {overview.unavailableSources.join(", ")}); access shown may be
            incomplete.
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
                <p className="text-destructive">
                  Failed to load users: {error.message}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {users.length === 0
                  ? "No users found"
                  : "No users match this filter"}
              </p>
            ) : (
              <>
                {/* Mobile: one card per user so Manage Roles is always within the viewport. */}
                <ul className="divide-y divide-border md:hidden">
                  {filteredUsers.map((user) => {
                    const roles = rolesFor(user.id);
                    return (
                      <li key={user.id} className="space-y-2 p-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium">
                              {user.full_name || "—"}
                            </div>
                            <div className="break-all text-muted-foreground">
                              {user.email ?? "—"}
                            </div>
                          </div>
                          <StatusBadge user={user} />
                        </div>
                        <RoleSummary roles={roles} />
                        {renderActions(user)}
                      </li>
                    );
                  })}
                </ul>

                <div className="hidden overflow-x-auto md:block">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/60">
                        <TableHead className="h-8">Name</TableHead>
                        <TableHead className="h-8">Email</TableHead>
                        <TableHead className="h-8">Status</TableHead>
                        <TableHead className="h-8">Primary Role</TableHead>
                        <TableHead className="h-8">Additional Roles</TableHead>
                        <TableHead className="h-8 text-right">
                          Permissions
                        </TableHead>
                        <TableHead className="h-8">Last Login</TableHead>
                        {/* Pinned so Manage Roles stays visible when the table scrolls sideways. */}
                        <TableHead className="sticky right-0 z-10 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.25)] h-8 bg-muted text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => {
                        const roles = rolesFor(user.id);
                        return (
                          <TableRow key={user.id} className="hover:bg-muted/40">
                            <TableCell className="py-2 font-medium">
                              {user.full_name || "—"}
                              {user.department && (
                                <div className="text-[0.625rem] font-normal text-muted-foreground">
                                  {user.department}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              {user.email ?? "—"}
                            </TableCell>
                            <TableCell className="py-2">
                              <StatusBadge user={user} />
                            </TableCell>
                            <TableCell className="py-2">
                              <PrimaryRole roles={roles} />
                            </TableCell>
                            <TableCell className="py-2 text-muted-foreground">
                              {roles?.additional.length
                                ? roles.additional
                                    .map((r) => r.role_name)
                                    .join(", ")
                                : "—"}
                            </TableCell>
                            <TableCell className="py-2 text-right font-mono">
                              {permissionCount(roles?.access)}
                            </TableCell>
                            <TableCell className="py-2 text-muted-foreground">
                              {formatDate(user.last_login)}
                            </TableCell>
                            <TableCell className="sticky right-0 z-10 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.25)] bg-background py-2">
                              {renderActions(user)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <ManageRolesDialog
          user={accessUser}
          overview={overview ?? null}
          onClose={() => setAccessUserId(null)}
        />
      </div>
    </AppShell>
  );

  function rolesFor(userId: string): UserRoles | undefined {
    const access = accessByUser.get(userId);
    if (!access || !overview) return undefined;
    const explicit = overview.mappings.some(
      (m) => m.user_id === userId && m.is_active !== false,
    );
    return {
      access,
      primary: access.roles.find((r) => r.id === access.primaryRoleId),
      additional: access.roles.filter((r) => r.id !== access.primaryRoleId),
      fallback: !explicit && access.roles.length > 0,
    };
  }

  function renderActions(user: UserProfile) {
    const busy = rowBusy(user.id);
    const isPending = user.approval_status === PENDING_APPROVAL;
    return (
      <div className="flex flex-wrap items-center gap-1 md:justify-end">
        {busy && <Loader2 className="size-3 animate-spin" />}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setAccessUserId(user.id)}
        >
          <KeyRound className="size-3.5" />
          {canManageRoles ? "Manage Roles" : "View Access"}
        </Button>
        {canApproveUsers && isPending && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => approveUser.mutate(user.id)}
            >
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive"
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
        {canEditUsers && !isPending && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
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
      </div>
    );
  }
}

type UserRoles = {
  access: EffectiveAccess;
  primary: RoleRef | undefined;
  additional: RoleRef[];
  /** No explicit user_roles_mapping rows: access comes from profiles.primary_role_id. */
  fallback: boolean;
};

function permissionCount(access: EffectiveAccess | undefined): string | number {
  if (!access) return "—";
  if (access.blocked) return 0;
  return access.isAdmin ? "All" : access.permissions.length;
}

function StatusBadge({ user }: { user: UserProfile }) {
  return (
    <div>
      <Badge
        className={
          STATUS_BADGES[user.status ?? ""] ?? "bg-slate-500 text-white"
        }
      >
        {user.status ?? "UNKNOWN"}
      </Badge>
      {user.approval_status === PENDING_APPROVAL && (
        <div className="mt-0.5 text-[0.625rem] text-amber-700">
          Pending approval
        </div>
      )}
    </div>
  );
}

function PrimaryRole({ roles }: { roles: UserRoles | undefined }) {
  if (!roles?.primary) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {roles.primary.role_name}
      {roles.fallback && (
        <span
          className="ml-1 text-[0.625rem] text-amber-700"
          title="No explicit role assignment; access comes from the profile base role"
        >
          (profile fallback)
        </span>
      )}
    </span>
  );
}

function RoleSummary({ roles }: { roles: UserRoles | undefined }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
      <dt className="text-muted-foreground">Primary</dt>
      <dd>
        <PrimaryRole roles={roles} />
      </dd>
      <dt className="text-muted-foreground">Additional</dt>
      <dd>
        {roles?.additional.length
          ? roles.additional.map((r) => r.role_name).join(", ")
          : "—"}
      </dd>
      <dt className="text-muted-foreground">Permissions</dt>
      <dd className="font-mono">{permissionCount(roles?.access)}</dd>
    </dl>
  );
}

function Kpi({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
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
