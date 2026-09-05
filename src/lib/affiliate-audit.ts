import { supabase } from "@/integrations/supabase/client";

/**
 * Append a structured audit event to activity_log. Used by bulk actions,
 * permission-gated executions, and realtime bridges so every operator
 * action is traceable across walls. Failures are swallowed and logged so
 * we never break the primary UX path if the audit write is rejected.
 */
export async function logAudit(
  action: string,
  entity: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const actor = sess.session?.user?.id ?? null;
    await supabase.from("activity_log").insert({
      action,
      entity,
      metadata: { ...metadata, actor, ts: new Date().toISOString() },
    });
  } catch (err) {
    // Audit must never break the caller; surface to console for triage.
    console.warn("[audit] failed to record", action, err);
  }
}

/**
 * Convenience wrapper for single-row operator actions (activate, deactivate,
 * status change, commission/wallet/payout updates). Encodes a consistent
 * `action` verb + `entity` id so activity_log can be filtered per record.
 */
export async function logRowAction(
  entity: string,
  entityId: string,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await logAudit(`${entity}.${action}`, entityId, { scope: "row", entity, entityId, ...metadata });
}
