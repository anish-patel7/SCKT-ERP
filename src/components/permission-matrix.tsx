import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface PermissionMatrixProps {
  permissions: Record<string, Array<{ id: string; permission_code: string; action: string }>>;
  selectedPermissionIds: Set<string>;
  onPermissionToggle: (permissionId: string, enabled: boolean) => void;
  isLoading?: boolean;
  readOnly?: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  read: "bg-blue-100 text-blue-800",
  write: "bg-green-100 text-green-800",
  create: "bg-green-100 text-green-800",
  update: "bg-yellow-100 text-yellow-800",
  delete: "bg-red-100 text-red-800",
  approve: "bg-purple-100 text-purple-800",
  export: "bg-cyan-100 text-cyan-800",
  print: "bg-indigo-100 text-indigo-800",
};

export function PermissionMatrix({
  permissions,
  selectedPermissionIds,
  onPermissionToggle,
  isLoading = false,
  readOnly = false,
}: PermissionMatrixProps) {
  const modules = useMemo(() => Object.keys(permissions).sort(), [permissions]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading permissions...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {modules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No permissions available
          </CardContent>
        </Card>
      ) : (
        modules.map((module) => {
          const modulePermissions = permissions[module] || [];
          const moduleGrantedCount = modulePermissions.filter((p) =>
            selectedPermissionIds.has(p.id),
          ).length;

          return (
            <Card key={module} className="rounded-md border border-border">
              <CardHeader className="py-2.5 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold capitalize">
                    {module.replace(/_/g, " ")}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {moduleGrantedCount}/{modulePermissions.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4">
                  {modulePermissions.map((permission) => {
                    const isGranted = selectedPermissionIds.has(permission.id);
                    const actionColor =
                      ACTION_COLORS[permission.action.toLowerCase()] ||
                      "bg-gray-100 text-gray-800";

                    return (
                      <div key={permission.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={permission.id}
                          checked={isGranted}
                          onCheckedChange={(checked) =>
                            !readOnly && onPermissionToggle(permission.id, checked as boolean)
                          }
                          disabled={readOnly}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={permission.id}
                          className="flex-1 cursor-pointer text-xs leading-tight"
                        >
                          <div className="font-medium text-foreground">
                            {permission.permission_code.split(":")[1] || permission.permission_code}
                          </div>
                          <Badge className={`text-[0.625rem] mt-0.5 ${actionColor}`}>
                            {permission.action}
                          </Badge>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

export default PermissionMatrix;
