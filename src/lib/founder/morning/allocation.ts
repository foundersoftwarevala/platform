import type { Scored } from "./priority";

/**
 * Which agent could take a piece of work, and why it is eligible.
 *
 * This recommends; it never assigns. Assignment is a governed act and belongs
 * to the approval flow, so the most this produces is a named agent and the
 * sentence justifying it. An operator can therefore disagree with the
 * suggestion without anything having already happened.
 *
 * The exclusions matter more than the matching. An agent that is archived,
 * paused, blocked, or that does not hold the permission the work needs, is
 * not a worse candidate - it is not a candidate, and it is excluded by name
 * so that "why was nothing suggested" has an answer.
 */

export interface EligibleAgent {
  id: string;
  agentKey: string;
  name: string;
  specialization: string | null;
  lifecycle: string;
  permissions: string[];
  maxConcurrent: number;
  /** Runs currently open for this agent. */
  openRuns: number;
  blockedReason: string | null;
}

export interface Allocation {
  agentId: string | null;
  reason: string | null;
  /** Why no agent was suggested, where none was. */
  unmatchedReason: string | null;
}

/** Lifecycle states in which an agent can be offered work at all. */
const OPEN_TO_WORK = new Set(["CONFIGURED", "AVAILABLE"]);

/**
 * What the work needs, expressed as the permission an agent must hold.
 *
 * Everything the plan produces is observation and recommendation, so CREATE
 * is the requirement: an agent has to be able to file a finding or a report.
 * Nothing here ever requires EXECUTE_LOW_RISK, because the plan does not
 * execute.
 */
const REQUIRED_PERMISSION = "CREATE";

/** A crude but honest match: does the agent's specialization mention this? */
function specializationMatches(agent: EligibleAgent, needs: string | null): boolean {
  if (!needs || !agent.specialization) return false;
  const want = needs.toLowerCase().replace(/[^a-z]/g, "");
  const have = agent.specialization.toLowerCase().replace(/[^a-z]/g, "");
  return want.length > 2 && (have.includes(want) || want.includes(have));
}

function domainMatches(agent: EligibleAgent, domain: string): boolean {
  if (!agent.agentKey) return false;
  const want = domain.toLowerCase().replace(/[^a-z]/g, "");
  const have = agent.agentKey.toLowerCase().replace(/[^a-z]/g, "");
  return want.length > 2 && have.includes(want);
}

/**
 * Pick an agent for one item.
 *
 * Preference order: an agent whose key names the same domain, then one whose
 * specialization matches what the work needs, then the least loaded agent
 * that is eligible at all. Ties break towards the agent carrying less work,
 * so one agent does not collect the whole day.
 */
export function allocate(item: Scored, agents: EligibleAgent[]): Allocation {
  if (agents.length === 0) {
    return {
      agentId: null,
      reason: null,
      unmatchedReason: "no agent is registered",
    };
  }

  const excluded: string[] = [];
  const eligible = agents.filter((agent) => {
    if (!OPEN_TO_WORK.has(agent.lifecycle)) {
      excluded.push(`${agent.agentKey} is ${agent.lifecycle.toLowerCase()}`);
      return false;
    }
    if (agent.blockedReason) {
      excluded.push(`${agent.agentKey} is blocked`);
      return false;
    }
    if (!agent.permissions.includes(REQUIRED_PERMISSION)) {
      excluded.push(`${agent.agentKey} does not hold ${REQUIRED_PERMISSION}`);
      return false;
    }
    if (agent.openRuns >= agent.maxConcurrent) {
      excluded.push(`${agent.agentKey} is at capacity`);
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    return {
      agentId: null,
      reason: null,
      // Naming a few is more useful than saying "none matched"; the full list
      // would be sixty lines and nobody would read it.
      unmatchedReason: `no eligible agent (${excluded.slice(0, 3).join(", ")}${
        excluded.length > 3 ? `, and ${excluded.length - 3} more` : ""
      })`,
    };
  }

  const byDomain = eligible.filter((agent) => domainMatches(agent, item.domain));
  const bySpecialization = eligible.filter((agent) => specializationMatches(agent, item.needs));

  const pool =
    byDomain.length > 0 ? byDomain : bySpecialization.length > 0 ? bySpecialization : eligible;
  const chosen = [...pool].sort(
    (a, b) => a.openRuns - b.openRuns || a.agentKey.localeCompare(b.agentKey),
  )[0];
  if (!chosen) {
    return { agentId: null, reason: null, unmatchedReason: "no eligible agent" };
  }

  const why =
    byDomain.length > 0
      ? `watches ${item.domain}`
      : bySpecialization.length > 0
        ? `specializes in ${chosen.specialization}`
        : "eligible and least loaded";

  return {
    agentId: chosen.id,
    reason: `${chosen.name}: ${why}; holds ${REQUIRED_PERMISSION}; ${chosen.openRuns} of ${chosen.maxConcurrent} in flight`,
    unmatchedReason: null,
  };
}
