import { toast } from "sonner";

export type UserStatus = "ACTIVE" | "PENDING" | "INACTIVE" | "SUSPENDED" | "LOCKED" | "REJECTED";
export type ApprovalStatus = "ADMIN_APPROVED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
export type CreationMethod = "ADMIN_CREATED" | "REGISTRATION_REQUEST";

export type PermissionAction =
  "VIEW" | "CREATE" | "EDIT" | "DELETE" | "APPROVE" | "EXPORT" | "PRINT";
export type ERPModule =
  | "users"
  | "masters"
  | "costing"
  | "production"
  | "inventory"
  | "sales"
  | "quality"
  | "reports"
  | "whatsapp"
  | "system";

export interface Role {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  permissions: Record<string, boolean>; // key format: "module.action" e.g. "users.view", "users.create_direct"
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  mobile: string;
  employee_id: string;
  department: string;
  designation: string;
  username: string;
  primary_role_id: string;
  additional_role_ids: string[];
  status: UserStatus;
  approval_status: ApprovalStatus;
  creation_method: CreationMethod;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  requested_role_id?: string;
  request_reason?: string;
  direct_permissions: Record<string, boolean>;
  last_login?: string;
  failed_attempts: number;
  is_locked: boolean;
  require_password_change?: boolean;
}

export interface RegistrationRequestInput {
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  employee_id: string;
  department: string;
  designation: string;
  requested_role_id: string;
  request_reason: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  user_name: string;
  device: string;
  browser: string;
  login_time: string;
  last_activity: string;
  ip_address: string;
  status: "ACTIVE" | "TERMINATED";
}

export interface UserAuditLog {
  id: string;
  timestamp: string;
  performed_by_name: string;
  target_user_name: string;
  action: string;
  previous_value?: string;
  new_value?: string;
  remarks?: string;
}

export const MODULE_LIST: { id: ERPModule; label: string; actions: PermissionAction[] }[] = [
  {
    id: "users",
    label: "Users & Roles",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT"],
  },
  {
    id: "masters",
    label: "Yarn & Fabric Masters",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "PRINT"],
  },
  {
    id: "costing",
    label: "Cost Sheets & Pricing",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "PRINT"],
  },
  {
    id: "production",
    label: "Production & Loom Planning",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "PRINT"],
  },
  {
    id: "inventory",
    label: "Inventory & Warehousing",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "PRINT"],
  },
  {
    id: "sales",
    label: "Sales & Customer Orders",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "PRINT"],
  },
  {
    id: "quality",
    label: "Quality Control & 4-Point Inspection",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "PRINT"],
  },
  { id: "reports", label: "Executive Reports & Analytics", actions: ["VIEW", "EXPORT", "PRINT"] },
  {
    id: "whatsapp",
    label: "WhatsApp Assistant & Webhook Settings",
    actions: ["VIEW", "CREATE", "EDIT", "APPROVE"],
  },
  {
    id: "system",
    label: "System Backup & Audit Logs",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT"],
  },
];

export const SPECIAL_PERMISSIONS = [
  { key: "users.create_direct", label: "Create Users Directly (Bypass Approval)", module: "users" },
  { key: "users.approve", label: "Approve Self-Registration Requests", module: "users" },
  { key: "summary.financial", label: "View Financial & Receivables Summary", module: "reports" },
  { key: "quality.override", label: "Override Quality Hold (BR-153)", module: "quality" },
];

