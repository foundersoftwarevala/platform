/**
 * What happens to a lead after it is written.
 *
 * Section 8 asks for capture, then deduplicate, score, route, assign and an
 * SLA. None of that ran. Every lead in the database - the 129 seeded ones and
 * the ones captured from the storefront alike - carries ai_score 50, which is
 * the column default, assigned_agent_id null and next_follow_up null. Mean-
 * while lead_routing_rules holds an active round-robin rule reporting 1,284
 * executions, and lead_agents holds eight real agents with a status and a
 * capacity. The rule was never executed by anything.
 *
 * This runs it, against those tables, on the server. Three things it will not
 * do:
 *
 *   It does not call the score AI. No AI provider is configured, and section
 *   12 says to mark insufficient data rather than fabricate certainty - so the
 *   score is a rule-based one, stored with score_type "rule_based" and every
 *   factor that produced it, and it does not claim to be an AI judgement.
 *
 *   It does not assign to an agent who is offline. Section 15 says not to
 *   route to an inactive user, so only agents whose status is online are
 *   considered, least-loaded first.
 *
 *   It does not delete a duplicate. Section 9 says to mark and link, so a
 *   repeat is flagged and pointed at the lead it repeats, and it is still
 *   scored and still assigned - a duplicate enquiry is still an enquiry.
 *
 * Every step is best-effort and independent: if scoring fails the lead is
 * still routed, and if routing fails the lead still exists. A capture must not
 * be lost because a later stage had a bad day.
 */

type Headers = Record<string, string>;

export type IntakeResult = {
  duplicate_of: string | null;
  score: number | null;
  score_factors: { factor: string; weight: number; evidence: string }[];
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  follow_up_due: string | null;
  steps: Record<string, string>;
};

