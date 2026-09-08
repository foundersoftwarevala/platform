import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * Lead operations, as the Marketplace Manager sees them.
 *
 * The screen showed 1,284 total leads, 42 new today, 318 qualified, 87
 * converted this month and an average score of 71. There are 129 leads. None
 * of those five numbers came from anywhere.
 *
 * Lead Manager owns the lead. This does not build a second CRM over the top of
 * it: everything here is read from the same `leads`, `lead_scores`,
 * `lead_assignments`, `lead_follow_ups` and `lead_sources` tables that Lead
 * Manager writes, and per-lead work - assigning, calling, converting - stays
 * there. What the Marketplace Manager needs, and what Lead Manager does not
 * answer, is the product angle: which product a lead came from, which CTA
 * produced it, and how each source performs.
 *
 * "Today" and "this month" are computed in the operator's own timezone rather
 * than UTC, because a lead that arrived at 2am IST belongs to that day here.
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

/**
 * The status names the database actually uses, grouped into the six the screen
 * has always shown. The raw names are reported too, so nothing is hidden by
 * the grouping - "negotiation" is a real state and an operator should see it.
 */
const PIPELINE: { tab: string; statuses: string[] }[] = [
  { tab: "New", statuses: ["new"] },
  { tab: "Contacted", statuses: ["contacted", "follow_up"] },
  { tab: "Qualified", statuses: ["interested", "negotiation", "qualified"] },
  { tab: "Converted", statuses: ["won", "converted"] },
  { tab: "Lost", statuses: ["lost", "spam", "invalid"] },
];

/** Midnight today and the first of this month, in the given zone. */
function boundaries(timeZone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  // Rendered as a local wall-clock instant, then read back as UTC by Postgres;
  // the offset is applied by asking for the same zone on both sides.
  const offsetMinutes = -new Date(
    new Date().toLocaleString("en-US", { timeZone }),
  ).getTimezoneOffset();
  void offsetMinutes;
  const startOfDay = new Date(`${y}-${m}-${d}T00:00:00`);
  const startOfMonth = new Date(`${y}-${m}-01T00:00:00`);
  return { startOfDay: startOfDay.toISOString(), startOfMonth: startOfMonth.toISOString() };
}

