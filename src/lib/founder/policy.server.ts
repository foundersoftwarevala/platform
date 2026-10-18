import type { ActionClass, PolicyDecision } from "./decision.types";
import type { Severity } from "./state.types";

/**
 * The governance policy layer.
 *
 * Every AI-originated action is classified and then judged: is it allowed at
 * all, does it need a human, does it need a second pair of eyes, must it
 * escalate, and who is permitted to decide. The answer names the rule that
 * produced it, because an approval request that cannot say which policy
 * required it is a form rather than governance.
 *
 * Policies are versioned. A decision made last month stays explainable against
 * the rules that applied last month, so the version in force is recorded on the
 * decision rather than looked up again later.
 *
 * Two defaults are deliberately strict. With no policy configured, anything at
 * or above HIGH risk requires a human and forbids self-approval — the safe
 * reading of an unconfigured system is that nothing is pre-authorised, not that
 * everything is. And nothing in this module ever returns an EXECUTE
 * authorisation: Founder AI reads, analyses, recommends, asks and records.
 */

const RANK: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

type Row = Record<string, unknown>;

function str(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/**
 * The strict default, used when no policy matches.
 *
 * It is not a fallback that lets things through; it is the rule that applies
 * when nobody has written one. High and critical risk need a human and cannot
 * be self-approved; everything else still needs approval but without the
 * second reviewer.
 */
function defaultPolicy(actionClass: ActionClass, risk: Severity): PolicyDecision {
  const serious = RANK[risk] >= RANK.HIGH;
  return {
    policyId: null,
    policyKey: null,
    policyVersion: null,
    actionClass,
    // Nothing here authorises execution; that belongs to a later layer.
    allowed: actionClass !== "EXECUTE",
    blocked: actionClass === "EXECUTE",
    requiresApproval: true,
    requiresSecondReviewer: serious,
    forbidSelfApproval: true,
    escalate: risk === "CRITICAL",
    approverRoles: ["boss", "admin", "super_admin", "boss_owner", "founder"],
    approvalTtlHours: serious ? 24 : 72,
    reasons: [
      "No policy is configured for this action, so the strict default applies.",
      serious
        ? `${risk} risk requires a human decision and a second reviewer.`
        : "A human decision is required.",
      ...(risk === "CRITICAL" ? ["Critical risk escalates automatically."] : []),
      ...(actionClass === "EXECUTE"
        ? ["Founder AI does not execute; this action class is blocked here."]
        : []),
    ],
  };
}

/**
 * Find the policy in force and apply it.
 *
 * The most specific active policy wins: one naming both the decision type and
 * the domain beats one naming only the domain, which beats a general one. Where
 * several are equally specific the newest effective version applies, and its
 * version number travels with the decision.
 */
export async function evaluatePolicy(input: {
  actionClass: ActionClass;
  risk: Severity;
  impact: Severity;
  domain: string;
  decisionType: string;
  financialExposure?: number | null;
}): Promise<PolicyDecision> {
  const base = restUrl();
  if (!base) return defaultPolicy(input.actionClass, input.risk);

  let rows: Row[] = [];
  try {
    const response = await fetch(
      `${base}/rest/v1/founder_policies?select=*&status=eq.active` +
        `&action_class=eq.${encodeURIComponent(input.actionClass)}` +
        `&order=effective_from.desc&limit=100`,
      { headers: restHeaders() },
    );
    if (response.ok) rows = (await response.json()) as Row[];
  } catch (error) {
    console.error("[founder/policy] could not read policies:", error);
    // An unreadable policy table must not mean "no rules apply".
    return {
      ...defaultPolicy(input.actionClass, input.risk),
      reasons: [
        "The policy table could not be read, so the strict default applies.",
        ...defaultPolicy(input.actionClass, input.risk).reasons.slice(1),
      ],
    };
  }

  const now = Date.now();
  const applicable = rows.filter((p) => {
    const from = str(p, "effective_from");
    const until = str(p, "effective_until");
    if (from && new Date(from).getTime() > now) return false;
    if (until && new Date(until).getTime() < now) return false;
    if (RANK[input.risk] < RANK[(str(p, "min_risk") ?? "LOW") as Severity]) return false;
    const domain = str(p, "domain");
    if (domain && domain !== input.domain) return false;
    const type = str(p, "decision_type");
    if (type && type !== input.decisionType) return false;
    return true;
  });

  if (applicable.length === 0) return defaultPolicy(input.actionClass, input.risk);

  // Specificity first, then recency.
  applicable.sort((a, b) => {
    const score = (p: Row) => (str(p, "decision_type") ? 2 : 0) + (str(p, "domain") ? 1 : 0);
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return (str(b, "effective_from") ?? "").localeCompare(str(a, "effective_from") ?? "");
  });

  const policy = applicable[0]!;
  const reasons: string[] = [
    `Policy "${str(policy, "name") ?? str(policy, "policy_key")}" version ${num(policy, "version") ?? 1} applies.`,
  ];

  const blocked = policy.blocked === true || input.actionClass === "EXECUTE";
  if (policy.blocked === true) reasons.push("This policy blocks the action outright.");
  if (input.actionClass === "EXECUTE") {
    reasons.push("Founder AI does not execute; this action class is blocked here.");
  }

  let requiresApproval = policy.requires_approval !== false;
  let requiresSecondReviewer = policy.requires_second_reviewer === true;
  let escalate = false;

  const escalateAbove = str(policy, "escalate_above") as Severity | null;
  if (escalateAbove && RANK[input.risk] >= RANK[escalateAbove]) {
    escalate = true;
    reasons.push(
      `${input.risk} risk is at or above the policy's escalation level ${escalateAbove}.`,
    );
  }

  // A financial ceiling is a hard stop: over it, a human decides and a second
  // reviewer is required whatever else the policy says.
  const ceiling = num(policy, "max_financial_exposure");
  const exposure = input.financialExposure ?? null;
  if (ceiling !== null && exposure !== null && exposure > ceiling) {
    requiresApproval = true;
    requiresSecondReviewer = true;
    escalate = true;
    reasons.push(
      `The estimated exposure of ${exposure} is above the policy ceiling of ${ceiling}.`,
    );
  }

  // Critical risk is never silently pre-authorised, whatever a policy says.
  if (input.risk === "CRITICAL") {
    requiresApproval = true;
    escalate = true;
    reasons.push("Critical risk always requires a human decision.");
  }

  const roles = Array.isArray(policy.approver_roles)
    ? (policy.approver_roles as unknown[]).map(String).filter(Boolean)
    : [];

  return {
    policyId: String(policy.id),
    policyKey: str(policy, "policy_key"),
    policyVersion: num(policy, "version"),
    actionClass: input.actionClass,
    allowed: !blocked,
    blocked,
    requiresApproval,
    requiresSecondReviewer,
    forbidSelfApproval: policy.forbid_self_approval !== false,
    escalate,
    approverRoles:
      roles.length > 0 ? roles : ["boss", "admin", "super_admin", "boss_owner", "founder"],
    approvalTtlHours: num(policy, "approval_ttl_hours") ?? 72,
    reasons,
  };
}

/**
 * Whether a person may act on an approval.
 *
 * Checked on the server against role_permissions and the policy's own approver
 * list, never against anything the browser sent. Separation of duties is
 * applied here as well as by the table constraint, so a caller gets a sentence
 * explaining the refusal rather than a database error.
 */
export async function canApprove(input: {
  approverId: string;
  requestedBy: string | null;
  policy: PolicyDecision;
  roles: string[];
}): Promise<{ allowed: boolean; reason: string }> {
  if (input.policy.blocked) {
    return { allowed: false, reason: "Policy blocks this action entirely." };
  }

  if (
    input.policy.forbidSelfApproval &&
    input.requestedBy &&
    input.requestedBy === input.approverId
  ) {
    return {
      allowed: false,
      reason: "Separation of duties: the actor who raised this cannot also approve it.",
    };
  }

  const permitted = input.roles.some((role) => input.policy.approverRoles.includes(role));
  if (!permitted) {
    return {
      allowed: false,
      reason: `This approval is reserved for ${input.policy.approverRoles.join(", ")}.`,
    };
  }

  const base = restUrl();
  if (base) {
    try {
      const held = await Promise.all(
        input.roles.map(async (role) => {
          const response = await fetch(
            `${base}/rest/v1/role_permissions?select=permission&role=eq.${encodeURIComponent(role)}` +
              `&permission=eq.decision.approve&limit=1`,
            { headers: restHeaders() },
          );
          return response.ok ? ((await response.json()) as Row[]).length > 0 : false;
        }),
      );
      if (!held.some(Boolean)) {
        return { allowed: false, reason: "No role held by this account carries decision.approve." };
      }
    } catch (error) {
      console.error("[founder/policy] permission lookup failed:", error);
      return {
        allowed: false,
        reason: "The permission table could not be read, so this is refused.",
      };
    }
  }

  return { allowed: true, reason: "Permitted by policy and by decision.approve." };
}

/** Risk severity from likelihood and impact, with the formula recorded. */
export function scoreRisk(
  likelihood: number | null,
  impact: Severity,
): { score: number | null; severity: Severity; method: string } {
  const method = "likelihood (0-100) x impact rank (1-4) / 4";
  if (likelihood === null) {
    return { score: null, severity: impact, method: "impact only; likelihood was not measured" };
  }
  const rank = Math.max(1, RANK[impact]);
  const score = Math.round((likelihood * rank) / 4);
  const severity: Severity =
    score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
  return { score, severity, method };
}
