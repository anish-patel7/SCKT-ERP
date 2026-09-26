// WeaveOne WhatsApp Business Bot Architecture & Type Definitions (Rule-Based Non-AI)

export type UserRole =
  | "admin"
  | "management"
  | "costing"
  | "approver"
  | "designer"
  | "planner"
  | "operator"
  | "beam"
  | "store"
  | "quality"
  | "sales"
  | "finance"
  | "jobwork"
  | "customer";

export interface WhatsAppUser {
  id: string;
  phone_number: string; // e.g. "+919876543210"
  display_name: string;
  weaveone_user_id: string;
  role: UserRole;
  is_active: boolean;
  registered_at: string;
}

export type CommandCategory =
  | "MENU"
  | "STOCK"
  | "PRODUCTION"
  | "LOOM"
  | "JOBWORK"
  | "PARTY"
  | "ORDER"
  | "DISPATCH"
  | "PURCHASE"
  | "QUALITY"
  | "REPORTS"
  | "SUMMARY"
  | "UNKNOWN";

export interface CommandRequest {
  sender_phone: string;
  raw_text: string;
  timestamp: string;
}

export interface WhatsAppButtonOption {
  id: string;
  title: string;
}

export interface WhatsAppListOption {
  id: string;
  title: string;
  description?: string;
}

export interface CommandResponse {
  formatted_text: string;
  buttons?: WhatsAppButtonOption[];
  list_options?: WhatsAppListOption[];
  document_url?: string;
  document_name?: string;
  category: CommandCategory;
  required_role_granted: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_id: string | null;
  user_name: string;
  phone_number: string;
  role: UserRole | "unauthorized";
  raw_command: string;
  parsed_category: CommandCategory;
  api_endpoint: string;
  status: "SUCCESS" | "UNAUTHORIZED" | "UNKNOWN_COMMAND" | "ERROR";
  response_summary: string;
}

export type AlertType =
  | "low_stock"
  | "loom_breakdown"
  | "production_delay"
  | "quality_hold"
  | "dispatch_ready"
  | "approval_pending";

export interface NotificationRule {
  alert_type: AlertType;
  label: string;
  enabled: boolean;
  target_roles: UserRole[];
  description: string;
}

export interface WhatsAppProviderConfig {
  provider_type: "meta_cloud_api" | "gupshup" | "twilio" | "mock";
  business_phone_number: string;
  phone_number_id: string;
  meta_app_id: string;
  access_token_masked: string;
  webhook_url: string;
  webhook_verify_token: string;
  webhook_status: "verified" | "error" | "disconnected";
  mock_mode: boolean;
}
