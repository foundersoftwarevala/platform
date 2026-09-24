/**
 * What the sitemap is allowed to contain.
 *
 * Every sitemap on this site reads from here and from nowhere else. A route no
 * longer decides for itself which of its URLs are fit to advertise: it asks
 * for the ones the safety gate passed, and if the gate has never seen a URL,
 * that URL is not in the answer.
 *
 * That last part is the point. The old sitemaps filtered on whatever their
 * author thought mattered - published and visible, occupied, body not null -
 * and each filter was a separate chance to forget something. A page that is
 * live, published, visible and quietly broken passed all of them. Now the
 * absence of a verdict is itself a verdict, and it keeps the page out.
 *
 * Server only: it reads with the service role.
 */

export type SitemapEntry = {
  url: string;
  lastmod: string | null;
};

function base() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/**
 * One page of the URLs the gate passed, for one kind of page.
 *
 * Indexed on (sitemap_eligible, url), so paging through eighteen thousand
 * decisions stays a range scan rather than a sort of the whole table.
 */
export async function eligibleUrls(
  entityType: string,
  offset: number,
  limit: number,
): Promise<SitemapEntry[]> {
  if (!base()) return [];
  const response = await fetch(
    `${base()}/rest/v1/seo_indexing_decisions?select=url,evaluated_at` +
      `&sitemap_eligible=is.true&entity_type=eq.${encodeURIComponent(entityType)}` +
      `&order=url.asc&limit=${limit}&offset=${offset}`,
    { headers: admin() },
  );
  if (!response.ok) {
    // A sitemap that cannot reach the gate serves nothing rather than serving
    // everything. Failing open here would undo the whole point of the gate.
    console.error("[sitemap gate] could not read decisions", response.status);
    return [];
  }
  const rows = (await response.json()) as { url: string; evaluated_at: string | null }[];
  return rows.map((row) => ({
    url: row.url,
    lastmod: row.evaluated_at ? String(row.evaluated_at).slice(0, 10) : null,
  }));
}

/** How many URLs of one kind the gate passed, so a sitemap knows its page count. */
export async function eligibleCount(entityType: string): Promise<number> {
  if (!base()) return 0;
  try {
    const response = await fetch(
      `${base()}/rest/v1/seo_indexing_decisions?select=id&sitemap_eligible=is.true` +
        `&entity_type=eq.${encodeURIComponent(entityType)}&limit=1`,
      { headers: { ...admin(), Prefer: "count=exact" } },
    );
    if (!response.ok) return 0;
    const range = response.headers.get("content-range") ?? "";
    return Number(range.split("/")[1]) || 0;
  } catch {
    return 0;
  }
}

/**
 * Whether one URL may be indexed, and why not when it may not.
 *
 * This is the question a page asks at render time if it ever needs to. It is
 * deliberately a single indexed lookup: no audit runs while a visitor waits.
 */
export async function canIndexPage(
  url: string,
): Promise<{ indexable: boolean; state: string; reason: string | null }> {
  if (!base()) return { indexable: false, state: "UNVERIFIED", reason: "No database configured." };
  try {
    const response = await fetch(
      `${base()}/rest/v1/seo_indexing_decisions?select=state,indexable,blocking_reason` +
        `&url=eq.${encodeURIComponent(url)}&limit=1`,
      { headers: admin() },
    );
    if (!response.ok) {
      return { indexable: false, state: "UNVERIFIED", reason: "The gate could not be read." };
    }
    const rows = (await response.json()) as {
      state: string;
      indexable: boolean;
      blocking_reason: string | null;
    }[];
    const row = rows[0];
    if (!row) {
      return {
        indexable: false,
        state: "UNVERIFIED",
        reason: "The gate has never evaluated this URL.",
      };
    }
    return { indexable: row.indexable === true, state: row.state, reason: row.blocking_reason };
  } catch (error) {
    console.error("[sitemap gate] canIndexPage failed", url, error);
    return { indexable: false, state: "ERROR", reason: "The gate could not be reached." };
  }
}
