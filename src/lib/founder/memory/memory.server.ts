import type { Confidence } from "../state.types";

/**
 * Long-term memory, as the application reads and writes it.
 *
 * Two rules shape this whole file.
 *
 * Reads of what is true now go through founder_memory_current, never the
 * table. The view excludes superseded and expired rows, so there is no query
 * here that could return a stale statement as though it still held — not
 * because the code is careful, but because the thing it reads cannot contain
 * one.
 *
 * Writes go through founder_memory_record, a single transaction that
 * supersedes the outgoing memory and inserts its replacement together.
 * Doing it as two requests would mean a failure between them leaves a subject
 * with no current memory at all, which turns the one-active-memory guarantee
 * into a way to lose facts.
 */

export type MemoryScope =
  "FOUNDER" | "COMPANY" | "OPERATIONAL" | "CONVERSATION" | "DECISION" | "LEARNING" | "WORKING";

export type MemoryStatus = "ACTIVE" | "SUPERSEDED" | "EXPIRED" | "RETRACTED";

export interface Memory {
  id: string;
  scope: MemoryScope;
  subject: string;
  statement: string;
  detail: string | null;
  sourceSystem: string;
  sourceRef: string | null;
  confidence: Confidence;
  verifiedAt: string | null;
  validFrom: string;
  validUntil: string | null;
  status: MemoryStatus;
  supersededBy: string | null;
  supersedeReason: string | null;
  allowedRoles: string[];
  createdAt: string;
}

export interface MemoryTotals {
  memories: number;
  active: number;
  superseded: number;
  retracted: number;
  working: number;
  unconfirmed90d: number;
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

async function rows(path: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${path}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${path.split("?")[0]}: ${response.status}`);
  return (await response.json()) as Row[];
}

async function rpc(name: string, body: unknown): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: restHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    // The database's own message is the useful one — it names the subject and
    // says what was missing — so it is carried through rather than replaced.
    let message = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // Not JSON; the raw text is what there is.
    }
    throw new Error(message);
  }
  const data = (await response.json()) as Row[] | Row;
  return Array.isArray(data) ? data : [data];
}

function str(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toMemory(row: Row): Memory {
  return {
    id: String(row.id),
    scope: String(row.scope ?? "COMPANY") as MemoryScope,
    subject: str(row, "subject") ?? "",
    statement: str(row, "statement") ?? "",
    detail: str(row, "detail"),
    sourceSystem: str(row, "source_system") ?? "",
    sourceRef: str(row, "source_ref"),
    confidence: (str(row, "confidence") ?? "UNKNOWN") as Confidence,
    verifiedAt: str(row, "verified_at"),
    validFrom: str(row, "valid_from") ?? "",
    validUntil: str(row, "valid_until"),
    status: String(row.status ?? "ACTIVE") as MemoryStatus,
    supersededBy: str(row, "superseded_by"),
    supersedeReason: str(row, "supersede_reason"),
    allowedRoles: Array.isArray(row.allowed_roles) ? row.allowed_roles.map(String) : [],
    createdAt: str(row, "created_at") ?? "",
  };
}

/**
 * The permission filter, applied in the query rather than after it.
 *
 * A reader who may not see a memory does not receive it and cannot tell it
 * exists — the same shape the Company Brain uses, for the same reason.
 */
function permissionClause(roles: string[]): string {
  if (roles.length === 0) return "allowed_roles=eq.{}";
  const list = roles.map((r) => `"${r.replace(/"/g, "")}"`).join(",");
  return `or=(allowed_roles.eq.{},allowed_roles.ov.{${list}})`;
}

export interface MemoryQuery {
  scope?: MemoryScope;
  subject?: string;
  search?: string;
  limit?: number;
}

/** What is true now, for this reader. */
export async function currentMemory(
  roles: string[],
  query: MemoryQuery = {},
): Promise<{ memories: Memory[]; degraded: string[] }> {
  const parts = [
    "select=*",
    permissionClause(roles),
    "order=scope.asc,subject.asc",
    `limit=${Math.min(query.limit ?? 100, 500)}`,
  ];
  if (query.scope) parts.push(`scope=eq.${encodeURIComponent(query.scope)}`);
  if (query.subject) parts.push(`subject=eq.${encodeURIComponent(query.subject)}`);
  if (query.search) {
    const term = query.search.replace(/[*,()]/g, " ").trim();
    if (term) parts.push(`statement=ilike.*${encodeURIComponent(term)}*`);
  }

  try {
    // founder_memory_current, not founder_memory: nothing stale can come back.
    const data = await rows(`founder_memory_current?${parts.join("&")}`);
    return { memories: data.map(toMemory), degraded: [] };
  } catch (error) {
    console.error("[founder/memory] current memory unavailable:", error);
    return { memories: [], degraded: ["founder_memory_current"] };
  }
}

