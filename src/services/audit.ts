import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export class AuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditError";
  }
}

// Mirrors public.audit_log.
export const AuditEntrySchema = z.object({
  id: z.string().uuid(),
  entity: z.string(),
  entity_id: z.string().nullable(),
  action: z.string(),
  details: z.string().nullable(),
  actor_id: z.string().uuid().nullable(),
  actor_name: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const auditService = {
  /**
   * Record a security-sensitive change. Failures are logged, not thrown, so a
   * completed change is never reported as failed because its audit row was rejected.
   */
  async record(entity: string, entityId: string | null, action: string, details: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("audit_log").insert({
      entity,
      entity_id: entityId,
      action,
      details,
      actor_id: user?.id ?? null,
      actor_name: user?.email ?? null,
    });
    if (error) console.error("Audit log write failed:", error.message);
  },

  async listRecent(limit = 200): Promise<AuditEntry[]> {
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, entity, entity_id, action, details, actor_id, actor_name, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new AuditError(`Failed to fetch audit history: ${error.message}`);
    }

    return z.array(AuditEntrySchema).parse(data ?? []);
  },
};
