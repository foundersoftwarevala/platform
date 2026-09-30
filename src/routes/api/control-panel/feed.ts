import { createFileRoute } from "@tanstack/react-router";

import { rest as serviceRest } from "@/lib/affiliate/core";
import { controlPanelCaller } from "@/lib/control-panel/access.server";
import { ALERT_SOURCES, isAlertSource, loadFeed } from "@/lib/control-panel/feed.server";

/**
 * The Control Panel banner.
 *
 *   GET  /api/control-panel/feed                                  the items
 *   POST /api/control-panel/feed {action:"acknowledge", source, id}
 *
 * Acknowledging writes the same change the owning module's screen writes, and
 * only to an alert that is still open: if someone else got there first nothing
 * changes and the answer says so. Every acknowledgement is recorded in the
 * platform audit trail with who made it. Approving an application does not
 * come through here - it goes to the applications API, which holds the rules.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/control-panel/feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const access = await controlPanelCaller(request);
        if (!access.ok) return access.response;
        const feed = await loadFeed(access.caller.id);
        return Response.json(feed, { headers: { "Cache-Control": "no-store" } });
      },

      POST: async ({ request }) => {
        const access = await controlPanelCaller(request);
        if (!access.ok) return access.response;

        const body = (await request.json().catch(() => null)) as {
          action?: unknown;
          source?: unknown;
          id?: unknown;
        } | null;
        if (!body || body.action !== "acknowledge")
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Unknown action" }, { status: 400 });
        if (!isAlertSource(body.source))
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Unknown kind of alert" }, { status: 400 });
        if (typeof body.id !== "string" || !UUID.test(body.id))
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "An alert id is required" }, { status: 400 });

        const source = ALERT_SOURCES[body.source];
        const change = source.acknowledge();
        const updated = await serviceRest(
          `${source.table}?id=eq.${body.id}&${source.open}&select=id`,
          { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(change) },
        );
        if (!updated.ok) {
          console.error("[control-panel feed] acknowledge failed", updated.status, await updated.text());
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "The alert could not be acknowledged." }, { status: 502 });
        }
        const rows = (await updated.json()) as unknown[];
        if (!rows.length) {
          return Response.json(
            // i18n-ignore: an API error message; this API answers in English.
            { error: "That alert is no longer open - someone has already dealt with it." },
            { status: 409 },
          );
        }

        const audit = await serviceRest("audit_logs", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            actor: access.caller.email || access.caller.id,
            action: "alert.acknowledged",
            entity_type: source.table,
            entity_id: body.id,
            severity: "info",
            metadata: { via: "control_panel_banner", user_id: access.caller.id, change },
          }),
        });
        if (!audit.ok) console.error("[control-panel feed] audit write failed", audit.status, await audit.text());

        return Response.json({ ok: true, audited: audit.ok });
      },
    },
  },
});