const INITIAL_ROLES: Role[] = [
  {
    id: "admin",
    name: "Admin",
    description:
      "Unrestricted access to all ERP modules, user governance, security audit logs, and approval queues.",
    is_system: true,
    permissions: {
      "users.view": true,
      "users.create": true,
      "users.edit": true,
      "users.delete": true,
      "users.approve": true,
      "users.export": true,
      "users.create_direct": true,
      "masters.view": true,
      "masters.create": true,
      "masters.edit": true,
      "masters.delete": true,
      "masters.export": true,
      "masters.print": true,
      "costing.view": true,
      "costing.create": true,
      "costing.edit": true,
      "costing.delete": true,
      "costing.approve": true,
      "costing.export": true,
      "costing.print": true,
      "production.view": true,
      "production.create": true,
      "production.edit": true,
      "production.delete": true,
      "production.approve": true,
      "production.export": true,
      "production.print": true,
      "inventory.view": true,
      "inventory.create": true,
      "inventory.edit": true,
      "inventory.delete": true,
      "inventory.export": true,
      "inventory.print": true,
      "sales.view": true,
      "sales.create": true,
      "sales.edit": true,
      "sales.delete": true,
      "sales.approve": true,
      "sales.export": true,
      "sales.print": true,
      "quality.view": true,
      "quality.create": true,
      "quality.edit": true,
      "quality.delete": true,
      "quality.approve": true,
      "quality.export": true,
      "quality.print": true,
      "quality.override": true,
      "reports.view": true,
      "reports.export": true,
      "reports.print": true,
      "summary.financial": true,
      "whatsapp.view": true,
      "whatsapp.create": true,
      "whatsapp.edit": true,
      "whatsapp.approve": true,
      "system.view": true,
      "system.create": true,
      "system.edit": true,
      "system.delete": true,
      "system.export": true,
    },
  },
  {
    id: "manager",
    name: "Manager",
    description:
      "Full management access across business operations, user management, and module administration.",
    is_system: true,
    permissions: {
      "users.view": true,
      "users.create": true,
      "users.edit": true,
      "users.approve": true,
      "users.create_direct": true,
      "masters.view": true,
      "masters.create": true,
      "masters.edit": true,
      "masters.export": true,
      "costing.view": true,
      "costing.create": true,
      "costing.edit": true,
      "costing.approve": true,
      "costing.export": true,
      "production.view": true,
      "production.create": true,
      "production.edit": true,
      "production.approve": true,
      "production.export": true,
      "inventory.view": true,
      "inventory.create": true,
      "inventory.edit": true,
      "inventory.export": true,
      "sales.view": true,
      "sales.create": true,
      "sales.edit": true,
      "sales.approve": true,
      "sales.export": true,
      "quality.view": true,
      "quality.create": true,
      "quality.edit": true,
      "quality.approve": true,
      "quality.override": true,
      "reports.view": true,
      "reports.export": true,
      "summary.financial": true,
      "whatsapp.view": true,
      "whatsapp.edit": true,
      "system.view": true,
    },
  },
  {
    id: "operator",
    name: "Management",
    description:
      "Executive visibility into costing, sales orders, financial summaries, and loom telemetry.",
    is_system: true,
    permissions: {
      "users.view": true,
      "masters.view": true,
      "costing.view": true,
      "costing.approve": true,
      "costing.export": true,
      "production.view": true,
      "production.approve": true,
      "production.export": true,
      "inventory.view": true,
      "inventory.export": true,
      "sales.view": true,
      "sales.approve": true,
      "sales.export": true,
      "quality.view": true,
      "quality.export": true,
      "reports.view": true,
      "reports.export": true,
      "summary.financial": true,
      "whatsapp.view": true,
    },
  },
  {
    id: "role-costing",
    name: "Costing Executive",
    description:
      "Prepare and calculate yarn cost sheets, warp & weft consumption, and feeder colourways.",
    is_system: true,
    permissions: {
      "masters.view": true,
      "costing.view": true,
      "costing.create": true,
      "costing.edit": true,
      "costing.export": true,
      "costing.print": true,
      "inventory.view": true,
      "reports.view": true,
    },
  },
  {
    id: "role-production-mgr",
    name: "Production Manager",
    description: "Manage loom assignments, daily production logs, job cards, and beam allocations.",
    is_system: true,
    permissions: {
      "masters.view": true,
      "production.view": true,
      "production.create": true,
      "production.edit": true,
      "production.approve": true,
      "production.export": true,
      "production.print": true,
      "inventory.view": true,
      "inventory.edit": true,
      "quality.view": true,
      "reports.view": true,
    },
  },
  {
    id: "role-production-op",
    name: "Production Operator",
    description: "Log daily pick counts, woven meters, and loom efficiency telemetry.",
    is_system: true,
    permissions: {
      "production.view": true,
      "production.create": true,
      "production.edit": true,
      "inventory.view": true,
    },
  },
  {
    id: "role-quality-mgr",
    name: "Quality Manager",
    description:
      "Perform 4-Point fabric inspection, log defect points, issue shade lab dips, and manage Quality Hold (BR-153).",
    is_system: true,
    permissions: {
      "quality.view": true,
      "quality.create": true,
      "quality.edit": true,
      "quality.approve": true,
      "quality.export": true,
      "quality.print": true,
      "quality.override": true,
      "production.view": true,
      "inventory.view": true,
      "reports.view": true,
    },
  },
  {
    id: "role-store-mgr",
    name: "Store Manager",
    description:
      "Manage yarn inward stock, beam inventory, fabric grey/finished stock, and dispatch note packing.",
    is_system: true,
    permissions: {
      "inventory.view": true,
      "inventory.create": true,
      "inventory.edit": true,
      "inventory.export": true,
      "inventory.print": true,
      "masters.view": true,
      "sales.view": true,
    },
  },
  {
    id: "role-sales-mgr",
    name: "Sales Manager",
    description:
      "Create customer quotations, sales orders, outstanding ledger tracking, and dispatch clearances.",
    is_system: true,
    permissions: {
      "sales.view": true,
      "sales.create": true,
      "sales.edit": true,
      "sales.approve": true,
      "sales.export": true,
      "sales.print": true,
      "inventory.view": true,
      "costing.view": true,
      "reports.view": true,
    },
  },
  {
    id: "role-viewer",
    name: "Viewer",
    description: "Read-only access to non-sensitive ERP catalogs and production dashboards.",
    is_system: true,
    permissions: {
      "masters.view": true,
      "production.view": true,
      "inventory.view": true,
      "reports.view": true,
    },
  },
];

