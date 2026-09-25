/**
 * Where the SEO gate's own two tables live.
 *
 * `seo_indexing_decisions` and `seo_fingerprints` are the gate's working notes:
 * one verdict per URL, and the content hashes that verdict was reached from.
 * Together they are a third of the Supabase database, and that database has a
 * hard 500 MB ceiling which it reached - at which point PostgREST stopped being
 * able to load its schema cache and every table read on the site began
 * answering 503. Neither table is reachable from the browser, neither has a
 * foreign key in or out, and the only trigger on either is the shared
 * `updated_at` stamp, so they can sit on our own PostgreSQL without touching
 * the RLS architecture that the other five hundred tables depend on.
 *
 * This module is the one seam. Everything that reads or writes those two tables
 * goes through here, and `SEO_STORE` decides which database answers:
 *
 *   SEO_STORE=supabase   (default) - unchanged behaviour, PostgREST as before
 *   SEO_STORE=vps                  - our PostgreSQL over the loopback interface
 *
 * The default is deliberate. Nothing moves until the variable is set, and
 * setting it back is the whole rollback - no deploy, no code change.
 *
 * Server only. The VPS database listens on localhost and is never reachable
 * from a browser; the connection string is read from the environment and is
 * never bundled.
 */
import type { Sql } from "postgres";

export type DecisionRow = Record<string, unknown>;
export type FingerprintRow = Record<string, unknown>;

export type SitemapRow = { url: string; evaluated_at: string | null };
export type IndexVerdict = { state: string; indexable: boolean; blocking_reason: string | null };
export type StateRow = { state: string; indexable: boolean; sitemap_eligible: boolean };

/** Which database answers for these two tables. */
export function seoStoreBackend(): "vps" | "supabase" {
  return process.env.SEO_STORE?.trim().toLowerCase() === "vps" ? "vps" : "supabase";
}

/* ------------------------------------------------------------------ *
 * Supabase (PostgREST) - the existing path, unchanged in behaviour.
 * ------------------------------------------------------------------ */

function supabaseBase(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function serviceHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function restFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${supabaseBase()}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
}

/* ------------------------------------------------------------------ *
 * Our PostgreSQL.
 * ------------------------------------------------------------------ */

let pool: Sql | null = null;

/**
 * One lazily-built connection pool for the process.
 *
 * Built on first use rather than at import time, so a server that never touches
 * the gate - which is every request that is not a sitemap - never opens a
 * connection, and so importing this module cannot fail a boot that has no VPS
 * database configured.
 */
async function vps(): Promise<Sql> {
  if (pool) return pool;
  const url = process.env.VPS_DATABASE_URL?.trim();
  if (!url) throw new Error("SEO_STORE=vps but VPS_DATABASE_URL is not set");
  const { default: postgres } = await import("postgres");
  pool = postgres(url, {
    max: 4,
    idle_timeout: 30,
    connect_timeout: 10,
    // The gate's own audit runs alongside live traffic. A statement that has
    // taken half a minute is a statement that is hurting the site more than the
    // answer is worth.
    statement_timeout: 30_000,
    onnotice: () => {},
  });
  return pool;
}

/* ------------------------------------------------------------------ *
 * The operations. Each one fails closed: on any error the caller is told
 * "no" rather than "yes", because this gate decides what search engines
 * are invited to crawl.
 * ------------------------------------------------------------------ */

/** One page of the URLs the gate passed, for one kind of page. */
export async function eligibleUrlRows(
  entityType: string,
  offset: number,
  limit: number,
): Promise<SitemapRow[]> {
  if (seoStoreBackend() === "vps") {
    const sql = await vps();
    const rows = await sql<SitemapRow[]>`
      select url, evaluated_at
        from public.seo_indexing_decisions
       where sitemap_eligible = true
         and entity_type = ${entityType}
       order by url asc
       limit ${limit} offset ${offset}`;
    return rows.map((row) => ({
      url: row.url,
      evaluated_at: row.evaluated_at ? new Date(row.evaluated_at).toISOString() : null,
    }));
  }
  if (!supabaseBase()) return [];
  const response = await restFetch(
    `seo_indexing_decisions?select=url,evaluated_at&sitemap_eligible=is.true` +
      `&entity_type=eq.${encodeURIComponent(entityType)}&order=url.asc&limit=${limit}&offset=${offset}`,
  );
  if (!response.ok) {
    console.error("[seo store] could not read decisions", response.status);
    return [];
  }
  return (await response.json()) as SitemapRow[];
}

