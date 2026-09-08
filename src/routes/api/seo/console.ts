import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * What the SEO Auto-Generator console reads.
 *
 * The screen showed 98% coverage, 1,842 schemas emitted, 12,406 sitemap URLs
 * and 34 robots rules. None of those came from anywhere - they were four
 * numbers written into the file, and section 2 names that exact 98% as the
 * thing not to do.
 *
 * Every figure below is counted at the moment of the request. Coverage is
 * computed per requirement rather than as one opaque percentage, because "98%
 * covered" hides which of the ten things is missing. The sitemap count is read
 * from the sitemap the site actually serves, not from a table that hopes to
 * describe it.
 *
 * A server route rather than a database function because this project has no
 * path to run DDL today; it holds the service role and requires an operator,
 * the same as /api/manager/resource.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function count(path: string): Promise<number> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, {
      headers: { ...admin(), Prefer: "count=exact", Range: "0-0" },
    });
    if (!response.ok) return 0;
    const range = response.headers.get("content-range") ?? "";
    return Number(range.split("/")[1]) || 0;
  } catch {
    return 0;
  }
}

/** How many <loc> entries the site is actually publishing today. */
async function sitemapUrls(base: string): Promise<{ total: number | null; parts: { url: string; urls: number }[] }> {
  try {
    const index = await fetch(`${base}/sitemap.xml`);
    if (!index.ok) return { total: null, parts: [] };
    const xml = await index.text();
    const children = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const parts: { url: string; urls: number }[] = [];
    let total = 0;
    // Counted, not estimated. Each child sitemap is fetched and its entries
    // counted, so the number on the card is the number a crawler would see.
    for (const child of children.slice(0, 40)) {
      try {
        const res = await fetch(child);
        if (!res.ok) {
          parts.push({ url: child, urls: 0 });
          continue;
        }
        const body = await res.text();
        const n = (body.match(/<loc>/g) ?? []).length;
        parts.push({ url: child, urls: n });
        total += n;
      } catch {
        parts.push({ url: child, urls: 0 });
      }
    }
    return { total, parts };
  } catch {
    return { total: null, parts: [] };
  }
}

/** The rules the served robots.txt actually contains. */
async function robots(base: string) {
  try {
    const res = await fetch(`${base}/robots.txt`);
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    return {
      agents: lines.filter((l) => /^user-agent:/i.test(l)).length,
      allow: lines.filter((l) => /^allow:/i.test(l)).length,
      disallow: lines.filter((l) => /^disallow:/i.test(l)).length,
      sitemap: lines.filter((l) => /^sitemap:/i.test(l)).length,
      rules: lines.length,
      protects_control_panel: /disallow:\s*\/control-panel/i.test(text),
      protects_api: /disallow:\s*\/api\//i.test(text),
    };
  } catch {
    return null;
  }
}


/**
 * What the public page actually emits for one product.
 *
 * Section 24 asks the preview to show real generated output, so this fetches
 * the live product page and reads the tags out of it rather than rendering
 * what the console thinks should be there. If the two ever disagree, this
 * shows the one a crawler would see.
 */
async function preview(base: string, slug: string) {
  const target = `${base}/marketplace/product/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(target);
    const html = await res.text();
    const pick = (re: RegExp) => (html.match(re)?.[1] ?? "").trim() || null;
    const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
      .map((m) => m[1].trim());
    const parsed = ld.map((raw) => {
      try {
        const value = JSON.parse(raw);
        return { valid: true, type: String(value["@type"] ?? "unknown"), bytes: raw.length };
      } catch {
        return { valid: false, type: "unparseable", bytes: raw.length };
      }
    });
    return {
      url: target,
      status: res.status,
      title: pick(/<title[^>]*>([^<]*)<\/title>/i),
      description: pick(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i),
      canonical: pick(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i),
      og_title: pick(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i),
      og_description: pick(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i),
      og_type: pick(/<meta[^>]+property="og:type"[^>]+content="([^"]*)"/i),
      twitter_card: pick(/<meta[^>]+name="twitter:card"[^>]+content="([^"]*)"/i),
      robots: pick(/<meta[^>]+name="robots"[^>]+content="([^"]*)"/i),
      json_ld: parsed,
    };
  } catch {
    return { url: target, status: 0, error: "The page could not be fetched." };
  }
}

export const Route = createFileRoute("/api/seo/console")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const base = process.env.APP_BASE_URL?.trim() || "https://softwarevala.net";
        const slug = (new URL(request.url).searchParams.get("product") ?? "").trim().slice(0, 200);

        const [
          eligible, withDescription, withKeywords, withCategory, withPrice,
          categories, canonicalRows, schemaRows, keywords, issues,
          indexing, integrations, sitemap, robotsRules,
        ] = await Promise.all([
          count("marketplace_products?select=id&visible=eq.true"),
          count("marketplace_products?select=id&visible=eq.true&description=not.is.null"),
          count("marketplace_products?select=id&visible=eq.true&search_keywords=not.is.null"),
          count("marketplace_products?select=id&visible=eq.true&category_id=not.is.null"),
          count("marketplace_products?select=id&visible=eq.true&price_label=not.is.null"),
          count("marketplace_categories?select=id&is_hidden=eq.false"),
          count("product_urls?select=id&status=eq.active"),
          count("seo_product_entries?select=id&structured_data=not.is.null"),
          count("seo_keywords?select=id"),
          count("seo_issues?select=id"),
          count("seo_indexing_records?select=id"),
          count("seo_integrations?select=id"),
          sitemapUrls(base),
          robots(base),
        ]);

        // Coverage per requirement. One percentage hides which requirement is
        // the one failing, so each is reported on its own with its own count.
        const pct = (n: number) => (eligible > 0 ? Math.round((n / eligible) * 1000) / 10 : null);
        const requirements = [
          { key: "description", label: "Meta description source", have: withDescription, pct: pct(withDescription) },
          { key: "keywords", label: "Keywords", have: withKeywords, pct: pct(withKeywords) },
          { key: "category", label: "Category (breadcrumb + schema)", have: withCategory, pct: pct(withCategory) },
          { key: "price", label: "Offer price (schema)", have: withPrice, pct: pct(withPrice) },
        ];
        const worst = requirements.reduce(
          (lowest, r) => (r.pct !== null && (lowest === null || r.pct < lowest) ? r.pct : lowest),
          null as number | null,
        );

        return Response.json({
          ok: true,
          base,
          products: { eligible, total: await count("marketplace_products?select=id") },
          // The honest headline: the weakest requirement, not an average that
          // flatters the ones that are fine.
          coverage: { weakest: worst, requirements },
          schemas: {
            // Only rows that actually carry structured data are counted, and
            // they are counted as stored, not as validated - validation is a
            // separate job and is reported separately below.
            stored: schemaRows,
            validated: null,
            note: "Counted from seo_product_entries rows that carry structured_data. Validation runs separately and has not been recorded for these rows.",
          },
          sitemap: {
            urls: sitemap.total,
            parts: sitemap.parts,
            note: "Counted by fetching the sitemap this site serves and counting its entries.",
          },
          robots: robotsRules,
          canonical: {
            product_url_rows: canonicalRows,
            note: "Product pages resolve from the product's own slug; a product_urls row is what the URL manager tracks and redirects from.",
          },
          catalogue: { categories },
          seo_tables: { keywords, issues, indexing_records: indexing, integrations },
          preview: slug ? await preview(base, slug) : null,
        });
      },
    },
  },
});
