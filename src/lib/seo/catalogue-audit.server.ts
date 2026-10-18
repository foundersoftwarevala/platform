/**
 * The catalogue audit — one implementation, two callers.
 *
 * This is the audit that `POST /api/internal/seo-audit` has been running: it
 * scans the real marketplace catalogue, finds the real problems, weights them
 * by severity and writes the result into `seo_audits` and `seo_issues`, which
 * are the tables the SEO Manager already reads.
 *
 * It was moved out of that route because there was a second, dishonest audit
 * beside it. `runSiteAudit` in seo.functions.ts — the server function the SEO
 * Manager's own hooks call — wrote a row with `score` hardcoded to 94,
 * `pages_crawled: 0`, `issues_found: 0` and a breakdown of seven invented
 * percentages. Every run of it put a fabricated grade into the same table the
 * real audit writes to, and no screen could tell the two apart.
 *
 * So rather than leave two audits and hope the right one is called, both
 * callers now run this one. Nothing here invents a number: every count is a
 * count of rows, and where an external source would be needed — impressions,
 * clicks, average position, search volume — it reports why the figure is
 * unavailable instead of guessing at it.
 */
const PAGE = 1000;

function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: { ...admin(), ...(init.headers as Record<string, string> | undefined) },
  });
}

/** Read a whole table in pages, so a 12,000 product catalogue does not need one huge query. */
async function readAll<T>(table: string, select: string, filter = ""): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < 60_000; offset += PAGE) {
    const response = await rest(
      `${table}?select=${select}${filter}&limit=${PAGE}&offset=${offset}&order=id`,
    );
    // A failed page is a failed audit. Stopping quietly here recorded a
    // "completed" audit over part of the catalogue - or none of it - with a
    // score computed from whatever had been read.
    if (!response.ok) {
      throw new CatalogueAuditError(`Could not read ${table}`, 502, `HTTP ${response.status} at offset ${offset}`);
    }
    const rows = (await response.json()) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

type Product = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  category_id: string | null;
  visible: boolean | null;
  content_status: string | null;
  moderation_status: string | null;
  demo_url: string | null;
  thumbnail_url: string | null;
  search_keywords: string[] | null;
  seller_id: string | null;
};

type Issue = {
  issue_type: string;
  category: string;
  severity: string;
  page_url: string;
  description: string;
  fix_suggestion: string;
};

export type CatalogueAudit = {
  ok: true;
  score: number;
  pagesCrawled: number;
  issuesFound: number;
  issuesRecorded: number;
  breakdown: Record<string, unknown>;
};

/** Carries a status and a detail, so a caller can answer with both. */
export class CatalogueAuditError extends Error {
  readonly status: number;
  readonly detail: string;
  constructor(message: string, status: number, detail = "") {
    super(message);
    this.name = "CatalogueAuditError";
    this.status = status;
    this.detail = detail;
  }
}

const norm = (v: string | null | undefined): string => (v ?? "").trim().toLowerCase();

