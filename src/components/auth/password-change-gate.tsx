import { useState } from "react";
import { useChangeOwnPassword, useCurrentUser } from "@/hooks/useUsersManagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { validateNewPassword } from "@/lib/passwords";

/**
 * Accounts created by an administrator start with require_password_change = true: the
 * user must replace the administrator-chosen password before using the application.
 */
export function PasswordChangeGate() {
  const { data: profile } = useCurrentUser();
  const changePassword = useChangeOwnPassword();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (profile?.require_password_change !== true) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    setError(problem);
    if (!problem) changePassword.mutate(password);
  };

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-sm [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Set a new password</DialogTitle>
          <DialogDescription>
            Your account was created by an administrator. Choose your own password to continue.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-1">
            <Label htmlFor="pcg-new" className="text-xs">
              New password
            </Label>
            <Input
              id="pcg-new"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pcg-confirm" className="text-xs">
              Confirm new password
            </Label>
            <Input
              id="pcg-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full gap-1" disabled={changePassword.isPending}>
            {changePassword.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save new password
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
