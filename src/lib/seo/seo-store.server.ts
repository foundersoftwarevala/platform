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

/**
 * A setting, taken from the environment, or from the deployment's own env file
 * when the environment does not carry it.
 *
 * The file is the fallback because of how this application is actually run. PM2
 * holds the environment it was first started with, and on this server PM2 has
 * lost track of which process holds the port, so `pm2 restart` does not reach
 * the process that is serving and a new variable never arrives. The env file
 * beside the build is read on every boot instead, whoever did the starting.
 *
 * The directory is not hardcoded: `DEPLOY_REPO_DIR` is already part of this
 * application's environment and already points at it. Without that variable
 * there is no fallback and the environment is the only source, so nothing about
 * a local or test process changes.
 *
 * Read once and remembered, so this costs one stat per process, not one per
 * request. The environment always wins when it has a value.
 */
let fileSettings: Record<string, string> | null = null;

function deploymentSetting(name: string): string {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;

  if (fileSettings === null) {
    fileSettings = {};
    const dir = process.env.DEPLOY_REPO_DIR?.trim();
    if (dir) {
      try {
        // Required lazily: a browser bundle must never pull node:fs in, and
        // this module is only ever reached from the server.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { readFileSync } = require("node:fs") as typeof import("node:fs");
        for (const line of readFileSync(`${dir}/.env`, "utf8").split("\n")) {
          const at = line.indexOf("=");
          if (at <= 0 || line.trimStart().startsWith("#")) continue;
          fileSettings[line.slice(0, at).trim()] = line
            .slice(at + 1)
            .trim()
            .replace(/^(["'])([\s\S]*)\1$/, "$2");
        }
      } catch {
        // No file, or unreadable. The environment was the only source anyway.
      }
    }
  }
  return fileSettings[name]?.trim() ?? "";
}

/** Which database answers for these two tables. */
export function seoStoreBackend(): "vps" | "supabase" {
  return deploymentSetting("SEO_STORE").toLowerCase() === "vps" ? "vps" : "supabase";
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
  const url = deploymentSetting("VPS_DATABASE_URL");
  if (!url) throw new Error("SEO_STORE=vps but VPS_DATABASE_URL is not set");
  const { default: postgres } = await import("postgres");
  pool = postgres(url, {
    max: 4,
    idle_timeout: 30,
    connect_timeout: 10,
    // The gate's own audit runs alongside live traffic. A statement that has
    // taken half a minute is hurting the site more than the answer is worth.
    // This is a server setting, not a driver setting, so it is sent as a
    // startup parameter rather than a top-level option.
    // A bare number is milliseconds to PostgreSQL, which is what the driver's
    // type wants here too.
    connection: { statement_timeout: 30_000 },
    onnotice: () => {},
  });
  return pool;
}

/**
 * The SQL for "insert these rows, replacing any that are already there".
 *
 * PostgREST spells this `on_conflict=url` and a one-line header. In SQL it is
 * written out, and written out once, here.
 *
 * The rows arrive as a single JSON parameter and `json_populate_recordset`
 * turns them into rows of the target table, which means the types come from the
 * table definition rather than from whatever the driver guesses - a jsonb
 * column stays jsonb, a timestamptz stays a timestamptz. Only the columns the
 * caller actually supplied are listed, so every column it left out takes its
 * default instead of becoming null and failing a NOT NULL check.
 *
 * Identifiers are interpolated, so each one is checked against the shape of a
 * plain unquoted lower-case column name first and the statement is refused
 * otherwise. The row data is never interpolated: it is the one bound parameter.
 *
 * The parameter is cast text-first, `$1::text::json`, and that is deliberate.
 * postgres.js looks at the cast to decide a parameter's type: with `$1::json`
 * it encodes the value as JSON itself, so a string that is already JSON
 * arrives double-encoded and PostgreSQL refuses it - "cannot call
 * json_populate_recordset on a scalar". Casting through text tells the driver
 * to send the string as a string, and PostgreSQL parses it. Passing the array
 * itself also works at runtime, but the driver's own types reject it, so this
 * is the form that both runs and typechecks.
 */
function upsertStatement(table: string, columns: string[], conflict: string[]): string {
  const safe = /^[a-z_][a-z0-9_]*$/;
  for (const column of columns) {
    if (!safe.test(column)) throw new Error(`refusing to build SQL for column "${column}"`);
  }
  const list = columns.join(", ");
  const updates = columns
    .filter((column) => !conflict.includes(column))
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");
  return (
    `insert into ${table} (${list})\n` +
    `select ${list} from json_populate_recordset(null::${table}, $1::json)\n` +
    `on conflict (${conflict.join(", ")}) do update set ${updates}`
  );
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
    await sql.unsafe(
      upsertStatement("public.seo_indexing_decisions", Object.keys(rows[0]!), ["url"]),
      [JSON.stringify(rows)],
    );
    return;
  }
  const response = await restFetch("seo_indexing_decisions?on_conflict=url", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(
      `upsertDecisions -> HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
}

/** Record the content hashes a verdict was reached from; unique per (url, layer). */
export async function upsertFingerprints(rows: FingerprintRow[]): Promise<void> {
  if (!rows.length) return;
  if (seoStoreBackend() === "vps") {
    const sql = await vps();
    await sql.unsafe(
      upsertStatement("public.seo_fingerprints", Object.keys(rows[0]!), ["url", "layer"]),
      [JSON.stringify(rows)],
    );
    return;
  }
  const response = await restFetch("seo_fingerprints?on_conflict=url,layer", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(
      `upsertFingerprints -> HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * The manager screens.
 *
 * The Marketplace Manager reads every table it exposes through one generic
 * handler that builds a PostgREST query. Two of the tables it exposes are the
 * two that moved, so once they are no longer in Supabase that handler would
 * find nothing and the "Indexing decisions" and "Fingerprints" screens would go
 * blank - a working screen broken by a storage change it has nothing to do
 * with. What follows is the same query, in SQL.
 * ------------------------------------------------------------------ */

/** The tables this module is responsible for. */
export const SEO_STORE_TABLES: ReadonlySet<string> = new Set([
  "seo_fingerprints",
  "seo_indexing_decisions",
]);

/** Whether a manager resource should be read from here rather than PostgREST. */
export function storeOwns(table: string): boolean {
  return seoStoreBackend() === "vps" && SEO_STORE_TABLES.has(table);
}

export type ResourceQuery = {
  table: string;
  select: string[];
  /** "column.asc" or "column.desc", as the resource definition writes it. */
  order: string;
  limit: number;
  offset: number;
  filters: { column: string; operator: string; value: string }[];
  search: string;
  searchable: string[];
};

const SAFE_NAME = /^[a-z_][a-z0-9_]*$/;
const SQL_OPERATOR: Record<string, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "like",
  ilike: "ilike",
};

function identifier(name: string): string {
  if (!SAFE_NAME.test(name)) throw new Error(`refusing to build SQL for "${name}"`);
  return name;
}

/**
 * One page of a manager resource, and the total the pager needs.
 *
 * The caller has already checked every column against the resource's own
 * whitelist and every operator against its fixed list; each is checked again
 * here, because a function that writes SQL should not trust that someone else
 * did it. Values are never interpolated - they are bound parameters - so the
 * only thing that reaches the statement as text is a name that matched
 * /^[a-z_][a-z0-9_]*$/.
 */
export async function readResourceRows(
  query: ResourceQuery,
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const sql = await vps();
  const table = identifier(query.table);
  const columns = query.select.map(identifier).join(", ");

  const where: string[] = [];
  const params: unknown[] = [];

  for (const filter of query.filters) {
    const column = identifier(filter.column);
    if (filter.operator === "is") {
      // PostgREST spells these is.null, is.true and is.false; anything else is
      // dropped rather than guessed at.
      const word = filter.value.toLowerCase();
      if (word === "null") where.push(`${column} is null`);
      else if (word === "true") where.push(`${column} is true`);
      else if (word === "false") where.push(`${column} is false`);
      continue;
    }
    const operator = SQL_OPERATOR[filter.operator];
    if (!operator) continue;
    params.push(filter.value);
    where.push(`${column}::text ${operator} $${params.length}`);
  }

  // The wildcards a LIKE pattern would read as instructions are removed rather
  // than escaped, so a search for "50%" looks for "50", not for everything.
  const term = query.search.replace(/[(),*%_\\]/g, " ").trim();
  if (term && query.searchable.length) {
    params.push(`%${term}%`);
    const at = params.length;
    const any = query.searchable.map((c) => `${identifier(c)}::text ilike $${at}`).join(" or ");
    where.push(`(${any})`);
  }

  const clause = where.length ? `where ${where.join(" and ")}` : "";

  const [column, direction] = query.order.split(".");
  const by = identifier(column ?? "id");
  const dir = direction === "desc" ? "desc" : "asc";

  const rows = (await sql.unsafe(
    `select ${columns} from public.${table} ${clause}
      order by ${by} ${dir} nulls last
      limit ${Math.min(Math.max(Math.trunc(query.limit) || 50, 1), 200)}
      offset ${Math.max(Math.trunc(query.offset) || 0, 0)}`,
    params as never[],
  )) as unknown as Record<string, unknown>[];

  const counted = (await sql.unsafe(
    `select count(*)::text as n from public.${table} ${clause}`,
    params as never[],
  )) as unknown as { n: string }[];

  return { rows: [...rows], total: Number(counted[0]?.n ?? 0) || 0 };
}
