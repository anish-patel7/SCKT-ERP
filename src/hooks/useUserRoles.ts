import { useState, useEffect } from "react";
import {
  getUserStore,
  UserProfile,
  Role,
  UserSession,
  UserAuditLog,
  RegistrationRequestInput,
  UserStatus,
} from "@/lib/user-role-store";

export function useUserRoles() {
  const store = getUserStore();
  const [users, setUsers] = useState<UserProfile[]>(store.getUsers());
  const [roles, setRoles] = useState<Role[]>(store.getRoles());
  const [sessions, setSessions] = useState<UserSession[]>(store.getSessions());
  const [audits, setAudits] = useState<UserAuditLog[]>(store.getAudits());

  const refreshState = () => {
    const s = getUserStore();
    setUsers(s.getUsers());
    setRoles(s.getRoles());
    setSessions(s.getSessions());
    setAudits(s.getAudits());
  };

  useEffect(() => {
    refreshState();
    const handleStorage = () => refreshState();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const pendingUsers = users.filter(
    (u) => u.approval_status === "PENDING_APPROVAL" || u.status === "PENDING",
  );
  const activeUsers = users.filter((u) => u.status === "ACTIVE");

  return {
    users,
    roles,
    sessions,
    audits,
    pendingUsers,
    activeUsers,
    refreshState,

    // Actions
    addUserDirect: (
      input: Omit<UserProfile, "id" | "created_at" | "approval_status" | "creation_method">,
      adminName?: string,
    ) => {
      const res = store.addUserDirect(input, adminName);
      refreshState();
      return res;
    },

    registerUserRequest: (input: RegistrationRequestInput) => {
      const res = store.registerUserRequest(input);
      refreshState();
      return res;
    },

    approveUserRequest: (userId: string, roleId: string, remarks: string, adminName?: string) => {
      store.approveUserRequest(userId, roleId, remarks, adminName);
      refreshState();
    },

    rejectUserRequest: (userId: string, remarks: string, adminName?: string) => {
      store.rejectUserRequest(userId, remarks, adminName);
      refreshState();
    },

    updateUserStatus: (
      userId: string,
      status: UserStatus,
      remarks?: string,
      adminName?: string,
    ) => {
      store.updateUserStatus(userId, status, remarks, adminName);
      refreshState();
    },

    updateUserRole: (
      userId: string,
      roleId: string,
      additionalRoles?: string[],
      directPermissions?: Record<string, boolean>,
      adminName?: string,
    ) => {
      store.updateUserRole(userId, roleId, additionalRoles, directPermissions, adminName);
      refreshState();
    },

    addRole: (role: Omit<Role, "id" | "is_system">, adminName?: string) => {
      const res = store.addRole(role, adminName);
      refreshState();
      return res;
    },

    updateRole: (roleId: string, updatedData: Partial<Role>, adminName?: string) => {
      store.updateRole(roleId, updatedData, adminName);
      refreshState();
    },

    terminateSession: (sessionId: string, adminName?: string) => {
      store.terminateSession(sessionId, adminName);
      refreshState();
    },

    resetUserPassword: (userId: string, tempPass: string, adminName?: string) => {
      store.resetUserPassword(userId, tempPass, adminName);
      refreshState();
    },
  };
}
