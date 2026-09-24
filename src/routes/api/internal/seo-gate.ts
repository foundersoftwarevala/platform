import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import {
  applyCrossPageFindings,
  evaluatePage,
  type Decision,
  type PageFacts,
} from "@/lib/seo/indexing-gate";

/**
 * Run the SEO safety gate over the site's own pages, and record what it found.
 *
 * The gate itself lives in src/lib/seo/indexing-gate.ts and is pure. This is
 * the job that feeds it: it builds the inventory of URLs from the catalogue,
 * asks this same server for each page, judges what comes back and writes one
 * decision per URL into seo_indexing_decisions, plus the content fingerprints
 * into seo_fingerprints.
 *
 * It runs in slices because 7,280 slots and 7,347 products is not one request.
 * The caller pages through with ?kind=&offset=&limit=, which keeps memory flat
 * however large the catalogue grows.
 *
 * The cross-page pass is separate and runs in SQL. Finding every page whose
 * only difference from another is a country name means grouping by the masked
 * fingerprint, and a database does that over fifteen thousand rows far better
 * than a process holding fifteen thousand page bodies.
 *
 *   POST /api/internal/seo-gate?kind=slot&offset=0&limit=200   evaluate a slice
 *   POST /api/internal/seo-gate?phase=cross                    the duplicate pass
 *   GET  /api/internal/seo-gate                                what the gate decided
 */

const AUDIT_VERSION = "v1";
const CONCURRENCY = 8;

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

async function rows<T>(path: string): Promise<T[]> {
  const response = await rest(path);
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return (await response.json()) as T[];
}

/**
 * Where to ask for the pages.
 *
 * The server asks itself, over the loopback interface, so an audit of fifteen
 * thousand pages never leaves the machine and never depends on the internet
 * being up. The canonical check still uses the public site name, because that
 * is what the page must claim.
 */
function origin(): string {
  const port = process.env.PORT?.trim() || "3000";
  return process.env.SEO_GATE_ORIGIN?.trim() || `http://127.0.0.1:${port}`;
}

function site(): string {
  const configured = process.env.SITE_URL?.trim() || "https://softwarevala.net";
  try {
    return new URL(configured).host;
  } catch {
    return "softwarevala.net";
  }
}

type Work = { facts: PageFacts; url: string };

