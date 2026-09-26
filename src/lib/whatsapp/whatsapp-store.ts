// SCKT WhatsApp Bot Store & Audit Engine (Section 22 & 28 of Spec)
import type {
  AuditLogEntry,
  CommandRequest,
  CommandResponse,
  NotificationRule,
  WhatsAppProviderConfig,
  WhatsAppUser,
} from "./types";
import { executeWhatsAppCommand, parseCommandCategory } from "./command-processor";

export interface WhatsAppData {
  config: WhatsAppProviderConfig;
  users: WhatsAppUser[];
  rules: NotificationRule[];
  auditLogs: AuditLogEntry[];
}

const STORAGE_KEY = "sckt_whatsapp_v1";

const SEED_USERS: WhatsAppUser[] = [
  {
    id: "usr-001",
    phone_number: "+919876543210",
    display_name: "SCKT Admin (admin@sckt.com)",
    sckt_user_id: "usr-admin-01",
    role: "admin",
    is_active: true,
    registered_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "usr-002",
    phone_number: "+919825012345",
    display_name: "Standard User (user@sckt.com)",
    sckt_user_id: "usr-user-02",
    role: "sales",
    is_active: true,
    registered_at: "2026-08-02T11:30:00Z",
  },
  {
    id: "usr-003",
    phone_number: "+919909055443",
    display_name: "Suresh Mehta (Quality Mgr)",
    sckt_user_id: "usr-qual-01",
    role: "quality",
    is_active: true,
    registered_at: "2026-08-03T14:15:00Z",
  },
  {
    id: "usr-004",
    phone_number: "+919712398765",
    display_name: "Ramesh Weaver (Loom Op)",
    sckt_user_id: "usr-op-01",
    role: "operator",
    is_active: true,
    registered_at: "2026-08-04T09:00:00Z",
  },
];

const SEED_RULES: NotificationRule[] = [
  {
    alert_type: "low_stock",
    label: "Low Stock Material Alert",
    enabled: true,
    target_roles: ["admin", "management", "store"],
    description: "Triggers when yarn or raw material inventory drops below reorder level.",
  },
  {
    alert_type: "loom_breakdown",
    label: "Loom Breakdown Alert",
    enabled: true,
    target_roles: ["admin", "management", "planner", "operator"],
    description: "Triggers when a loom controller reports an active breakdown fault.",
  },
  {
    alert_type: "production_delay",
    label: "Production Target Delay",
    enabled: true,
    target_roles: ["management", "planner"],
    description: "Triggers when job card production falls behind schedule.",
  },
  {
    alert_type: "quality_hold",
    label: "Quality Roll Hold (BR-153)",
    enabled: true,
    target_roles: ["admin", "management", "quality", "sales"],
    description: "Triggers when a fabric roll is marked on Quality Hold, blocking dispatch.",
  },
  {
    alert_type: "dispatch_ready",
    label: "Dispatch Packing Ready",
    enabled: true,
    target_roles: ["sales", "store", "management"],
    description: "Triggers when a sales order packing list is ready for dispatch shipment.",
  },
];

const SEED_AUDIT: AuditLogEntry[] = [
  {
    id: "log-101",
    timestamp: "2026-08-09T18:05:12Z",
    user_id: "usr-002",
    user_name: "Amit Patel (Prod Manager)",
    phone_number: "+919825012345",
    role: "management",
    raw_command: "STOCK DESIGN D-015",
    parsed_category: "STOCK",
    api_endpoint: "/api/v1/inventory/design/D-015",
    status: "SUCCESS",
    response_summary: "Returned 2,850m available finished stock for D-015",
  },
  {
    id: "log-102",
    timestamp: "2026-08-09T18:12:44Z",
    user_id: "usr-004",
    user_name: "Ramesh Weaver (Loom Op)",
    phone_number: "+919712398765",
    role: "operator",
    raw_command: "SUMMARY",
    parsed_category: "SUMMARY",
    api_endpoint: "/api/v1/management/summary",
    status: "UNAUTHORIZED",
    response_summary: "Access Denied: Financial summary restricted to management role",
  },
];

const SEED_CONFIG: WhatsAppProviderConfig = {
  provider_type: "meta_cloud_api",
  business_phone_number: "+919876500000",
  phone_number_id: "109845720912",
  meta_app_id: "9812405781249",
  access_token_masked: "EAAG...89Xz",
  webhook_url: "https://sckt.erp/api/v1/whatsapp/webhook",
  webhook_verify_token: "sckt_secure_token_2026",
  webhook_status: "verified",
  mock_mode: true,
};

const SEED_STORE: WhatsAppData = {
  config: SEED_CONFIG,
  users: SEED_USERS,
  rules: SEED_RULES,
  auditLogs: SEED_AUDIT,
};

export function getWhatsAppStore(): WhatsAppData {
  if (typeof window === "undefined") return SEED_STORE;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_STORE));
    return SEED_STORE;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return SEED_STORE;
  }
}

export function saveWhatsAppStore(data: WhatsAppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Simulates processing an incoming WhatsApp message:
 * 1. Authenticates phone number against authorized users.
 * 2. Parses command deterministically (NO AI).
 * 3. Enforces RBAC permissions.
 * 4. Executes SCKT business query.
 * 5. Formats response text & WhatsApp UI elements.
 * 6. Records an audit log entry.
 */
export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

export function processWhatsAppMessage(
  phoneNumber: string,
  rawText: string,
): { response: CommandResponse; auditLog: AuditLogEntry } {
  const store = getWhatsAppStore();
  const user = store.users.find((u) => u.phone_number === phoneNumber && u.is_active) || null;

  const req: CommandRequest = {
    sender_phone: phoneNumber,
    raw_text: rawText,
    timestamp: new Date().toISOString(),
  };

  const response = executeWhatsAppCommand(req, user);
  const { category } = parseCommandCategory(rawText);

  let status: AuditLogEntry["status"] = "SUCCESS";
  if (!user) {
    status = "UNAUTHORIZED";
  } else if (!response.required_role_granted) {
    status = "UNAUTHORIZED";
  } else if (category === "UNKNOWN") {
    status = "UNKNOWN_COMMAND";
  }

  const auditLog: AuditLogEntry = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    user_id: user ? user.id : null,
    user_name: user ? user.display_name : "Unknown Sender",
    phone_number: phoneNumber,
    role: user ? user.role : "unauthorized",
    raw_command: rawText,
    parsed_category: category,
    api_endpoint: `/api/v1/whatsapp/${category.toLowerCase()}`,
    status: status,
    response_summary: response.formatted_text.slice(0, 80) + "...",
  };

  // Persist updated audit log
  saveWhatsAppStore({
    ...store,
    auditLogs: [auditLog, ...store.auditLogs],
  });

  return { response, auditLog };
}
