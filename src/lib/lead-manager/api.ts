import { supabase } from "@/integrations/supabase/client";
import type { Agent, LeadInsert, LeadStatus, LeadUpdate } from "./types";

/** Records an immutable audit entry for every privileged Lead Manager action. */
export async function writeAudit(entry: {
  lead_id?: string | null;
  action: string;
  action_type?: string;
  details?: string;
  actor?: string;
  actor_role?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("lead_audit_logs").insert({
    lead_id: entry.lead_id ?? null,
    action: entry.action,
    action_type: entry.action_type ?? "read",
    details: entry.details ?? null,
    actor: entry.actor ?? "Lead Manager Console",
    actor_role: entry.actor_role ?? "Admin",
    metadata: (entry.metadata ?? {}) as never,
  });
  if (error) console.error("[audit]", error.message);
}

function unwrap<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

/**
 * Which budget band a lead falls in, and what that band is worth.
 *
 * This used to be written as two substring tests:
 *
 *   budget.includes("10L") ? 25 : budget.includes("6L") ? 18 : 10
 *
 * The bands actually stored are "₹10L+", "₹6L - ₹10L", "₹3L - ₹6L",
 * "₹1L - ₹3L" and "Under ₹1L". "₹6L - ₹10L" contains "10L", so the band below
 * the top one scored as the top one - 24 leads in the current data. "₹3L - ₹6L"
 * contains "6L" and took the middle weight for the same reason, another 24.
 *
 * The three weights are unchanged, because which band is worth what is a
 * business decision. What changed is which band each lead lands in: the top
 * band is the one that is open-ended, the middle band is the one that runs to
 * ten lakh, and everything below them takes the base weight. Currency symbols,
 * spaces and case are removed first so a differently typed label still lands
 * in the right place, and anything unrecognised - a bare number, say - takes
 * the base weight rather than guessing.
 */
function budgetBandWeight(raw: string): number {
  const band = raw.replace(/[^0-9a-z+]/gi, "").toLowerCase();
  // The plus is what marks the open-ended top band, so it is matched literally.
  // Written as 10l+ it would mean "ten followed by one or more L", which is
  // true of "6l10l" as well and puts the band below the top one back on the
  // top weight - the exact fault this function exists to remove.
  if (/10l\+/.test(band)) return 25;
  if (/6l10l/.test(band)) return 18;
  return 10;
}

/**
 * What a re-score works out, from the lead record alone.
 *
 * Separated from the database call so it can be checked without one. The
 * caller stores the result; everything decided here is decided from the four
 * fields below and nothing else.
 */
export function rescoreFromRecord(lead: {
  budget_range?: string | null;
  source?: string | null;
  intent_score?: number | null;
  last_contact_at?: string | null;
  created_at?: string | null;
}): {
  score: number;
  probability: number;
  /** How many of the four inputs the lead supplied, as a percentage. */
  coverage: number;
  factors: { factor: string; weight: number; evidence: string }[];
} {
  const factors: { factor: string; weight: number; evidence: string }[] = [];
  let known = 0;
  const total = 4;

  const budget = String(lead.budget_range ?? "");
  if (budget) {
    known += 1;
    const weight = budgetBandWeight(budget);
    factors.push({ factor: "budget", weight, evidence: `Budget recorded as ${budget}.` });
  } else {
    factors.push({
      factor: "budget",
      weight: 10,
      evidence: "No budget recorded; scored at the base weight.",
    });
  }

  if (lead.source) {
    known += 1;
    const strong = ["referral", "website", "whatsapp"].includes(lead.source);
    factors.push({
      factor: "source",
      weight: strong ? 18 : 10,
      evidence: `Came from ${lead.source}${strong ? ", which converts better than average." : "."}`,
    });
  } else {
    factors.push({
      factor: "source",
      weight: 10,
      evidence: "Source not recorded; scored at the base weight.",
    });
  }

  // Engagement, from what is actually known. Nothing in the platform writes
  // intent_score, so when it is absent it counts for nothing rather than for
  // a number chosen here.
  const contacted = Boolean(lead.last_contact_at);
  if (lead.intent_score != null) {
    known += 1;
    factors.push({
      factor: "engagement",
      weight: Math.min(25, Math.round(lead.intent_score / 4) + (contacted ? 6 : 0)),
      evidence: `Intent score ${lead.intent_score}${contacted ? ", and the lead has been contacted." : ", not yet contacted."}`,
    });
  } else {
    factors.push({
      factor: "engagement",
      weight: contacted ? 6 : 0,
      evidence: contacted
        ? "No intent score recorded; counted only that the lead has been contacted."
        : "No intent score recorded and no contact yet, so engagement adds nothing.",
    });
  }

  if (lead.created_at) {
    known += 1;
    const days = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86_400_000);
    factors.push({
      factor: "freshness",
      weight: Math.max(0, 20 - days),
      evidence: `Arrived ${days} day${days === 1 ? "" : "s"} ago.`,
    });
  }

  const score = Math.max(
    5,
    Math.min(
      99,
      factors.reduce((t, f) => t + f.weight, 0),
    ),
  );
  return {
    score,
    probability: Math.max(2, Math.min(97, score - 6)),
    coverage: Math.round((known / total) * 100),
    factors,
  };
}

