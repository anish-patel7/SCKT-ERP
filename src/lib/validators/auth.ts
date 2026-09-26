import { z } from "zod";

// Role enums
export enum AppRole {
  Admin = "admin",
  Manager = "manager",
  Operator = "operator",
  Viewer = "viewer",
}

export enum UserStatus {
  Active = "ACTIVE",
  Pending = "PENDING",
  Inactive = "INACTIVE",
  Suspended = "SUSPENDED",
  Locked = "LOCKED",
  Rejected = "REJECTED",
}

export enum ApprovalStatus {
  AdminApproved = "ADMIN_APPROVED",
  PendingApproval = "PENDING_APPROVAL",
  Approved = "APPROVED",
  Rejected = "REJECTED",
}

export enum CreationMethod {
  AdminCreated = "ADMIN_CREATED",
  RegistrationRequest = "REGISTRATION_REQUEST",
}

// Profile validation schema
export const ProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().optional(),
  employee_id: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  mobile: z.string().optional(),
  status: z.nativeEnum(UserStatus).default(UserStatus.Active),
  approval_status: z.nativeEnum(ApprovalStatus).default(ApprovalStatus.AdminApproved),
  creation_method: z.nativeEnum(CreationMethod).default(CreationMethod.AdminCreated),
  approved_by: z.string().optional(),
  approved_at: z.date().optional(),
  last_login: z.date().optional(),
  failed_login_attempts: z.number().int().nonnegative().default(0),
  is_locked: z.boolean().default(false),
  require_password_change: z.boolean().default(false),
  created_at: z.date(),
  updated_at: z.date(),
});

export type Profile = z.infer<typeof ProfileSchema>;

// PostgREST returns timestamptz with a UTC offset (e.g. "...+00:00").
const Timestamp = z.string().datetime({ offset: true });

// Role definition schema (mirrors public.role_definitions; most columns nullable)
export const RoleDefinitionSchema = z.object({
  id: z.string().uuid(),
  role_code: z.string(),
  role_name: z.string(),
  description: z.string().nullable().default(null),
  display_order: z.number().int().nullable().default(null),
  is_system: z
    .boolean()
    .nullable()
    .transform((v) => v ?? false),
  is_active: z
    .boolean()
    .nullable()
    .transform((v) => v ?? true),
  created_at: Timestamp.nullable().default(null),
  updated_at: Timestamp.nullable().default(null),
});

export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;

// Permission schema (mirrors public.permissions)
export const PermissionSchema = z.object({
  id: z.string().uuid(),
  permission_code: z.string(),
  permission_name: z.string(),
  description: z.string().nullable().default(null),
  module: z.string(),
  action: z.string(),
  is_system: z
    .boolean()
    .nullable()
    .transform((v) => v ?? false),
  is_active: z
    .boolean()
    .nullable()
    .transform((v) => v ?? true),
  created_at: Timestamp.nullable().default(null),
  updated_at: Timestamp.nullable().default(null),
});

export type Permission = z.infer<typeof PermissionSchema>;

// Row returned by public.get_user_effective_permissions(_user_id)
export const EffectivePermissionSchema = z.object({
  permission_id: z.string().uuid(),
  permission_code: z.string(),
  module: z.string(),
  action: z.string(),
});

export type EffectivePermission = z.infer<typeof EffectivePermissionSchema>;

// User role schema
export const UserRoleSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.nativeEnum(AppRole),
  created_at: z.date(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;

// Profile update schema (for admin updates)
export const ProfileUpdateSchema = ProfileSchema.partial().omit({
  id: true,
  created_at: true,
});

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
