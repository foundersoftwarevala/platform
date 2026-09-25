/**
 * Where the operational SEO scripts read and write the gate's two tables.
 *
 * `seo_indexing_decisions` and `seo_fingerprints` moved off Supabase because
 * together they were a third of a database with a hard 500 MB ceiling, and that
 * ceiling is what stopped PostgREST from loading its schema cache. The server
 * code reaches them through src/lib/seo/seo-store.server.ts; these scripts,
 * which run on the same machine as the application, reach them through here.
 *
 * `SEO_STORE` picks the backend, exactly as it does for the server:
 *
 *   SEO_STORE=supabase   (default) - PostgREST, unchanged
 *   SEO_STORE=vps                  - our PostgreSQL on the loopback interface
 *
 * These scripts only ever run on the server, which is why talking to a database
 * that listens on localhost is possible at all.
 */

let pool = null;

/** Which database answers. */
export function backend() {
  return (process.env.SEO_STORE || "").trim().toLowerCase() === "vps" ? "vps" : "supabase";
}

async function sql() {
  if (pool) return pool;
  const url = (process.env.VPS_DATABASE_URL || "").trim();
  if (!url) throw new Error("SEO_STORE=vps but VPS_DATABASE_URL is not set");
  const { default: postgres } = await import("postgres");
  pool = postgres(url, { max: 2, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  return pool;
}

/** Close the pool so a script that finishes its work actually exits. */
export async function close() {
  if (pool) {
    await pool.end({ timeout: 5 });
    pool = null;
  }
}

function rest(base, key) {
  return { base: (base || "").trim(), head: { apikey: key, Authorization: `Bearer ${key}` } };
}

/**
 * Every row of a PostgREST query, a thousand at a time.
 *
 * Kept byte-for-byte compatible with the helper it replaces so the Supabase
 * path behaves as it always did.
 */
async function readAllRest(path, base, key) {
  const { base: b, head } = rest(base, key);
  const out = [];
  let from = 0;
  for (;;) {
    const res = await fetch(`${b}/rest/v1/${path}`, {
      headers: { ...head, Range: `${from}-${from + 999}` },
    });
    if (!res.ok)
      throw new Error(`${path} -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) return out;
    from += 1000;
  }
}

/** One hash per page for one fingerprint layer, ordered by URL. */
export async function fingerprintsByLayer(layer, base, key) {
  if (backend() === "vps") {
    const db = await sql();
    return await db`select url, hash from public.seo_fingerprints where layer = ${layer} order by url asc`;
  }
  return readAllRest(
    `seo_fingerprints?select=url,hash&layer=eq.${encodeURIComponent(layer)}&order=url.asc`,
    base,
    key,
  );
}

/** Every decision's state, kind and sitemap eligibility, ordered by URL. */
export async function allDecisions(base, key) {
  if (backend() === "vps") {
    const db = await sql();
    return await db`select state, entity_type, sitemap_eligible from public.seo_indexing_decisions order by url asc`;
  }
  return readAllRest(
    "seo_indexing_decisions?select=state,entity_type,sitemap_eligible&order=url.asc",
    base,
    key,
  );
}

/** Every decision in full for the given kinds of page, for the verifier. */
export async function decisionsForKinds(kinds, base, key) {
  if (backend() === "vps") {
    const db = await sql();
    return await db`
      select url, entity_type, state, indexable, sitemap_eligible, blocking_reason
        from public.seo_indexing_decisions
       where entity_type = any(${kinds})
       order by url asc`;
  }
  return readAllRest(
    "seo_indexing_decisions?select=url,entity_type,state,indexable,sitemap_eligible,blocking_reason" +
      `&entity_type=in.(${kinds.join(",")})&order=url.asc`,
    base,
    key,
  );
}

/** Which of these URLs are still passing the gate. */
export async function passingUrls(urls, base, key) {
  if (!urls.length) return new Set();
  if (backend() === "vps") {
    const db = await sql();
    const rows = await db`
      select url from public.seo_indexing_decisions
       where sitemap_eligible = true and url = any(${urls})`;
    return new Set(rows.map((row) => row.url));
  }
  const { base: b, head } = rest(base, key);
  const found = new Set();
  for (let at = 0; at < urls.length; at += 100) {
    const slice = urls.slice(at, at + 100);
    const res = await fetch(
      `${b}/rest/v1/seo_indexing_decisions?select=url&sitemap_eligible=is.true` +
        `&url=in.(${slice.map((u) => `"${u}"`).join(",")})`,
      { headers: head },
    );
    if (!res.ok) throw new Error(`passingUrls -> HTTP ${res.status}`);
    for (const row of await res.json()) found.add(row.url);
  }
  return found;
}

/** Set the same fields on a set of URLs. */
export async function patchDecisions(urls, body, base, key) {
  if (!urls.length) return;
  if (backend() === "vps") {
    const db = await sql();
    await db`update public.seo_indexing_decisions set ${db(body)} where url = any(${urls})`;
    return;
  }
  const { base: b, head } = rest(base, key);
  for (let at = 0; at < urls.length; at += 100) {
    const slice = urls.slice(at, at + 100);
    const res = await fetch(
      `${b}/rest/v1/seo_indexing_decisions?url=in.(${slice.map((u) => `"${u}"`).join(",")})`,
      {
        method: "PATCH",
        headers: { ...head, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok)
      throw new Error(`patchDecisions -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}
