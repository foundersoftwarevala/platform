import { createHash } from "node:crypto";

import { freshnessOf, type Confidence, type Freshness } from "../state.types";

/**
 * The Company Brain: what the company knows about itself.
 *
 * Retrieval is permission-aware at the query, not in the component. An item
 * names the roles allowed to read it and the filter is applied in the request
 * to the database, so an unauthorised reader receives nothing rather than a
 * hidden card they could find in a network tab.
 *
 * Search is Postgres full-text over a generated tsvector. There is no pgvector
 * on this database and the brief rules out new infrastructure, so retrieval is
 * lexical — and says so, rather than being described as semantic and quietly
 * missing a paraphrase.
 *
 * Every item carries what kind of claim it is making. A model-produced item
 * cannot be filed as a fact about the company; the table refuses it. That is
 * the difference between a knowledge base and a pile of plausible sentences.
 */

export type KnowledgeKind =
  | "GOAL"
  | "OBJECTIVE"
  | "KPI_DEFINITION"
  | "PRIORITY"
  | "POLICY"
  | "SOP"
  | "BUSINESS_RULE"
  | "DECISION"
  | "INITIATIVE"
  | "PROCESS"
  | "RISK"
  | "DEPENDENCY"
  | "STRATEGY"
  | "ORG_CONTEXT"
  | "OPERATIONAL_STATE";

export type ClaimKind =
  "CURRENT_FACT" | "HISTORICAL_FACT" | "HUMAN_DECISION" | "AI_INFERENCE" | "AI_RECOMMENDATION";

