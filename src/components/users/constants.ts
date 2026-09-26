/** Permission code controlling role assignment (enforced by RLS on user_roles_mapping). */
export const MANAGE_ROLES_PERMISSION = "user_management:write";

export const STATUS_BADGES: Record<string, string> = {
  ACTIVE: "bg-emerald-600 text-white",
  INACTIVE: "bg-slate-500 text-white",
  SUSPENDED: "bg-rose-600 text-white",
  LOCKED: "bg-orange-600 text-white",
};