/**
 * Everything ever recorded about one subject, newest first.
 *
 * This is the one read that deliberately includes superseded rows: the point
 * of it is to show how a belief changed and why, which is exactly what the
 * current view hides.
 */
export async function memoryHistory(
  roles: string[],
  scope: MemoryScope,
  subject: string,
): Promise<{ history: Memory[]; degraded: string[] }> {
  const parts = [
    "select=*",
    permissionClause(roles),
    `scope=eq.${encodeURIComponent(scope)}`,
    `subject=eq.${encodeURIComponent(subject)}`,
    "order=created_at.desc",
    "limit=50",
  ];
  try {
    return {
      history: (await rows(`founder_memory?${parts.join("&")}`)).map(toMemory),
      degraded: [],
    };
  } catch (error) {
    console.error("[founder/memory] history unavailable:", error);
    return { history: [], degraded: ["founder_memory"] };
  }
}

/** Active memory nobody has confirmed in ninety days. */
export async function staleMemory(limit = 50): Promise<{
  stale: { id: string; scope: string; subject: string; statement: string }[];
  degraded: string[];
}> {
  try {
    const data = await rows(`founder_memory_stale?select=*&limit=${Math.min(limit, 200)}`);
    return {
      stale: data.map((row) => ({
        id: String(row.id),
        scope: String(row.scope ?? ""),
        subject: str(row, "subject") ?? "",
        statement: str(row, "statement") ?? "",
      })),
      degraded: [],
    };
  } catch (error) {
    console.error("[founder/memory] stale memory unavailable:", error);
    return { stale: [], degraded: ["founder_memory_stale"] };
  }
}

export async function memoryTotals(): Promise<MemoryTotals | null> {
  try {
    const data = await rows("founder_memory_totals?select=*&limit=1");
    const row = data[0];
    if (!row) return null;
    const n = (key: string): number => {
      const value = row[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
      return 0;
    };
    return {
      memories: n("memories"),
      active: n("active"),
      superseded: n("superseded"),
      retracted: n("retracted"),
      working: n("working"),
      unconfirmed90d: n("unconfirmed_90d"),
    };
  } catch (error) {
    // Null rather than zeros: a count that could not be taken is not a count
    // of nothing.
    console.error("[founder/memory] totals unavailable:", error);
    return null;
  }
}

export interface RecordMemory {
  scope: MemoryScope;
  subject: string;
  statement: string;
  sourceSystem: string;
  detail?: string | null;
  sourceRef?: string | null;
  recordedBy?: string | null;
  confidence?: Confidence;
  verifiedAt?: string | null;
  validUntil?: string | null;
  allowedRoles?: string[];
  /** Required when something is already held about this subject. */
  supersedeReason?: string | null;
}

export type RecordResult =
  | { ok: true; memoryId: string; replaced: boolean; supersededId: string | null }
  | { ok: false; reason: string };

/**
 * Record a memory, superseding whatever it replaces.
 *
 * The whole act is one transaction in the database. Where something is
 * already held about the subject and no reason for replacing it was given,
 * this comes back refused rather than overwriting — a caller that did not
 * realise it was contradicting an existing belief should be told so.
 */
export async function recordMemory(input: RecordMemory): Promise<RecordResult> {
  try {
    const data = await rpc("founder_memory_record", {
      p_scope: input.scope,
      p_subject: input.subject,
      p_statement: input.statement,
      p_source_system: input.sourceSystem,
      p_detail: input.detail ?? null,
      p_source_ref: input.sourceRef ?? null,
      p_recorded_by: input.recordedBy ?? null,
      p_confidence: input.confidence ?? "UNKNOWN",
      p_verified_at: input.verifiedAt ?? null,
      p_valid_until: input.validUntil ?? null,
      p_allowed_roles: input.allowedRoles ?? [],
      p_supersede_reason: input.supersedeReason ?? null,
    });
    const row = data[0];
    if (!row) return { ok: false, reason: "the memory was not recorded" };
    return {
      ok: true,
      memoryId: String(row.memory_id),
      replaced: row.replaced === true,
      supersededId: str(row, "superseded_id"),
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Retire a memory without replacing it. */
export async function retractMemory(
  memoryId: string,
  reason: string,
  actor: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const data = await rpc("founder_memory_retract", {
      p_memory_id: memoryId,
      p_reason: reason,
      p_actor: actor,
    });
    const retracted = data[0]?.founder_memory_retract ?? data[0];
    if (retracted === false) {
      return { ok: false, reason: "that memory is not active, so there was nothing to retract" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
