import type { Confidence } from "../state.types";

/**
 * The System Learning Log, and the decision memory it reads from.
 *
 * Decision memory is not rebuilt here. founder_decisions and
 * founder_decision_history already hold the whole chain — what was observed,
 * what the AI recommended, what a human decided, what they overrode and what
 * the outcome was — so the learning log points at that rather than keeping a
 * second copy that could disagree with it.
 *
 * The vocabulary is deliberate. Nothing in this module retrains a model, so
 * nothing in it says a model was retrained. A learning record is created, a
 * pattern is identified, feedback is recorded. Saying otherwise would be the
 * kind of claim the owner has been most explicit about refusing.
 *
 * A pattern is a claim about repetition and the table will not accept one
 * resting on a single case. One override is a disagreement; five overrides of
 * the same recommendation are a signal.
 */

export type LearningStage =
  | "OBSERVATION"
  | "SUGGESTION"
  | "HUMAN_DECISION"
  | "ACTION"
  | "OUTCOME"
  | "FEEDBACK"
  | "PATTERN"
  | "BEHAVIOUR_ADJUSTMENT";

export interface LearningEntry {
  id: string;
  threadId: string;
  stage: LearningStage;
  title: string;
  detail: string;
  decisionId: string | null;
  knowledgeId: string | null;
  actorKind: string;
  sourceSystem: string;
  patternKey: string | null;
  sampleSize: number | null;
  confidence: Confidence;
  occurredAt: string;
}

