import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";

/**
 * Support Desk, over the support records that already exist.
 *
 * This is the richest real dataset in the console: 11 tickets with priority,
 * channel, category and SLA columns, 5 escalations, 5 chat sessions with 11
 * messages, 28 published FAQs across 7 categories, and 6 knowledge articles.
 * None of it needed creating.
 *
 * Three things it will not do.
 *
 * CSAT renders as a dash. The column exists on every ticket and not one row has
 * a value, so there is no satisfaction score to report - section 2 and section
 * 39 both say a dash rather than a number, and an average of nothing would be
 * the easiest fake on this screen.
 *
 * First-response time renders as a dash for the same reason: first_response_at
 * is null on all 11 tickets, so the first-response SLA cannot be computed from
 * these records however much the column suggests it could.
 *
 * And the ticket dates are reported. The newest is from 19 August; nothing has
 * been raised since, which is worth knowing before anybody reads the queue as
 * live.
 *
 * Chat reuses chat_sessions and chat_messages, which is the platform's existing
 * chat architecture. No second chat system is created here - section 51 asks
 * exactly that, and there is already a Chat Manager that owns those tables.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows<T = Record<string, unknown>>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

async function count(path: string): Promise<number | null> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, {
      headers: { ...admin(), Prefer: "count=exact", Range: "0-0" },
    });
    if (!response.ok) return null;
    return Number((response.headers.get("content-range") ?? "").split("/")[1]) || 0;
  } catch {
    return null;
  }
}

const OPEN_STATES = new Set(["new", "assigned", "in_progress", "waiting", "open", "reopened", "escalated"]);
const CLOSED_STATES = new Set(["resolved", "closed"]);

const daysAgo = (value: unknown): number | null => {
  if (!value) return null;
  const at = Date.parse(String(value));
  return Number.isFinite(at) ? Math.floor((Date.now() - at) / 86400000) : null;
};

async function audit(request: Request, action: string, after: unknown, reason: string) {
  try {
    const authorization = request.headers.get("authorization");
    const anon =
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? "";
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    const asOperator = Boolean(authorization && anon);
    await fetch(`${url()}/rest/v1/rpc/mm_audit`, {
      method: "POST",
      headers: asOperator
        ? { apikey: anon, Authorization: authorization!, "Content-Type": "application/json" }
        : { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_action: action, p_entity_type: "support", p_entity_id: null,
        p_before: null, p_after: after, p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[support] audit failed", error);
  }
}

export const Route = createFileRoute("/api/marketplace/support")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const params = new URL(request.url).searchParams;
        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const may = (action: string) => {
          const d = resolveAction({ roles: caller.roles, action, permissions: matrix });
          return d.visible && d.enabled;
        };
        if (!may("view")) {
          await recordDenial(request, {
            action: "support_view", permission: "marketplace.view",
            roles: caller.roles, entityType: "support", recordId: null,
            why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: "Permission marketplace.view is required." },
            { status: 403 },
          );
        }

        // Sections 18 to 20: searched, filtered and sorted on the server.
        const q = (params.get("q") ?? "").trim();
        const status = params.get("status") ?? "all";
        const priority = params.get("priority") ?? "all";
        const sort = params.get("sort") ?? "created_at.desc";
        const page = Math.max(1, Number(params.get("page") ?? 1));
        const size = Math.min(100, Math.max(10, Number(params.get("size") ?? 25)));

        let filter = "";
        if (status !== "all") filter += `&status=eq.${encodeURIComponent(status)}`;
        if (priority !== "all") filter += `&priority=eq.${encodeURIComponent(priority)}`;
        if (q) {
          filter += `&or=(subject.ilike.*${encodeURIComponent(q)}*,description.ilike.*${encodeURIComponent(q)}*,` +
            `customer_name.ilike.*${encodeURIComponent(q)}*,reference.ilike.*${encodeURIComponent(q)}*)`;
        }
        const allowedSort = new Set([
          "created_at.desc", "created_at.asc", "updated_at.desc",
          "priority.asc", "status.asc", "sla_minutes_remaining.asc",
        ]);
        const order = allowedSort.has(sort) ? sort : "created_at.desc";

        const [
          tickets, allTickets, ticketTotal, escalations,
          chatSessions, chatMessages, faqs, faqCategories, articles, chatbots,
          quickRequests, faqVersions,
        ] = await Promise.all([
          rows<Record<string, unknown>>(
            `support_tickets?select=*${filter}&order=${order}&offset=${(page - 1) * size}&limit=${size}`,
          ),
          rows<Record<string, unknown>>("support_tickets?select=reference,status,priority,channel,category,csat,created_at,resolved_at,first_response_at,sla_breached,sla_minutes_remaining,assigned_to&limit=1000"),
          count(`support_tickets?select=id${filter}`),
          rows<Record<string, unknown>>("support_escalations?select=*&order=created_at.desc&limit=50"),
          rows<Record<string, unknown>>("chat_sessions?select=*&order=started_at.desc&limit=50"),
          count("chat_messages?select=id"),
          rows<Record<string, unknown>>("faqs?select=id,question,category_id,language,position,published_at,ai_generated&order=position&limit=200"),
          rows<Record<string, unknown>>("faq_categories?select=id,name,slug,enabled,position&order=position"),
          rows<Record<string, unknown>>("wiki_articles?select=*&order=views.desc&limit=50"),
          rows<Record<string, unknown>>("chatbots?select=name,channel,status,conversations,resolution_rate,escalation_rate"),
          count("quick_support_requests?select=id"),
          count("faq_versions?select=id"),
        ]);

        /* ------------------------------------------------------ metrics */
        const open = allTickets.filter((t) => OPEN_STATES.has(String(t.status)));
        const closed = allTickets.filter((t) => CLOSED_STATES.has(String(t.status)));
        const withCsat = allTickets.filter((t) => t.csat !== null && t.csat !== undefined);
        const withFirstResponse = allTickets.filter((t) => t.first_response_at);
        const breached = allTickets.filter((t) => t.sla_breached === true);

        const resolutionTimes = allTickets
          .filter((t) => t.resolved_at && t.created_at)
          .map((t) => Date.parse(String(t.resolved_at)) - Date.parse(String(t.created_at)))
          .filter((v) => Number.isFinite(v) && v > 0);

        const tally = (field: string) => {
          const out: Record<string, number> = {};
          for (const t of allTickets) out[String(t[field] ?? "unknown")] = (out[String(t[field] ?? "unknown")] ?? 0) + 1;
          return out;
        };

        const newest = allTickets
          .map((t) => Date.parse(String(t.created_at)))
          .filter(Number.isFinite)
          .sort((a, b) => b - a)[0];

        return Response.json({
          ok: true,
          metrics: {
            tickets: allTickets.length,
            open: open.length,
            resolved: closed.length,
            // Section 2 and 39: no response exists, so no score is reported.
            csat: withCsat.length > 0
              ? Math.round((withCsat.reduce((s, t) => s + Number(t.csat), 0) / withCsat.length) * 100) / 100
              : null,
          },
          metric_sources: {
            tickets: "support_tickets — every row.",
            open: "Tickets in new, assigned, in progress, waiting, escalated or reopened.",
            resolved: "Tickets in resolved or closed.",
            csat: withCsat.length === 0
              ? "The csat column exists on every ticket and not one row has a value. There is no satisfaction score to report, so this is a dash — an average of nothing would be the easiest fake on this screen."
              : `Averaged over ${withCsat.length} real response(s).`,
          },
          seed_markers: {
            declared: allTickets.filter((t) =>
              String(t.reference ?? "").toUpperCase().startsWith("SEED")).length,
            sequential_references: allTickets.filter((t) =>
              /^TKT-\d{3}$/.test(String(t.reference ?? ""))).length,
            note:
              "A record that names itself SEED is counted as declared. The sequentially numbered ones are reported as a pattern and not as a verdict — they are TKT-001 upward, created inside a single week, which is strong evidence of one origin and is not the same thing as the record saying so.",
          },
          freshness: {
            newest_ticket_days_ago: newest ? Math.floor((Date.now() - newest) / 86400000) : null,
            note: newest && Date.now() - newest > 7 * 86400000
              ? "Nothing has been raised recently. These records are real but they are not a live queue, and the dates say so."
              : null,
          },
          tickets: {
            page, size, total: ticketTotal, rows: tickets,
            breakdown: {
              status: tally("status"), priority: tally("priority"),
              channel: tally("channel"), category: tally("category"),
            },
            assigned: allTickets.filter((t) => t.assigned_to).length,
          },
          sla: {
            breached: breached.length,
            first_response_recorded: withFirstResponse.length,
            first_response_note: withFirstResponse.length === 0
              ? "first_response_at is null on every ticket, so the first-response SLA cannot be computed from these records however much the column suggests it could."
              : null,
            average_resolution_hours: resolutionTimes.length
              ? Math.round((resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) / 3600000 * 10) / 10
              : null,
            resolution_sample: resolutionTimes.length,
          },
          escalations: {
            rows: escalations,
            open: escalations.filter((e) => String(e.status) !== "resolved").length,
            by_level: escalations.reduce((acc: Record<string, number>, e) => {
              acc[String(e.level)] = (acc[String(e.level)] ?? 0) + 1;
              return acc;
            }, {}),
          },
          chat: {
            sessions: chatSessions,
            messages: chatMessages,
            active: chatSessions.filter((s) => String(s.status) === "active").length,
            architecture:
              "chat_sessions and chat_messages are the platform's existing chat tables, owned by the Chat Manager. This screen reads them; it does not start a second chat system.",
            bots: chatbots,
          },
          knowledge: {
            articles,
            published: articles.filter((a) => String(a.status) === "published").length,
            drafts: articles.filter((a) => String(a.status) === "draft").length,
            // View and helpful counts sit on the article row with no event
            // table behind them, which is the same shape of problem the
            // Integrity screen reports for ratings and downloads.
            counters_note:
              "The view and helpful counts are columns on the article, and there is no view or feedback event table behind them. They cannot be reconciled against anything, so treat them as recorded rather than measured.",
          },
          faqs: {
            total: faqs.length,
            published: faqs.filter((f) => f.published_at).length,
            ai_generated: faqs.filter((f) => f.ai_generated).length,
            categories: faqCategories,
            rows: faqs.slice(0, 100),
            versions: faqVersions,
            versions_note: (faqVersions ?? 0) === 0
              ? "faq_versions exists and is empty, so no FAQ has a version history yet."
              : null,
          },
          announcements: {
            state: "NOT CONNECTED",
            reason:
              "There is no announcements table on this database and none can be created from here — the management token answers 401, so there is no DDL. Nothing is shown rather than a composer that would write nowhere.",
          },
          quick_requests: quickRequests,
          permissions: {
            view: true,
            edit: may("edit"),
            export: may("export"),
          },
        });
      },

      /** Section 24: an audited export of what the caller may already read. */
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { action?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const decision = resolveAction({ roles: caller.roles, action: "export", permissions: matrix });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action: "support_export", permission: "marketplace.export",
            roles: caller.roles, entityType: "support", recordId: null,
            why: `${decision.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: decision.reason },
            { status: 403 },
          );
        }

        if (body.action !== "export_tickets") {
          return Response.json(
            {
              ok: false, reason: "unsupported_action",
              message:
                "Only export_tickets runs from here. Creating and replying to tickets belongs in the screen that owns the conversation, where the customer-visible and internal distinction is made explicitly.",
            },
            { status: 400 },
          );
        }

        const list = await rows<Record<string, unknown>>(
          "support_tickets?select=reference,subject,status,priority,category,channel,customer_name,assigned_to,created_at,resolved_at,sla_breached,csat&order=created_at.desc&limit=5000",
        );
        const cell = (v: unknown) => {
          const t = v === null || v === undefined ? "" : String(v);
          return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        };
        const lines = ["reference,subject,status,priority,category,channel,customer,assigned_to,created_at,resolved_at,sla_breached,csat"];
        for (const r of list) {
          lines.push([
            r.reference, r.subject, r.status, r.priority, r.category, r.channel,
            r.customer_name, r.assigned_to, r.created_at, r.resolved_at, r.sla_breached, r.csat,
          ].map(cell).join(","));
        }
        // Descriptions and conversation bodies are left out deliberately: an
        // export is the easiest way for customer text to leave the building.
        await audit(request, "Support tickets exported", { rows: list.length },
          `${list.length} tickets exported. Descriptions and message bodies were not included.`);
        return new Response(lines.join("\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="support-tickets-${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        });
      },
    },
  },
});