export const leadApi = {
  async listLeads(
    filters: {
      status?: string;
      source?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    // The default page is what a screen shows. An export asks for pages
    // explicitly and walks to the end rather than accepting this first one.
    const limit = filters.limit ?? 200;
    const offset = filters.offset ?? 0;
    let query = supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.status && filters.status !== "all")
      query = query.eq("status", filters.status as LeadStatus);
    if (filters.source && filters.source !== "all")
      query = query.eq("source", filters.source as never);
    if (filters.search) {
      // The search term is pasted into a PostgREST `or` expression, where a
      // comma separates conditions, brackets group them, and * is the wildcard.
      // Typed straight in, a search for "Acme, Ltd" split into two conditions
      // and a stray bracket made the whole filter unparseable - the list either
      // returned the wrong rows or failed outright. Those characters are
      // removed, and the % and _ that ilike reads as wildcards with them, so a
      // search for "50%" looks for "50" rather than for everything.
      const term = filters.search
        .replace(/[(),*%_\\"']/g, " ")
        .trim()
        .slice(0, 120);
      if (term) {
        query = query.or(
          ["name", "email", "company", "city"].map((c) => `${c}.ilike.%${term}%`).join(","),
        );
      }
    }

    return unwrap(await query);
  },

  async getLead(id: string) {
    return unwrap(await supabase.from("leads").select("*").eq("id", id).single());
  },

  /**
   * The agent record belonging to whoever is signed in, if there is one.
   *
   * The Security screen offers a per-agent Export and Unmask switch, and both
   * were writing to the database and changing nothing, because nothing in the
   * Lead Manager ever asked who was using it. lead_agents carries no user_id,
   * so the link is made on email, which both tables already hold.
   *
   * A signed-in user with no agent record - an owner or an admin who is not on
   * the sales roster - gets null, and the callers treat that as "not an agent,
   * so the agent switches do not apply". That keeps today's behaviour for them
   * rather than locking out the people who own the system.
   */
  async currentAgent(): Promise<Agent | null> {
    const { data, error } = await supabase.auth.getUser();
    const email = data.user?.email?.trim().toLowerCase();
    if (error || !email) return null;

    // ilike is a pattern match, not a comparison: %, _ and * are wildcards in
    // it, and _ is perfectly legal in an email address. Left unescaped, a user
    // whose own address contains one could match an agent row belonging to
    // somebody else - somebody who may be allowed to export and unmask. The
    // pattern is escaped, and the row that comes back is then checked for a
    // real equality, so a wildcard cannot decide who anyone is.
    const pattern = email.replace(/[%_*\\]/g, (ch) => "\\" + ch);
    const rows = unwrap(
      await supabase.from("lead_agents").select("*").ilike("email", pattern).limit(5),
    ) as unknown as Agent[];
    return rows.find((row) => row.email?.trim().toLowerCase() === email) ?? null;
  },

  /**
   * Whether this export is allowed, recorded either way.
   *
   * can_export was read in two places - a counter and a badge - and checked in
   * none, so an agent whose export switch was off could still download every
   * lead. Refusing here is what makes the switch mean something, and the
   * refusal is written to the audit trail, because an attempt that was blocked
   * is exactly the kind of thing an audit trail is for.
   */
  async assertCanExport(what: string) {
    const agent = await leadApi.currentAgent();
    if (agent && !agent.can_export) {
      await writeAudit({
        action: "Export Denied",
        action_type: "read",
        details: `${agent.name} tried to export ${what} without export permission.`,
        actor: agent.name,
        actor_role: agent.role ?? undefined,
      });
      throw new Error("Your account does not have permission to export leads.");
    }
    await writeAudit({
      action: "Bulk Export",
      action_type: "read",
      details: `Exported ${what}.`,
      actor: agent?.name,
      actor_role: agent?.role ?? undefined,
    });
    return true;
  },

  async listAgents() {
    return unwrap(await supabase.from("lead_agents").select("*").order("name"));
  },

  async listSources() {
    return unwrap(await supabase.from("lead_sources").select("*").order("name"));
  },

  /**
   * The twelve numbers the overview shows, counted by the database.
   *
   * They used to be worked out in the browser from listLeads(), which stops at
   * two hundred rows. With 139 leads that gave the right answers; the moment a
   * two-hundred-and-first arrived, every figure on the dashboard would have
   * started shrinking - total, hot, cold, conversion rate, pipeline value - with
   * nothing on screen to say so. A dashboard that quietly under-reports as the
   * business grows is worse than one that fails loudly.
   *
   * Every query is written out rather than built by a shared helper. A helper
   * returning the query builder widened its type to a union of every table in
   * the database, which cost the column names their meaning - the typechecker
   * started objecting that deal_value does not exist on ai_models. Written
   * inline, each from("leads") keeps the table it names.
   *
   * Counts ask for an exact count with no rows returned, so the row limit stops
   * mattering. The two money totals need each matching row's deal_value, so
   * those page to the end rather than taking the first page as a total.
   */
  async leadOverviewStats() {
    const CLOSED = "(won,lost,spam)";
    const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
    const count = (r: { count: number | null; error: { message: string } | null }) => {
      if (r.error) throw new Error(r.error.message);
      return r.count ?? 0;
    };

    /** Every deal_value for one set of leads, to the last page. */
    const sumDealValue = async (onlyWon: boolean): Promise<number> => {
      const PAGE = 1000;
      let from = 0;
      let sum = 0;
      for (;;) {
        const page = onlyWon
          ? await supabase
              .from("leads")
              .select("deal_value")
              .eq("status", "won")
              .range(from, from + PAGE - 1)
          : await supabase
              .from("leads")
              .select("deal_value")
              .not("status", "in", CLOSED)
              .range(from, from + PAGE - 1);
        if (page.error) throw new Error(page.error.message);
        const rows = (page.data ?? []) as unknown as { deal_value: number | null }[];
        for (const row of rows) sum += row.deal_value ?? 0;
        if (rows.length < PAGE) return sum;
        from += PAGE;
      }
    };

    const [
      total,
      active,
      hot,
      cold,
      today,
      week,
      month,
      won,
      unassigned,
      duplicates,
      wonValue,
      pipelineValue,
    ] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).then(count),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .not("status", "in", CLOSED)
        .then(count),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .filter("temperature", "eq", "hot")
        .then(count),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .filter("temperature", "eq", "cold")
        .then(count),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", ago(1))
        .then(count),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", ago(7))
        .then(count),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", ago(30))
        .then(count),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "won")
        .then(count),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .is("assigned_agent_id", null)
        .not("status", "in", CLOSED)
        .then(count),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .filter("is_duplicate", "eq", true)
        .then(count),
      sumDealValue(true),
      sumDealValue(false),
    ]);

    return {
      total,
      active,
      hot,
      cold,
      today,
      week,
      month,
      won,
      unassigned,
      duplicates,
      wonValue,
      pipelineValue,
    };
  },

  /**
   * The report figures, grouped by the database.
   *
   * Source-wise totals, the funnel and the lost-reason breakdown were all
   * worked out in the browser from listLeads(), which stops at two hundred
   * rows. At a few hundred leads that is invisible; at the volume this platform
   * is built for - hundreds of orders a day across hundreds of resellers - every
   * report would silently describe the newest two hundred leads and call it the
   * business.
   *
   * These counts are asked for as exact counts with no rows returned, so the
   * number of leads stops mattering to the cost. Deal values are summed by
   * paging to the end of each group rather than taking a first page.
   */
  async leadReportStats(): Promise<{
    bySource: { source: string; total: number; won: number; value: number }[];
    byStage: { status: string; total: number; value: number }[];
    byLostReason: { reason: string; total: number }[];
  }> {
    const SOURCES = [
      "website",
      "seo",
      "social",
      "ads",
      "marketplace",
      "referral",
      "manual",
      "api",
      "whatsapp",
    ] as const;
    const STAGES = [
      "new",
      "contacted",
      "interested",
      "follow_up",
      "negotiation",
      "won",
      "lost",
      "spam",
    ] as const;

    const countWhere = async (
      build: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
    ) => {
      const r = await build();
      if (r.error) throw new Error(r.error.message);
      return r.count ?? 0;
    };

    /** Sum deal_value across every matching row, one page at a time. */
    const sumValue = async (column: "source" | "status", value: string): Promise<number> => {
      const PAGE = 1000;
      let from = 0;
      let sum = 0;
      for (;;) {
        const page =
          column === "source"
            ? await supabase
                .from("leads")
                .select("deal_value")
                .filter("source", "eq", value)
                .eq("status", "won")
                .range(from, from + PAGE - 1)
            : await supabase
                .from("leads")
                .select("deal_value")
                .eq("status", value as never)
                .range(from, from + PAGE - 1);
        if (page.error) throw new Error(page.error.message);
        const rows = (page.data ?? []) as unknown as { deal_value: number | null }[];
        for (const row of rows) sum += row.deal_value ?? 0;
        if (rows.length < PAGE) return sum;
        from += PAGE;
      }
    };

    const bySource = await Promise.all(
      SOURCES.map(async (source) => ({
        source,
        total: await countWhere(() =>
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .filter("source", "eq", source),
        ),
        won: await countWhere(() =>
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .filter("source", "eq", source)
            .eq("status", "won"),
        ),
        value: await sumValue("source", source),
      })),
    );

    const byStage = await Promise.all(
      STAGES.map(async (status) => ({
        status,
        total: await countWhere(() =>
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .filter("status", "eq", status),
        ),
        value: await sumValue("status", status),
      })),
    );

    // Lost reasons are free text, so the distinct set has to be read. Only lost
    // leads carry one, which keeps this bounded by the number of lost deals.
    const lostRows: { lost_reason: string | null }[] = [];
    for (let from = 0; ; from += 1000) {
      const page = await supabase
        .from("leads")
        .select("lost_reason")
        .eq("status", "lost")
        .range(from, from + 999);
      if (page.error) throw new Error(page.error.message);
      const rows = (page.data ?? []) as unknown as { lost_reason: string | null }[];
      lostRows.push(...rows);
      if (rows.length < 1000) break;
    }
    const reasons = new Map<string, number>();
    for (const row of lostRows) {
      const reason = row.lost_reason ?? "Not recorded";
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }

    return {
      bySource: bySource.filter((r) => r.total > 0).sort((a, b) => b.total - a.total),
      byStage,
      byLostReason: [...reasons.entries()]
        .map(([reason, total]) => ({ reason, total }))
        .sort((a, b) => b.total - a.total),
    };
  },

  /**
   * Every lead matching a filter, for an export.
   *
   * exportLeadsCsv used to be handed whatever was already on screen, which is
   * listLeads() and therefore at most two hundred rows. An operator exporting
   * "all leads" got the newest two hundred and a file that looked complete. At
   * the volume this platform is built for that is not a rounding error, it is
   * most of the business missing from the spreadsheet.
   *
   * This pages to the end. The caller passes the same filters the screen is
   * showing, so what is exported is what was asked for - all of it.
   */
  async fetchLeadsForExport(filters: { status?: string; source?: string; search?: string } = {}) {
    const PAGE = 1000;
    const all: Awaited<ReturnType<typeof leadApi.listLeads>> = [];
    for (let from = 0; ; from += PAGE) {
      const rows = await leadApi.listLeads({ ...filters, limit: PAGE, offset: from });
      all.push(...rows);
      if (rows.length < PAGE) return all;
      // A safety stop so a filter that somehow never narrows cannot page for
      // ever; 200k rows is far beyond any single export anyone wants.
      if (all.length >= 200_000) return all;
    }
  },

  async listAlerts() {
    return unwrap(
      await supabase
        .from("lead_alerts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(150),
    );
  },

  async listFollowUps() {
    return unwrap(
      await supabase
        .from("lead_follow_ups")
        .select("*")
        .order("scheduled_at", { ascending: true })
        .limit(150),
    );
  },

  async listEscalations() {
    return unwrap(
      await supabase
        .from("lead_escalations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150),
    );
  },

  async listRoutingRules() {
    return unwrap(await supabase.from("lead_routing_rules").select("*").order("created_at"));
  },

  async listAutomationRules() {
    return unwrap(await supabase.from("lead_automation_rules").select("*").order("created_at"));
  },

  async listIntegrations() {
    return unwrap(await supabase.from("lead_integrations").select("*").order("created_at"));
  },

  async listIntegrationEvents() {
    return unwrap(
      await supabase
        .from("lead_integration_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    );
  },

  async listSettings() {
    return unwrap(await supabase.from("lead_settings").select("*").order("setting_key"));
  },

  async listAuditLogs() {
    return unwrap(
      await supabase
        .from("lead_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
    );
  },

  async listNotes(leadId: string) {
    return unwrap(
      await supabase
        .from("lead_notes")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }),
    );
  },

  async listCommunications(leadId: string) {
    return unwrap(
      await supabase
        .from("lead_communications")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }),
    );
  },

  async createLead(payload: LeadInsert) {
    const lead = unwrap(await supabase.from("leads").insert(payload).select().single());
    await writeAudit({
      lead_id: lead.id,
      action: "Lead Created",
      action_type: "create",
      details: `Created ${lead.name} from ${lead.sub_source}`,
    });
    return lead;
  },

  /**
   * Change a lead, and record what actually changed.
   *
   * The audit line used to be `Updated fields: status, closed_at` - the names
   * of the columns and nothing else. Asked who moved a lead out of Negotiation
   * and what it was before, the trail could answer neither. lead_audit_logs has
   * carried `metadata` (jsonb) and `actor` columns all along; the seeded rows
   * use them and the live path never did, so every row the application wrote
   * said "Lead Manager Console" and held an empty object.
   *
   * The row is now read before it is changed, and each field that genuinely
   * moved is recorded with the value it held and the value it took. A field
   * written with the value it already had is not reported as a change, because
   * an audit trail full of things that did not happen is harder to read than a
   * short one.
   */
  async updateLead(
    id: string,
    updates: LeadUpdate,
    auditAction = "Lead Edited",
    actor?: { name?: string; role?: string },
  ) {
    // Before, so the trail can say what it was and not only what it became.
    let before: Record<string, unknown> | null = null;
    try {
      before = (await leadApi.getLead(id)) as unknown as Record<string, unknown>;
    } catch {
      // A lead that cannot be read is still worth updating; the change is then
      // recorded without its previous values rather than not at all.
    }

    const lead = unwrap(
      await supabase.from("leads").update(updates).eq("id", id).select().single(),
    );

    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const [field, to] of Object.entries(updates)) {
      const from = before ? before[field] : undefined;
      if (before && Object.is(from, to)) continue;
      changed[field] = { from: before ? (from ?? null) : "unknown", to: to ?? null };
    }

    const fields = Object.keys(changed);
    await writeAudit({
      lead_id: id,
      action: auditAction,
      action_type: "update",
      details: fields.length
        ? fields
            .map((f) => `${f}: ${String(changed[f]?.from)} → ${String(changed[f]?.to)}`)
            .join("; ")
            .slice(0, 500)
        : "No field changed value.",
      actor: actor?.name,
      actor_role: actor?.role,
      metadata: { changed },
    });
    return lead;
  },

  async deleteLead(id: string, name: string) {
    if (unwrap(await supabase.from("leads").delete().eq("id", id).select("id")).length === 0) {
      throw new Error("Lead could not be deleted");
    }
    await writeAudit({
      lead_id: id,
      action: "Lead Deleted",
      action_type: "delete",
      details: `Deleted lead ${name}`,
    });
  },

  async assignLead(leadId: string, agentId: string, reason = "Manual assignment") {
    const previous = await leadApi.getLead(leadId);
    const lead = unwrap(
      await supabase
        .from("leads")
        .update({ assigned_agent_id: agentId, assigned_at: new Date().toISOString() })
        .eq("id", leadId)
        .select()
        .single(),
    );
    const { error: assignmentError } = await supabase.from("lead_assignments").insert({
      lead_id: leadId,
      agent_id: agentId,
      previous_agent_id: previous.assigned_agent_id,
      reason,
      auto_assigned: false,
      assignment_score: lead.ai_score,
    });
    if (assignmentError) {
      await supabase
        .from("leads")
        .update({
          assigned_agent_id: previous.assigned_agent_id,
          assigned_at: previous.assigned_at,
        })
        .eq("id", leadId);
      throw new Error(assignmentError.message);
    }
    await writeAudit({
      lead_id: leadId,
      action: previous.assigned_agent_id ? "Lead Reassigned" : "Lead Assigned",
      action_type: "update",
      details: reason,
    });
    return lead;
  },

  /**
   * Move a lead to another stage.
   *
   * Any stage may follow any other: there is no sequence enforced here, and
   * that is left as it was - a lead genuinely can come back from lost.
   *
   * What changed is that the reasons survive. This used to null lost_reason
   * and spam_reason on every change that was not itself a lost or spam with a
   * reason attached, so reopening a lost lead erased why it had been lost, and
   * re-marking one as lost without retyping the reason erased it too. The
   * reason for closing a deal is exactly the kind of thing a pipeline is kept
   * for, and it was being thrown away by a branch that read as tidying up.
   *
   * Now a reason is written when one is given, and otherwise left alone. The
   * only thing cleared is closed_at, because a lead that is open again has no
   * closing date - that one is a fact about the present, not a record of the
   * past.
   */
  async changeStatus(leadId: string, status: LeadStatus, reason?: string) {
    const updates: LeadUpdate = { status };
    updates.closed_at = status === "won" || status === "lost" ? new Date().toISOString() : null;
    if (status === "lost" && reason) updates.lost_reason = reason;
    if (status === "spam" && reason) updates.spam_reason = reason;
    return leadApi.updateLead(leadId, updates, `Status → ${status}`);
  },

  async logCommunication(payload: {
    lead_id: string;
    type: "call" | "email" | "whatsapp" | "sms" | "meeting" | "note";
    content: string;
    subject?: string;
    direction?: string;
    created_by?: string;
  }) {
    const row = unwrap(
      await supabase
        .from("lead_communications")
        .insert({
          lead_id: payload.lead_id,
          type: payload.type,
          content: payload.content,
          subject: payload.subject ?? null,
          direction: payload.direction ?? "outbound",
          created_by: payload.created_by ?? "Lead Manager Console",
        })
        .select()
        .single(),
    );
    await supabase
      .from("leads")
      .update({ last_contact_at: new Date().toISOString() })
      .eq("id", payload.lead_id);
    await writeAudit({
      lead_id: payload.lead_id,
      action: `${payload.type} logged`,
      action_type: "update",
      details: payload.content,
    });
    return row;
  },

  async addNote(leadId: string, content: string, createdBy = "Lead Manager Console") {
    const note = unwrap(
      await supabase
        .from("lead_notes")
        .insert({ lead_id: leadId, content, created_by: createdBy })
        .select()
        .single(),
    );
    await writeAudit({
      lead_id: leadId,
      action: "Note Added",
      action_type: "update",
      details: content,
    });
    return note;
  },

  async scheduleFollowUp(payload: {
    lead_id: string;
    agent_id: string | null;
    scheduled_at: string;
    follow_up_type: string;
    notes?: string | null;
  }) {
    const row = unwrap(
      await supabase
        .from("lead_follow_ups")
        .insert({ ...payload, notes: payload.notes ?? null })
        .select()
        .single(),
    );
    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({ next_follow_up: payload.scheduled_at })
      .eq("id", payload.lead_id);
    if (leadUpdateError) {
      await supabase.from("lead_follow_ups").delete().eq("id", row.id);
      throw new Error(leadUpdateError.message);
    }
    await writeAudit({
      lead_id: payload.lead_id,
      action: "Follow-Up Scheduled",
      action_type: "update",
      details: `${payload.follow_up_type} at ${payload.scheduled_at}`,
    });
    return row;
  },

  async completeFollowUp(id: string, outcome: string) {
    const row = unwrap(
      await supabase
        .from("lead_follow_ups")
        .update({ is_completed: true, completed_at: new Date().toISOString(), outcome })
        .eq("id", id)
        .select()
        .single(),
    );
    const next = unwrap(
      await supabase
        .from("lead_follow_ups")
        .select("scheduled_at")
        .eq("lead_id", row.lead_id)
        .eq("is_completed", false)
        .neq("id", id)
        .order("scheduled_at", { ascending: true })
        .limit(1),
    )[0];
    const { error: leadError } = await supabase
      .from("leads")
      .update({ next_follow_up: next?.scheduled_at ?? null })
      .eq("id", row.lead_id);
    if (leadError) throw new Error(leadError.message);
    await writeAudit({
      lead_id: row.lead_id,
      action: "Follow-Up Completed",
      action_type: "update",
      details: outcome,
    });
    return row;
  },

  async resolveEscalation(id: string, notes: string) {
    const row = unwrap(
      await supabase
        .from("lead_escalations")
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq("id", id)
        .select()
        .single(),
    );
    await writeAudit({
      lead_id: row.lead_id,
      action: "Escalation Resolved",
      action_type: "update",
      details: notes,
    });
    return row;
  },

  async acknowledgeAlert(id: string) {
    return unwrap(
      await supabase
        .from("lead_alerts")
        .update({ is_active: false, acknowledged_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single(),
    );
  },

  /**
   * Re-score a lead from what is on its record.
   *
   * This is arithmetic over four stored fields. It is not a model, and it is no
   * longer described as one: it used to write score_type "ai_quality" with a
   * confidence of 82 and an audit line reading "AI Re-Scored", none of which was
   * true - there is no AI anywhere in this path, and 82 was a constant typed
   * into the source.
   *
   * What replaces the invented confidence is coverage: how many of the four
   * inputs the lead actually supplied, which is the same thing the intake
   * scorer records and means something an operator can act on. A lead scored
   * from one known field and three blanks now says so instead of claiming 82%
   * certainty.
   *
   * The weights themselves are unchanged - they are a business decision, not
   * mine to alter - except that a missing intent score is now treated as
   * missing. It used to be replaced with 50, which fed a made-up number into a
   * real score; nothing in this platform ever computes intent_score, so that
   * substitution was inventing the very thing it was standing in for.
   */
  async rescoreLead(leadId: string) {
    const lead = await leadApi.getLead(leadId);
    const { score, probability, coverage, factors } = rescoreFromRecord(lead);

    await supabase.from("lead_scores").insert({
      lead_id: leadId,
      // Named for what it is. The intake scorer writes "rule_based" for the same
      // kind of arithmetic, so the two agree about what they are.
      score_type: "rule_based",
      score,
      // Not a model confidence. How much of the lead was there to score.
      confidence: coverage,
      factors: factors as never,
    });
    return leadApi.updateLead(
      leadId,
      { ai_score: score, conversion_probability: probability },
      "Re-scored from the lead record",
    );
  },

  async toggleSetting(key: string, value: boolean) {
    return unwrap(
      await supabase
        .from("lead_settings")
        .update({ value_bool: value })
        .eq("setting_key", key)
        .select()
        .single(),
    );
  },

  async toggleRoutingRule(key: string, value: boolean) {
    return unwrap(
      await supabase
        .from("lead_routing_rules")
        .update({ is_active: value })
        .eq("rule_key", key)
        .select()
        .single(),
    );
  },

  async toggleAutomationRule(key: string, value: boolean) {
    return unwrap(
      await supabase
        .from("lead_automation_rules")
        .update({ is_active: value })
        .eq("rule_key", key)
        .select()
        .single(),
    );
  },

  async toggleIntegration(key: string, value: boolean) {
    return unwrap(
      await supabase
        .from("lead_integrations")
        .update({
          is_enabled: value,
          status: value ? "connected" : "disconnected",
          last_sync_at: value ? new Date().toISOString() : null,
        })
        .eq("integration_key", key)
        .select()
        .single(),
    );
  },

  async toggleSource(id: string, value: boolean) {
    return unwrap(
      await supabase
        .from("lead_sources")
        .update({ is_active: value })
        .eq("id", id)
        .select()
        .single(),
    );
  },

  async setAgentStatus(id: string, status: "online" | "busy" | "offline") {
    const row = unwrap(
      await supabase.from("lead_agents").update({ status }).eq("id", id).select().single(),
    );
    await writeAudit({
      action: "Agent Availability Changed",
      action_type: "update",
      details: `${row.name} → ${status}`,
    });
    return row;
  },

  async setAgentPermissions(id: string, perms: { can_export?: boolean; can_unmask?: boolean }) {
    // Who is granting this, and what it was before.
    //
    // The entry used to read "Agent Permissions Updated - Priya Patel:
    // can_export=true", signed by "Lead Manager Console". For an ordinary edit
    // that is enough; for the one screen that hands out the right to export
    // every customer's contact details it is not. The question an audit of this
    // table has to answer is who granted it and what changed, and neither was
    // recorded. Both are now.
    const actor = await leadApi.currentAgent();
    const before = unwrap(
      await supabase.from("lead_agents").select("can_export, can_unmask").eq("id", id).single(),
    ) as unknown as Pick<Agent, "can_export" | "can_unmask">;
    const row = unwrap(
      await supabase.from("lead_agents").update(perms).eq("id", id).select().single(),
    );

    const changed = Object.entries(perms)
      .filter(([key, value]) => before[key as keyof typeof before] !== value)
      .map(([key, value]) => `${key}: ${before[key as keyof typeof before]} → ${value}`);

    await writeAudit({
      action: "Agent Permissions Updated",
      action_type: "update",
      details: `${row.name} — ${changed.length ? changed.join("; ") : "no effective change"}`,
      actor: actor?.name,
      actor_role: actor?.role ?? undefined,
      metadata: { agent_id: id, before, after: perms },
    });
    return row;
  },

  async listAssignments(limit = 40) {
    return unwrap(
      await supabase
        .from("lead_assignments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  },

  async listRecentCommunications(limit = 40) {
    return unwrap(
      await supabase
        .from("lead_communications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  },

  async listScores(limit = 120) {
    return unwrap(
      await supabase
        .from("lead_scores")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  },

  /**
   * Real routing engine: picks the online agent with the smallest open lead load
   * (falls back to busy agents), writes the assignment row and the audit trail.
   */
  async autoAssign(leadId: string) {
    const agents = await leadApi.listAgents();
    const open = unwrap(
      await supabase
        .from("leads")
        .select("assigned_agent_id")
        .not("status", "in", "(won,lost,spam)"),
    );
    const load = new Map<string, number>();
    for (const row of open) {
      if (row.assigned_agent_id)
        load.set(row.assigned_agent_id, (load.get(row.assigned_agent_id) ?? 0) + 1);
    }
    const pool = agents.filter((a) => a.status === "online");
    const candidates = (pool.length ? pool : agents.filter((a) => a.status === "busy")).filter(
      (a) => (load.get(a.id) ?? 0) < a.capacity,
    );
    if (candidates.length === 0) throw new Error("No agent has spare capacity right now");
    candidates.sort(
      (a, b) =>
        (load.get(a.id) ?? 0) / a.capacity - (load.get(b.id) ?? 0) / b.capacity ||
        b.conversion_rate - a.conversion_rate,
    );
    const chosen = candidates[0];
    if (!chosen) throw new Error("No eligible agent is available");
    return leadApi.assignLead(leadId, chosen.id, `Auto-routed to ${chosen.name} (load balancing)`);
  },

  async bulkAutoAssign(leadIds: string[]) {
    let assigned = 0;
    for (const id of leadIds) {
      await leadApi.autoAssign(id);
      assigned += 1;
    }
    return assigned;
  },

  async markSpam(leadId: string, reason: string) {
    return leadApi.changeStatus(leadId, "spam", reason);
  },

  async resolveDuplicate(leadId: string, keep: boolean) {
    return leadApi.updateLead(
      leadId,
      keep
        ? { is_duplicate: false, duplicate_of: null, duplicate_score: 0 }
        : { status: "spam", spam_reason: "Confirmed duplicate" },
      keep ? "Duplicate Dismissed" : "Duplicate Merged",
    );
  },

  async updateSettingText(key: string, value: string) {
    return unwrap(
      await supabase
        .from("lead_settings")
        .update({ value_text: value })
        .eq("setting_key", key)
        .select()
        .single(),
    );
  },

  async syncIntegration(key: string, name: string) {
    await supabase.from("lead_integration_events").insert({
      integration_key: key,
      event: "manual_sync",
      detail: `${name} sync triggered from the Lead Manager console`,
      status: "success",
    });
    return unwrap(
      await supabase
        .from("lead_integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("integration_key", key)
        .select()
        .single(),
    );
  },
};
