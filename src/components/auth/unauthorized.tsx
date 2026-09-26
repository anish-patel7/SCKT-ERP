import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnauthorizedProps {
  requiredRole?: string;
  requiredPermission?: string;
  title?: string;
  description?: string;
}

/**
 * Component displayed when user doesn't have required permissions
 */
export function Unauthorized({
  requiredRole,
  requiredPermission,
  title = "Access Denied",
  description,
}: UnauthorizedProps) {
  const defaultDescription =
    description ||
    (requiredRole
      ? `You need the ${requiredRole} role to access this page.`
      : requiredPermission
        ? `You don't have permission to access this page.`
        : "You don't have permission to access this resource.");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="flex justify-center">
          <ShieldAlert className="h-16 w-16 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{defaultDescription}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link to="/">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading component for permission checks
 */
export function PermissionLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin">
          <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto" />
        </div>
        <p className="text-sm text-muted-foreground">Checking permissions...</p>
      </div>
    </div>
  );
}
