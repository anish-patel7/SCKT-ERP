import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

type CanProps = {
  children: ReactNode;
  fallback?: ReactNode;
} & ({ permission: string; anyOf?: never } | { anyOf: readonly string[]; permission?: never });

/** Renders children only when the current user holds the permission (or any of them). */
export function Can({ children, fallback = null, permission, anyOf }: CanProps) {
  const { canAny, isLoading } = usePermissions();
  const codes = permission !== undefined ? [permission] : anyOf;
  if (isLoading || !canAny(codes)) return <>{fallback}</>;
  return <>{children}</>;
}

export function NoPermission({ action = "use this function" }: { action?: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      You don't have permission to {action}. Ask an administrator to add it to one of your Roles /
      Access Groups.
    </div>
  );
}
