// WeaveOne WhatsApp RBAC & Permission Layer (Section 19 & 20 of Spec)
import type { CommandCategory, UserRole, WhatsAppUser } from "./types";

export const ROLE_PERMISSIONS: Record<UserRole, CommandCategory[]> = {
  admin: [
    "MENU",
    "STOCK",
    "PRODUCTION",
    "LOOM",
    "JOBWORK",
    "PARTY",
    "ORDER",
    "DISPATCH",
    "PURCHASE",
    "QUALITY",
    "REPORTS",
    "SUMMARY",
  ],
  management: [
    "MENU",
    "STOCK",
    "PRODUCTION",
    "LOOM",
    "JOBWORK",
    "PARTY",
    "ORDER",
    "DISPATCH",
    "PURCHASE",
    "QUALITY",
    "REPORTS",
    "SUMMARY",
  ],
  costing: ["MENU", "STOCK", "REPORTS"],
  approver: ["MENU", "STOCK", "ORDER", "REPORTS", "SUMMARY"],
  designer: ["MENU", "STOCK"],
  planner: ["MENU", "STOCK", "PRODUCTION", "LOOM", "JOBWORK", "ORDER"],
  operator: ["MENU", "PRODUCTION", "LOOM"],
  beam: ["MENU", "PRODUCTION", "LOOM"],
  store: ["MENU", "STOCK", "PURCHASE", "DISPATCH"],
  quality: ["MENU", "STOCK", "PRODUCTION", "QUALITY"],
  sales: ["MENU", "STOCK", "PARTY", "ORDER", "DISPATCH", "REPORTS"],
  finance: ["MENU", "PARTY", "ORDER", "DISPATCH", "REPORTS", "SUMMARY"],
  jobwork: ["MENU", "JOBWORK", "PARTY"],
  customer: ["MENU", "ORDER", "DISPATCH"],
};

export function canUserAccessCategory(
  user: WhatsAppUser | null,
  category: CommandCategory,
): boolean {
  if (!user || !user.is_active) return false;
  if (category === "MENU" || category === "UNKNOWN") return true;

  const allowedCategories = ROLE_PERMISSIONS[user.role] || [];
  return allowedCategories.includes(category);
}
