import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  useAllRoles,
  useCreateRole,
  useUpdateRole,
  useSetRoleActive,
} from "@/hooks/useRolesManagement";
import type { RoleDefinition } from "@/lib/validators/auth";
import { useAccessOverview } from "@/hooks/useRolesManagement";
import { ADMIN_ROLE_CODE, summarizeRoles } from "@/services/access";
import { Can } from "@/components/auth";
import { SYSTEM_PERMISSIONS } from "@/lib/access-control";
import { Checkbox } from "@/components/ui/checkbox";
import { requireAuth } from "@/lib/route-guards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit2, Lock, Trash2, Loader2, RotateCcw, KeyRound } from "lucide-react";

export const Route = createFileRoute("/system/roles")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Roles / Access Groups — SCKT ERP" },
      {
        name: "description",
        content: "Manage system roles, define role permissions, and control access levels.",
      },
      { property: "og:title", content: "Roles & Functions — SCKT ERP" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  const { data: rolesData, isLoading: rolesLoading, error: rolesError, refetch } = useAllRoles();
  const roles = rolesData ?? [];
  const { mutate: createRole, isPending: isCreating } = useCreateRole();
  const { mutate: updateRole, isPending: isUpdating } = useUpdateRole();
  const { mutate: setRoleActive, isPending: isTogglingActive } = useSetRoleActive();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleActive, setNewRoleActive] = useState(true);
  const { data: overview, error: overviewError } = useAccessOverview();
  const summaries = useMemo(() => (overview ? summarizeRoles(overview) : null), [overview]);

  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editOrder, setEditOrder] = useState("");

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newRoleName.trim() || !newRoleCode.trim()) {
      toast.error("Role name and code are required");
      return;
    }
    const code = newRoleCode.trim().toLowerCase().replace(/\s+/g, "_");
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      toast.error("Role code must start with a letter and use only letters, numbers and _");
      return;
    }
    if (roles.some((r) => r.role_code.toLowerCase() === code)) {
      toast.error(`Role code "${code}" already exists`);
      return;
    }

    createRole(
      {
        roleName: newRoleName.trim(),
        roleCode: code,
        description: newRoleDesc.trim(),
        isActive: newRoleActive,
      },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          setNewRoleName("");
          setNewRoleCode("");
          setNewRoleDesc("");
          setNewRoleActive(true);
        },
      },
    );
  };

  const openEdit = (role: RoleDefinition) => {
    setEditingRole(role);
    setEditName(role.role_name);
    setEditDesc(role.description ?? "");
    setEditOrder(role.display_order === null ? "" : String(role.display_order));
  };

  const handleUpdateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    if (!editName.trim()) {
      toast.error("Role name is required");
      return;
    }
    const order = editOrder.trim() === "" ? null : Number(editOrder);
    if (order !== null && (!Number.isInteger(order) || order < 0)) {
      toast.error("Display order must be a non-negative whole number");
      return;
    }
    updateRole(
      {
        roleId: editingRole.id,
        updates: {
          role_name: editName.trim(),
          description: editDesc.trim() || null,
          display_order: order,
        },
      },
      { onSuccess: () => setEditingRole(null) },
    );
  };

  const handleDeactivateRole = (roleId: string, roleName: string) => {
    if (confirm(`Are you sure you want to deactivate "${roleName}"?`)) {
      setRoleActive({ roleId, isActive: false });
    }
  };

  const activeRoles = roles.filter((r) => r.is_active);
  const inactiveRoles = roles.filter((r) => !r.is_active);

  return (
    <AppShell
      title="Roles / Access Groups"
      breadcrumb={[{ label: "System", to: "/system" }, { label: "Roles / Access Groups" }]}
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Roles</span>
                <Lock className="size-4 text-purple-600" />
              </div>
              <p className="mt-1 text-lg font-bold">{roles.length}</p>
              <span className="text-[0.6875rem] text-muted-foreground">
                {activeRoles.length} active, {inactiveRoles.length} inactive
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>System Roles</span>
                <Lock className="size-4 text-amber-600" />
              </div>
              <p className="mt-1 text-lg font-bold">{roles.filter((r) => r.is_system).length}</p>
              <span className="text-[0.6875rem] text-muted-foreground">
                Protected from deletion
              </span>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Custom Roles</span>
                <Plus className="size-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-lg font-bold">{roles.filter((r) => !r.is_system).length}</p>
              <span className="text-[0.6875rem] text-muted-foreground">User-created roles</span>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            A Role / Access Group bundles permissions. Users receive the union of the permissions of
            all their active roles. The Administrator role always has full access.
          </p>
          <Can permission={SYSTEM_PERMISSIONS.rolesCreate}>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2" size="sm">
              <Plus className="size-4" /> Create Role / Access Group
            </Button>
          </Can>
        </div>
        {overviewError && (
          <p className="text-xs text-destructive">
            Permission and user counts unavailable: {overviewError.message}
          </p>
        )}

        {/* Roles Table */}
        <Card className="rounded-md border border-border">
          <CardContent className="p-0">
            {rolesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : rolesError ? (
              <div className="space-y-2 py-8 text-center text-sm">
                <p className="text-destructive">Failed to load roles: {rolesError.message}</p>
                <Button size="sm" variant="outline" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="h-8">Role Name</TableHead>
                    <TableHead className="h-8">Code</TableHead>
                    <TableHead className="h-8">Description</TableHead>
                    <TableHead className="h-8">Type</TableHead>
                    <TableHead className="h-8">Status</TableHead>
                    <TableHead className="h-8 text-right">Permissions</TableHead>
                    <TableHead className="h-8 text-right">Users</TableHead>
                    <TableHead className="h-8 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                        No roles configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    roles.map((role) => (
                      <TableRow key={role.id} className="hover:bg-muted/40">
                        <TableCell className="py-2 font-medium">{role.role_name}</TableCell>
                        <TableCell className="py-2 font-mono text-xs">{role.role_code}</TableCell>
                        <TableCell className="py-2 text-muted-foreground max-w-xs truncate">
                          {role.description || "-"}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant={role.is_system ? "outline" : "secondary"}
                            className="text-[0.625rem]"
                          >
                            {role.is_system ? "System" : "Custom"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            className={
                              role.is_active
                                ? "bg-emerald-600 text-white text-[0.625rem]"
                                : "bg-slate-400 text-white text-[0.625rem]"
                            }
                          >
                            {role.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono">
                          {role.role_code.toLowerCase() === ADMIN_ROLE_CODE
                            ? "All"
                            : (summaries?.get(role.id)?.permissionCount ?? "—")}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono">
                          {summaries?.get(role.id)?.userCount ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-right space-x-1 whitespace-nowrap">
                          <Button variant="ghost" size="icon" className="size-6" asChild>
                            <Link
                              to="/system/permission-matrix"
                              search={{ role: role.id }}
                              title="View permissions"
                            >
                              <KeyRound className="size-3.5" />
                            </Link>
                          </Button>
                          <Can permission={SYSTEM_PERMISSIONS.rolesUpdate}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              title="Edit role"
                              onClick={() => openEdit(role)}
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                            {!role.is_system && role.is_active && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-destructive hover:text-destructive"
                                onClick={() => handleDeactivateRole(role.id, role.role_name)}
                                disabled={isTogglingActive}
                                title="Deactivate role"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                            {!role.is_active && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6"
                                onClick={() => setRoleActive({ roleId: role.id, isActive: true })}
                                disabled={isTogglingActive}
                                title="Reactivate role"
                              >
                                <RotateCcw className="size-3.5" />
                              </Button>
                            )}
                          </Can>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Role Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Role / Access Group</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  placeholder="e.g., Store Manager"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role-code">Role Code</Label>
                <Input
                  id="role-code"
                  placeholder="e.g., store_mgr"
                  value={newRoleCode}
                  onChange={(e) => setNewRoleCode(e.target.value)}
                  disabled={isCreating}
                  className="font-mono text-xs"
                />
                <p className="text-[0.6875rem] text-muted-foreground">
                  Stable identifier; it cannot be changed after creation.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="role-desc">Description</Label>
                <Textarea
                  id="role-desc"
                  placeholder="Describe the responsibilities and scope..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  disabled={isCreating}
                  rows={3}
                  className="text-xs"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={newRoleActive}
                  onCheckedChange={(c) => setNewRoleActive(c === true)}
                  disabled={isCreating}
                />
                Active
              </label>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                  Create Role
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Role Dialog */}
        <Dialog open={editingRole !== null} onOpenChange={(open) => !open && setEditingRole(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Role</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div className="space-y-1">
                <Label>Role Code</Label>
                <Input
                  value={editingRole?.role_code ?? ""}
                  disabled
                  className="font-mono text-xs"
                />
                <p className="text-[0.6875rem] text-muted-foreground">
                  Role codes are referenced by permission checks and cannot be changed.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-role-name">Role Name</Label>
                <Input
                  id="edit-role-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isUpdating}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-role-desc">Description</Label>
                <Textarea
                  id="edit-role-desc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  disabled={isUpdating}
                  rows={3}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-role-order">Display Order</Label>
                <Input
                  id="edit-role-order"
                  type="number"
                  min={0}
                  value={editOrder}
                  onChange={(e) => setEditOrder(e.target.value)}
                  disabled={isUpdating}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingRole(null)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
