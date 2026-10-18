/**
 * What has to be true before an AI request is allowed to happen.
 *
 * Four separate questions, each with its own failure mode:
 *
 * Authorization. Sensitive operational context — revenue, customers, risks —
 * must not be handed to a model on behalf of someone who is not allowed to see
 * it. The check runs on the server against the roles the caller actually holds.
 *
 * Rate limiting. An AI request costs money and a loop costs money quickly. A
 * runaway caller is stopped at a ceiling rather than discovered on an invoice.
 *
 * Loop protection. A chain of AI calls that can start another AI call will,
 * eventually, start itself. Depth is carried through the chain and refused at
 * a bound.
 *
 * Data quality. Reasoning over a metric that is stale, missing or contradicted
 * produces a confident answer about nothing. The quality is assessed first and
 * either lowers the confidence or refuses the strong recommendation.
 *
 * None of these invents a limit. The ceilings come from the route
 * configuration and the policy tables, and where nothing is configured the
 * strict default applies rather than an unbounded one.
 */

import { freshnessOf } from "../state.types";

type Row = Record<string, unknown>;

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** Roles allowed to put company operational context in front of a model. */
const AI_PERMISSION = "decision.read";

export interface CallerIdentity {
  userId: string;
  roles: string[];
}

export interface AuthorizationResult {
  allowed: boolean;
  reason: string;
}

/**
 * Whether this caller may have the company's state analysed on their behalf.
 *
 * The permission reused here is the one the Decision Engine already defines:
 * someone who may not read a decision has no business having the operating
 * state summarised for them either, and a second permission table is exactly
 * what the brief forbids.
 */
export async function authorizeAiRequest(caller: CallerIdentity): Promise<AuthorizationResult> {
  if (!caller.userId) return { allowed: false, reason: "No signed-in caller." };
  if (caller.roles.length === 0) {
    return { allowed: false, reason: "This account holds no role." };
  }

  const base = restUrl();
  if (!base) return { allowed: false, reason: "The permission table is not reachable." };

  try {
    const response = await fetch(
      `${base}/rest/v1/role_permissions?select=role&permission=eq.${AI_PERMISSION}` +
        `&role=in.(${caller.roles.map((r) => `"${r}"`).join(",")})&limit=1`,
      { headers: restHeaders() },
    );
    if (!response.ok) {
      return { allowed: false, reason: "The permission table could not be read." };
    }
    const rows = (await response.json()) as Row[];
    if (rows.length === 0) {
      return {
        allowed: false,
        reason: `No role held by this account carries ${AI_PERMISSION}.`,
      };
    }
    return { allowed: true, reason: `Permitted by ${AI_PERMISSION}.` };
  } catch (error) {
    console.error("[founder/ai] authorization lookup failed:", error);
    // An unreadable permission table means refused, never allowed.
    return { allowed: false, reason: "The permission table could not be read." };
  }
}

export interface RateLimitResult {
  allowed: boolean;
  reason: string;
  used: number;
  limit: number;
  windowMinutes: number;
}

/**
 * How many AI requests one caller may make in a window.
 *
 * Counted from founder_ai_requests, which already records every attempt, so
 * this needs no counter of its own and cannot drift from what actually
 * happened. A retry counts: three attempts against a flapping provider are
 * three calls that cost money.
 */
export async function checkRateLimit(
  userId: string,
  options: { limit?: number; windowMinutes?: number } = {},
): Promise<RateLimitResult> {
  const limit = options.limit ?? 60;
  const windowMinutes = options.windowMinutes ?? 10;

  const base = restUrl();
  if (!base) {
    return {
      allowed: false,
      reason: "The request log is not reachable.",
      used: 0,
      limit,
      windowMinutes,
    };
  }

  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  try {
    const response = await fetch(
      `${base}/rest/v1/founder_ai_requests?select=id&user_id=eq.${encodeURIComponent(userId)}` +
        `&created_at=gte.${since}`,
      { headers: { ...restHeaders(), Prefer: "count=exact", Range: "0-0" } },
    );
    const range = response.headers.get("content-range") ?? "";
    const used = Number(range.slice(range.indexOf("/") + 1));
    const count = Number.isFinite(used) ? used : 0;

    if (count >= limit) {
      return {
        allowed: false,
        reason: `${count} AI requests in the last ${windowMinutes} minutes is at the ceiling of ${limit}.`,
        used: count,
        limit,
        windowMinutes,
      };
    }
    return { allowed: true, reason: "Within the rate limit.", used: count, limit, windowMinutes };
  } catch (error) {
    console.error("[founder/ai] rate limit check failed:", error);
    return {
      allowed: false,
      reason: "The request log could not be read, so this is refused rather than allowed.",
      used: 0,
      limit,
      windowMinutes,
    };
  }
}

/** How deep a chain of AI calls may go before it is refused. */
export const MAX_AI_DEPTH = 3;

