import { SYSTEM_PERMISSIONS } from "@/lib/access-control";

/** Role assignment (enforced by RLS on user_roles_mapping). */
export const MANAGE_ROLES_PERMISSION = SYSTEM_PERMISSIONS.usersAssignRole;
/** Activate / deactivate and edit profile details (enforced by the profiles guard trigger). */
export const EDIT_USERS_PERMISSION = SYSTEM_PERMISSIONS.usersUpdate;
/** Approve / reject registration requests (enforced by the profiles guard trigger). */
export const APPROVE_USERS_PERMISSION = SYSTEM_PERMISSIONS.usersApprove;
/** Future server-side Admin "Add User" action. */
export const CREATE_USERS_PERMISSION = SYSTEM_PERMISSIONS.usersCreate;

export const STATUS_BADGES: Record<string, string> = {
  ACTIVE: "bg-emerald-600 text-white",
  INACTIVE: "bg-slate-500 text-white",
  SUSPENDED: "bg-rose-600 text-white",
  LOCKED: "bg-orange-600 text-white",
};