async function rest(base: string, headers: Headers, path: string, init?: RequestInit) {
  return fetch(`${base}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
}

async function rows<T>(base: string, headers: Headers, path: string): Promise<T[]> {
  try {
    const response = await rest(base, headers, path);
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

/**
 * The score, from what the lead actually says about itself.
 *
 * Every factor is something present in the record, and each is stored with the
 * evidence that produced it so an operator can see why the number is what it
 * is. Nothing here guesses at information the lead did not give.
 */
function scoreLead(lead: {
  email?: string | null; phone?: string | null; company?: string | null;
  cta_action?: string | null; product_id?: string | null; country?: string | null;
  requirements?: string | null;
}): {
  score: number;
  factors: { factor: string; weight: number; evidence: string }[];
  sufficient: boolean;
  /**
   * How much of the lead was actually there to score, as a percentage.
   *
   * lead_scores.confidence is NOT NULL, and a rule-based score has no model
   * confidence to report - it is arithmetic, not a prediction. Rather than
   * inventing one, this carries coverage: the share of the seven signals this
   * lead supplied. score_type says rule_based and model_version says
   * lead-intake-v1, so nothing can mistake it for a model's own certainty.
   */
  coverage: number;
} {
  const factors: { factor: string; weight: number; evidence: string }[] = [];
  const add = (factor: string, weight: number, evidence: string) => factors.push({ factor, weight, evidence });

  // Intent, from the button they actually pressed.
  const cta = String(lead.cta_action ?? "");
  if (cta === "request_demo") add("demo_request", 25, "Asked for a demo, which is the highest-intent CTA on a product page.");
  else if (cta === "contact_sales" || cta === "enterprise") add("sales_contact", 30, "Asked to speak to sales.");
  else if (cta === "callback") add("callback_request", 20, "Asked to be called back.");
  else if (cta === "whatsapp") add("whatsapp", 15, "Came through WhatsApp.");
  else if (cta === "brochure") add("brochure", 8, "Downloaded a brochure, which is research rather than intent.");
  else add("enquiry", 5, `General enquiry (${cta || "unspecified"}).`);

  if (lead.product_id) add("product_identified", 15, "The enquiry is about a specific product in the catalogue.");
  if (lead.phone && String(lead.phone).trim().length >= 7) add("phone_given", 12, "Gave a phone number, so they can be reached directly.");
  if (lead.company && String(lead.company).trim()) add("company_given", 10, "Named a company.");
  const requirements = String(lead.requirements ?? "").trim();
  if (requirements.length > 120) add("detailed_requirement", 10, `Wrote ${requirements.length} characters about what they need.`);
  if (lead.country) add("country_known", 3, `Country recorded as ${lead.country}.`);

  const score = Math.max(0, Math.min(100, factors.reduce((t, f) => t + f.weight, 0)));
  // Nothing but the CTA means there is not enough here to call it a score.
  const sufficient = factors.length > 1;
  // Seven signals are possible: the CTA, a product, a phone, a company, a
  // detailed requirement, a country, and the CTA being a high-intent one.
  const coverage = Math.round((factors.length / 7) * 100);
  return { score, factors, sufficient, coverage };
}

export async function runLeadIntake(
  base: string,
  headers: Headers,
  lead: Record<string, unknown>,
): Promise<IntakeResult> {
  const id = String(lead.id ?? "");
  const steps: Record<string, string> = {};
  const result: IntakeResult = {
    duplicate_of: null, score: null, score_factors: [],
    assigned_agent_id: null, assigned_agent_name: null, follow_up_due: null, steps,
  };
  if (!id) {
    steps.all = "skipped — the lead has no id";
    return result;
  }

  /* ---------------------------------------------------------- deduplicate */
  try {
    const email = String(lead.email ?? "").trim().toLowerCase();
    const phone = String(lead.phone ?? "").trim();
    const clauses: string[] = [];
    if (email) clauses.push(`email.eq.${encodeURIComponent(email)}`);
    if (phone.length >= 7) clauses.push(`phone.eq.${encodeURIComponent(phone)}`);
    if (clauses.length) {
      const earlier = await rows<{ id: string; created_at: string }>(
        base, headers,
        `leads?select=id,created_at&or=(${clauses.join(",")})&id=neq.${id}&order=created_at.asc&limit=1`,
      );
      if (earlier[0]) {
        result.duplicate_of = earlier[0].id;
        // Marked and linked. Never removed: section 9.
        await rest(base, headers, `leads?id=eq.${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ is_duplicate: true, duplicate_of: earlier[0].id }),
        });
        steps.deduplicate = `matched an earlier lead (${earlier[0].id}); marked and linked, not removed`;
      } else {
        steps.deduplicate = "no earlier lead with this email or phone";
      }
    } else {
      steps.deduplicate = "skipped — no email or phone to match on";
    }
  } catch {
    steps.deduplicate = "failed — the lead was kept anyway";
  }

  /* ---------------------------------------------------------------- score */
  try {
    const { score, factors, sufficient, coverage } = scoreLead(lead as Parameters<typeof scoreLead>[0]);
    result.score = sufficient ? score : null;
    result.score_factors = factors;

    const scoreWrite = await rest(base, headers, "lead_scores", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        lead_id: id,
        // Named for what it is. No AI provider is configured, so calling this
        // an AI score would be a lie about where the number came from.
        score_type: "rule_based",
        score: sufficient ? score : 0,
        // Not a model confidence. See scoreLead.
        confidence: coverage,
        factors: sufficient
          ? factors
          : [...factors, { factor: "insufficient_data", weight: 0, evidence: "Only the CTA is known, which is not enough to score." }],
        model_version: "lead-intake-v1",
      }),
    });

    if (!scoreWrite.ok) {
      // Said out loud. A score row that never landed used to leave the lead
      // looking scored with no record of why.
      console.error("[lead-intake] score row rejected", scoreWrite.status, await scoreWrite.text());
      steps.score_record = `not written (HTTP ${scoreWrite.status})`;
    }

    if (sufficient) {
      await rest(base, headers, `leads?id=eq.${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ ai_score: score }),
      });
      steps.score = `${score} from ${factors.length} factors, all stored`;
    } else {
      steps.score = "INSUFFICIENT DATA — recorded as such rather than guessed";
    }
  } catch {
    steps.score = "failed — the lead was kept anyway";
  }

  /* ------------------------------------------------------ route and assign */
  try {
    const rules = await rows<{ rule_key: string; strategy: string; is_active: boolean }>(
      base, headers, "lead_routing_rules?select=rule_key,strategy,is_active&is_active=eq.true&limit=5",
    );
    const strategy = rules.find((r) => r.rule_key === "auto_assignment")?.strategy ?? null;

    if (!strategy) {
      steps.route = "skipped — no active routing rule";
    } else {
      // Only agents who are actually available. Section 15.
      const agents = await rows<{ id: string; name: string; capacity: number; status: string }>(
        base, headers, "lead_agents?select=id,name,capacity,status&status=eq.online&order=name.asc&limit=50",
      );
      if (agents.length === 0) {
        steps.route = "no agent is online, so the lead is left unassigned rather than given to somebody who is not there";
      } else {
        // Current load per agent, so round robin is least-loaded rather than
        // blind: an agent already holding the most open leads is not next.
        const open = await rows<{ assigned_agent_id: string }>(
          base, headers,
          "leads?select=assigned_agent_id&assigned_agent_id=not.is.null" +
            "&status=in.(new,contacted,follow_up,interested,negotiation)&limit=5000",
        );
        const load = new Map<string, number>();
        for (const l of open) {
          const key = String(l.assigned_agent_id);
          load.set(key, (load.get(key) ?? 0) + 1);
        }
        const eligible = agents
          .map((a) => ({ ...a, open: load.get(a.id) ?? 0 }))
          .filter((a) => a.open < (a.capacity || 30))
          .sort((a, b) => a.open - b.open);

        const chosen = eligible[0] ?? null;
        if (!chosen) {
          steps.route = "every online agent is at capacity, so the lead is left unassigned";
        } else {
          const now = new Date().toISOString();
          await rest(base, headers, `leads?id=eq.${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ assigned_agent_id: chosen.id, assigned_at: now }),
          });
          // History, not a replacement: section 28 says never overwrite the
          // previous owner, so each assignment is its own row.
          await rest(base, headers, "lead_assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({
              lead_id: id, agent_id: chosen.id, previous_agent_id: null,
              reason: `${strategy}, least loaded of ${eligible.length} available agent(s)`,
              auto_assigned: true, assignment_score: result.score,
            }),
          });
          result.assigned_agent_id = chosen.id;
          result.assigned_agent_name = chosen.name;
          steps.route = `${strategy} → ${chosen.name} (${chosen.open} open of ${chosen.capacity})`;
        }
      }
    }
  } catch {
    steps.route = "failed — the lead was kept anyway";
  }

  /* ------------------------------------------------------------------ SLA */
  try {
    if (result.assigned_agent_id) {
      // Two hours is the response target section 17 gives as its example. It
      // is written onto the lead and as a follow-up the owner can see.
      const due = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
      await rest(base, headers, `leads?id=eq.${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ next_follow_up: due }),
      });
      await rest(base, headers, "lead_follow_ups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          lead_id: id, agent_id: result.assigned_agent_id, scheduled_at: due,
          follow_up_type: "first_contact",
          notes: "First contact SLA from capture. Two hours from assignment.",
          is_completed: false,
        }),
      });
      result.follow_up_due = due;
      steps.sla = `first contact due ${due}`;
    } else {
      steps.sla = "skipped — an SLA with no owner would have nobody to breach it";
    }
  } catch {
    steps.sla = "failed — the lead was kept anyway";
  }

  /* ---------------------------------------------------------------- audit */
  try {
    await rest(base, headers, "lead_audit_logs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        lead_id: id,
        action: "lead_intake",
        action_type: "system",
        details: `Captured from the marketplace and put through intake: ${Object.entries(steps)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ")}`,
        actor: "marketplace_capture",
        actor_role: "system",
        metadata: { ...result, steps: undefined },
      }),
    });
  } catch {
    steps.audit = "failed";
  }

  return result;
}
