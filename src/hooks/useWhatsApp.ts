import { useCallback, useEffect, useState } from "react";
import {
  getWhatsAppStore,
  saveWhatsAppStore,
  type WhatsAppData,
} from "@/lib/whatsapp/whatsapp-store";

const EMPTY: WhatsAppData = {
  config: {
    provider_type: "meta_cloud_api",
    business_phone_number: "+919876500000",
    phone_number_id: "109845720912",
    meta_app_id: "9812405781249",
    access_token_masked: "EAAG...89Xz",
    webhook_url: "https://sckt.erp/api/v1/whatsapp/webhook",
    webhook_verify_token: "sckt_secure_token_2026",
    webhook_status: "verified",
    mock_mode: true,
  },
  users: [],
  rules: [],
  auditLogs: [],
};

export function useWhatsApp() {
  const [data, setData] = useState<WhatsAppData>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(getWhatsAppStore());
    setReady(true);
  }, []);

  const update = useCallback((fn: (prev: WhatsAppData) => WhatsAppData) => {
    setData((prev) => {
      const next = fn(prev);
      saveWhatsAppStore(next);
      return next;
    });
  }, []);

  return { data, ready, update };
}