const countrySlug = (country: string): string =>
  country
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/** Which pages of one kind this slice covers. */
async function inventory(kind: string, offset: number, limit: number): Promise<Work[]> {
  const host = site();

  if (kind === "slot") {
    const slots = await rows<{
      id: string;
      slot_url: string;
      country_marker: string;
      status: string;
      current_product_id: string | null;
      marketplace_categories: { name: string } | null;
    }>(
      `marketplace_card_slots?select=id,slot_url,country_marker,status,current_product_id,` +
        `marketplace_categories(name)&order=slot_url.asc&limit=${limit}&offset=${offset}`,
    );
    if (!slots.length) return [];

    // One query for the tenants of this slice, rather than one per slot.
    const ids = slots.map((slot) => slot.current_product_id).filter(Boolean) as string[];
    const products = ids.length
      ? await rows<{ id: string; name: string; visible: boolean; content_status: string }>(
          `marketplace_products?select=id,name,visible,content_status&id=in.(${ids.join(",")})`,
        )
      : [];
    const byId = new Map(products.map((product) => [product.id, product]));

    return slots.map((slot) => {
      const tenant = slot.current_product_id ? byId.get(slot.current_product_id) : undefined;
      return {
        url: slot.slot_url,
        facts: {
          url: slot.slot_url,
          entityType: "slot",
          entityId: slot.id,
          site: host,
          // A vacant slot is a real record that is simply not ready to be
          // shown to a crawler. It is not a draft and not an error.
          publication: slot.status === "occupied" && tenant ? "published" : "unknown",
          entityExists: true,
          terms: {
            country: slot.country_marker,
            category: slot.marketplace_categories?.name ?? null,
            product: tenant?.name ?? null,
          },
          countryKnown: true,
          categoryKnown: Boolean(slot.marketplace_categories?.name),
          expectedHreflang: 81,
          minInternalLinks: 20,
        },
      };
    });
  }

  if (kind === "product") {
    const products = await rows<{
      id: string;
      slug: string;
      name: string;
      visible: boolean;
      content_status: string;
      search_keywords: string[] | null;
      marketplace_categories: { name: string } | null;
    }>(
      `marketplace_products?select=id,slug,name,visible,content_status,search_keywords,` +
        `marketplace_categories(name)&order=id.asc&limit=${limit}&offset=${offset}`,
    );
    return products
      .filter((product) => product.slug)
      .map((product) => {
        const marker = (product.search_keywords ?? []).find((k) => k.startsWith("country:"));
        const published = product.visible === true && product.content_status === "published";
        return {
          url: `/marketplace/product/${product.slug}`,
          facts: {
            url: `/marketplace/product/${product.slug}`,
            entityType: "product",
            entityId: product.id,
            site: host,
            publication: published
              ? "published"
              : product.content_status === "archived"
                ? "archived"
                : product.content_status === "draft"
                  ? "draft"
                  : "unknown",
            entityExists: true,
            terms: {
              country: marker ? marker.slice("country:".length) : null,
              category: product.marketplace_categories?.name ?? null,
              product: product.name,
            },
            expectedHreflang: null,
            minInternalLinks: 3,
          },
        } satisfies Work;
      });
  }

  if (kind === "category") {
    const categories = await rows<{ id: string; slug: string; name: string; is_hidden: boolean }>(
      `marketplace_categories?select=id,slug,name,is_hidden&order=sort_order.asc&limit=${limit}&offset=${offset}`,
    );
    return categories.map((category) => ({
      url: `/marketplace/category/${category.slug}`,
      facts: {
        url: `/marketplace/category/${category.slug}`,
        entityType: "category",
        entityId: category.id,
        site: host,
        publication: category.is_hidden ? "unknown" : "published",
        entityExists: true,
        terms: { category: category.name },
        categoryKnown: true,
        expectedHreflang: null,
        minInternalLinks: 3,
      },
    }));
  }

  if (kind === "country") {
    const countries = await rows<{ country_marker: string }>(
      `marketplace_card_slots?select=country_marker&order=slot_no.asc&limit=${limit}&offset=${offset}`,
    );
    const seen = new Set<string>();
    const out: Work[] = [];
    for (const row of countries) {
      if (seen.has(row.country_marker)) continue;
      seen.add(row.country_marker);
      const url = `/marketplace/country/${countrySlug(row.country_marker)}`;
      out.push({
        url,
        facts: {
          url,
          entityType: "country",
          entityId: null,
          site: host,
          publication: "published",
          entityExists: true,
          terms: { country: row.country_marker },
          countryKnown: true,
          expectedHreflang: null,
          minInternalLinks: 3,
        },
      });
    }
    return out;
  }

  if (kind === "blog") {
    const posts = await rows<{
      id: string;
      url: string | null;
      title: string;
      status: string;
      body: string | null;
    }>(
      `seo_content_items?select=id,url,title,status,body&order=created_at.desc&limit=${limit}&offset=${offset}`,
    );
    return posts
      .filter((post) => post.url)
      .map((post) => ({
        url: String(post.url),
        facts: {
          url: String(post.url),
          entityType: "blog",
          entityId: post.id,
          site: host,
          // A published row with nothing stored in it is not published in any
          // sense a reader would recognise.
          publication:
            post.status === "published" && post.body && post.body.trim()
              ? "published"
              : post.status === "published"
                ? "unknown"
                : "draft",
          entityExists: true,
          terms: { product: post.title },
          expectedHreflang: null,
          minInternalLinks: 1,
        },
      }));
  }

  throw new Error(`unknown kind "${kind}"`);
}

/** Ask this server for a page, and say plainly when the asking failed. */
async function render(
  url: string,
): Promise<{ status: number | null; html: string | null; error?: string }> {
  try {
    const response = await fetch(new URL(url, origin()).toString(), {
      redirect: "manual",
      headers: { "user-agent": "SoftwareVala-SEO-Gate" },
    });
    return { status: response.status, html: await response.text() };
  } catch (error) {
    return { status: null, html: null, error: String(error).slice(0, 200) };
  }
}

function decisionRow(decision: Decision) {
  return {
    url: decision.url,
    entity_type: decision.entityType,
    entity_id: decision.entityId,
    state: decision.state,
    indexable: decision.indexable,
    sitemap_eligible: decision.sitemapEligible,
    quality_status: decision.qualityStatus,
    quality_score: decision.qualityScore,
    fingerprint_class: decision.fingerprintClass,
    canonical_status: decision.canonicalStatus,
    schema_status: decision.schemaStatus,
    hreflang_status: decision.hreflangStatus,
    content_status: decision.contentStatus,
    http_status: decision.httpStatus,
    blocking_reason: decision.blockingReason,
    checks: decision.checks,
    duplicate_of: decision.duplicateOf,
    audit_version: AUDIT_VERSION,
    evaluated_at: new Date().toISOString(),
  };
}