const INITIAL_USERS: UserProfile[] = [
  {
    id: "usr-admin-01",
    first_name: "Rajesh",
    last_name: "Shah",
    display_name: "SCKT Admin",
    email: "admin@sckt.com",
    mobile: "+919876543210",
    employee_id: "EMP-001",
    department: "Management",
    designation: "Managing Director & Chief Admin",
    username: "admin@sckt.com",
    primary_role_id: "admin",
    additional_role_ids: ["role-admin"],
    status: "ACTIVE",
    approval_status: "ADMIN_APPROVED",
    creation_method: "ADMIN_CREATED",
    created_at: "2026-08-01T10:00:00Z",
    approved_by: "System Initialization",
    approved_at: "2026-08-01T10:00:00Z",
    direct_permissions: {},
    last_login: "2026-08-09T21:30:00Z",
    failed_attempts: 0,
    is_locked: false,
  },
  {
    id: "usr-user-02",
    first_name: "Standard",
    last_name: "User",
    display_name: "SCKT Standard User",
    email: "user@sckt.com",
    mobile: "+919825012345",
    employee_id: "EMP-002",
    department: "Costing & Design",
    designation: "Senior Costing Executive",
    username: "user@sckt.com",
    primary_role_id: "manager",
    additional_role_ids: [],
    status: "ACTIVE",
    approval_status: "ADMIN_APPROVED",
    creation_method: "ADMIN_CREATED",
    created_at: "2026-08-02T11:00:00Z",
    approved_by: "Rajesh Shah",
    approved_at: "2026-08-02T11:00:00Z",
    direct_permissions: {},
    last_login: "2026-08-09T20:15:00Z",
    failed_attempts: 0,
    is_locked: false,
  },
  {
    id: "usr-prod-03",
    first_name: "Amit",
    last_name: "Patel",
    display_name: "Amit Patel (Prod Mgr)",
    email: "amit.prod@sckt.com",
    mobile: "+919898011223",
    employee_id: "EMP-003",
    department: "Production",
    designation: "Production General Manager",
    username: "amit.prod@sckt.com",
    primary_role_id: "manager",
    additional_role_ids: [],
    status: "ACTIVE",
    approval_status: "ADMIN_APPROVED",
    creation_method: "ADMIN_CREATED",
    created_at: "2026-08-03T09:15:00Z",
    approved_by: "Rajesh Shah",
    approved_at: "2026-08-03T09:15:00Z",
    direct_permissions: {},
    last_login: "2026-08-09T18:45:00Z",
    failed_attempts: 0,
    is_locked: false,
  },
  {
    id: "usr-req-04",
    first_name: "Neha",
    last_name: "Sharma",
    display_name: "Neha Sharma",
    email: "neha.q@sckt.com",
    mobile: "+919909055443",
    employee_id: "EMP-088",
    department: "Quality Control",
    designation: "Quality Inspector",
    username: "neha.q@sckt.com",
    primary_role_id: "manager",
    requested_role_id: "manager",
    additional_role_ids: [],
    status: "PENDING",
    approval_status: "PENDING_APPROVAL",
    creation_method: "REGISTRATION_REQUEST",
    created_at: "2026-08-09T14:20:00Z",
    request_reason:
      "Newly hired Quality Inspector requiring 4-Point inspection entry authorization.",
    direct_permissions: {},
    failed_attempts: 0,
    is_locked: false,
  },
  {
    id: "usr-req-05",
    first_name: "Karan",
    last_name: "Verma",
    display_name: "Karan Verma",
    email: "karan.v@example.com",
    mobile: "+919712344321",
    employee_id: "EMP-999",
    department: "Sales",
    designation: "Sales Executive",
    username: "karan.v@example.com",
    primary_role_id: "manager",
    requested_role_id: "manager",
    additional_role_ids: [],
    status: "REJECTED",
    approval_status: "REJECTED",
    creation_method: "REGISTRATION_REQUEST",
    created_at: "2026-08-08T16:00:00Z",
    rejection_reason:
      "Invalid employee ID provided. Re-submit registration with official HR credentials.",
    approved_by: "Rajesh Shah",
    approved_at: "2026-08-08T17:30:00Z",
    direct_permissions: {},
    failed_attempts: 0,
    is_locked: false,
  },
];

