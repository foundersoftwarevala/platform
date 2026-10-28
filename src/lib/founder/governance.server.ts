import type { TransactionSql } from "postgres";
import type { Severity } from "./state.types";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";
import { loadSecurityAssessment, type SecurityAlertInput } from "./insights.server";

type Row = Record<string, unknown>;

function safeText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

const RANK: Record<string, number> = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export interface RiskCategoryView {
  id: string;
  category: string;
  level: "low" | "medium" | "high" | "critical";
  score: number | null;
  issues: number;
  trend: string | null;
  scoringMethod: string | null;
}

export interface ComplianceItemView {
  id: string;
  policy: string;
  status: string;
  lastReviewed: string | null;
  dateLabel: string;
  reviewDue: string | null;
  source: string;
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
  securityAlerts: number;
  sources: Record<string, string>;
  degraded: string[];
  assessment: { model: string; createdAt: string; summary: string } | null;
}

function severity(value: unknown): Severity {
  const normalized = String(value ?? "LOW").toUpperCase();
  if (normalized === "INFO" || normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH" || normalized === "CRITICAL") return normalized;
  return "LOW";
}

function levelOf(value: string): RiskCategoryView["level"] {
  const rank = RANK[value.toUpperCase()] ?? 1;
  if (rank >= 4) return "critical";
  if (rank === 3) return "high";
  if (rank === 2) return "medium";
  return "low";
}

async function safeRows<T extends Row>(
  label: string,
  degraded: string[],
  query: (tx: TransactionSql) => Promise<T[]>,
  fallback: T[] = [],
): Promise<T[]> {
  try {
    return await withVpsPublicDatabase(query);
  } catch (error) {
    console.error(`[founder/governance] ${label} unavailable:`, error);
    degraded.push(label);
    return fallback;
  }
}

export async function loadGovernance(): Promise<GovernanceView> {
  const degraded: string[] = [];
  const [risks, policies, safety, attention, alerts, legalPolicies] = await Promise.all([
    safeRows("founder_risks", degraded, (tx) => tx<Row[]>`
      select id::text, title, description, domain, affected_area, severity::text, status,
        score, scoring_method, mitigation, source, detected_at::text
      from public.founder_risks
      where lower(status) not in ('resolved', 'closed', 'dismissed')
      order by detected_at desc limit 200
    `),
    safeRows("founder_policies", degraded, (tx) => tx<Row[]>`
      select id::text, policy_key, name, description, domain, decision_type, status,
        effective_from::text, effective_until::text
      from public.founder_policies
      where status = 'active' and effective_from <= now()
        and (effective_until is null or effective_until > now())
      order by effective_from desc limit 100
    `),
    safeRows("safety_policies", degraded, (tx) => tx<Row[]>`
      select id::text, name, category, enabled, created_at::text
      from public.safety_policies where enabled is true
      order by created_at desc limit 100
    `),
    safeRows("founder_attention", degraded, (tx) => tx<Row[]>`
      select id::text, title, reason, severity::text, created_at::text
      from public.founder_attention
      where status in ('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS')
      order by severity desc, created_at desc limit 50
    `),
    safeRows("security_alerts", degraded, (tx) => tx<Row[]>`
      select id::text, title, severity, category, source, detected_at::text, description
      from public.security_alerts
      where resolved_at is null and lower(status) not in ('resolved', 'closed', 'dismissed')
      order by detected_at desc limit 200
    `),
    safeRows("legal_policies", degraded, (tx) => tx<Row[]>`
      select id::text, name, policy_type,
        case when review_due < current_date then 'review_due' else status end as status,
        last_updated::text, effective_from::text, review_due::text, updated_at::text
      from public.legal_policies
      where status = 'published' and (effective_from is null or effective_from <= current_date)
      order by coalesce(last_updated, effective_from) desc nulls last limit 100
    `),
  ]);

  const securityAlerts: SecurityAlertInput[] = alerts.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Security alert"),
    severity: String(row.severity ?? "LOW"),
    category: String(row.category ?? "security"),
    source: String(row.source ?? "security_alerts"),
    detectedAt: String(row.detected_at ?? ""),
    description: safeText(row.description),
  }));
  let assessment: Awaited<ReturnType<typeof loadSecurityAssessment>> = null;
  try {
    assessment = await loadSecurityAssessment(securityAlerts);
  } catch (error) {
    console.error("[founder/governance] security_risk_assessment unavailable:", error);
    degraded.push("security_risk_assessment");
  }
  const aiScores = new Map(assessment?.issues.map((item) => [item.id, item]) ?? []);
  const grouped = new Map<string, Row[]>();
  for (const risk of risks) {
    const area = safeText(risk.affected_area) ?? safeText(risk.domain) ?? "EXECUTIVE";
    grouped.set(area, [...(grouped.get(area) ?? []), risk]);
  }

  const riskCategories: RiskCategoryView[] = [...grouped.entries()].map(([area, items]) => {
    const scores = items.map((item) => numberOrNull(item.score)).filter((score): score is number => score !== null);
    const worst = items.reduce((rank, item) => Math.max(rank, RANK[severity(item.severity)] ?? 1), 0);
    const methods = [...new Set(items.map((item) => safeText(item.scoring_method)).filter((method): method is string => method !== null))];
    return {
      id: area,
      category: area.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
      level: levelOf(Object.keys(RANK).find((key) => RANK[key] === worst) ?? "LOW"),
      score: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
      issues: items.length,
      trend: null,
      scoringMethod: methods[0] ?? null,
    };
  });

  const alertGroups = new Map<string, { scores: number[]; severity: Severity[] }>();
  for (const alert of securityAlerts) {
    const group = alert.category || "security";
    const current = alertGroups.get(group) ?? { scores: [], severity: [] };
    const scored = aiScores.get(alert.id);
    if (scored) {
      current.scores.push(scored.score);
      current.severity.push(scored.severity);
    } else {
      current.severity.push(severity(alert.severity));
    }
    alertGroups.set(group, current);
  }
  for (const [category, group] of alertGroups) {
    const highestSeverity = group.severity.reduce((highest, value) => (RANK[value] > RANK[highest] ? value : highest), "LOW" as Severity);
    const score = group.scores.length ? Math.round(group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length) : null;
    const scoreLevel = highestSeverity;
    riskCategories.push({
      id: `security:${category}`,
      category: `Security · ${category.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}`,
      level: levelOf(scoreLevel),
      score,
      issues: securityAlerts.filter((alert) => alert.category === category).length,
      trend: null,
      scoringMethod: score === null ? null : `Local Ollama issue scores averaged per category (${assessment?.model ?? "local model"})`,
    });
  }

  const compliance: ComplianceItemView[] = [
    ...legalPolicies.map((policy) => ({
      id: `legal:${String(policy.id)}`,
      policy: safeText(policy.name) ?? String(policy.id),
      status: safeText(policy.status) ?? "unknown",
      lastReviewed: safeText(policy.last_updated) ?? safeText(policy.updated_at),
      dateLabel: "Updated",
      reviewDue: safeText(policy.review_due),
      source: "legal_policies",
      scope: safeText(policy.policy_type),
    })),
    ...policies.map((policy) => ({
      id: `founder:${String(policy.id)}`,
      policy: safeText(policy.name) ?? safeText(policy.policy_key) ?? String(policy.id),
      status: safeText(policy.status) ?? "unknown",
      lastReviewed: safeText(policy.effective_from),
      dateLabel: "Effective",
      reviewDue: safeText(policy.effective_until),
      source: "founder_policies",
      scope: [safeText(policy.domain), safeText(policy.decision_type)].filter((value): value is string => value !== null).join(" · ") || null,
    })),
    ...safety.map((policy) => ({
      id: `safety:${String(policy.id)}`,
      policy: safeText(policy.name) ?? String(policy.id),
      status: "active",
      lastReviewed: safeText(policy.created_at),
      dateLabel: "Created",
      reviewDue: null,
      source: "safety_policies",
      scope: safeText(policy.category),
    })),
  ];

  const preventive: PreventiveAction[] = [
    ...(assessment?.suggestions.map((suggestion, index) => ({
      id: `ollama:${assessment?.snapshotHash}:${index}`,
      text: `${suggestion.title}: ${suggestion.action}`,
      source: `Local Ollama · ${assessment?.model}`,
      severity: severity(suggestion.severity),
    })) ?? []),
    ...risks.map((risk) => {
      const mitigation = safeText(risk.mitigation);
      return mitigation ? { id: `risk:${String(risk.id)}`, text: mitigation, source: "founder_risks", severity: severity(risk.severity) } : null;
    }).filter((action): action is PreventiveAction => action !== null),
    ...attention.slice(0, 10).map((item) => ({
      id: `attention:${String(item.id)}`,
      text: safeText(item.reason) ?? safeText(item.title) ?? "",
      source: "founder_attention",
      severity: severity(item.severity),
    })),
  ].filter((action) => action.text.length > 0);

  const criticalRisks = risks.filter((risk) => severity(risk.severity) === "CRITICAL").length
    + securityAlerts.filter((alert) => (aiScores.get(alert.id)?.score ?? 0) >= 90 || severity(alert.severity) === "CRITICAL").length;

  return {
    riskCategories,
    compliance,
    preventive,
    openRisks: risks.length + securityAlerts.length,
    criticalRisks,
    securityAlerts: securityAlerts.length,
    sources: {
      risks: "VPS public.founder_risks + public.security_alerts",
      compliance: "VPS public.legal_policies + public.founder_policies + public.safety_policies",
      preventive: "VPS local-Ollama assessments + founder risk mitigations + founder attention",
      alerts: "VPS public.security_alerts",
    },
    degraded: [...new Set(degraded)],
    assessment: assessment ? { model: assessment.model, createdAt: assessment.createdAt, summary: assessment.summary } : null,
  };
}
