import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/route-guards";
import { accessRequirementFor } from "@/lib/access-control";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Shield, Lock, Settings, FileText, Database, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/system/")({
  beforeLoad: async () => {
    await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "System Administration — SCKT ERP" },
      {
        name: "description",
        content:
          "System administration panel for user management, roles, permissions, and settings.",
      },
      { property: "og:title", content: "System Administration — SCKT ERP" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SystemPage,
});

const SYSTEM_MODULES = [
  {
    id: "users",
    title: "Users & Roles",
    description: "Manage users and assign roles for system access control",
    icon: Users,
    to: "/system/users",
    badge: "Active",
  },
  {
    id: "roles",
    title: "Roles & Functions",
    description: "Define roles and manage role configurations",
    icon: Shield,
    to: "/system/roles",
    badge: "Active",
  },
  {
    id: "permissions",
    title: "Permission Matrix",
    description: "Configure granular permissions for each role across all modules",
    icon: Lock,
    to: "/system/permission-matrix",
    badge: "Active",
  },
  {
    id: "settings",
    title: "Settings",
    description: "System settings, constants, and configuration",
    icon: Settings,
    to: "/system/settings",
    badge: "Active",
  },
  {
    id: "audit",
    title: "Audit History",
    description: "View system audit logs and activity trails",
    icon: FileText,
    to: "/system/audit",
    badge: "Active",
  },
  {
    id: "backup",
    title: "Backup & Restore",
    description: "Manage system backups and data restoration",
    icon: Database,
    to: "/system/backup",
    badge: "Phase 2",
  },
  {
    id: "whatsapp",
    title: "WhatsApp Bot",
    description: "Configure WhatsApp integration and messaging",
    icon: MessageCircle,
    to: "/system/whatsapp",
    badge: "Active",
  },
];

function SystemPage() {
  const { canAny } = usePermissions();
  const visibleModules = SYSTEM_MODULES.filter((m) => {
    const requirement = accessRequirementFor(m.to);
    return requirement === null || canAny(requirement.anyOf);
  });
  return (
    <AppShell title="System Administration" breadcrumb={[{ label: "System", to: "/system" }]}>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage system-wide settings, users, roles, and permissions. These administrative tools
            control access and configuration for the entire SCKT ERP system.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((module) => {
            const Icon = module.icon;
            const isDeferred = module.badge === "Phase 2";

            return (
              <Link key={module.id} to={module.to}>
                <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{module.title}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {module.description}
                        </CardDescription>
                      </div>
                      <Icon className="size-5 text-muted-foreground ml-2 flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[0.7rem] font-semibold px-2 py-1 rounded ${
                          isDeferred
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                        }`}
                      >
                        {module.badge}
                      </span>
                      {isDeferred && (
                        <span className="text-[0.65rem] text-muted-foreground">Coming soon</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
