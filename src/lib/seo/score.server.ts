import { scorePage, type PageEvidence, type PageScore } from "./page-score";

/**
 * Score real pages from the evidence the platform already holds.
 *
 * Two tables know things about a page: `seo_pages` is what the crawler saw,
 * and `seo_indexing_decisions` is what the gate decided. Neither alone is
 * enough - the crawler knows the title and the word count, the gate knows
 * whether the page is allowed in and whether it is advertised - so this joins
 * them by URL and judges what it finds.
 *
 * It works in batches and reports how far it got, because there are 1,905
 * crawled pages and 14,819 gate verdicts today and both grow. A scoring pass
 * that had to hold the whole catalogue in memory would stop working at exactly
 * the point the catalogue became worth scoring.
 *
 * A page with no evidence is not scored. It is left alone rather than written
 * with a zero, because a zero would be read as a bad page rather than an
 * unexamined one.
 */

export type ScoreRunResult = {
  considered: number;
  scored: number;
  skipped_no_evidence: number;
  failed_writes: number;
  /** The worst pages this pass found, for a report to lead with. */
  worst: { url: string; score: number; issues: number }[];
  bands: Record<string, number>;
  next_offset: number | null;
};

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

async function rest(path: string, init?: RequestInit) {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Strip the origin so a crawled URL and a gate URL can be compared. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url.split("?")[0].replace(/\/+$/, "") || "/";
  }
}

type CrawlRow = {
  id: string;
  url: string;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  canonical_url: string | null;
  word_count: number | null;
  index_status: string | null;
  schema_json: unknown;
};

type GateRow = {
  url: string;
  state: string | null;
  indexable: boolean | null;
  sitemap_eligible: boolean | null;
  canonical_status: string | null;
  schema_status: string | null;
  hreflang_status: string | null;
  content_status: string | null;
  http_status: number | null;
  blocking_reason: string | null;
  fingerprint_class: string | null;
};

/**
 * Score one batch of crawled pages and write the result back.
 *
 * Returns where to carry on from, so a caller can walk the whole table without
 * ever asking for all of it at once.
 */
export async function scoreCrawledPages(options: {
  limit?: number;
  offset?: number;
}): Promise<ScoreRunResult> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 1000);
  const offset = Math.max(options.offset ?? 0, 0);

  const result: ScoreRunResult = {
    considered: 0,
    scored: 0,
    skipped_no_evidence: 0,
    failed_writes: 0,
    worst: [],
    bands: {},
    next_offset: null,
  };

  const crawlResponse = await rest(
    "seo_pages?select=id,url,title,meta_description,h1,canonical_url,word_count," +
      `index_status,schema_json&order=url.asc&limit=${limit}&offset=${offset}`,
  );
  if (!crawlResponse.ok) {
    throw new Error(`seo_pages could not be read: HTTP ${crawlResponse.status}`);
  }
  const crawled = (await crawlResponse.json()) as CrawlRow[];
  result.considered = crawled.length;
  if (crawled.length === 0) return result;

  // The gate's verdicts for exactly these URLs, asked for in one request
  // rather than one per page.
  const paths = [...new Set(crawled.map((row) => pathOf(row.url)))];
  const gateByPath = new Map<string, GateRow>();
  const BATCH = 100;
  for (let at = 0; at < paths.length; at += BATCH) {
    const slice = paths.slice(at, at + BATCH);
    const list = slice.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(",");
    const gateResponse = await rest(
      "seo_indexing_decisions?select=url,state,indexable,sitemap_eligible,canonical_status," +
        "schema_status,hreflang_status,content_status,http_status,blocking_reason," +
        `fingerprint_class&url=in.(${encodeURIComponent(list)})`,
    );
    if (!gateResponse.ok) continue;
    for (const row of (await gateResponse.json()) as GateRow[]) {
      gateByPath.set(pathOf(row.url), row);
    }
  }

  const scored: { row: CrawlRow; score: PageScore }[] = [];
  for (const row of crawled) {
    const gate = gateByPath.get(pathOf(row.url)) ?? null;
    const evidence: PageEvidence = {
      url: row.url,
      crawl: {
        title: row.title,
        meta_description: row.meta_description,
        h1: row.h1,
        canonical_url: row.canonical_url,
        word_count: row.word_count,
        index_status: row.index_status,
        schema_json: row.schema_json,
        http_status: gate?.http_status ?? null,
      },
      gate,
      // Sitemap membership is what the gate already decided; asking the live
      // sitemaps per page would be thousands of requests to learn what is
      // already recorded.
      advertised: gate?.sitemap_eligible ?? null,
    };

    const score = scorePage(evidence);
    if (score.score === null) {
      result.skipped_no_evidence += 1;
      continue;
    }
    scored.push({ row, score });
  }

  // Written one page at a time: PostgREST has no multi-row update by primary
  // key, and a failed write on one page must not lose the rest of the pass.
  for (const { row, score } of scored) {
    const response = await rest(`seo_pages?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        seo_score: score.score,
        score_components: score.components,
        score_issues: score.issues,
        scored_at: score.scored_at,
        score_source: score.source,
        issues_count: score.issues.length,
      }),
    });
    if (response.ok) result.scored += 1;
    else result.failed_writes += 1;
  }

  for (const { score } of scored) {
    const band =
      score.score! < 50
        ? "critical"
        : score.score! < 70
          ? "warning"
          : score.score! < 85
            ? "fair"
            : "healthy";
    result.bands[band] = (result.bands[band] ?? 0) + 1;
  }

  result.worst = scored
    .slice()
    .sort((a, b) => a.score.score! - b.score.score!)
    .slice(0, 10)
    .map(({ row, score }) => ({
      url: row.url,
      score: score.score!,
      issues: score.issues.length,
    }));

  result.next_offset = crawled.length === limit ? offset + limit : null;
  return result;
}
