import { loadOperatingState } from "../operating-state.server";
import type { Confidence } from "../state.types";

import { loadDecisionMemory } from "./learning.server";

/**
 * AI Reports, generated from what the company actually recorded.
 *
 * The screen this feeds carried five reports written into the component under
 * a comment reading "Mock reports data", with sizes, page counts and accuracy
 * percentages that had never been measured. This replaces the source of that
 * screen, not the screen.
 *
 * The rule that shapes the whole file is section 9: where the data is not
 * there, the report says so. A report with no findings is stored with its
 * limitations and an insufficient_data flag rather than an empty list that
 * reads like a clean bill of health — the table refuses the empty version.
 *
 * Nothing here calls a model. A report is an assembly of measured figures with
 * their sources named; the intelligence layer can be asked to comment on one
 * afterwards, and that commentary is labelled as AI when it happens.
 */

export type ReportType =
  "EXECUTIVE_SUMMARY" | "OPERATIONAL_HEALTH" | "DECISION_REVIEW" | "RISK_REVIEW" | "KPI_REVIEW";

export interface ReportFinding {
  /** What kind of claim this is, kept from the evidence taxonomy. */
  kind: "FACT" | "OBSERVATION" | "CALCULATION";
  statement: string;
  source: string;
  value?: number | string | null;
}

/**
 * What a report was built from.
 *
 * A named shape rather than a free-form map, for two reasons. It crosses the
 * server-function boundary, where a map of unknown values cannot be
 * serialised. And a report that cannot say which sources it read is a
 * document, not a report — naming them is the point.
 */
export interface ReportBasis {
  reportType: string;
  /** The sources actually read, named one by one. */
  generatedFrom: string[];
}

export interface ReportRecord {
  id: string;
  reportType: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  producedByAi: boolean;
  basis: ReportBasis;
  findings: ReportFinding[];
  recommendations: string[];
  limitations: string[];
  confidence: Confidence;
  insufficientData: boolean;
  status: string;
  failureReason: string | null;
  /** Roles that may read it. Empty means everyone holding report.read. */
  allowedRoles: string[];
}