/** How many URLs of one kind the gate passed. */
export async function eligibleRowCount(entityType: string): Promise<number> {
  try {
    if (seoStoreBackend() === "vps") {
      const sql = await vps();
      const rows = await sql<{ n: string }[]>`
        select count(*)::text as n
          from public.seo_indexing_decisions
         where sitemap_eligible = true
           and entity_type = ${entityType}`;
      return Number(rows[0]?.n ?? 0) || 0;
    }
    if (!supabaseBase()) return 0;
    const response = await restFetch(
      `seo_indexing_decisions?select=id&sitemap_eligible=is.true` +
        `&entity_type=eq.${encodeURIComponent(entityType)}&limit=1`,
      { headers: { Prefer: "count=exact" } },
    );
    if (!response.ok) return 0;
    const range = response.headers.get("content-range") ?? "";
    return Number(range.split("/")[1]) || 0;
  } catch (error) {
    console.error("[seo store] eligibleRowCount failed", entityType, error);
    return 0;
  }
}

/** The gate's verdict on one URL, or null when it has never seen it. */
export async function decisionForUrl(url: string): Promise<IndexVerdict | null> {
  if (seoStoreBackend() === "vps") {
    const sql = await vps();
    const rows = await sql<IndexVerdict[]>`
      select state, indexable, blocking_reason
        from public.seo_indexing_decisions
       where url = ${url}
       limit 1`;
    return rows[0] ?? null;
  }
  if (!supabaseBase()) return null;
  const response = await restFetch(
    `seo_indexing_decisions?select=state,indexable,blocking_reason` +
      `&url=eq.${encodeURIComponent(url)}&limit=1`,
  );
  if (!response.ok) throw new Error(`decisionForUrl -> HTTP ${response.status}`);
  const rows = (await response.json()) as IndexVerdict[];
  return rows[0] ?? null;
}

/** Every decision's state, for the summary the gate's own screen shows. */
export async function allDecisionStates(limit = 20000): Promise<StateRow[]> {
  if (seoStoreBackend() === "vps") {
    const sql = await vps();
    return await sql<StateRow[]>`
      select state, indexable, sitemap_eligible
        from public.seo_indexing_decisions
       limit ${limit}`;
  }
  const response = await restFetch(
    `seo_indexing_decisions?select=state,indexable,sitemap_eligible&limit=${limit}`,
  );
  if (!response.ok) throw new Error(`allDecisionStates -> HTTP ${response.status}`);
  return (await response.json()) as StateRow[];
}

/**
 * Record a slice of verdicts, one row per URL.
 *
 * `url` is unique, so a re-run replaces a page's verdict rather than adding a
 * second one. On PostgREST that is `on_conflict`; here it is the same thing
 * spelled in SQL, built column-by-column from the rows actually supplied so a
 * new column in the gate does not need a change in two places.
 */
export async function upsertDecisions(rows: DecisionRow[]): Promise<void> {
  if (!rows.length) return;
  if (seoStoreBackend() === "vps") {
    const sql = await vps();
    const columns = Object.keys(rows[0]!);
    await sql`
      insert into public.seo_indexing_decisions ${sql(rows, ...columns)}
      on conflict (url) do update set ${sql(
        columns
          .filter((c) => c !== "url")
          .reduce<Record<string, unknown>>((acc, c) => ({ ...acc, [c]: sql`excluded.${sql(c)}` }), {}),
      )}`;
    return;
  }
  const response = await restFetch("seo_indexing_decisions?on_conflict=url", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(`upsertDecisions -> HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
}

/** Record the content hashes a verdict was reached from; unique per (url, layer). */
export async function upsertFingerprints(rows: FingerprintRow[]): Promise<void> {
  if (!rows.length) return;
  if (seoStoreBackend() === "vps") {
    const sql = await vps();
    const columns = Object.keys(rows[0]!);
    await sql`
      insert into public.seo_fingerprints ${sql(rows, ...columns)}
      on conflict (url, layer) do update set ${sql(
        columns
          .filter((c) => c !== "url" && c !== "layer")
          .reduce<Record<string, unknown>>((acc, c) => ({ ...acc, [c]: sql`excluded.${sql(c)}` }), {}),
      )}`;
    return;
  }
  const response = await restFetch("seo_fingerprints?on_conflict=url,layer", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(`upsertFingerprints -> HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
}
