import type { Severity } from "./state.types";

/**
 * What the Risk & Compliance screen shows, read from the governance tables.
 *
 * That screen shipped with three hardcoded arrays under a comment reading
 * "Mock risk data" — five invented risk categories with invented scores, five
 * invented compliance policies with invented audit dates, and three invented
 * suggestions. It also carried a notice saying it was waiting for a risk
 * scoring engine and a compliance register. Both now exist, so this reads them.
 *
 * Two things are deliberately absent where the platform cannot support them.
 * There is no trend, because nothing stores a risk score history yet and an
 * arrow pointing up would be decoration. And nothing here asserts compliance:
 * a policy's status is the status recorded against it, never a claim that the
 * company is compliant with a law.
 */

type Row = Record<string, unknown>;

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows(table: string, query: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${table}: ${response.status}`);
  return (await response.json()) as Row[];
}

async function safe<T>(label: string, degraded: string[], run: () => Promise<T>, fallback: T) {
  try {
    return await run();
  } catch (error) {
    console.error(`[founder/governance] ${label} unavailable:`, error);
    degraded.push(label);
    return fallback;
  }
}

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

const RANK: Record<string, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export interface RiskCategoryView {
  id: string;
  category: string;
  level: "low" | "medium" | "high" | "critical";
  /** Null where no risk in this group carries a scored assessment. */
  score: number | null;
  issues: number;
  /** Null until a score history exists. Never an invented arrow. */
  trend: string | null;
  /** The formula behind the score, so the number can be defended. */
  scoringMethod: string | null;
}

export interface ComplianceItemView {
  id: string;
  policy: string;
  status: string;
  lastReviewed: string | null;
  source: string;
  /** What the policy actually governs, rather than a claim about the law. */
  scope: string | null;
}

export interface PreventiveAction {
  id: string;
  text: string;
  source: string;
  severity: Severity;
}

export interface GovernanceView {
  riskCategories: RiskCategoryView[];
  compliance: ComplianceItemView[];
  preventive: PreventiveAction[];
  openRisks: number;
  criticalRisks: number;
  sources: Record<string, string>;
  degraded: string[];
}

function levelOf(severity: string): RiskCategoryView["level"] {
  const rank = RANK[severity.toUpperCase()] ?? 1;
  if (rank >= 4) return "critical";
  if (rank === 3) return "high";
  if (rank === 2) return "medium";
  return "low";
}

/**
 * Risks grouped the way the screen groups them: by the area they affect.
 *
 * The score is the mean of the scored risks in the group, and it is null when
 * none of them carries a score — the table refuses a score without a method,
 * so an averaged score always has methods behind it.
 */
export async function loadGovernance(): Promise<GovernanceView> {
  const degraded: string[] = [];

  const [risks, policies, safety, attention, alerts] = await Promise.all([
    safe(
      "founder_risks",
      degraded,
      () => rows("founder_risks", `select=*&status=neq.resolved&order=detected_at.desc&limit=200`),
      [] as Row[],
    ),
    safe(
      "founder_policies",
      degraded,
      () => rows("founder_policies", `select=*&order=effective_from.desc&limit=100`),
      [] as Row[],
    ),
    safe(
      "safety_policies",
      degraded,
      () => rows("safety_policies", `select=*&limit=100`),
      [] as Row[],
    ),
    safe(
      "founder_attention",
      degraded,
      () =>
        rows(
          "founder_attention",
          `select=*&status=in.(NEW,ACKNOWLEDGED,IN_PROGRESS)&order=severity.desc&limit=50`,
        ),
      [] as Row[],
    ),
    safe(
      "security_alerts",
      degraded,
      () => rows("security_alerts", `select=*&resolved_at=is.null&limit=100`),
      [] as Row[],
    ),
  ]);

  // Group the recorded risks by the area they affect.
  const groups = new Map<string, Row[]>();
  for (const risk of risks) {
    const key = str(risk, "affected_area") ?? str(risk, "domain") ?? "EXECUTIVE";
    groups.set(key, [...(groups.get(key) ?? []), risk]);
  }

  const riskCategories: RiskCategoryView[] = [...groups.entries()].map(([area, items]) => {
    const scored = items.map((r) => num(r, "score")).filter((s): s is number => s !== null);
    const worst = items.reduce((acc, r) => {
      const rank = RANK[(str(r, "severity") ?? "LOW").toUpperCase()] ?? 1;
      return Math.max(acc, rank);
    }, 0);
    const methods = [...new Set(items.map((r) => str(r, "scoring_method")).filter(Boolean))];

    return {
      id: area,
      category: area
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      level: levelOf(Object.keys(RANK).find((k) => RANK[k] === worst) ?? "LOW"),
      score:
        scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
      issues: items.length,
      // No score history exists yet, so there is no trend to report.
      trend: null,
      scoringMethod: methods[0] ?? null,
    };
  });

  // Security alerts are a risk area the platform already tracks, folded in so
  // the screen shows one picture rather than two.
  if (alerts.length > 0) {
    const worst = alerts.reduce((acc, a) => {
      const rank = RANK[(str(a, "severity") ?? "LOW").toUpperCase()] ?? 1;
      return Math.max(acc, rank);
    }, 0);
    riskCategories.push({
      id: "security_alerts",
      category: "Security Alerts",
      level: levelOf(Object.keys(RANK).find((k) => RANK[k] === worst) ?? "LOW"),
      score: null,
      issues: alerts.length,
      trend: null,
      scoringMethod: null,
    });
  }

  const compliance: ComplianceItemView[] = [
    ...policies.map((p) => ({
      id: `policy:${String(p.id)}`,
      policy: str(p, "name") ?? str(p, "policy_key") ?? String(p.id),
      status: str(p, "status") ?? "draft",
      lastReviewed: str(p, "effective_from"),
      source: "founder_policies",
      scope: [str(p, "domain"), str(p, "decision_type")].filter(Boolean).join(" · ") || null,
    })),
    ...safety.map((s) => ({
      id: `safety:${String(s.id)}`,
      policy: str(s, "name") ?? String(s.id),
      status: s.enabled === false ? "disabled" : "active",
      lastReviewed: str(s, "created_at"),
      source: "safety_policies",
      scope: str(s, "category"),
    })),
  ];

  // What could be done, taken from what the platform has actually recorded —
  // a risk's own mitigation, or the reason an attention item was raised.
  const preventive: PreventiveAction[] = [
    ...risks
      .map((r) => {
        const mitigation = str(r, "mitigation");
        if (!mitigation) return null;
        return {
          id: `risk:${String(r.id)}`,
          text: mitigation,
          source: "founder_risks",
          severity: (str(r, "severity") ?? "LOW").toUpperCase() as Severity,
        };
      })
      .filter((a): a is PreventiveAction => a !== null),
    ...attention.slice(0, 10).map((a) => ({
      id: `attention:${String(a.id)}`,
      text: str(a, "reason") ?? str(a, "title") ?? "",
      source: "founder_attention",
      severity: (str(a, "severity") ?? "LOW").toUpperCase() as Severity,
    })),
  ].filter((a) => a.text.length > 0);

  return {
    riskCategories,
    compliance,
    preventive,
    openRisks: risks.length,
    criticalRisks: risks.filter((r) => (str(r, "severity") ?? "").toUpperCase() === "CRITICAL")
      .length,
    sources: {
      risks: "founder_risks",
      compliance: "founder_policies + safety_policies",
      preventive: "founder_risks.mitigation + founder_attention",
      alerts: "security_alerts",
    },
    degraded: [...new Set(degraded)],
  };
}
