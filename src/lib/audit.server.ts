import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AUDIT_SEVERITIES = ["info", "low", "medium", "high", "warning", "critical"] as const;

export interface AuditEventInput {
  action: string;
  entityType: string;
  entityId?: string | null | undefined;
  severity?: (typeof AUDIT_SEVERITIES)[number] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/** Writes one audit_logs row for the signed-in user. Throws when it was not written. */
export const recordAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AuditEventInput) => {
    const text = (value: unknown, field: string, max: number) => {
      if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
      return value.trim().slice(0, max);
    };
    return {
      action: text(input?.action, "action", 200),
      entityType: text(input?.entityType, "entityType", 100),
      entityId: input?.entityId ? String(input.entityId).slice(0, 200) : null,
      severity: AUDIT_SEVERITIES.includes(input?.severity as never) ? input.severity! : "info",
      metadata: (() => {
        const metadata =
          input?.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
            ? input.metadata
            : {};
        if (JSON.stringify(metadata).length > 16_000) throw new Error("metadata is too large");
        return metadata;
      })(),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = (context.claims as { email?: string } | undefined)?.email;
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor: email ?? context.userId,
      action: data.action,
      entity_type: data.entityType,
      entity_id: data.entityId,
      severity: data.severity,
      metadata: { ...data.metadata, actor_user_id: context.userId, source: "client" } as never,
    });
    if (error) throw new Error(`Audit log write failed: ${error.message}`);
    return { ok: true as const };
  });