const INITIAL_SESSIONS: UserSession[] = [
  {
    id: "sess-001",
    user_id: "usr-admin-01",
    user_name: "SCKT Admin",
    device: "Windows Desktop PC",
    browser: "Chrome 127.0",
    login_time: "2026-08-09T21:30:00Z",
    last_activity: "2026-08-09T22:00:00Z",
    ip_address: "192.168.1.45 (Surat Mill Network)",
    status: "ACTIVE",
  },
  {
    id: "sess-002",
    user_id: "usr-user-02",
    user_name: "SCKT Standard User",
    device: "MacBook Pro M2",
    browser: "Safari 17.4",
    login_time: "2026-08-09T20:15:00Z",
    last_activity: "2026-08-09T21:45:00Z",
    ip_address: "192.168.1.102 (Costing Desk)",
    status: "ACTIVE",
  },
];

const INITIAL_AUDITS: UserAuditLog[] = [
  {
    id: "aud-001",
    timestamp: "2026-08-09T14:20:00Z",
    performed_by_name: "Neha Sharma",
    target_user_name: "Neha Sharma",
    action: "REGISTRATION_REQUESTED",
    new_value: "Pending Quality Manager Access",
    remarks: "Submitted self-registration access request",
  },
  {
    id: "aud-002",
    timestamp: "2026-08-08T17:30:00Z",
    performed_by_name: "SCKT Admin",
    target_user_name: "Karan Verma",
    action: "USER_REJECTED",
    previous_value: "PENDING_APPROVAL",
    new_value: "REJECTED",
    remarks: "Invalid employee ID provided. Re-submit registration with official HR credentials.",
  },
  {
    id: "aud-003",
    timestamp: "2026-08-03T09:15:00Z",
    performed_by_name: "SCKT Admin",
    target_user_name: "Amit Patel",
    action: "USER_CREATED_DIRECT",
    new_value: "ACTIVE (Production Manager)",
    remarks: "Admin direct creation with immediate activation",
  },
];

const STORAGE_USERS = "weaveone_users_v1";
const STORAGE_ROLES = "weaveone_roles_v1";
const STORAGE_SESSIONS = "weaveone_sessions_v1";
const STORAGE_AUDITS = "weaveone_audits_v1";

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveStorage<T>(key: string, value: T) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("storage"));
  }
}