export async function runCatalogueAudit(): Promise<CatalogueAudit> {
  if (!supabaseUrl()) {
    throw new CatalogueAuditError("The database gateway is not configured", 503);
  }

  const startedAt = new Date().toISOString();

  const products = await readAll<Product>(
    "marketplace_products",
    "id,name,slug,description,category_id,visible,content_status,moderation_status," +
      "demo_url,thumbnail_url,search_keywords,seller_id",
  );
  const seoPages = await readAll<{
    url: string;
    meta_title: string | null;
    canonical_url: string | null;
    product_id: string | null;
  }>("seo_pages", "url,meta_title,canonical_url,product_id");
  const categories = await readAll<{ id: string; slug: string | null; name: string | null }>(
    "marketplace_categories",
    "id,slug,name",
  );

  const indexable = products.filter(
    (p) => p.visible === true && norm(p.content_status) === "published",
  );

  // ---- duplicate detection, over the real catalogue -------------------
  const bySlug = new Map<string, Product[]>();
  const byTitle = new Map<string, Product[]>();
  const byDescription = new Map<string, Product[]>();
  for (const p of indexable) {
    const s = norm(p.slug);
    const t = norm(p.name);
    const d = norm(p.description);
    if (s) bySlug.set(s, [...(bySlug.get(s) ?? []), p]);
    if (t) byTitle.set(t, [...(byTitle.get(t) ?? []), p]);
    if (d) byDescription.set(d, [...(byDescription.get(d) ?? []), p]);
  }

  const issues: Issue[] = [];
  const url = (p: Product) => `/marketplace/product/${p.slug ?? p.id}`;

  for (const p of indexable) {
    if (!norm(p.slug)) {
      issues.push({
        issue_type: "missing_slug",
        category: "technical",
        severity: "critical",
        page_url: url(p),
        description: `"${p.name ?? p.id}" has no slug, so it has no stable URL.`,
        fix_suggestion: "Give the product a slug derived from its name.",
      });
    }
    if (!norm(p.name)) {
      issues.push({
        issue_type: "missing_title",
        category: "metadata",
        severity: "critical",
        page_url: url(p),
        description: "The product has no name, so the page has no title.",
        fix_suggestion: "Set a product name; the page title is built from it.",
      });
    }
    const description = (p.description ?? "").trim();
    if (!description) {
      issues.push({
        issue_type: "missing_description",
        category: "metadata",
        severity: "high",
        page_url: url(p),
        description: "No description, so the page has no meta description.",
        fix_suggestion: "Write 70–160 characters describing what the product does.",
      });
    } else if (description.length < 70) {
      issues.push({
        issue_type: "thin_description",
        category: "content",
        severity: "medium",
        page_url: url(p),
        description: `The description is ${description.length} characters, which is thin for a meta description.`,
        fix_suggestion: "Expand it to 70–160 characters.",
      });
    } else if (description.length > 300) {
      issues.push({
        issue_type: "long_description",
        category: "metadata",
        severity: "low",
        page_url: url(p),
        description: `The description is ${description.length} characters and will be truncated in search results.`,
        fix_suggestion: "Front-load the first 160 characters with the key message.",
      });
    }
    if (!p.category_id) {
      issues.push({
        issue_type: "missing_category",
        category: "structure",
        severity: "medium",
        page_url: url(p),
        description: "No category, so the product is orphaned from category and breadcrumb links.",
        fix_suggestion: "Assign the product to a marketplace category.",
      });
    }
    if (!norm(p.thumbnail_url)) {
      issues.push({
        issue_type: "missing_image",
        category: "metadata",
        severity: "low",
        page_url: url(p),
        description:
          "No image. The `icon` column holds a lucide icon name, not a URL, " +
          "so there is nothing for a social preview or image search to use.",
        fix_suggestion: "Set thumbnail_url to a real image; it becomes the OpenGraph image.",
      });
    }
  }

  for (const [slug, group] of bySlug) {
    if (group.length > 1) {
      issues.push({
        issue_type: "duplicate_slug",
        category: "technical",
        severity: "critical",
        page_url: `/marketplace/product/${slug}`,
        description: `${group.length} products share the slug "${slug}", so they compete for one URL.`,
        fix_suggestion: "Make each slug unique; only one product can own a URL.",
      });
    }
  }
  for (const [, group] of byTitle) {
    if (group.length > 1) {
      issues.push({
        issue_type: "duplicate_title",
        category: "metadata",
        severity: "high",
        page_url: url(group[0]),
        description: `${group.length} products share the title "${group[0].name}".`,
        fix_suggestion: "Differentiate the titles, by country or by use case.",
      });
    }
  }
  for (const [, group] of byDescription) {
    if (group.length > 1) {
      issues.push({
        issue_type: "duplicate_description",
        category: "metadata",
        severity: "medium",
        page_url: url(group[0]),
        description: `${group.length} products share the same description word for word.`,
        fix_suggestion: "Rewrite so each page says something only it can say.",
      });
    }
  }

  // ---- the SEO Manager's own page store, checked against reality ------
  const productSlugs = new Set(indexable.map((p) => norm(p.slug)).filter(Boolean));
  const origin = process.env.SITE_URL?.trim() || "http://127.0.0.1:3003";
  const CHECK_LIMIT = 200;

  /** Ask the site whether a URL exists, rather than guessing from its shape. */
  async function urlIsLive(path: string): Promise<boolean> {
    try {
      const response = await fetch(new URL(path, origin).toString(), {
        method: "GET",
        redirect: "follow",
        headers: { "user-agent": "SoftwareVala-SEO-Audit" },
      });
      return response.status < 400;
    } catch {
      // A network failure is not evidence the page is missing.
      return true;
    }
  }

  let deadSeoPages = 0;
  let checked = 0;
  for (const page of seoPages) {
    const u = (page.url ?? "").trim();
    if (!u || !u.startsWith("/")) continue;
    const isProductUrl = u.startsWith("/marketplace/product/");
    const slug = isProductUrl ? norm(u.split("/").pop()) : "";

    let looksReal: boolean;
    if (isProductUrl) {
      // A product URL is answered from the catalogue, no request needed.
      looksReal = productSlugs.has(slug);
    } else if (checked < CHECK_LIMIT) {
      checked += 1;
      looksReal = await urlIsLive(u);
    } else {
      looksReal = true;
    }

    if (!looksReal) {
      deadSeoPages += 1;
      issues.push({
        issue_type: "seo_record_for_dead_url",
        category: "technical",
        severity: "high",
        page_url: u,
        description: `The SEO record for "${u}" points at a URL this site does not serve.`,
        fix_suggestion: "Repoint the record at a live URL, or retire it.",
      });
    }
    const canonical = (page.canonical_url ?? "").trim();
    if (canonical.includes("softwarewala.net")) {
      issues.push({
        issue_type: "canonical_wrong_domain",
        category: "technical",
        severity: "critical",
        page_url: u,
        description: "The canonical points at the testing domain instead of the production domain.",
        fix_suggestion: "Point the canonical at softwarevala.net.",
      });
    }
  }

  // ---- coverage ------------------------------------------------------
  const withSeoRecord = new Set(seoPages.map((p) => p.product_id).filter(Boolean)).size;
  const coveragePct = indexable.length
    ? Math.round((withSeoRecord / indexable.length) * 10000) / 100
    : 0;

  const bySeverity = issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.severity] = (acc[i.severity] ?? 0) + 1;
    return acc;
  }, {});

  // Weighted by severity. Treating a missing social image the same as a
  // broken canonical made every catalogue score zero and told nobody
  // anything. The weights are deductions per affected page.
  const WEIGHT: Record<string, number> = { critical: 1, high: 0.5, medium: 0.15, low: 0.03 };
  const penalty = issues.reduce((sum, i) => sum + (WEIGHT[i.severity] ?? 0.1), 0);
  const score = indexable.length
    ? Math.max(0, Math.min(100, Math.round(100 - (penalty / indexable.length) * 100)))
    : 0;

  const breakdown = {
    products_total: products.length,
    products_indexable: indexable.length,
    products_hidden: products.length - indexable.length,
    categories: categories.length,
    seo_page_records: seoPages.length,
    seo_records_for_dead_urls: deadSeoPages,
    products_with_seo_record: withSeoRecord,
    metadata_coverage_percent: coveragePct,
    duplicate_slugs: [...bySlug.values()].filter((g) => g.length > 1).length,
    duplicate_titles: [...byTitle.values()].filter((g) => g.length > 1).length,
    duplicate_descriptions: [...byDescription.values()].filter((g) => g.length > 1).length,
    issues_by_severity: bySeverity,
    // Stated, not guessed: these need an external source that is not connected.
    unavailable: {
      impressions: "Google Search Console is disconnected",
      clicks: "Google Search Console is disconnected",
      average_position: "Google Search Console is disconnected",
      search_volume: "no keyword research provider is connected",
    },
  };

  // ---- persist into the tables the Manager already reads --------------
  const audit = await rest("seo_audits", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name: `Catalogue audit — ${indexable.length} indexable pages`,
      status: "completed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      pages_crawled: indexable.length,
      issues_found: issues.length,
      score,
      breakdown,
    }),
  });
  if (!audit.ok) {
    const detail = await audit.text();
    throw new CatalogueAuditError("Could not record the audit", 502, detail.slice(0, 200));
  }

  // Replace this run's issue rows, capped so one bad import cannot write
  // fifty thousand rows into a table an operator has to read.
  const capped = issues.slice(0, 500);
  const now = new Date().toISOString();
  if (capped.length) {
    const written = await rest("seo_issues", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(capped.map((i) => ({ ...i, status: "open", detected_at: now }))),
    });
    // The audit row is in; the issue rows are not. Said, rather than reported
    // to the operator as a clean run.
    if (!written.ok) {
      const detail = await written.text();
      throw new CatalogueAuditError("The audit was recorded but its issues were not", 502, detail.slice(0, 200));
    }
  }

  return {
    ok: true,
    score,
    pagesCrawled: indexable.length,
    issuesFound: issues.length,
    issuesRecorded: capped.length,
    breakdown,
  };
}

/** The most recent audit, without re-running one. */
export async function latestCatalogueAudit(): Promise<unknown> {
  const response = await rest("seo_audits?select=*&order=created_at.desc&limit=1");
  const rows = response.ok ? await response.json() : [];
  return (rows as unknown[])[0] ?? null;
}
