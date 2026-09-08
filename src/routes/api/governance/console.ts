import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * Activity, audit and version history, from the records that exist.
 *
 * The screen showed 1,284 events today, 18 scheduled, 42 backups and 6
 * rollbacks, beside a version panel listing V4.2, V4.1, V4.0 and V3.9. Section
 * 53 names those as the thing to remove. There are 87 audit rows, no versions,
 * nothing scheduled, and no backup system at all.
 *
 * That last one matters and is not softened here. marketplace_backups,
 * marketplace_schedules, marketplace_approvals and marketplace_bulk_operations
 * do not exist - the database answers 404 for each - so the backup, approval
 * and bulk-operation sections have nothing behind them and say so. Showing "42
 * backups" over a system that has never taken one is the most dangerous
 * number on this screen: it is the one somebody relies on the day they need a
 * restore.
 *
 * What is real: marketplace_audit_logs, append-only in practice - verified by
 * trying to change and delete a row with the anon key and finding it unchanged
 * and still there - and the publish_at / unpublish_at columns on products,
 * which are the actual scheduling mechanism this application has.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

type Row = Record<string, unknown>;

async function read(path: string): Promise<Row[]> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as Row[];
  } catch {
    return [];
  }
}

/** Whether a table exists at all, rather than assuming it does. */
async function exists(table: string): Promise<boolean> {
  try {
    const response = await fetch(`${url()}/rest/v1/${table}?select=*&limit=1`, { headers: admin() });
    return response.status !== 404;
  } catch {
    return false;
  }
}

const ROLLBACK = /rollback|restore|revert/i;

export const Route = createFileRoute("/api/governance/console")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const params = new URL(request.url).searchParams;
        const timeZone = (params.get("tz") || "Asia/Kolkata").slice(0, 60);
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        }).formatToParts(new Date());
        const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
        const startOfDay = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00`).toISOString();
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        const [events, versions, scheduledPublish, scheduledUnpublish, hasBackups, hasSchedules, hasApprovals, hasBulk] =
          await Promise.all([
            read(
              "marketplace_audit_logs?select=id,action,entity_type,entity_id,actor,actor_role,actor_id," +
                "reason,module,request_id,created_at,before_state,after_state&order=created_at.desc&limit=500",
            ),
            read("marketplace_product_versions?select=*&order=created_at.desc&limit=50"),
            read("marketplace_products?select=id,name,slug,publish_at,visible&publish_at=not.is.null&order=publish_at.asc&limit=100"),
            read("marketplace_products?select=id,name,slug,unpublish_at,visible&unpublish_at=not.is.null&order=unpublish_at.asc&limit=100"),
            exists("marketplace_backups"),
            exists("marketplace_schedules"),
            exists("marketplace_approvals"),
            exists("marketplace_bulk_operations"),
          ]);

        const today = events.filter((e) => String(e.created_at ?? "") >= startOfDay);
        const week = events.filter((e) => String(e.created_at ?? "") >= weekAgo);
        const rollbacks = events.filter((e) => ROLLBACK.test(String(e.action ?? "")));

        const byAction: Record<string, number> = {};
        const byModule: Record<string, number> = {};
        const byActor: Record<string, number> = {};
        for (const e of events) {
          const a = String(e.action ?? "unknown");
          byAction[a] = (byAction[a] ?? 0) + 1;
          const m = String(e.module ?? "unknown");
          byModule[m] = (byModule[m] ?? 0) + 1;
          const r = String(e.actor_role ?? "unknown");
          byActor[r] = (byActor[r] ?? 0) + 1;
        }

        return Response.json({
          ok: true,
          timezone: timeZone,
          metrics: {
            events_today: today.length,
            events_7d: week.length,
            events_held: events.length,
            // Counted from the audit trail itself: an action naming a rollback,
            // restore or revert. Zero means none was ever recorded.
            rollbacks: rollbacks.length,
            versions: versions.length,
            scheduled: scheduledPublish.length + scheduledUnpublish.length,
          },
          activity: events.slice(0, 60).map((e) => ({
            id: e.id,
            action: e.action,
            entity_type: e.entity_type,
            entity_id: e.entity_id,
            actor: e.actor ?? (e.actor_id ? "account" : "system"),
            actor_role: e.actor_role ?? "system",
            reason: e.reason,
            module: e.module,
            correlation_id: e.request_id,
            created_at: e.created_at,
            has_before: e.before_state !== null && e.before_state !== undefined,
            has_after: e.after_state !== null && e.after_state !== undefined,
          })),
          breakdown: { by_action: byAction, by_module: byModule, by_actor_role: byActor },
          versions: versions.map((v) => ({ ...v })),
          schedules: [
            ...scheduledPublish.map((p) => ({
              product_id: p.id, name: p.name, slug: p.slug,
              action: "publish", at: p.publish_at, currently_visible: p.visible,
            })),
            ...scheduledUnpublish.map((p) => ({
              product_id: p.id, name: p.name, slug: p.slug,
              action: "unpublish", at: p.unpublish_at, currently_visible: p.visible,
            })),
          ],
          // What this module does not have, named rather than implied.
          capabilities: {
            audit_log: {
              state: "CONNECTED",
              detail: "marketplace_audit_logs, written by the mm_audit function every manager operation calls.",
            },
            immutability: {
              state: "CONNECTED",
              detail:
                "No signed-in role can change or remove an audit row - verified by attempting an update and a delete with the anon key and finding the row unchanged and the count identical. The service role bypasses row level security, as it does on every table.",
            },
            scheduling: {
              state: "PARTIALLY_CONNECTED",
              detail:
                "Products carry publish_at and unpublish_at and the catalogue reader honours them, so a schedule takes effect. There is no scheduler table, no job runner and no execution record, so a failed schedule cannot be reported as failed.",
            },
            versions: {
              state: versions.length ? "CONNECTED" : "PARTIALLY_CONNECTED",
              detail: versions.length
                ? `${versions.length} version record(s) held.`
                : "marketplace_product_versions exists and is empty. No product change has ever written a version, so there is nothing to diff or roll back to.",
            },
            backups: {
              state: hasBackups ? "PARTIALLY_CONNECTED" : "NOT_IMPLEMENTED",
              detail: hasBackups
                ? "A backup table exists."
                : "There is no backup system. marketplace_backups does not exist, nothing has ever taken a backup, and no restore is possible. This is reported rather than shown as a number because a backup count is what somebody relies on the day they need a restore.",
            },
            approvals: {
              state: hasApprovals ? "PARTIALLY_CONNECTED" : "NOT_IMPLEMENTED",
              detail: hasApprovals
                ? "An approvals table exists."
                : "marketplace_approvals does not exist. Author submissions have their own approval workflow with a real state machine; this module has none of its own.",
            },
            bulk_operations: {
              state: hasBulk ? "PARTIALLY_CONNECTED" : "NOT_IMPLEMENTED",
              detail: hasBulk
                ? "A bulk operations table exists."
                : "marketplace_bulk_operations does not exist, so a bulk run has no operation id to group its audit rows under.",
            },
            schedule_table: { state: hasSchedules ? "PRESENT" : "ABSENT" },
          },
        });
      },
    },
  },
});