export function getUserStore() {
  const users = loadStorage<UserProfile[]>(STORAGE_USERS, INITIAL_USERS);
  const roles = loadStorage<Role[]>(STORAGE_ROLES, INITIAL_ROLES);
  const sessions = loadStorage<UserSession[]>(STORAGE_SESSIONS, INITIAL_SESSIONS);
  const audits = loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS);

  return {
    getUsers: () => loadStorage<UserProfile[]>(STORAGE_USERS, INITIAL_USERS),
    getRoles: () => loadStorage<Role[]>(STORAGE_ROLES, INITIAL_ROLES),
    getSessions: () => loadStorage<UserSession[]>(STORAGE_SESSIONS, INITIAL_SESSIONS),
    getAudits: () => loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),

    // Check if user is Super Admin
    isSuperAdmin: (user: UserProfile) => {
      const r = roles.find((x) => x.id === user.primary_role_id);
      return r?.name === "Super Admin" || user.primary_role_id === "role-superadmin";
    },

    // Rule 10: Last Active Super Admin Protection Guard
    canDeactivateUser: (targetUserId: string): { allowed: boolean; reason?: string } => {
      const currentUsers = loadStorage<UserProfile[]>(STORAGE_USERS, INITIAL_USERS);
      const currentRoles = loadStorage<Role[]>(STORAGE_ROLES, INITIAL_ROLES);
      const targetUser = currentUsers.find((u) => u.id === targetUserId);
      if (!targetUser) return { allowed: false, reason: "User not found" };

      const targetRole = currentRoles.find((r) => r.id === targetUser.primary_role_id);
      if (targetRole?.name === "Super Admin" || targetUser.primary_role_id === "role-superadmin") {
        const activeSuperAdmins = currentUsers.filter((u) => {
          if (u.status !== "ACTIVE") return false;
          const uRole = currentRoles.find((r) => r.id === u.primary_role_id);
          return uRole?.name === "Super Admin" || u.primary_role_id === "role-superadmin";
        });

        if (activeSuperAdmins.length <= 1) {
          return {
            allowed: false,
            reason:
              "⚠️ Cannot complete this action. At least one active Super Admin must remain in the system.",
          };
        }
      }
      return { allowed: true };
    },

    // Workflow A: Admin Direct User Creation
    addUserDirect: (
      input: Omit<UserProfile, "id" | "created_at" | "approval_status" | "creation_method">,
      adminName = "SCKT Admin",
    ) => {
      const currentUsers = loadStorage<UserProfile[]>(STORAGE_USERS, INITIAL_USERS);
      const newId = `usr-${Date.now().toString(36)}`;
      const newUser: UserProfile = {
        ...input,
        id: newId,
        creation_method: "ADMIN_CREATED",
        approval_status: "ADMIN_APPROVED",
        created_at: new Date().toISOString(),
        approved_by: adminName,
        approved_at: new Date().toISOString(),
        failed_attempts: 0,
        is_locked: false,
      };

      const updated = [newUser, ...currentUsers];
      saveStorage(STORAGE_USERS, updated);

      // Log Audit
      const newAudit: UserAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        performed_by_name: adminName,
        target_user_name: newUser.display_name,
        action: "USER_CREATED_DIRECT",
        new_value: `Role: ${newUser.primary_role_id}, Status: ${newUser.status}`,
        remarks: "Admin created user directly (Immediate Activation)",
      };
      saveStorage(STORAGE_AUDITS, [
        newAudit,
        ...loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),
      ]);
      toast.success(`✅ User "${newUser.display_name}" created directly and activated!`);
      return newUser;
    },

    // Workflow B: Self Registration Access Request
    registerUserRequest: (input: RegistrationRequestInput) => {
      const currentUsers = loadStorage<UserProfile[]>(STORAGE_USERS, INITIAL_USERS);
      const existing = currentUsers.find(
        (u) => u.email.toLowerCase() === input.email.toLowerCase(),
      );
      if (existing) {
        toast.error("An account or registration request with this email already exists.");
        return null;
      }

      const newId = `usr-req-${Date.now().toString(36)}`;
      const newRequest: UserProfile = {
        id: newId,
        first_name: input.first_name,
        last_name: input.last_name,
        display_name: `${input.first_name} ${input.last_name}`.trim(),
        email: input.email,
        mobile: input.mobile,
        employee_id: input.employee_id,
        department: input.department,
        designation: input.designation,
        username: input.email,
        primary_role_id: input.requested_role_id,
        requested_role_id: input.requested_role_id,
        additional_role_ids: [],
        status: "PENDING",
        approval_status: "PENDING_APPROVAL",
        creation_method: "REGISTRATION_REQUEST",
        request_reason: input.request_reason,
        created_at: new Date().toISOString(),
        direct_permissions: {},
        failed_attempts: 0,
        is_locked: false,
      };

      saveStorage(STORAGE_USERS, [newRequest, ...currentUsers]);

      const newAudit: UserAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        performed_by_name: newRequest.display_name,
        target_user_name: newRequest.display_name,
        action: "REGISTRATION_REQUESTED",
        new_value: "PENDING_APPROVAL",
        remarks: input.request_reason,
      };
      saveStorage(STORAGE_AUDITS, [
        newAudit,
        ...loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),
      ]);
      toast.success("Registration request submitted! Status: PENDING APPROVAL.");
      return newRequest;
    },

    // Approve Registration Request
    approveUserRequest: (
      userId: string,
      roleId: string,
      remarks: string,
      adminName = "SCKT Admin",
    ) => {
      const currentUsers = loadStorage<UserProfile[]>(STORAGE_USERS, INITIAL_USERS);
      const target = currentUsers.find((u) => u.id === userId);
      if (!target) return;

      const updatedUsers = currentUsers.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            primary_role_id: roleId,
            status: "ACTIVE" as UserStatus,
            approval_status: "APPROVED" as ApprovalStatus,
            approved_by: adminName,
            approved_at: new Date().toISOString(),
          };
        }
        return u;
      });

      saveStorage(STORAGE_USERS, updatedUsers);

      const newAudit: UserAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        performed_by_name: adminName,
        target_user_name: target.display_name,
        action: "USER_APPROVED",
        previous_value: "PENDING_APPROVAL",
        new_value: "APPROVED (ACTIVE)",
        remarks: remarks || "Registration request approved by Admin",
      };
      saveStorage(STORAGE_AUDITS, [
        newAudit,
        ...loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),
      ]);
      toast.success(`✅ User "${target.display_name}" approved and activated!`);
    },

    // Reject Registration Request
    rejectUserRequest: (userId: string, remarks: string, adminName = "SCKT Admin") => {
      if (!remarks.trim()) {
        toast.error("Rejection remarks are mandatory.");
        return;
      }

      const currentUsers = loadStorage<UserProfile[]>(STORAGE_USERS, INITIAL_USERS);
      const target = currentUsers.find((u) => u.id === userId);
      if (!target) return;

      const updatedUsers = currentUsers.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            status: "REJECTED" as UserStatus,
            approval_status: "REJECTED" as ApprovalStatus,
            rejection_reason: remarks,
            approved_by: adminName,
            approved_at: new Date().toISOString(),
          };
        }
        return u;
      });

      saveStorage(STORAGE_USERS, updatedUsers);

      const newAudit: UserAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        performed_by_name: adminName,
        target_user_name: target.display_name,
        action: "USER_REJECTED",
        previous_value: "PENDING_APPROVAL",
        new_value: "REJECTED",
        remarks: remarks,
      };
      saveStorage(STORAGE_AUDITS, [
        newAudit,
        ...loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),
      ]);
      toast.error(`❌ Registration request for "${target.display_name}" rejected.`);
    },

    // Update Status (ACTIVE, INACTIVE, SUSPENDED, LOCKED, etc.)
    updateUserStatus: (
      userId: string,
      status: UserStatus,
      remarks?: string,
      adminName = "SCKT Admin",
    ) => {
      const currentUsers = loadStorage<UserProfile[]>(STORAGE_USERS, INITIAL_USERS);
      const target = currentUsers.find((u) => u.id === userId);
      if (!target) return;

      // Check Super Admin Guard
      if (status === "INACTIVE" || status === "SUSPENDED" || status === "REJECTED") {
        const guard = getUserStore().canDeactivateUser(userId);
        if (!guard.allowed) {
          toast.error(guard.reason);
          return;
        }
      }

      const updatedUsers = currentUsers.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            status,
            is_locked: status === "LOCKED",
          };
        }
        return u;
      });

      saveStorage(STORAGE_USERS, updatedUsers);

      const newAudit: UserAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        performed_by_name: adminName,
        target_user_name: target.display_name,
        action: `USER_STATUS_${status}`,
        previous_value: target.status,
        new_value: status,
        remarks: remarks || `User status changed to ${status}`,
      };
      saveStorage(STORAGE_AUDITS, [
        newAudit,
        ...loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),
      ]);
      toast.info(`User status updated to ${status}`);
    },

    // Update User Role & Permissions
    updateUserRole: (
      userId: string,
      roleId: string,
      additionalRoles: string[] = [],
      directPermissions: Record<string, boolean> = {},
      adminName = "SCKT Admin",
    ) => {
      const currentUsers = loadStorage<UserProfile[]>(STORAGE_USERS, INITIAL_USERS);
      const target = currentUsers.find((u) => u.id === userId);
      if (!target) return;

      const updatedUsers = currentUsers.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            primary_role_id: roleId,
            additional_role_ids: additionalRoles,
            direct_permissions: directPermissions,
          };
        }
        return u;
      });

      saveStorage(STORAGE_USERS, updatedUsers);

      const newAudit: UserAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        performed_by_name: adminName,
        target_user_name: target.display_name,
        action: "USER_ROLE_UPDATED",
        previous_value: target.primary_role_id,
        new_value: roleId,
        remarks: "Updated primary role and direct permission overrides",
      };
      saveStorage(STORAGE_AUDITS, [
        newAudit,
        ...loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),
      ]);
      toast.success("User role & permissions updated!");
    },

    // Roles Matrix CRUD
    addRole: (role: Omit<Role, "id" | "is_system">, adminName = "SCKT Admin") => {
      const currentRoles = loadStorage<Role[]>(STORAGE_ROLES, INITIAL_ROLES);
      const newRole: Role = {
        ...role,
        id: `role-${Date.now().toString(36)}`,
        is_system: false,
      };
      saveStorage(STORAGE_ROLES, [...currentRoles, newRole]);

      const newAudit: UserAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        performed_by_name: adminName,
        target_user_name: "Role Matrix",
        action: "ROLE_CREATED",
        new_value: newRole.name,
        remarks: `Created custom role ${newRole.name}`,
      };
      saveStorage(STORAGE_AUDITS, [
        newAudit,
        ...loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),
      ]);
      toast.success(`Role "${newRole.name}" created!`);
      return newRole;
    },

    updateRole: (roleId: string, updatedData: Partial<Role>, adminName = "SCKT Admin") => {
      const currentRoles = loadStorage<Role[]>(STORAGE_ROLES, INITIAL_ROLES);
      const updated = currentRoles.map((r) => {
        if (r.id === roleId) {
          return { ...r, ...updatedData };
        }
        return r;
      });
      saveStorage(STORAGE_ROLES, updated);

      const newAudit: UserAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        performed_by_name: adminName,
        target_user_name: "Role Matrix",
        action: "ROLE_UPDATED",
        new_value: roleId,
        remarks: "Updated role permissions",
      };
      saveStorage(STORAGE_AUDITS, [
        newAudit,
        ...loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),
      ]);
      toast.success("Role updated successfully!");
    },

    // Sessions Management
    terminateSession: (sessionId: string, adminName = "SCKT Admin") => {
      const currentSessions = loadStorage<UserSession[]>(STORAGE_SESSIONS, INITIAL_SESSIONS);
      const target = currentSessions.find((s) => s.id === sessionId);
      const updated = currentSessions.map((s) => {
        if (s.id === sessionId) {
          return { ...s, status: "TERMINATED" as const };
        }
        return s;
      });
      saveStorage(STORAGE_SESSIONS, updated);

      if (target) {
        const newAudit: UserAuditLog = {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          performed_by_name: adminName,
          target_user_name: target.user_name,
          action: "SESSION_TERMINATED",
          remarks: `Terminated session on ${target.device} (${target.ip_address})`,
        };
        saveStorage(STORAGE_AUDITS, [
          newAudit,
          ...loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),
        ]);
      }
      toast.info("Session terminated.");
    },

    // Reset User Password
    resetUserPassword: (userId: string, tempPass: string, adminName = "SCKT Admin") => {
      const currentUsers = loadStorage<UserProfile[]>(STORAGE_USERS, INITIAL_USERS);
      const target = currentUsers.find((u) => u.id === userId);
      if (!target) return;

      const updatedUsers = currentUsers.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            require_password_change: true,
            failed_attempts: 0,
            is_locked: false,
          };
        }
        return u;
      });
      saveStorage(STORAGE_USERS, updatedUsers);

      const newAudit: UserAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        performed_by_name: adminName,
        target_user_name: target.display_name,
        action: "PASSWORD_RESET",
        remarks: "Temporary password generated; password change required on next login",
      };
      saveStorage(STORAGE_AUDITS, [
        newAudit,
        ...loadStorage<UserAuditLog[]>(STORAGE_AUDITS, INITIAL_AUDITS),
      ]);
      toast.success(`Temporary password generated for ${target.display_name}`);
    },
  };
}
