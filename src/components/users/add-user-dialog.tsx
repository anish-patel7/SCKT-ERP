import { useState } from "react";
import { useCreateUser } from "@/hooks/useUsersManagement";
import { usePermissions } from "@/hooks/usePermissions";
import { useAllRoles } from "@/hooks/useRolesManagement";
import { UnauthorizedError, UserFieldError } from "@/services/users";
import {
  CreateUserInputSchema,
  type CreateUserInput,
  type CreatedUser,
} from "@/lib/validators/admin-users";
import { APPROVE_USERS_PERMISSION, MANAGE_ROLES_PERMISSION } from "@/components/users/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { generatePassword } from "@/lib/passwords";

const NO_ROLE = "__none__";

type FormState = {
  email: string;
  full_name: string;
  password: string;
  employee_id: string;
  department: string;
  designation: string;
  mobile: string;
  primaryRoleId: string;
  additionalRoleIds: string[];
};

const EMPTY: FormState = {
  email: "",
  full_name: "",
  password: "",
  employee_id: "",
  department: "",
  designation: "",
  mobile: "",
  primaryRoleId: NO_ROLE,
  additionalRoleIds: [],
};

export function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { can } = usePermissions();
  const canAssignRoles = can(MANAGE_ROLES_PERMISSION);
  const canApprove = can(APPROVE_USERS_PERMISSION);
  const { data: roleData } = useAllRoles();
  const roles = (roleData ?? []).filter((r) => r.is_active);
  const createUser = useCreateUser();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState<{ user: CreatedUser; password: string } | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
  };

  const close = () => {
    if (createUser.isPending) return;
    setForm(EMPTY);
    setErrors({});
    setCreated(null);
    setShowPassword(false);
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const roleIds =
      canAssignRoles && form.primaryRoleId !== NO_ROLE
        ? [form.primaryRoleId, ...form.additionalRoleIds.filter((id) => id !== form.primaryRoleId)]
        : [];
    const input: CreateUserInput = {
      email: form.email,
      full_name: form.full_name,
      password: form.password,
      employee_id: form.employee_id,
      department: form.department,
      designation: form.designation,
      mobile: form.mobile,
      role_ids: roleIds,
    };
    const parsed = CreateUserInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    createUser.mutate(input, {
      onSuccess: (user) => setCreated({ user, password: form.password }),
      onError: (error) => {
        if (error instanceof UserFieldError) {
          setErrors({ [error.field]: error.message });
        } else if (error instanceof UnauthorizedError) {
          setErrors({ form: error.message });
        } else {
          setErrors({ form: error instanceof Error ? error.message : "User creation failed" });
        }
      },
    });
  };

  const copyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied");
    } catch {
      toast.error("Could not copy; select the password and copy it manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{created ? "User created" : "Add User"}</DialogTitle>
          <DialogDescription>
            {created
              ? "Share the sign-in details with the user through a secure channel."
              : "Creates a sign-in account. The user must set a new password at first sign-in."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all font-medium">{created.user.email}</dd>
              <dt className="text-muted-foreground">Initial password</dt>
              <dd className="flex items-center gap-2">
                <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {created.password}
                </code>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  aria-label="Copy password"
                  onClick={() => void copyPassword(created.password)}
                >
                  <Copy className="size-3.5" />
                </Button>
              </dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {created.user.approval_status === "PENDING_APPROVAL"
                  ? "Pending approval — cannot sign in until approved"
                  : "Active"}
              </dd>
            </dl>
            <p className="text-xs text-muted-foreground">
              This password is shown only now and is not stored in the app.
            </p>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <Field id="au-name" label="Full name *" error={errors["full_name"]}>
              <Input
                id="au-name"
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field id="au-email" label="Email *" error={errors["email"]}>
              <Input
                id="au-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field id="au-password" label="Initial password *" error={errors["password"]}>
              <div className="flex gap-1">
                <Input
                  id="au-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete="new-password"
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 gap-1 text-xs"
                  onClick={() => {
                    set("password", generatePassword());
                    setShowPassword(true);
                  }}
                >
                  <RefreshCw className="size-3.5" /> Generate
                </Button>
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="au-emp" label="Employee ID" error={errors["employee_id"]}>
                <Input
                  id="au-emp"
                  value={form.employee_id}
                  onChange={(e) => set("employee_id", e.target.value)}
                />
              </Field>
              <Field id="au-mobile" label="Mobile" error={errors["mobile"]}>
                <Input
                  id="au-mobile"
                  value={form.mobile}
                  onChange={(e) => set("mobile", e.target.value)}
                />
              </Field>
              <Field id="au-dept" label="Department" error={errors["department"]}>
                <Input
                  id="au-dept"
                  value={form.department}
                  onChange={(e) => set("department", e.target.value)}
                />
              </Field>
              <Field id="au-desig" label="Designation" error={errors["designation"]}>
                <Input
                  id="au-desig"
                  value={form.designation}
                  onChange={(e) => set("designation", e.target.value)}
                />
              </Field>
            </div>

            {canAssignRoles ? (
              <div className="space-y-2">
                <Field id="au-role" label="Primary role" error={errors["role_ids"]}>
                  <Select value={form.primaryRoleId} onValueChange={(v) => set("primaryRoleId", v)}>
                    <SelectTrigger id="au-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ROLE}>No role yet (Viewer fallback)</SelectItem>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.role_name} ({r.role_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {form.primaryRoleId !== NO_ROLE && roles.length > 1 && (
                  <fieldset className="space-y-1">
                    <legend className="text-xs font-medium">Additional roles</legend>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {roles
                        .filter((r) => r.id !== form.primaryRoleId)
                        .map((r) => (
                          <label key={r.id} className="flex min-h-8 items-center gap-2 text-xs">
                            <Checkbox
                              checked={form.additionalRoleIds.includes(r.id)}
                              onCheckedChange={(c) =>
                                set(
                                  "additionalRoleIds",
                                  c === true
                                    ? [...form.additionalRoleIds, r.id]
                                    : form.additionalRoleIds.filter((id) => id !== r.id),
                                )
                              }
                            />
                            {r.role_name}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                You cannot assign roles. The new user gets Viewer access until someone with
                role-assignment rights assigns a role.
              </p>
            )}

            {!canApprove && (
              <p className="text-xs text-amber-700">
                You cannot approve users, so the account is created pending approval and cannot sign
                in until approved.
              </p>
            )}
            {errors["form"] && (
              <p role="alert" className="text-xs text-destructive">
                {errors["form"]}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={createUser.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending} className="gap-1">
                {createUser.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