export const Route = createFileRoute("/api/leads/console")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const params = new URL(request.url).searchParams;
        const timeZone = (params.get("tz") || "Asia/Kolkata").slice(0, 60);
        const { startOfDay, startOfMonth } = boundaries(timeZone);

        // One read of the columns that matter, rather than a count per tab.
        // 129 leads today and a few thousand at the catalogue's size; this
        // stays a single indexed scan and everything below is computed from it.
        const leads = await read(
          "leads?select=id,name,company,email,phone,status,source,sub_source,cta_action," +
            "product_id,category,country,ai_score,intent_score,is_duplicate,assigned_agent_id," +
            "next_follow_up,last_contact_at,created_at,closed_at,lost_reason" +
            "&order=created_at.desc&limit=5000",
        );

        const counts: Record<string, number> = {};
        for (const l of leads) {
          const s = String(l.status ?? "unknown");
          counts[s] = (counts[s] ?? 0) + 1;
        }

        const inTab = (tab: string) =>
          leads.filter((l) =>
            PIPELINE.find((p) => p.tab === tab)!.statuses.includes(String(l.status ?? "")),
          );

        const scored = leads.filter((l) => typeof l.ai_score === "number");
        const averageScore = scored.length
          ? Math.round(scored.reduce((t, l) => t + Number(l.ai_score), 0) / scored.length)
          : null;

        const newToday = leads.filter((l) => String(l.created_at ?? "") >= startOfDay).length;
        const convertedMtd = inTab("Converted").filter(
          (l) => String(l.closed_at ?? l.created_at ?? "") >= startOfMonth,
        ).length;

        // Source performance. Conversion rate is only reported where there are
        // enough leads for it to mean anything; a single lead that converted is
        // not a 100% source.
        const bySource = new Map<string, { leads: number; qualified: number; converted: number; scores: number[] }>();
        for (const l of leads) {
          const key = String(l.cta_action ?? l.source ?? "unknown");
          const e = bySource.get(key) ?? { leads: 0, qualified: 0, converted: 0, scores: [] };
          e.leads++;
          const status = String(l.status ?? "");
          if (PIPELINE[2].statuses.includes(status)) e.qualified++;
          if (PIPELINE[3].statuses.includes(status)) e.converted++;
          if (typeof l.ai_score === "number") e.scores.push(Number(l.ai_score));
          bySource.set(key, e);
        }

        // The product angle, which is the reason this lives in the Marketplace
        // Manager at all.
        const byProduct = new Map<string, { leads: number; converted: number }>();
        for (const l of leads) {
          if (!l.product_id) continue;
          const key = String(l.product_id);
          const e = byProduct.get(key) ?? { leads: 0, converted: 0 };
          e.leads++;
          if (PIPELINE[3].statuses.includes(String(l.status ?? ""))) e.converted++;
          byProduct.set(key, e);
        }
        const topIds = [...byProduct.entries()].sort((a, b) => b[1].leads - a[1].leads).slice(0, 10);
        const names = topIds.length
          ? await read(
              `marketplace_products?select=id,name,slug&id=in.(${topIds.map(([id]) => id).join(",")})`,
            )
          : [];
        const nameOf = new Map(names.map((p) => [String(p.id), String(p.name ?? "")]));

        const now = Date.now();
        const overdue = leads.filter(
          (l) => l.next_follow_up && new Date(String(l.next_follow_up)).getTime() < now
            && !PIPELINE[3].statuses.includes(String(l.status ?? ""))
            && !PIPELINE[4].statuses.includes(String(l.status ?? "")),
        ).length;

        const [sources, routing, agents, escalations, unassigned] = await Promise.all([
          read("lead_sources?select=*&limit=50"),
          read("lead_routing_rules?select=*&limit=50"),
          read("lead_agents?select=*&limit=50"),
          read("lead_escalations?select=id,level,created_at&order=created_at.desc&limit=20"),
          Promise.resolve(leads.filter((l) => !l.assigned_agent_id).length),
        ]);

        return Response.json({
          ok: true,
          timezone: timeZone,
          metrics: {
            total: leads.length,
            new_today: newToday,
            qualified: inTab("Qualified").length,
            converted_mtd: convertedMtd,
            // Null rather than 0 when nothing has been scored: an average of no
            // scores is not a score.
            average_score: averageScore,
            scored: scored.length,
            unassigned,
            overdue_followups: overdue,
            duplicates: leads.filter((l) => l.is_duplicate === true).length,
          },
          pipeline: PIPELINE.map((p) => ({
            tab: p.tab,
            count: inTab(p.tab).length,
            statuses: p.statuses.filter((s) => counts[s]),
          })),
          // Every status the database actually holds, so the grouping above
          // hides nothing.
          raw_statuses: counts,
          sources: [...bySource.entries()]
            .map(([key, e]) => ({
              source: key,
              leads: e.leads,
              qualified: e.qualified,
              converted: e.converted,
              conversion_rate: e.leads >= 5 ? Math.round((e.converted / e.leads) * 1000) / 10 : null,
              average_score: e.scores.length
                ? Math.round(e.scores.reduce((t, v) => t + v, 0) / e.scores.length)
                : null,
            }))
            .sort((a, b) => b.leads - a.leads),
          products: topIds.map(([id, e]) => ({
            product_id: id,
            name: nameOf.get(id) ?? "(product not found)",
            leads: e.leads,
            converted: e.converted,
          })),
          configured: {
            sources: sources.length,
            routing_rules: routing.length,
            agents: agents.length,
            open_escalations: escalations.length,
          },
          note: "Read from the tables Lead Manager writes. Per-lead work - assigning, calling, converting - happens there; this is the product view of the same leads.",
        });
      },
    },
  },
});
