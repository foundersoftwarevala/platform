import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { invalidateSeoOverride } from "@/lib/seo/page-overrides";

/**
 * Write the SEO for one page, and have it appear immediately.
 *
 * This is the operator's side of the override chain. Writing straight to the
 * table would work but the page would keep serving the previous values until
 * the resolver's cache expired, so an operator would edit a title, reload, see
 * no change, and reasonably conclude the feature was broken. Every write here
 * clears the cache entry for that path.
 *
 * Only the fields an operator is meant to control are accepted. Everything
 * else on the row — crawl state, scores, timestamps — belongs to the audit.
 *
 *   GET  /api/internal/seo-page?url=/marketplace/product/x   -> current record
 *   POST /api/internal/seo-page  { url, metaTitle?, metaDescription?, h1?,
 *                                  canonicalUrl?, indexStatus?, productId? }
 *   POST /api/internal/seo-page  { url, action: "delete" }
 */

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

const clean = (v: unknown, max = 400): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

const INDEX_STATES = ["indexed", "pending", "crawled_not_indexed", "noindex"];

export const Route = createFileRoute("/api/internal/seo-page")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        const url = new URL(request.url).searchParams.get("url")?.trim();
        if (!url) return Response.json({ error: "url is required" }, { status: 400 });

        const response = await rest(
          `seo_pages?select=*&url=eq.${encodeURIComponent(url)}&limit=1`,
        );
        if (!response.ok) {
          return Response.json({ error: "Could not read the record" }, { status: 502 });
        }
        const rows = (await response.json()) as unknown[];
        return Response.json({ url, record: rows[0] ?? null });
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const url = clean(body.url, 300);
        if (!url || !url.startsWith("/")) {
          return Response.json({ error: "A site-relative url is required" }, { status: 400 });
        }

        const existingResponse = await rest(
          `seo_pages?select=id,title&url=eq.${encodeURIComponent(url)}&limit=1`,
        );
        const existing = existingResponse.ok
          ? ((await existingResponse.json()) as { id: string; title: string | null }[])[0]
          : undefined;

        // -------------------------------------------------------- delete
        if (body.action === "delete") {
          if (!existing) return Response.json({ ok: true, deleted: false, reason: "no record" });
          const deleted = await rest(`seo_pages?id=eq.${encodeURIComponent(existing.id)}`, {
            method: "DELETE",
            headers: { Prefer: "return=minimal" },
          });
          invalidateSeoOverride(url);
          return Response.json({ ok: deleted.ok, deleted: deleted.ok, url });
        }

        const canonical = clean(body.canonicalUrl, 300);
        if (canonical && canonical.includes("softwarewala.net")) {
          return Response.json(
            {
              error:
                "That canonical points at the testing domain. Point it at softwarevala.net " +
                "or leave it empty to use the default.",
            },
            { status: 400 },
          );
        }

        const indexStatus = clean(body.indexStatus, 40);
        if (indexStatus && !INDEX_STATES.includes(indexStatus)) {
          return Response.json(
            { error: "Unknown index status", allowed: INDEX_STATES },
            { status: 400 },
          );
        }

        const metaTitle = clean(body.metaTitle, 200);
        const metaDescription = clean(body.metaDescription, 400);

        // Length guidance, reported rather than enforced: a long title is a
        // judgement call, not an error, and the operator can see the number.
        const warnings: string[] = [];
        if (metaTitle && metaTitle.length > 60) {
          warnings.push(`The title is ${metaTitle.length} characters; search results usually cut around 60.`);
        }
        if (metaDescription && (metaDescription.length < 70 || metaDescription.length > 160)) {
          warnings.push(`The description is ${metaDescription.length} characters; 70–160 shows in full.`);
        }

        const payload: Record<string, unknown> = {
          url,
          page_type: clean(body.pageType, 40) ?? "product",
          // `title` is NOT NULL on this table and is the human label for the
          // record, distinct from the meta title that goes on the page.
          title: clean(body.title, 200) ?? existing?.title ?? metaTitle ?? url,
          meta_title: metaTitle,
          meta_description: metaDescription,
          h1: clean(body.h1, 200),
          canonical_url: canonical,
          updated_at: new Date().toISOString(),
        };
        if (indexStatus) payload.index_status = indexStatus;
        const productId = clean(body.productId, 64);
        if (productId) payload.product_id = productId;

        const written = existing
          ? await rest(`seo_pages?id=eq.${encodeURIComponent(existing.id)}`, {
              method: "PATCH",
              headers: { Prefer: "return=representation" },
              body: JSON.stringify(payload),
            })
          : await rest("seo_pages", {
              method: "POST",
              headers: { Prefer: "return=representation" },
              body: JSON.stringify({ ...payload, index_status: indexStatus ?? "pending" }),
            });

        if (!written.ok) {
          const detail = await written.text();
          console.error("[seo-page] write failed", written.status, detail.slice(0, 300));
          return Response.json(
            { error: "Could not save the record", detail: detail.slice(0, 200) },
            { status: 502 },
          );
        }

        // Without this the page would keep serving the previous values until the
        // resolver cache expired, and the edit would look like it did nothing.
        invalidateSeoOverride(url);

        const rows = (await written.json()) as unknown[];
        return Response.json({
          ok: true,
          created: !existing,
          url,
          warnings,
          record: rows[0] ?? null,
        });
      },
    },
  },
});
