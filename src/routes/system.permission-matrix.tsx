import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PermissionMatrixGrid } from "@/components/permissions/permission-matrix-grid";
import { useAccessOverview, useAllRoles } from "@/hooks/useRolesManagement";
import {
  usePermissions as usePermissionCatalog,
  useRolePermissions,
  useUpdateRolePermissions,
} from "@/hooks/usePermissionsManagement";
import { usePermissions } from "@/hooks/usePermissions";
import { requireAuth } from "@/lib/route-guards";
import { SYSTEM_PERMISSIONS } from "@/lib/access-control";
import { buildPermissionMatrix, countGranted, diffGrants, withIds } from "@/lib/permission-matrix";
import { ADMIN_ROLE_CODE, summarizeRoles } from "@/services/access";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

const DISCARD_PROMPT = "Discard unsaved permission changes?";

function PermissionMatrixPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { can } = usePermissions();
  const canEdit = can(SYSTEM_PERMISSIONS.rolesAssignPermissions);

  const roles = useAllRoles();
  const catalog = usePermissionCatalog();
  const { data: overview } = useAccessOverview();
  const summaries = useMemo(() => (overview ? summarizeRoles(overview) : null), [overview]);
  const roleList = roles.data ?? [];
  const selectedRoleId = search.role ?? roleList.find((r) => r.is_active)?.id ?? "";
  const assigned = useRolePermissions(selectedRoleId);
  const { mutate: savePermissions, isPending: isSaving } = useUpdateRolePermissions();

  // Draft edits for one role; null means "no edits" so background refetches never
  // overwrite unsaved changes.
  const [draft, setDraft] = useState<{
    roleId: string;
    ids: Set<string>;
  } | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);

  const permissions = useMemo(() => catalog.data ?? [], [catalog.data]);
  const model = useMemo(
    () => buildPermissionMatrix(permissions, { includeDeprecated: showLegacy }),
    [permissions, showLegacy],
  );
  const currentRole = roleList.find((r) => r.id === selectedRoleId);
  const isAdminRole = currentRole?.role_code.toLowerCase() === ADMIN_ROLE_CODE;
  const editable = canEdit && !!currentRole && !isAdminRole;

  const savedIds = useMemo(() => new Set((assigned.data ?? []).map((p) => p.id)), [assigned.data]);
  const pending = draft?.roleId === selectedRoleId ? draft.ids : savedIds;
  const { added, removed } = diffGrants(savedIds, pending);
  const dirty = added.length > 0 || removed.length > 0;

  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirty && current.pathname !== next.pathname && !confirm(DISCARD_PROMPT),
    enableBeforeUnload: () => dirty,
  });

  const change = (ids: string[], granted: boolean) =>
    setDraft({ roleId: selectedRoleId, ids: withIds(pending, ids, granted) });

  const selectRole = (roleId: string) => {
    if (roleId === selectedRoleId) return;
    if (dirty && !confirm(DISCARD_PROMPT)) return;
    setDraft(null);
    void navigate({ search: { role: roleId } });
  };

  const save = () => {
    if (!currentRole) return;
    savePermissions(
      { roleId: currentRole.id, permissionIds: [...pending] },
      { onSuccess: () => setDraft(null) },
    );
  };

  const loadError = roles.error ?? catalog.error ?? assigned.error;
  const loading = roles.isLoading || catalog.isLoading || (!!selectedRoleId && assigned.isLoading);
  const grantedCount = countGranted(permissions, pending);

  return (
    <AppShell
      title="Permission Matrix"
      breadcrumb={[{ label: "System", to: "/system" }, { label: "Permission Matrix" }]}
    >
      {/* Capped so wide screens do not stretch the gap between resource names and actions. */}
      <div className="max-w-6xl space-y-4">
        <Card className="border border-border">
          <CardContent className="space-y-3 p-3 sm:p-4">
            <label className="text-xs font-semibold" htmlFor="pm-role">
              Role / Access Group
            </label>
            <Select value={selectedRoleId} onValueChange={selectRole}>
              <SelectTrigger id="pm-role" className="w-full sm:max-w-md">
                <SelectValue placeholder="Choose a role..." />
              </SelectTrigger>
              <SelectContent>
                {roleList.map((role) => {
                  const admin = role.role_code.toLowerCase() === ADMIN_ROLE_CODE;
                  const count = admin ? "All" : summaries?.get(role.id)?.permissionCount;
                  return (
                    <SelectItem key={role.id} value={role.id}>
                      <span className="flex items-center gap-2">
                        {role.role_name}
                        <span className="font-mono text-[0.625rem] text-muted-foreground">
                          {role.role_code}
                        </span>
                        {role.is_system && <Lock className="size-3 text-amber-600" />}
                        {!role.is_active && (
                          <span className="text-xs text-muted-foreground">(inactive)</span>
                        )}
                        {count !== undefined && (
                          <span className="text-[0.625rem] text-muted-foreground">· {count}</span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {currentRole && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono">
                  {currentRole.role_code}
                </Badge>
                <Badge variant={currentRole.is_system ? "outline" : "secondary"}>
                  {currentRole.is_system ? "System role" : "Custom role"}
                </Badge>
                <Badge
                  className={
                    currentRole.is_active ? "bg-emerald-600 text-white" : "bg-slate-400 text-white"
                  }
                >
                  {currentRole.is_active ? "Active" : "Inactive"}
                </Badge>
                {isAdminRole && <Badge variant="outline">Protected role</Badge>}
                <Badge className="bg-blue-600 text-white">
                  {isAdminRole ? "All permissions" : `${grantedCount} permissions`}
                </Badge>
                {dirty && (
                  <Badge className="bg-amber-500 text-black">
                    Unsaved changes: +{added.length} / −{removed.length}
                  </Badge>
                )}
              </div>
            )}
            {isAdminRole && (
              <p className="text-xs text-muted-foreground">
                The Administrator role always holds every permission, including ones added later,
                and cannot be restricted here.
              </p>
            )}
            {currentRole && !currentRole.is_active && (
              <p className="text-xs text-amber-700">
                This role is inactive and grants no permissions until reactivated.
              </p>
            )}
            {!canEdit && (
              <p className="text-xs text-muted-foreground">
                View only — changing role permissions requires{" "}
                <span className="font-mono">{SYSTEM_PERMISSIONS.rolesAssignPermissions}</span>.
              </p>
            )}
          </CardContent>
        </Card>

        {loadError ? (
          <StateCard tone="error">Unable to load permissions: {loadError.message}</StateCard>
        ) : loading ? (
          <StateCard>
            <Loader2 className="mr-2 inline size-4 animate-spin" />
            Loading permission matrix...
          </StateCard>
        ) : roleList.length === 0 ? (
          <StateCard>No roles are configured.</StateCard>
        ) : !currentRole ? (
          <StateCard>Choose a role to view its permissions.</StateCard>
        ) : permissions.length === 0 ? (
          <StateCard>No permission definitions found.</StateCard>
        ) : (
          <>
            <MatrixToolbar
              hiddenLegacy={model.hiddenDeprecated.length}
              showLegacy={showLegacy}
              onShowLegacy={setShowLegacy}
            />
            <PermissionMatrixGrid
              model={model}
              granted={pending}
              allGranted={isAdminRole}
              editable={editable}
              onChange={change}
            />
          </>
        )}

        {editable && (
          <div className="sticky bottom-0 z-40 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
            <p className="mr-auto flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
              <TriangleAlert className="size-3.5 shrink-0" />
              {dirty
                ? "Unsaved changes. Grants are applied before revokes (not atomic); a failure reloads the saved state."
                : "No unsaved changes."}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty || isSaving}
              onClick={() => setDraft(null)}
              className="gap-1"
            >
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || isSaving} className="gap-1">
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function MatrixToolbar({
  hiddenLegacy,
  showLegacy,
  onShowLegacy,
}: {
  hiddenLegacy: number;
  showLegacy: boolean;
  onShowLegacy: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] text-muted-foreground">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1">
          <Checkbox checked disabled aria-hidden className="size-3.5" /> granted
        </span>
        <span className="flex items-center gap-1">
          <Checkbox checked={false} disabled aria-hidden className="size-3.5" /> not granted
        </span>
        <span>
          <span className="mr-1 text-muted-foreground/60">—</span>action does not exist
        </span>
      </div>
      {(hiddenLegacy > 0 || showLegacy) && (
        <label className="flex cursor-pointer items-center gap-1.5">
          <Checkbox checked={showLegacy} onCheckedChange={(c) => onShowLegacy(c === true)} />
          Show legacy duplicates{hiddenLegacy > 0 ? ` (${hiddenLegacy})` : ""}
        </label>
      )}
    </div>
  );
}

function StateCard({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <Card>
      <CardContent
        className={
          tone === "error"
            ? "py-8 text-center text-sm text-destructive"
            : "py-8 text-center text-sm text-muted-foreground"
        }
      >
        {children}
      </CardContent>
    </Card>
  );
}
