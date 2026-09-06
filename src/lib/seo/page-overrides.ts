/**
 * Lets the SEO Manager actually control what a page says.
 *
 * The Manager edits `seo_pages` and `seo_meta_rules`, and the public page read
 * neither: it built its title and description straight from
 * `marketplace_products`. So an operator could rewrite a meta title all day and
 * the page would never change. This is the missing link.
 *
 * Resolution order, most specific first:
 *
 *   1. a `seo_pages` record for this product or URL   — hand-written, wins
 *   2. the best matching active `seo_meta_rules` row  — a template, scales
 *   3. whatever the product itself implies            — the current behaviour
 *
 * Two deliberate safety rules, because 5,469 pages currently have no record and
 * a bad override would be worse than no override:
 *
 *   * only a NON-EMPTY field overrides. A half-filled record cannot blank a
 *     title that is currently fine.
 *   * anything that throws falls back to the product default. An SEO table
 *     being unavailable must never take the marketplace down.
 *
 * The template layer is what makes this workable at 12,000+ products: one rule
 * with a URL pattern covers a whole class of pages, so nobody has to write
 * twelve thousand records by hand.
 */

export type SeoOverride = {
  title: string | null;
  description: string | null;
  h1: string | null;
  canonical: string | null;
  noindex: boolean;
  /** Where the winning value came from, so the Manager can explain itself. */
  source: "page-record" | "meta-rule" | "product";
  ruleName?: string;
};

type SeoPageRow = {
  url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  h1: string | null;
  canonical_url: string | null;
  index_status: string | null;
  product_id: string | null;
};

type MetaRuleRow = {
  name: string | null;
  url_pattern: string | null;
  title_template: string | null;
  description_template: string | null;
  priority: number | null;
  status: string | null;
};

const clean = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
};

function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function adminHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/**
 * A URL pattern like `/marketplace/product/*` or `/{{country}}/*`.
 * `*` matches a path segment run; `{{token}}` matches one segment.
 */
function patternMatches(pattern: string, path: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  if (p === path) return true;
  const source =
    "^" +
    p
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\{\{[^}]+\}\}/g, "[^/]+")
      .replace(/\*/g, ".*") +
    "$";
  try {
    return new RegExp(source).test(path);
  } catch {
    return false;
  }
}

/** How specific a pattern is, so `/marketplace/product/*` beats `/*`. */
function specificity(pattern: string): number {
  return pattern.replace(/\*/g, "").length;
}

function applyTokens(template: string, tokens: Record<string, string | null | undefined>): string | null {
  let out = template;
  let missing = false;
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = clean(tokens[key]);
    if (!value) {
      missing = true;
      return "";
    }
    return value;
  });
  // A template that leaves a hole would publish "Software for  in " — refuse it
  // and let the next layer answer instead.
  if (missing) return null;
  return clean(out.replace(/\s{2,}/g, " ").replace(/\s+([|,·—-])\s*$/, ""));
}

const cache = new Map<string, { at: number; value: SeoOverride | null }>();
const CACHE_MS = 300_000;
// A miss is held briefly: nearly every page has no record, so the cache is
// still worth having, but a newly written record must not be invisible for
// five minutes while an operator wonders whether the save worked.
const MISS_CACHE_MS = 45_000;

/**
 * Resolve the SEO overrides for one page.
 *
 * `tokens` carries whatever the caller knows about the page — product name,
 * country, industry, category — for the template layer to substitute.
 */
export async function resolveSeoOverride(
  path: string,
  tokens: Record<string, string | null | undefined> = {},
  productId?: string | null,
): Promise<SeoOverride | null> {
  if (!supabaseUrl() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const key = `${path}::${productId ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.value ? CACHE_MS : MISS_CACHE_MS)) return hit.value;

  let result: SeoOverride | null = null;

  try {
    // ---- 1. a record written for this exact page ------------------------
    const filter = productId
      ? `or=(product_id.eq.${encodeURIComponent(productId)},url.eq.${encodeURIComponent(path)})`
      : `url=eq.${encodeURIComponent(path)}`;
    const pageResponse = await fetch(
      `${supabaseUrl()}/rest/v1/seo_pages` +
        `?select=url,meta_title,meta_description,h1,canonical_url,index_status,product_id` +
        `&${filter}&limit=1`,
      { headers: adminHeaders() },
    );
    const pages = pageResponse.ok ? ((await pageResponse.json()) as SeoPageRow[]) : [];
    const record = pages[0];

    if (record) {
      const canonical = clean(record.canonical_url);
      result = {
        title: clean(record.meta_title),
        description: clean(record.meta_description),
        h1: clean(record.h1),
        // A canonical pointing at the testing domain is a mistake, not an
        // instruction. Refuse it rather than publishing it.
        canonical: canonical && !canonical.includes("softwarewala.net") ? canonical : null,
        noindex: clean(record.index_status)?.toLowerCase() === "noindex",
        source: "page-record",
      };
    }

    // ---- 2. a template rule, for anything the record did not answer -----
    if (!result?.title || !result?.description) {
      const ruleResponse = await fetch(
        `${supabaseUrl()}/rest/v1/seo_meta_rules` +
          `?select=name,url_pattern,title_template,description_template,priority,status` +
          `&status=eq.active&order=priority.desc&limit=50`,
        { headers: adminHeaders() },
      );
      const rules = ruleResponse.ok ? ((await ruleResponse.json()) as MetaRuleRow[]) : [];
      const matching = rules
        .filter((r) => r.url_pattern && patternMatches(r.url_pattern, path))
        .sort(
          (a, b) =>
            (b.priority ?? 0) - (a.priority ?? 0) ||
            specificity(b.url_pattern ?? "") - specificity(a.url_pattern ?? ""),
        );

      for (const rule of matching) {
        const title = rule.title_template ? applyTokens(rule.title_template, tokens) : null;
        const description = rule.description_template
          ? applyTokens(rule.description_template, tokens)
          : null;
        if (!title && !description) continue;
        result = {
          title: result?.title ?? title,
          description: result?.description ?? description,
          h1: result?.h1 ?? null,
          canonical: result?.canonical ?? null,
          noindex: result?.noindex ?? false,
          source: result?.source ?? "meta-rule",
          ruleName: result?.source === "page-record" ? result.ruleName : (rule.name ?? undefined),
        };
        break;
      }
    }
  } catch (error) {
    // The marketplace must render even if the SEO tables are unreachable.
    console.error("[seo override] falling back to product defaults for", path, error);
    result = null;
  }

  // Nothing useful found — the caller keeps its own values.
  if (result && !result.title && !result.description && !result.h1 && !result.canonical && !result.noindex) {
    result = null;
  }

  cache.set(key, { at: Date.now(), value: result });
  if (cache.size > 2000) cache.clear();
  return result;
}

/** Drop a cached override so a Manager edit shows up without waiting. */
export function invalidateSeoOverride(path?: string) {
  if (!path) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${path}::`)) cache.delete(key);
  }
}
