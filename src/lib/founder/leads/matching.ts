/**
 * Choosing the agent a lead should go to, and being able to say why.
 *
 * The hard rule for this system is that there is no random assignment, and
 * the way to keep that rule is not to try harder — it is to make every
 * choice arithmetic that writes down its own reasoning. Every contribution to
 * a score carries the sentence that explains it, and every agent who was
 * ruled out is named with what ruled them out. An assignment that cannot
 * answer "why this agent, and why not that one" is a random assignment with
 * extra steps.
 *
 * Eligibility is decided before ranking and is absolute. An offline agent, an
 * agent at their open-lead ceiling, and an agent without a language the
 * customer speaks are not worse candidates — they are not candidates. That
 * distinction is what stops a lead being placed with someone who cannot take
 * it because the arithmetic happened to like them.
 *
 * Nothing here reads a stored performance figure it has not been given.
 * `conversionRate` and `avgResponseMinutes` come from lead_agents, where a
 * person set them; they are used as recorded and never recalculated into a
 * claim this code cannot support.
 */

export interface LeadNeed {
  leadId: string;
  /** The language the customer actually wrote in, where it was detected. */
  language: string | null;
  region: string | null;
  /** What the lead is about, e.g. "erp", "pos". Empty when unknown. */
  interests: string[];
  /** The lead's own score, where the Lead Manager has computed one. */
  score: number | null;
  /** True where the lead is large enough to want an experienced agent. */
  enterprise: boolean;
}

export interface AgentProfile {
  agentId: string;
  name: string;
  /** online, busy or offline — the values agent_status actually has. */
  status: string;
  languages: string[];
  regions: string[];
  expertise: string[];
  timezone: string | null;
  openLeads: number;
  maxOpenLeads: number;
  /** As recorded on lead_agents. Not recomputed here. */
  conversionRate: number | null;
  avgResponseMinutes: number | null;
  unavailableReason: string | null;
}

export interface Excluded {
  agentId: string;
  name: string;
  why: string;
}

export interface Ranked {
  agentId: string;
  name: string;
  score: number;
  reason: string;
  factors: Record<string, number>;
}

export type MatchResult =
  | {
      matched: true;
      chosen: Ranked;
      considered: Ranked[];
      excluded: Excluded[];
      /** Anything the match could not take into account, stated plainly. */
      limitations: string[];
    }
  | {
      matched: false;
      /** Why nobody could take it — never a bare "none available". */
      reason: string;
      excluded: Excluded[];
      limitations: string[];
    };

/** Case- and punctuation-insensitive membership. */
function has(list: string[], value: string): boolean {
  const want = value.toLowerCase().trim();
  return list.some((entry) => entry.toLowerCase().trim() === want);
}

/**
 * Who cannot take this lead at all, and why.
 *
 * Language is the one that needs care. An agent with no recorded languages is
 * not a polyglot — nothing is known about them — so they are excluded from a
 * language-matched lead rather than treated as matching everything. The
 * alternative silently routes an Arabic enquiry to someone who may not read
 * it.
 */
export function eligibility(
  need: LeadNeed,
  agents: AgentProfile[],
): { eligible: AgentProfile[]; excluded: Excluded[] } {
  const excluded: Excluded[] = [];
  const eligible = agents.filter((agent) => {
    if (agent.status === "offline") {
      excluded.push({
        agentId: agent.agentId,
        name: agent.name,
        why: agent.unavailableReason ? `offline — ${agent.unavailableReason}` : "offline",
      });
      return false;
    }
    if (agent.openLeads >= agent.maxOpenLeads) {
      excluded.push({
        agentId: agent.agentId,
        name: agent.name,
        why: `at capacity (${agent.openLeads} of ${agent.maxOpenLeads} open)`,
      });
      return false;
    }
    if (need.language && !has(agent.languages, need.language)) {
      excluded.push({
        agentId: agent.agentId,
        name: agent.name,
        why:
          agent.languages.length === 0
            ? `no languages recorded, so ${need.language} cannot be confirmed`
            : `does not work in ${need.language}`,
      });
      return false;
    }
    return true;
  });
  return { eligible, excluded };
}