export interface KnowledgeItem {
  id: string;
  kind: KnowledgeKind;
  claim: ClaimKind;
  title: string;
  body: string;
  summary: string | null;
  domain: string | null;
  sourceSystem: string;
  sourceTable: string | null;
  sourceRecord: string | null;
  sourceUrl: string | null;
  ownerName: string | null;
  status: string;
  allowedRoles: string[];
  effectiveFrom: string;
  reviewDue: string | null;
  supersededBy: string | null;
  confidence: Confidence;
  producedByAi: boolean;
  /** Derived at read time from reviewDue, never stored. */
  freshness: Freshness;
  /** True when the review date has passed and nobody has confirmed it. */
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeLink {
  id: string;
  relation: string;
  targetTable: string;
  targetId: string;
  note: string | null;
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
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  return (await response.json()) as Row[];
}

function str(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function arr(row: Row, key: string): string[] {
  return Array.isArray(row[key]) ? (row[key] as unknown[]).map(String) : [];
}

/**
 * The permission clause for a reader.
 *
 * An item with no roles listed is readable by anyone who can reach the Company
 * Brain at all; one with roles listed is readable only by those roles. The
 * filter goes into the query so the rows never leave the database.
 */
function permissionClause(roles: string[]): string {
  if (roles.length === 0) {
    // No roles means only items that name no restriction.
    return "allowed_roles=eq.{}";
  }
  const list = roles.map((r) => `"${r.replace(/"/g, "")}"`).join(",");
  return `or=(allowed_roles.eq.{},allowed_roles.ov.{${list}})`;
}

function toItem(row: Row): KnowledgeItem {
  const reviewDue = str(row, "review_due");
  const status = str(row, "status") ?? "active";
  // Stale means the review date has passed while the item is still presented
  // as current. A superseded or archived item is not stale, it is finished.
  const stale =
    status === "active" && Boolean(reviewDue) && new Date(reviewDue!).getTime() < Date.now();

  return {
    id: String(row.id),
    kind: (str(row, "kind") ?? "ORG_CONTEXT") as KnowledgeKind,
    claim: (str(row, "claim") ?? "CURRENT_FACT") as ClaimKind,
    title: str(row, "title") ?? "",
    body: str(row, "body") ?? "",
    summary: str(row, "summary"),
    domain: str(row, "domain"),
    sourceSystem: str(row, "source_system") ?? "",
    sourceTable: str(row, "source_table"),
    sourceRecord: str(row, "source_record"),
    sourceUrl: str(row, "source_url"),
    ownerName: str(row, "owner_name"),
    status,
    allowedRoles: arr(row, "allowed_roles"),
    effectiveFrom: str(row, "effective_from") ?? "",
    reviewDue,
    supersededBy: str(row, "superseded_by"),
    confidence: (str(row, "confidence") ?? "UNKNOWN") as Confidence,
    producedByAi: row.produced_by_ai === true,
    freshness: reviewDue
      ? stale
        ? "STALE"
        : freshnessOf(str(row, "updated_at"), 24 * 90)
      : "UNKNOWN",
    stale,
    createdAt: str(row, "created_at") ?? "",
    updatedAt: str(row, "updated_at") ?? "",
  };
}

export interface KnowledgeQuery {
  /** Free text. Matched with Postgres full-text search, not semantically. */
  search?: string;
  kind?: KnowledgeKind;
  status?: string;
  domain?: string;
  source?: string;
  /** Only items whose review date has passed. */
  staleOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface KnowledgeResult {
  items: KnowledgeItem[];
  total: number;
  /** Named so the UI can say what kind of search this was. */
  retrieval: "FULL_TEXT" | "FILTER_ONLY";
  degraded: string[];
}

/** Browse or search the Company Brain as a particular reader. */
export async function searchKnowledge(
  roles: string[],
  query: KnowledgeQuery = {},
): Promise<KnowledgeResult> {
  const degraded: string[] = [];
  const limit = Math.min(query.limit ?? 50, 200);
  const parts = [`select=*`, `limit=${limit}`, permissionClause(roles)];

  if (query.offset && query.offset > 0) parts.push(`offset=${query.offset}`);
  if (query.kind) parts.push(`kind=eq.${query.kind}`);
  if (query.domain) parts.push(`domain=eq.${encodeURIComponent(query.domain)}`);
  if (query.source) parts.push(`source_system=eq.${encodeURIComponent(query.source)}`);
  parts.push(query.status ? `status=eq.${query.status}` : `status=neq.archived`);
  if (query.staleOnly) parts.push(`review_due=lt.${new Date().toISOString()}`);

  const text = query.search?.trim();
  if (text) {
    // websearch_to_tsquery copes with what a person actually types — quoted
    // phrases, "or", a stray minus — instead of erroring on it.
    parts.push(`search_text=wfts(english).${encodeURIComponent(text)}`);
    parts.push("order=updated_at.desc");
  } else {
    parts.push("order=updated_at.desc");
  }

  try {
    const base = restUrl();
    const response = await fetch(`${base}/rest/v1/founder_knowledge?${parts.join("&")}`, {
      headers: restHeaders({ Prefer: "count=exact" }),
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    const data = (await response.json()) as Row[];
    const range = response.headers.get("content-range") ?? "";
    const total = Number(range.slice(range.indexOf("/") + 1));

    return {
      items: data.map(toItem),
      total: Number.isFinite(total) ? total : data.length,
      retrieval: text ? "FULL_TEXT" : "FILTER_ONLY",
      degraded,
    };
  } catch (error) {
    console.error("[founder/brain] knowledge search failed:", error);
    degraded.push("founder_knowledge");
    return { items: [], total: 0, retrieval: text ? "FULL_TEXT" : "FILTER_ONLY", degraded };
  }
}

export interface KnowledgeDetail {
  item: KnowledgeItem;
  links: KnowledgeLink[];
  history: Array<{ changedAt: string; reason: string | null }>;
  /** Items superseded by this one, so the chain is readable both ways. */
  supersedes: Array<{ id: string; title: string }>;
}

/**
 * One item, if this reader is allowed it.
 *
 * Returns null for both "does not exist" and "not permitted" on purpose:
 * distinguishing them tells an unauthorised caller that the item is there.
 */
export async function loadKnowledge(roles: string[], id: string): Promise<KnowledgeDetail | null> {
  try {
    const found = await rows(
      "founder_knowledge",
      `select=*&id=eq.${encodeURIComponent(id)}&limit=1&${permissionClause(roles)}`,
    );
    if (!found[0]) return null;

    const [links, history, supersedes] = await Promise.all([
      rows("founder_knowledge_links", `select=*&knowledge_id=eq.${id}&limit=100`).catch(() => []),
      rows(
        "founder_knowledge_history",
        `select=changed_at,reason&knowledge_id=eq.${id}&order=changed_at.desc&limit=50`,
      ).catch(() => []),
      rows(
        "founder_knowledge",
        `select=id,title&superseded_by=eq.${id}&limit=20&${permissionClause(roles)}`,
      ).catch(() => []),
    ]);

    return {
      item: toItem(found[0]),
      links: links.map((l) => ({
        id: String(l.id),
        relation: str(l, "relation") ?? "",
        targetTable: str(l, "target_table") ?? "",
        targetId: str(l, "target_id") ?? "",
        note: str(l, "note"),
      })),
      history: history.map((h) => ({
        changedAt: str(h, "changed_at") ?? "",
        reason: str(h, "reason"),
      })),
      supersedes: supersedes.map((s) => ({ id: String(s.id), title: str(s, "title") ?? "" })),
    };
  } catch (error) {
    console.error("[founder/brain] knowledge load failed:", error);
    return null;
  }
}

export interface IngestInput {
  kind: KnowledgeKind;
  claim: ClaimKind;
  title: string;
  body: string;
  summary?: string | null;
  domain?: string | null;
  sourceSystem: string;
  sourceTable?: string | null;
  sourceRecord?: string | null;
  sourceUrl?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  allowedRoles?: string[];
  reviewDue?: string | null;
  confidence?: Confidence;
  producedByAi?: boolean;
  createdBy?: string | null;
  links?: Array<{ relation: string; targetTable: string; targetId: string; note?: string }>;
}

export type IngestResult =
  { ok: true; id: string; duplicate: boolean } | { ok: false; reason: string; stage: string };

/**
 * Take a piece of knowledge in.
 *
 * Validation first, because the failures worth catching are the boring ones:
 * an empty body, a claim an AI is not allowed to make, a title with nothing in
 * it. Then a content hash, so the same record ingested twice is one item
 * rather than two that will both be returned by the next search.
 *
 * The item is only reported as ingested once it is readable back, which is the
 * difference between "stored" and "indexed" — section 4 asks for exactly that.
 */
export async function ingestKnowledge(input: IngestInput): Promise<IngestResult> {
  const title = input.title?.trim() ?? "";
  const body = input.body?.trim() ?? "";

  if (!title) return { ok: false, reason: "A knowledge item needs a title.", stage: "VALIDATE" };
  if (!body) return { ok: false, reason: "A knowledge item needs a body.", stage: "VALIDATE" };
  if (!input.sourceSystem?.trim()) {
    return { ok: false, reason: "A knowledge item needs a named source.", stage: "VALIDATE" };
  }
  if (input.producedByAi && input.claim !== "AI_INFERENCE" && input.claim !== "AI_RECOMMENDATION") {
    return {
      ok: false,
      reason: "Something produced by a model cannot be filed as a fact about the company.",
      stage: "CLASSIFY",
    };
  }

  const hash = createHash("sha256")
    .update(`${input.sourceTable ?? ""}|${input.sourceRecord ?? ""}|${title}|${body}`)
    .digest("hex")
    .slice(0, 32);

  const base = restUrl();
  if (!base) return { ok: false, reason: "The database is not configured.", stage: "STORE" };

  let id: string;
  try {
    const response = await fetch(`${base}/rest/v1/founder_knowledge`, {
      method: "POST",
      headers: restHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify({
        kind: input.kind,
        claim: input.claim,
        title,
        body,
        summary: input.summary ?? null,
        domain: input.domain ?? null,
        source_system: input.sourceSystem.trim(),
        source_table: input.sourceTable ?? null,
        source_record: input.sourceRecord ?? null,
        source_url: input.sourceUrl ?? null,
        owner_id: input.ownerId ?? null,
        owner_name: input.ownerName ?? null,
        allowed_roles: input.allowedRoles ?? [],
        review_due: input.reviewDue ?? null,
        confidence: input.confidence ?? "MEASURED",
        produced_by_ai: input.producedByAi ?? false,
        content_hash: hash,
        created_by: input.createdBy ?? null,
      }),
    });

    if (response.status === 409) {
      const existing = await rows(
        "founder_knowledge",
        `select=id&source_system=eq.${encodeURIComponent(input.sourceSystem.trim())}` +
          `&content_hash=eq.${hash}&limit=1`,
      );
      return { ok: true, id: String(existing[0]?.id ?? ""), duplicate: true };
    }
    if (!response.ok) {
      return {
        ok: false,
        reason: (await response.text()).slice(0, 200),
        stage: "STORE",
      };
    }
    id = String(((await response.json()) as Row[])[0]?.id ?? "");
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message.slice(0, 200) : "the item was not stored",
      stage: "STORE",
    };
  }

  if (input.links && input.links.length > 0) {
    try {
      await fetch(`${base}/rest/v1/founder_knowledge_links`, {
        method: "POST",
        headers: restHeaders(),
        body: JSON.stringify(
          input.links.map((l) => ({
            knowledge_id: id,
            relation: l.relation,
            target_table: l.targetTable,
            target_id: l.targetId,
            note: l.note ?? null,
          })),
        ),
      });
    } catch (error) {
      console.error("[founder/brain] links not stored:", error);
    }
  }

  // Confirm it can actually be read back before calling it indexed.
  try {
    const back = await rows("founder_knowledge", `select=id&id=eq.${id}&limit=1`);
    if (!back[0]) {
      return {
        ok: false,
        reason: "The item was stored but could not be read back.",
        stage: "VERIFY",
      };
    }
  } catch {
    return { ok: false, reason: "The item could not be verified after storing.", stage: "VERIFY" };
  }

  return { ok: true, id, duplicate: false };
}

/**
 * Retire an item without losing it.
 *
 * Superseding points at what replaced it; archiving takes it out of retrieval.
 * Neither deletes anything, and the previous version is kept by the table's
 * own trigger.
 */
export async function archiveKnowledge(
  id: string,
  actorId: string,
  reason: string,
  supersededBy?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!reason.trim()) return { ok: false, error: "Retiring a knowledge item needs a reason." };

  const base = restUrl();
  if (!base) return { ok: false, error: "The database is not configured." };

  try {
    const response = await fetch(
      `${base}/rest/v1/founder_knowledge?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: restHeaders(),
        body: JSON.stringify(
          supersededBy
            ? { status: "superseded", superseded_by: supersededBy }
            : { status: "archived" },
        ),
      },
    );
    if (!response.ok) return { ok: false, error: (await response.text()).slice(0, 200) };

    await fetch(`${base}/rest/v1/founder_knowledge_history`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({
        knowledge_id: id,
        changed_by: actorId,
        previous: {},
        reason: reason.trim(),
      }),
    }).catch(() => {});

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "failed" };
  }
}

/** Items whose review date has passed, so the Knowledge Center can flag them. */
export async function staleKnowledge(roles: string[], limit = 50): Promise<KnowledgeItem[]> {
  const result = await searchKnowledge(roles, { staleOnly: true, limit, status: "active" });
  return result.items;
}