/** One decision's full story, assembled from the decision tables. */
export interface DecisionMemory {
  decisionId: string;
  title: string;
  observation: string;
  aiRecommendation: string | null;
  humanDecision: string | null;
  /** True where a person chose something other than the recommendation. */
  overridden: boolean;
  overrideReason: string | null;
  outcome: string | null;
  outcomeRecordedAt: string | null;
  /** Whether the recommendation was accepted, refused, or never answered. */
  recommendationAccepted: boolean | null;
  state: string;
  createdAt: string;
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

async function rows(table: string, query: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${table}: ${response.status}`);
  return (await response.json()) as Row[];
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

export async function loadLearningLog(limit = 100): Promise<{
  entries: LearningEntry[];
  degraded: string[];
}> {
  try {
    const data = await rows(
      "founder_learning",
      `select=*&order=occurred_at.desc&limit=${Math.min(limit, 200)}`,
    );
    return {
      entries: data.map((row) => ({
        id: String(row.id),
        threadId: String(row.thread_id),
        stage: (str(row, "stage") ?? "OBSERVATION") as LearningStage,
        title: str(row, "title") ?? "",
        detail: str(row, "detail") ?? "",
        decisionId: str(row, "decision_id"),
        knowledgeId: str(row, "knowledge_id"),
        actorKind: str(row, "actor_kind") ?? "SYSTEM",
        sourceSystem: str(row, "source_system") ?? "",
        patternKey: str(row, "pattern_key"),
        sampleSize: num(row, "sample_size"),
        confidence: (str(row, "confidence") ?? "UNKNOWN") as Confidence,
        occurredAt: str(row, "occurred_at") ?? "",
      })),
      degraded: [],
    };
  } catch (error) {
    console.error("[founder/learning] log unavailable:", error);
    return { entries: [], degraded: ["founder_learning"] };
  }
}

/**
 * Decision memory, read from where decisions actually live.
 *
 * Only decisions that reached a human are included: a decision still being
 * analysed has nothing to learn from yet, and including it would pad the log
 * with cases that have no outcome.
 */
export async function loadDecisionMemory(limit = 50): Promise<{
  memories: DecisionMemory[];
  degraded: string[];
}> {
  try {
    const decisions = await rows(
      "founder_decisions",
      `select=*&state=in.(APPROVED,REJECTED,EXECUTING,VERIFICATION,VERIFIED,FAILED,CLOSED)` +
        `&order=updated_at.desc&limit=${Math.min(limit, 200)}`,
    );
    if (decisions.length === 0) return { memories: [], degraded: [] };

    const ids = decisions.map((d) => `"${String(d.id)}"`).join(",");
    const [options, approvals] = await Promise.all([
      rows("founder_decision_options", `select=*&decision_id=in.(${ids})&limit=400`).catch(
        () => [],
      ),
      rows("founder_approvals", `select=*&decision_id=in.(${ids})&limit=200`).catch(() => []),
    ]);

    const memories = decisions.map((d): DecisionMemory => {
      const id = String(d.id);
      const recommendedId = str(d, "recommended_option_id");
      const selectedId = str(d, "selected_option_id");
      const recommended = options.find((o) => String(o.id) === recommendedId);
      const selected = options.find((o) => String(o.id) === selectedId);
      const approval = approvals.find((a) => String(a.decision_id) === id);
      const approvalState = approval ? str(approval, "state") : null;

      const overridden = Boolean(selectedId && recommendedId && selectedId !== recommendedId);

      // Accepted means a human approved it and did not swap the option.
      // Refused means rejected, or approved but overridden. Null means nobody
      // has answered — which is not the same as refused.
      let accepted: boolean | null = null;
      if (approvalState === "APPROVED") accepted = !overridden;
      else if (approvalState === "REJECTED") accepted = false;

      return {
        decisionId: id,
        title: str(d, "title") ?? id,
        observation: str(d, "description") ?? "",
        aiRecommendation: recommended
          ? `${str(recommended, "label")}. ${str(recommended, "title")}`
          : null,
        humanDecision: selected
          ? `${str(selected, "label")}. ${str(selected, "title")}`
          : approvalState
            ? approvalState.toLowerCase()
            : null,
        overridden,
        overrideReason: str(d, "override_reason"),
        outcome: str(d, "outcome"),
        outcomeRecordedAt: str(d, "outcome_recorded_at"),
        recommendationAccepted: accepted,
        state: str(d, "state") ?? "",
        createdAt: str(d, "created_at") ?? "",
      };
    });

    return { memories, degraded: [] };
  } catch (error) {
    console.error("[founder/learning] decision memory unavailable:", error);
    return { memories: [], degraded: ["founder_decisions"] };
  }
}

export interface RecordLearning {
  stage: LearningStage;
  title: string;
  detail: string;
  threadId?: string | null;
  decisionId?: string | null;
  knowledgeId?: string | null;
  eventId?: string | null;
  actorKind: "HUMAN" | "AI" | "SYSTEM" | "EXTERNAL";
  actorId?: string | null;
  sourceSystem: string;
  evidence?: Record<string, unknown>;
  patternKey?: string | null;
  sampleSize?: number | null;
  confidence?: Confidence;
}

/** Append one stage to the log. */
export async function recordLearning(
  entry: RecordLearning,
): Promise<{ ok: boolean; id?: string; threadId?: string; error?: string }> {
  if (!entry.title?.trim() || !entry.detail?.trim()) {
    return { ok: false, error: "A learning record needs a title and a detail." };
  }
  if (entry.stage === "PATTERN" && (!entry.patternKey || (entry.sampleSize ?? 0) < 2)) {
    return {
      ok: false,
      error: "A pattern needs a key and at least two cases. One occurrence is an anecdote.",
    };
  }
  if (entry.stage === "OUTCOME" && !entry.decisionId) {
    return { ok: false, error: "An outcome has to name the decision it is the outcome of." };
  }

  const base = restUrl();
  if (!base) return { ok: false, error: "The database is not configured." };

  try {
    const response = await fetch(`${base}/rest/v1/founder_learning`, {
      method: "POST",
      headers: restHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify({
        stage: entry.stage,
        title: entry.title.trim(),
        detail: entry.detail.trim(),
        ...(entry.threadId ? { thread_id: entry.threadId } : {}),
        decision_id: entry.decisionId ?? null,
        knowledge_id: entry.knowledgeId ?? null,
        event_id: entry.eventId ?? null,
        actor_kind: entry.actorKind,
        actor_id: entry.actorId ?? null,
        source_system: entry.sourceSystem,
        evidence: entry.evidence ?? {},
        pattern_key: entry.patternKey ?? null,
        sample_size: entry.sampleSize ?? null,
        confidence: entry.confidence ?? "UNKNOWN",
      }),
    });
    if (!response.ok) return { ok: false, error: (await response.text()).slice(0, 200) };
    const created = ((await response.json()) as Row[])[0];
    return { ok: true, id: String(created?.id ?? ""), threadId: String(created?.thread_id ?? "") };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "failed" };
  }
}

export interface OverridePattern {
  patternKey: string;
  recommendation: string;
  chosenInstead: string;
  occurrences: number;
  reasons: string[];
  /** What this justifies: noticing, not retraining. */
  suggestedAction: string;
}

/**
 * Where a human has repeatedly chosen something other than the recommendation.
 *
 * This identifies a pattern and records it. It does not change any model, and
 * it does not change how recommendations are made — section 36 is explicit
 * that a repeated override is a signal for a later evaluation step, not a
 * trigger for automatic adjustment.
 *
 * A single override is not returned. Two or more of the same swap is.
 */
export async function findOverridePatterns(minimum = 2): Promise<{
  patterns: OverridePattern[];
  degraded: string[];
}> {
  const { memories, degraded } = await loadDecisionMemory(200);
  const overrides = memories.filter((m) => m.overridden && m.aiRecommendation && m.humanDecision);

  const grouped = new Map<string, DecisionMemory[]>();
  for (const memory of overrides) {
    const key = `${memory.aiRecommendation} -> ${memory.humanDecision}`;
    grouped.set(key, [...(grouped.get(key) ?? []), memory]);
  }

  const patterns: OverridePattern[] = [];
  for (const [key, group] of grouped) {
    if (group.length < minimum) continue;
    patterns.push({
      patternKey: key,
      recommendation: group[0]!.aiRecommendation!,
      chosenInstead: group[0]!.humanDecision!,
      occurrences: group.length,
      reasons: group.map((g) => g.overrideReason).filter((r): r is string => Boolean(r)),
      suggestedAction:
        "Recorded as a pattern for review. No model has been changed and no recommendation logic has been adjusted.",
    });
  }

  return { patterns: patterns.sort((a, b) => b.occurrences - a.occurrences), degraded };
}

/**
 * The headline counts the learning screen shows.
 *
 * These are read from founder_learning_totals, which counts in SQL. They are
 * deliberately not derived from the rows loadLearningLog or loadDecisionMemory
 * returned: those are capped pages, and a count taken from a capped page stops
 * being true the moment the register outgrows it.
 */
export interface LearningTotals {
  learningRecords: number;
  patternsRecorded: number;
  decisionsOnRecord: number;
  overridden: number;
  /** Approval requests a person actually answered, approved or rejected. */
  recommendationsAnswered: number;
  /** Of those, the ones approved without swapping the recommended option. */
  recommendationsAccepted: number;
  outcomesRecorded: number;
}

export async function loadLearningTotals(): Promise<{
  totals: LearningTotals | null;
  degraded: string[];
}> {
  try {
    const data = await rows("founder_learning_totals", "select=*&limit=1");
    const row = data[0];
    if (!row) return { totals: null, degraded: ["founder_learning_totals"] };
    return {
      totals: {
        learningRecords: num(row, "learning_records") ?? 0,
        patternsRecorded: num(row, "patterns_recorded") ?? 0,
        decisionsOnRecord: num(row, "decisions_on_record") ?? 0,
        overridden: num(row, "overridden") ?? 0,
        recommendationsAnswered: num(row, "recommendations_answered") ?? 0,
        recommendationsAccepted: num(row, "recommendations_accepted") ?? 0,
        outcomesRecorded: num(row, "outcomes_recorded") ?? 0,
      },
      degraded: [],
    };
  } catch (error) {
    // A failed count is not a zero. The screen is told the figure is unknown.
    console.error("[founder/learning] totals unavailable:", error);
    return { totals: null, degraded: ["founder_learning_totals"] };
  }
}
