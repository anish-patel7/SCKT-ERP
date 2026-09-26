// WeaveOne WhatsApp Automatic Alert Notification Engine (Section 18 of Spec)
import type { AlertType, NotificationRule, WhatsAppUser } from "./types";
import { MockWhatsAppProvider } from "./provider-adapter";

export interface AlertPayload {
  alert_type: AlertType;
  title: string;
  item_code?: string;
  loom_no?: string;
  roll_no?: string;
  order_no?: string;
  party_name?: string;
  current_val?: string;
  target_val?: string;
  reason?: string;
}

export function formatAlertMessage(payload: AlertPayload): string {
  switch (payload.alert_type) {
    case "low_stock":
      return `⚠️ *LOW STOCK ALERT*

*Material:* ${payload.item_code || "40/1 Cotton Yarn"}
*Current Stock:* ${payload.current_val || "420 kg"}
*Minimum Threshold:* ${payload.target_val || "500 kg"}

*Action Required:* Create Purchase Order.`;

    case "loom_breakdown":
      return `🔴 *LOOM BREAKDOWN ALERT*

*Loom:* ${payload.loom_no || "L-04"}
*Stop Reason:* ${payload.reason || "Electrical Fault"}
*Time:* ${new Date().toLocaleTimeString("en-IN")}
*Status:* Loom Maintenance Triggered`;

    case "production_delay":
      return `⚠️ *PRODUCTION DELAY ALERT*

*Job Card:* ${payload.item_code || "JC-1025"}
*Target Quantity:* ${payload.target_val || "5,000 m"}
*Woven Production:* ${payload.current_val || "2,850 m"}
*Pending Balance:* 2,150 m`;

    case "quality_hold":
      return `🔴 *QUALITY HOLD ALERT (BR-153)*

*Roll #:* ${payload.roll_no || "ROL-9903"}
*Item / Design:* ${payload.item_code || "ITEM-002"}
*Hold Reason:* ${payload.reason || "Oil Stain Contamination"}

*Status:* DISPATCH BLOCKED`;

    case "dispatch_ready":
      return `🚚 *DISPATCH READY ALERT*

*Party Name:* ${payload.party_name || "Shree Fabrics Pvt Ltd"}
*Sales Order:* ${payload.order_no || "SO-2601"}
*Quantity Ready:* ${payload.current_val || "4,500 m"}

*Status:* READY FOR PACKING LIST`;

    default:
      return `🔔 *WEAVEONE SYSTEM NOTIFICATION*\n\n${payload.title}`;
  }
}

export async function dispatchAlertNotification(
  payload: AlertPayload,
  users: WhatsAppUser[],
  rules: NotificationRule[],
): Promise<{ dispatched_count: number }> {
  const rule = rules.find((r) => r.alert_type === payload.alert_type);
  if (!rule || !rule.enabled) return { dispatched_count: 0 };

  const recipients = users.filter((u) => u.is_active && rule.target_roles.includes(u.role));
  const provider = new MockWhatsAppProvider();
  const formattedText = formatAlertMessage(payload);

  let sent = 0;
  for (const user of recipients) {
    await provider.sendText(user.phone_number, formattedText);
    sent++;
  }

  return { dispatched_count: sent };
}