type Row = Record<string, unknown>;

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function str(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** The stored jsonb, read back into the shape the screen is typed against. */
function toBasis(value: unknown): ReportBasis {
  const raw = (value ?? {}) as { reportType?: unknown; generatedFrom?: unknown };
  return {
    reportType: typeof raw.reportType === "string" ? raw.reportType : "",
    generatedFrom: Array.isArray(raw.generatedFrom) ? raw.generatedFrom.map(String) : [],
  };
}

function toReport(row: Row): ReportRecord {
  return {
    id: String(row.id),
    reportType: str(row, "report_type") ?? "",
    title: str(row, "title") ?? "",
    periodStart: str(row, "period_start") ?? "",
    periodEnd: str(row, "period_end") ?? "",
    generatedAt: str(row, "generated_at") ?? "",
    producedByAi: row.produced_by_ai === true,
    basis: toBasis(row.basis),
    findings: Array.isArray(row.findings) ? (row.findings as ReportFinding[]) : [],
    recommendations: Array.isArray(row.recommendations) ? row.recommendations.map(String) : [],
    limitations: Array.isArray(row.limitations) ? row.limitations.map(String) : [],
    confidence: (str(row, "confidence") ?? "UNKNOWN") as Confidence,
    insufficientData: row.insufficient_data === true,
    status: str(row, "status") ?? "generated",
    failureReason: str(row, "failure_reason"),
    allowedRoles: Array.isArray(row.allowed_roles) ? row.allowed_roles.map(String) : [],
  };
}

/** Reports this reader may see. */
export async function listReports(
  roles: string[],
  limit = 50,
): Promise<{ reports: ReportRecord[]; degraded: string[] }> {
  const base = restUrl();
  if (!base) return { reports: [], degraded: ["founder_reports"] };

  const permission =
    roles.length === 0
      ? "allowed_roles=eq.{}"
      : `or=(allowed_roles.eq.{},allowed_roles.ov.{${roles.map((r) => `"${r}"`).join(",")}})`;

  try {
    const response = await fetch(
      `${base}/rest/v1/founder_reports?select=*&status=neq.archived&order=generated_at.desc` +
        `&limit=${Math.min(limit, 200)}&${permission}`,
      { headers: restHeaders() },
    );
    if (!response.ok) throw new Error(String(response.status));
    return { reports: ((await response.json()) as Row[]).map(toReport), degraded: [] };
  } catch (error) {
    console.error("[founder/reports] list unavailable:", error);
    return { reports: [], degraded: ["founder_reports"] };
  }
}

export interface GenerateInput {
  reportType: ReportType;
  periodStart: Date;
  periodEnd: Date;
  generatedBy?: string | null;
  allowedRoles?: string[];
}

const TITLES: Record<ReportType, string> = {
  EXECUTIVE_SUMMARY: "Executive summary",
  OPERATIONAL_HEALTH: "Operational health",
  DECISION_REVIEW: "Decision review",
  RISK_REVIEW: "Risk review",
  KPI_REVIEW: "KPI review",
};

/**
 * Build a report from the operating state and the decision record.
 *
 * Findings are only produced where something was measured. A KPI with no
 * reading contributes a limitation, not a finding — and a report made entirely
 * of limitations is stored as such, saying plainly that there was not enough
 * data, rather than being suppressed or padded.
 */
export async function generateReport(
  input: GenerateInput,
): Promise<{ ok: boolean; report?: ReportRecord; error?: string }> {
  const findings: ReportFinding[] = [];
  const limitations: string[] = [];
  const recommendations: string[] = [];
  const basis: ReportBasis = {
    reportType: input.reportType,
    generatedFrom: [],
  };

  let state: Awaited<ReturnType<typeof loadOperatingState>>;
  try {
    state = await loadOperatingState();
    basis.generatedFrom.push(...Object.values(state.sources).map((s) => s.source));
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message.slice(0, 200)
          : "the operating state could not be read",
    };
  }

  for (const source of state.degraded) {
    limitations.push(`${source} could not be read, so anything depending on it is missing here.`);
  }

  // KPIs: a reading is a finding, an absent one is a limitation.
  if (input.reportType === "KPI_REVIEW" || input.reportType === "EXECUTIVE_SUMMARY") {
    if (state.kpis.length === 0) {
      limitations.push("No KPI is defined, so there is nothing to report on.");
    }
    for (const kpi of state.kpis) {
      if (kpi.current.value === null) {
        limitations.push(`${kpi.name} has no reading; its status is unknown.`);
        continue;
      }
      findings.push({
        kind: "FACT",
        statement: `${kpi.name} is ${kpi.current.value}${kpi.unit ? ` ${kpi.unit}` : ""} — ${kpi.statusReason}`,
        source: kpi.current.source,
        value: kpi.current.value,
      });
      if (kpi.status === "AT_RISK" || kpi.status === "CRITICAL") {
        recommendations.push(`Review ${kpi.name}: ${kpi.statusReason}`);
      }
    }
  }

  if (input.reportType === "OPERATIONAL_HEALTH" || input.reportType === "EXECUTIVE_SUMMARY") {
    const known = state.health.filter((h) => h.health !== "UNKNOWN");
    if (known.length === 0) {
      limitations.push(
        "Nothing is recorded against any business domain, so health cannot be judged.",
      );
    }
    for (const domain of known) {
      findings.push({
        kind: "OBSERVATION",
        statement: `${domain.domain.replace(/_/g, " ").toLowerCase()} is ${domain.health} — ${domain.reason}`,
        source: "founder_attention + founder_kpis",
      });
    }

    const overdue = state.deadlines.filter((d) => d.state === "OVERDUE");
    const atRisk = state.deadlines.filter((d) => d.state === "AT_RISK");
    if (state.deadlines.length === 0) {
      limitations.push("No dated work is recorded, so no deadline can be assessed.");
    } else {
      findings.push({
        kind: "CALCULATION",
        statement: `${overdue.length} deadline(s) have passed and ${atRisk.length} are blocked or at risk, out of ${state.deadlines.length} dated items.`,
        source: "tm_tasks + tm_dependencies",
        value: overdue.length,
      });
      for (const item of atRisk.slice(0, 5)) {
        recommendations.push(`${item.title}: ${item.reason}`);
      }
    }
  }

  if (input.reportType === "RISK_REVIEW" || input.reportType === "EXECUTIVE_SUMMARY") {
    if (state.risks.length === 0) {
      limitations.push("The risk register holds nothing for this period.");
    } else {
      const critical = state.risks.filter(
        (r) => r.severity === "CRITICAL" || r.severity === "HIGH",
      );
      findings.push({
        kind: "FACT",
        statement: `${state.risks.length} open risk(s), ${critical.length} at high or critical severity.`,
        source: "founder_risks",
        value: state.risks.length,
      });
    }
  }

  if (input.reportType === "DECISION_REVIEW" || input.reportType === "EXECUTIVE_SUMMARY") {
    const { memories, degraded } = await loadDecisionMemory(200);
    if (degraded.length > 0) limitations.push("The decision record could not be read.");
    basis.generatedFrom.push("founder_decisions");

    const inPeriod = memories.filter((m) => {
      const at = new Date(m.createdAt).getTime();
      return at >= input.periodStart.getTime() && at <= input.periodEnd.getTime();
    });

    if (inPeriod.length === 0) {
      limitations.push("No decision reached a human in this period.");
    } else {
      const answered = inPeriod.filter((m) => m.recommendationAccepted !== null);
      const accepted = inPeriod.filter((m) => m.recommendationAccepted === true);
      const overridden = inPeriod.filter((m) => m.overridden);
      const withOutcome = inPeriod.filter((m) => m.outcome);

      findings.push({
        kind: "CALCULATION",
        statement: `${inPeriod.length} decision(s) reached a human; ${answered.length} were answered, ${accepted.length} accepted as recommended, ${overridden.length} overridden.`,
        source: "founder_decisions + founder_approvals",
        value: inPeriod.length,
      });

      if (withOutcome.length === 0) {
        limitations.push(
          "No outcome has been recorded against any decision in this period, so nothing can be said about whether they worked.",
        );
      } else {
        findings.push({
          kind: "FACT",
          statement: `${withOutcome.length} decision(s) have a recorded outcome.`,
          source: "founder_decisions.outcome",
          value: withOutcome.length,
        });
      }

      if (overridden.length > 0) {
        recommendations.push(
          `${overridden.length} recommendation(s) were overridden; the reasons are worth reading before the next similar decision.`,
        );
      }
    }
  }

  const insufficient = findings.length === 0;
  if (insufficient) {
    limitations.push("No sufficient data available for this period.");
  }

  // Confidence follows what the report is actually made of.
  const confidence: Confidence = insufficient
    ? "UNKNOWN"
    : limitations.length > findings.length
      ? "ESTIMATED"
      : "MEASURED";

  const base = restUrl();
  if (!base) return { ok: false, error: "The database is not configured." };

  try {
    const response = await fetch(`${base}/rest/v1/founder_reports`, {
      method: "POST",
      headers: restHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify({
        report_type: input.reportType,
        title: `${TITLES[input.reportType]} — ${input.periodStart.toISOString().slice(0, 10)} to ${input.periodEnd.toISOString().slice(0, 10)}`,
        period_start: input.periodStart.toISOString(),
        period_end: input.periodEnd.toISOString(),
        generated_by: input.generatedBy ?? null,
        // Assembled from measured figures, not written by a model.
        produced_by_ai: false,
        basis: { ...basis, generatedFrom: [...new Set(basis.generatedFrom)] },
        findings,
        recommendations,
        limitations,
        confidence,
        insufficient_data: insufficient,
        status: "generated",
        allowed_roles: input.allowedRoles ?? [],
      }),
    });

    if (!response.ok) {
      return { ok: false, error: (await response.text()).slice(0, 300) };
    }
    return { ok: true, report: toReport(((await response.json()) as Row[])[0] ?? {}) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "failed" };
  }
}