export interface DepthResult {
  allowed: boolean;
  reason: string;
  depth: number;
}

/**
 * Stop a chain of AI calls from calling itself forever.
 *
 * Depth travels with the request rather than being inferred, because a loop
 * that goes through the database and back looks like a fresh request from the
 * outside. Part 8 and 9 will need this same bound for agents.
 */
export function checkDepth(depth: number): DepthResult {
  if (depth > MAX_AI_DEPTH) {
    return {
      allowed: false,
      reason: `This is ${depth} AI calls deep, past the limit of ${MAX_AI_DEPTH}. Refusing rather than looping.`,
      depth,
    };
  }
  return { allowed: true, reason: "Within the depth limit.", depth };
}

export interface QualityIssue {
  kind: "MISSING" | "STALE" | "CONFLICT" | "OUT_OF_RANGE" | "TOO_FEW_POINTS";
  subject: string;
  detail: string;
}

export interface QualityAssessment {
  /** 0–100. Not a score of the company, a score of what is known about it. */
  score: number;
  issues: QualityIssue[];
  /** True when the data is too poor to support a confident recommendation. */
  refuseStrongRecommendation: boolean;
  summary: string;
}

export interface MetricSample {
  subject: string;
  value: number | null;
  measuredAt: string | null;
  /** Where the value came from, for a conflict report. */
  source: string;
  min?: number | null;
  max?: number | null;
}

/**
 * Judge the data before reasoning over it.
 *
 * The point is section 30: a model given four stale numbers and one missing
 * one will still produce a fluent recommendation. Assessing the inputs first
 * means the recommendation either carries a lower confidence or is refused,
 * rather than being confidently wrong.
 *
 * Conflicts are not resolved here. Two sources disagreeing about the same
 * subject is recorded as a conflict and left that way, which is what Part 4's
 * DATA_CONFLICT exists for.
 */
export function assessDataQuality(samples: MetricSample[]): QualityAssessment {
  const issues: QualityIssue[] = [];

  if (samples.length === 0) {
    return {
      score: 0,
      issues: [
        { kind: "MISSING", subject: "everything", detail: "No measurements were supplied." },
      ],
      refuseStrongRecommendation: true,
      summary: "Nothing was measured, so nothing can be concluded.",
    };
  }

  for (const sample of samples) {
    if (sample.value === null) {
      issues.push({
        kind: "MISSING",
        subject: sample.subject,
        detail: `${sample.source} returned no value.`,
      });
      continue;
    }
    if (freshnessOf(sample.measuredAt) === "STALE") {
      issues.push({
        kind: "STALE",
        subject: sample.subject,
        detail: `the newest reading from ${sample.source} is too old to act on.`,
      });
    }
    if (sample.min !== null && sample.min !== undefined && sample.value < sample.min) {
      issues.push({
        kind: "OUT_OF_RANGE",
        subject: sample.subject,
        detail: `${sample.value} is below the expected minimum of ${sample.min}.`,
      });
    }
    if (sample.max !== null && sample.max !== undefined && sample.value > sample.max) {
      issues.push({
        kind: "OUT_OF_RANGE",
        subject: sample.subject,
        detail: `${sample.value} is above the expected maximum of ${sample.max}.`,
      });
    }
  }

  // Two sources reporting different values for the same subject is a conflict,
  // and picking one silently is the thing being prevented.
  const bySubject = new Map<string, MetricSample[]>();
  for (const sample of samples) {
    if (sample.value === null) continue;
    bySubject.set(sample.subject, [...(bySubject.get(sample.subject) ?? []), sample]);
  }
  for (const [subject, group] of bySubject) {
    const distinct = new Set(group.map((g) => g.value));
    if (group.length > 1 && distinct.size > 1) {
      issues.push({
        kind: "CONFLICT",
        subject,
        detail: `${group.map((g) => `${g.source} says ${g.value}`).join("; ")}.`,
      });
    }
  }

  const usable = samples.filter((s) => s.value !== null).length;
  const stale = issues.filter((i) => i.kind === "STALE").length;
  const conflicts = issues.filter((i) => i.kind === "CONFLICT").length;

  let score = Math.round((usable / samples.length) * 100);
  if (stale > 0) score = Math.round(score * (1 - stale / samples.length / 2));
  if (conflicts > 0) score = Math.min(score, 40);
  if (issues.some((i) => i.kind === "OUT_OF_RANGE")) score = Math.min(score, 60);

  const refuse = conflicts > 0 || usable === 0 || score < 40;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    refuseStrongRecommendation: refuse,
    summary: refuse
      ? conflicts > 0
        ? "Sources disagree; this needs resolving before a recommendation means anything."
        : "The data is too thin or too old to support a confident recommendation."
      : issues.length > 0
        ? "Usable, with caveats noted."
        : "Every measurement is present and current.",
  };
}
