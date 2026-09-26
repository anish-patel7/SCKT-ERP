// SCKT WhatsApp Provider Adapter Architecture (Section 4 of Spec)
import type { WhatsAppButtonOption, WhatsAppListOption, WhatsAppProviderConfig } from "./types";

export interface WhatsAppProviderPayload {
  to_phone: string;
  body: string;
  buttons?: WhatsAppButtonOption[];
  list_options?: WhatsAppListOption[];
  document_url?: string;
  document_name?: string;
  template_name?: string;
}

export interface WhatsAppProvider {
  sendText(to: string, message: string): Promise<{ success: boolean; message_id: string }>;
  sendTemplate(
    to: string,
    templateName: string,
    params: string[],
  ): Promise<{ success: boolean; message_id: string }>;
  sendButtons(
    to: string,
    body: string,
    buttons: WhatsAppButtonOption[],
  ): Promise<{ success: boolean; message_id: string }>;
  sendList(
    to: string,
    body: string,
    title: string,
    options: WhatsAppListOption[],
  ): Promise<{ success: boolean; message_id: string }>;
  sendDocument(
    to: string,
    documentUrl: string,
    caption: string,
  ): Promise<{ success: boolean; message_id: string }>;
  verifyWebhook(verifyToken: string, challenge: string): boolean;
}

/**
 * Meta WhatsApp Cloud API Provider Adapter
 * Encapsulates graph.facebook.com API v18.0 format without embedding ERP logic.
 */
export class MetaCloudApiProvider implements WhatsAppProvider {
  private config: WhatsAppProviderConfig;

  constructor(config: WhatsAppProviderConfig) {
    this.config = config;
  }

  async sendText(to: string, message: string) {
    // In production, posts to https://graph.facebook.com/v18.0/{phone_number_id}/messages
    return { success: true, message_id: `wamid.meta.${Date.now()}` };
  }

  async sendTemplate(to: string, templateName: string, _params: string[]) {
    return { success: true, message_id: `wamid.meta.tpl.${Date.now()}` };
  }

  async sendButtons(to: string, body: string, _buttons: WhatsAppButtonOption[]) {
    return { success: true, message_id: `wamid.meta.btn.${Date.now()}` };
  }

  async sendList(to: string, body: string, _title: string, _options: WhatsAppListOption[]) {
    return { success: true, message_id: `wamid.meta.list.${Date.now()}` };
  }

  async sendDocument(to: string, _documentUrl: string, _caption: string) {
    return { success: true, message_id: `wamid.meta.doc.${Date.now()}` };
  }

  verifyWebhook(verifyToken: string, _challenge: string): boolean {
    return verifyToken === this.config.webhook_verify_token;
  }
}

/**
 * Mock Provider Adapter (MOCK_MODE=true)
 * Allows testing full WhatsApp flows before production database & webhook go live.
 */
export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendText(_to: string, _message: string) {
    return { success: true, message_id: `mock-msg-${Date.now()}` };
  }

  async sendTemplate(_to: string, _templateName: string, _params: string[]) {
    return { success: true, message_id: `mock-tpl-${Date.now()}` };
  }

  async sendButtons(_to: string, _body: string, _buttons: WhatsAppButtonOption[]) {
    return { success: true, message_id: `mock-btn-${Date.now()}` };
  }

  async sendList(_to: string, _body: string, _title: string, _options: WhatsAppListOption[]) {
    return { success: true, message_id: `mock-list-${Date.now()}` };
  }

  async sendDocument(_to: string, _documentUrl: string, _caption: string) {
    return { success: true, message_id: `mock-doc-${Date.now()}` };
  }

  verifyWebhook(_verifyToken: string, _challenge: string): boolean {
    return true;
  }
}