/**
 * How many reports exist, counted in SQL and scoped to the reader's roles.
 *
 * The screen previously drew 365 daily, 52 weekly, 12 monthly and "100%
 * delivered". None of those had ever been counted, and nothing in this
 * platform delivers a report anywhere. These are the four figures that can
 * honestly be stated about the register.
 */
export interface ReportTotals {
  total: number;
  generated: number;
  failed: number;
  insufficientData: number;
  withFindings: number;
}

export async function loadReportTotals(
  roles: string[],
): Promise<{ totals: ReportTotals | null; degraded: string[] }> {
  const base = restUrl();
  if (!base) return { totals: null, degraded: ["founder_report_totals"] };

  try {
    const response = await fetch(`${base}/rest/v1/rpc/founder_report_totals`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({ p_roles: roles }),
    });
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as Row[];
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return { totals: null, degraded: ["founder_report_totals"] };

    const count = (key: string): number => {
      const value = row[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
      return 0;
    };

    return {
      totals: {
        total: count("total"),
        generated: count("generated"),
        failed: count("failed"),
        insufficientData: count("insufficient_data"),
        withFindings: count("with_findings"),
      },
      degraded: [],
    };
  } catch (error) {
    console.error("[founder/reports] totals unavailable:", error);
    return { totals: null, degraded: ["founder_report_totals"] };
  }
}
