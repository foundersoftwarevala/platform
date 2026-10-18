import { supabase } from "@/integrations/supabase/client";
import type { EntitySource } from "@/components/affiliate/EntityWall";
import type { EntityFilter } from "@/lib/affiliate-entity";

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
    // activity_logs records what was done under `activity`; everything else
    // about it belongs in `metadata`. Written to activity_log - no plural -
    // every one of these was refused and nothing was ever recorded.
    // activity_logs has no insert policy for signed-in users, so this write is
    // refused; the refusal is reported rather than passed off as recorded.
    const { error } = await supabase.from("activity_logs").insert({
      user_id: actor,
      activity: action,
      metadata: { ...metadata, entity, actor, ts: new Date().toISOString() },
    });
    if (error) throw error;
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

/**
 * Where the Audit Log and Analytics walls read affiliate operator events.
 *
 * The walls were written against activity_log, which does not exist, and
 * activity_logs holds nothing (signed-in users cannot write to it). The
 * affiliate operator actions that are recorded - applications approved,
 * rejected and reviewed - are in marketplace_audit_logs, with an entity type
 * naming the affiliate partner. The walls read those rows; the tab views map
 * onto the entity type or action, and a view with no recorded events of its
 * kind (Revenue, Country, ...) has nothing to show.
 */
const AUDIT_TABS: Record<string, EntityFilter[]> = {
  affiliate: [{ column: "entity_type", value: "marketplace_affiliate_partner" }],
  commission: [{ column: "entity_type", op: "ilike", value: "%commission%" }],
  payout: [{ column: "entity_type", op: "ilike", value: "%payout%" }],
  wallet: [{ column: "entity_type", op: "ilike", value: "%wallet%" }],
  bulk: [{ column: "action", op: "ilike", value: "bulk.%" }],
};

export function affiliateAuditSource<T>(): EntitySource<T> {
  return {
    table: "marketplace_audit_logs",
    select: "id, action, entity_type, entity_id, actor_id, actor, metadata, created_at",
    fixed: [{ column: "entity_type", op: "ilike", value: "%affiliate%" }],
    filter: (f) => {
      if (f.column === "status") return AUDIT_TABS[String(f.value)] ?? null;
      if (f.column === "entity") return [{ ...f, column: "entity_type" }];
      if (f.column === "action") return [f];
      return null;
    },
    sortColumn: (field) => (field === "created_at" || field === "action" ? field : null),
    searchColumns: ["action", "entity_type"],
    order: { column: "created_at", ascending: false },
    toRows: (rows) =>
      rows.map((r) => {
        const metadata = (r.metadata ?? {}) as Record<string, unknown>;
        return {
          id: String(r.id),
          action: String(r.action ?? ""),
          entity: (r.entity_type as string | null) ?? null,
          entity_id: (r.entity_id as string | null) ?? null,
          actor_id: (r.actor_id as string | null) ?? null,
          affiliate_id: (metadata["affiliate_id"] as string | undefined) ?? null,
          metadata: { actor: r.actor ?? undefined, ...metadata },
          created_at: String(r.created_at ?? ""),
        } as unknown as T;
      }),
  };
}
