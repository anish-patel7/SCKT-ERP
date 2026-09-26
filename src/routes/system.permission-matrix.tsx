import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { useAllRoles } from "@/hooks/useRolesManagement";
import {
  usePermissions as usePermissionCatalog,
  useRolePermissions,
  useUpdateRolePermissions,
} from "@/hooks/usePermissionsManagement";
import { usePermissions } from "@/hooks/usePermissions";
import { requireAuth } from "@/lib/route-guards";
import { actionLabel, actionSortIndex, groupSortIndex, moduleLabel } from "@/lib/access-control";
import { ADMIN_ROLE_CODE } from "@/services/access";
import type { Permission } from "@/lib/validators/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Lock, RotateCcw, Save, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/system/permission-matrix")({
  validateSearch: z.object({ role: z.string().uuid().optional() }),
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Permission Matrix — SCKT ERP" },
      {
        name: "description",
        content: "Grant module and action permissions to each Role / Access Group.",
      },
      { property: "og:title", content: "Permission Matrix — SCKT ERP" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PermissionMatrixPage,
});

type ResourceRow = { module: string; resource: string; byAction: Map<string, Permission> };
type ModuleGroup = { group: string; rows: ResourceRow[] };

function buildMatrix(permissions: Permission[]): { groups: ModuleGroup[]; actions: string[] } {
  const actions = [...new Set(permissions.map((p) => p.action))].sort(
    (a, b) => actionSortIndex(a) - actionSortIndex(b) || a.localeCompare(b),
  );
  const rows = new Map<string, ResourceRow & { group: string }>();
  for (const perm of permissions) {
    const { group, resource } = moduleLabel(perm.module);
    let row = rows.get(perm.module);
    if (!row) {
      row = { group, module: perm.module, resource, byAction: new Map() };
      rows.set(perm.module, row);
    }
    row.byAction.set(perm.action, perm);
  }
  const groups = new Map<string, ResourceRow[]>();
  for (const row of rows.values()) {
    const list = groups.get(row.group) ?? [];
    list.push(row);
    groups.set(row.group, list);
  }
  return {
    actions,
    groups: [...groups.entries()]
      .sort(([a], [b]) => groupSortIndex(a) - groupSortIndex(b) || a.localeCompare(b))
      .map(([group, list]) => ({
        group,
        rows: list.sort((a, b) => a.resource.localeCompare(b.resource)),
      })),
  };
}

function PermissionMatrixPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { can } = usePermissions();
  const canEdit = can("user_management:write");

  const { data: rolesData, isLoading: rolesLoading, error: rolesError } = useAllRoles();
  const roles = rolesData ?? [];
  const {
    data: catalogData,
    isLoading: catalogLoading,
    error: catalogError,
  } = usePermissionCatalog();
  const selectedRoleId = search.role ?? roles.find((r) => r.is_active)?.id ?? "";
  const {
    data: assignedData,
    isLoading: assignedLoading,
    error: assignedError,
  } = useRolePermissions(selectedRoleId);
  const { mutate: savePermissions, isPending: isSaving } = useUpdateRolePermissions();

  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPending(new Set((assignedData ?? []).map((p) => p.id)));
  }, [assignedData]);

  const { groups, actions } = useMemo(() => buildMatrix(catalogData ?? []), [catalogData]);
  const currentRole = roles.find((r) => r.id === selectedRoleId);
  const isAdminRole = currentRole?.role_code.toLowerCase() === ADMIN_ROLE_CODE;
  const editable = canEdit && !!currentRole && !isAdminRole;
  const loadError = rolesError ?? catalogError ?? assignedError;

  const assignedIds = useMemo(() => new Set((assignedData ?? []).map((p) => p.id)), [assignedData]);
  const added = [...pending].filter((id) => !assignedIds.has(id));
  const removed = [...assignedIds].filter((id) => !pending.has(id));
  const dirty = added.length > 0 || removed.length > 0;

  const setMany = (ids: string[], checked: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const selectRole = (roleId: string) => {
    if (dirty && !confirm("Discard unsaved permission changes?")) return;
    void navigate({ search: { role: roleId } });
  };

  const handleSave = () => {
    if (!currentRole) return;
    savePermissions({ roleId: currentRole.id, permissionIds: [...pending] });
  };

  return (
    <AppShell
      title="Permission Matrix"
      breadcrumb={[{ label: "System", to: "/system" }, { label: "Permission Matrix" }]}
    >
      <div className="space-y-4">
        <Card className="border border-border">
          <CardHeader className="py-2.5">
            <CardTitle className="text-sm">Role / Access Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <Select value={selectedRoleId} onValueChange={selectRole}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Choose a role..." />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <span className="flex items-center gap-2">
                      {role.role_name}
                      {role.is_system && <Lock className="size-3 text-amber-600" />}
                      {!role.is_active && (
                        <span className="text-xs text-muted-foreground">(inactive)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentRole && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono">
                  {currentRole.role_code}
                </Badge>
                {currentRole.is_system && <Badge variant="outline">System role</Badge>}
                {!currentRole.is_active && (
                  <Badge variant="outline" className="text-amber-700">
                    Inactive — grants no permissions until reactivated
                  </Badge>
                )}
                <Badge className="bg-blue-600 text-white">
                  {isAdminRole ? "All permissions" : `${pending.size} permissions selected`}
                </Badge>
                {dirty && (
                  <Badge className="bg-amber-500 text-black">
                    Unsaved: +{added.length} / −{removed.length}
                  </Badge>
                )}
              </div>
            )}
            {isAdminRole && (
              <p className="text-xs text-muted-foreground">
                The Administrator role always has every permission and cannot be restricted.
              </p>
            )}
            {!canEdit && (
              <p className="text-xs text-muted-foreground">
                You can view this matrix but not change it (requires user_management:write).
              </p>
            )}
          </CardContent>
        </Card>

        {loadError ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-destructive">
              Failed to load permission data: {loadError.message}
            </CardContent>
          </Card>
        ) : rolesLoading || catalogLoading || (selectedRoleId && assignedLoading) ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading permissions...</span>
            </CardContent>
          </Card>
        ) : roles.length === 0 ? (
          <EmptyCard text="No roles are configured." />
        ) : groups.length === 0 ? (
          <EmptyCard text="No permissions are defined in the system." />
        ) : (
          groups.map(({ group, rows }) => {
            const groupIds = rows.flatMap((r) => [...r.byAction.values()].map((p) => p.id));
            const viewIds = rows.flatMap((r) => {
              const view = r.byAction.get("read");
              return view ? [view.id] : [];
            });
            return (
              <Card key={group} className="rounded-md border border-border">
                <CardHeader className="flex flex-row items-center justify-between gap-2 bg-muted/30 px-4 py-2.5">
                  <CardTitle className="text-sm font-semibold">{group}</CardTitle>
                  {editable && (
                    <div className="flex gap-1">
                      {viewIds.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => setMany(viewIds, true)}
                        >
                          Select all VIEW
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={() => setMany(groupIds, false)}
                      >
                        Clear module
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8">Resource / Function</TableHead>
                        {actions.map((a) => (
                          <TableHead key={a} className="h-8 text-center">
                            {actionLabel(a)}
                          </TableHead>
                        ))}
                        {editable && <TableHead className="h-8 text-right">Row</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const rowIds = [...row.byAction.values()].map((p) => p.id);
                        return (
                          <TableRow key={row.module}>
                            <TableCell className="py-1.5">
                              <div className="font-medium">{row.resource}</div>
                              <div className="font-mono text-[0.625rem] text-muted-foreground">
                                {row.module}
                              </div>
                            </TableCell>
                            {actions.map((a) => {
                              const perm = row.byAction.get(a);
                              if (!perm) {
                                return (
                                  <TableCell
                                    key={a}
                                    className="py-1.5 text-center text-muted-foreground"
                                  >
                                    –
                                  </TableCell>
                                );
                              }
                              const checked = isAdminRole || pending.has(perm.id);
                              return (
                                <TableCell key={a} className="py-1.5 text-center">
                                  <Checkbox
                                    checked={checked}
                                    disabled={!editable}
                                    title={`${perm.permission_code} — ${perm.permission_name}`}
                                    aria-label={perm.permission_code}
                                    onCheckedChange={(c) => setMany([perm.id], c === true)}
                                  />
                                </TableCell>
                              );
                            })}
                            {editable && (
                              <TableCell className="py-1.5 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-xs"
                                  onClick={() => setMany(rowIds, true)}
                                >
                                  All
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })
        )}

        {editable && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 py-3">
            <p className="mr-auto flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
              <TriangleAlert className="size-3.5" />
              Saves apply grants first, then revokes; the backend has no atomic replace.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty || isSaving}
              onClick={() => setPending(new Set(assignedIds))}
              className="gap-1"
            >
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || isSaving} className="gap-1">
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save Permissions
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