export const Route = createFileRoute("/api/internal/seo-gate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        const response = await rest(
          "seo_indexing_decisions?select=state,indexable,sitemap_eligible&limit=20000",
        );
        if (!response.ok)
          return Response.json({ error: "Could not read decisions" }, { status: 502 });
        const all = (await response.json()) as { state: string; sitemap_eligible: boolean }[];
        const byState: Record<string, number> = {};
        for (const row of all) byState[row.state] = (byState[row.state] ?? 0) + 1;
        return Response.json({
          decisions: all.length,
          sitemapEligible: all.filter((row) => row.sitemap_eligible).length,
          byState,
        });
      },

      POST: async ({ request }) => {
        const auth = await requireInternalOperator(request);
        if (!auth.ok) return auth.response;
        if (!supabaseUrl()) {
          return Response.json({ error: "Supabase is not configured" }, { status: 503 });
        }

        const params = new URL(request.url).searchParams;

        const kind = String(params.get("kind") ?? "slot");
        const offset = Math.max(0, Number(params.get("offset") ?? 0) || 0);
        const limit = Math.min(500, Math.max(1, Number(params.get("limit") ?? 100) || 100));

        let work: Work[];
        try {
          work = await inventory(kind, offset, limit);
        } catch (error) {
          return Response.json({ error: String(error).slice(0, 200) }, { status: 400 });
        }
        if (!work.length)
          return Response.json({ ok: true, kind, offset, evaluated: 0, done: true });

        const decisions: Decision[] = [];
        const queue = [...work];
        await Promise.all(
          Array.from({ length: CONCURRENCY }, async () => {
            for (;;) {
              const item = queue.shift();
              if (!item) return;
              const rendered = await render(item.url);
              decisions.push(evaluatePage(item.facts, rendered));
            }
          }),
        );

        // Within a slice the pages are compared with each other by hash, which
        // catches an exact duplicate and a country swap cheaply. The bodies are
        // deliberately not passed: only the truncated samples are still in
        // memory, and comparing those would be comparing the first hundred and
        // sixty characters of two pages and calling it a verdict. The wider
        // comparison, across every slice, is the SQL pass in
        // scripts/ops/seo-gate-run.mjs.
        const settled = applyCrossPageFindings(decisions.map((decision) => ({ decision })));

        const wrote = await rest("seo_indexing_decisions?on_conflict=url", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(settled.map(decisionRow)),
        });
        if (!wrote.ok) {
          const detail = await wrote.text();
          return Response.json(
            { error: "Could not record the decisions", detail: detail.slice(0, 300) },
            { status: 502 },
          );
        }

        const prints = settled.flatMap((decision) =>
          decision.fingerprints.map((print) => ({
            url: decision.url,
            entity_type: decision.entityType,
            entity_id: decision.entityId,
            layer: print.layer,
            hash: print.hash,
            simhash: print.simhash,
            token_count: print.tokens,
            sample: print.sample,
            audit_version: AUDIT_VERSION,
            computed_at: new Date().toISOString(),
          })),
        );
        if (prints.length) {
          const wrotePrints = await rest("seo_fingerprints?on_conflict=url,layer", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(prints),
          });
          if (!wrotePrints.ok) {
            const detail = await wrotePrints.text();
            return Response.json(
              { error: "Could not record the fingerprints", detail: detail.slice(0, 300) },
              { status: 502 },
            );
          }
        }

        const byState: Record<string, number> = {};
        for (const decision of settled)
          byState[decision.state] = (byState[decision.state] ?? 0) + 1;

        return Response.json({
          ok: true,
          kind,
          offset,
          evaluated: settled.length,
          eligible: settled.filter((decision) => decision.sitemapEligible).length,
          byState,
          blocked: settled
            .filter((decision) => !decision.sitemapEligible)
            .slice(0, 5)
            .map((decision) => ({
              url: decision.url,
              state: decision.state,
              reason: decision.blockingReason,
            })),
          done: settled.length < limit,
        });
      },
    },
  },
});