/** One eligible agent's fit, and the sentence that justifies it. */
export function rank(need: LeadNeed, agent: AgentProfile): Ranked {
  const factors: Record<string, number> = {};
  const parts: string[] = [];
  let total = 0;

  const add = (name: string, value: number, sentence: string) => {
    if (value === 0) return;
    factors[name] = value;
    total += value;
    parts.push(sentence);
  };

  if (need.language && has(agent.languages, need.language)) {
    add("language", 40, `works in ${need.language}`);
  }

  if (need.region && has(agent.regions, need.region)) {
    add("region", 25, `covers ${need.region}`);
  }

  const matchedInterests = need.interests.filter((i) => has(agent.expertise, i));
  if (matchedInterests.length > 0) {
    add("expertise", 20 * matchedInterests.length, `knows ${matchedInterests.join(" and ")}`);
  }

  // Headroom rather than raw load: an agent with two of twenty-five free is
  // nearly full, and one with two of four is nearly full too.
  const headroom =
    agent.maxOpenLeads > 0 ? (agent.maxOpenLeads - agent.openLeads) / agent.maxOpenLeads : 0;
  add(
    "headroom",
    Math.round(headroom * 20),
    `${agent.maxOpenLeads - agent.openLeads} of ${agent.maxOpenLeads} places free`,
  );

  if (agent.conversionRate !== null) {
    // Used as recorded on lead_agents, and said so, because this is not a
    // figure this code measured.
    add(
      "conversion",
      Math.round(agent.conversionRate / 4),
      `recorded conversion ${agent.conversionRate}%`,
    );
  }

  if (agent.avgResponseMinutes !== null && agent.avgResponseMinutes > 0) {
    // Faster is better, and the curve flattens: ten minutes against twenty
    // matters more than sixty against seventy.
    add(
      "responsiveness",
      Math.max(0, Math.round(15 - agent.avgResponseMinutes / 2)),
      `responds in about ${agent.avgResponseMinutes} minutes`,
    );
  }

  if (need.enterprise && has(agent.expertise, "enterprise")) {
    add("enterprise", 25, "has enterprise experience");
  }

  if (agent.status === "busy") {
    add("busy", -10, "currently busy");
  }

  // Headroom, conversion and responsiveness are true of the agent whatever
  // the lead is. If none of the lead-specific factors fired, the match was
  // generic, and saying so is what stops "chosen because they were free"
  // reading like "chosen because they fit".
  const leadSpecific = ["language", "region", "expertise", "enterprise"];
  if (!leadSpecific.some((key) => key in factors)) {
    parts.unshift("nothing about this lead matches them particularly");
  }

  return {
    agentId: agent.agentId,
    name: agent.name,
    score: total,
    reason: `${agent.name}: ${parts.join("; ")}`,
    factors,
  };
}

/**
 * Match a lead to an agent.
 *
 * Returns the choice, everyone who was considered, everyone who was excluded
 * and why, and anything the match could not take into account. A caller that
 * writes this to lead_assignment_log has everything the audit constraint
 * demands.
 */
export function match(need: LeadNeed, agents: AgentProfile[]): MatchResult {
  const limitations: string[] = [];

  // A standing gap, reported whether or not this particular lead has a
  // detected language: while it holds, no lead can be language-matched.
  if (agents.length > 0 && agents.every((a) => a.languages.length === 0)) {
    limitations.push("No agent has recorded languages, so no lead can be language-matched.");
  }
  if (need.language === null) {
    limitations.push("The lead has no detected language, so language was not matched.");
  }
  if (need.region === null) {
    limitations.push("The lead has no recorded region, so regional fit was not considered.");
  }
  if (need.interests.length === 0) {
    limitations.push("The lead has no recorded product interest, so expertise was not matched.");
  }

  if (agents.length === 0) {
    return {
      matched: false,
      reason: "No agent is registered.",
      excluded: [],
      limitations,
    };
  }

  const { eligible, excluded } = eligibility(need, agents);

  if (eligible.length === 0) {
    return {
      matched: false,
      // Never a bare "nobody available": the audit constraint refuses that,
      // and so should the answer given to a person.
      reason: `No eligible agent: ${excluded.map((e) => `${e.name} is ${e.why}`).join("; ")}`,
      excluded,
      limitations,
    };
  }

  const considered = eligible
    .map((agent) => rank(need, agent))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.score - a.item.score || a.index - b.index)
    .map(({ item }) => item);

  const chosen = considered[0];
  if (!chosen) {
    return { matched: false, reason: "No eligible agent.", excluded, limitations };
  }

  return { matched: true, chosen, considered, excluded, limitations };
}
