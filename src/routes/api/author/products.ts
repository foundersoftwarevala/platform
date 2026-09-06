import { createFileRoute } from "@tanstack/react-router";

import {
  AUTHOR_TRANSITIONS,
  ownsProduct,
  pickAuthorFields,
  requireAuthor,
  rest,
  slugify,
} from "@/lib/marketplace/author-guard";

/**
 * The author's own products, on the canonical `marketplace_products` table.
 *
 * There was no way for an author to put anything on the marketplace: the
 * catalogue was writable only by operators, and `seller_id` — the ownership
 * column that already existed — was never set by anything.
 *
 * A product created here is owned by the calling author's seller record and
 * starts as an invisible draft. The author can edit it and submit it for
 * review; approval, publication and visibility stay with Software Vala, so
 * nothing an author does can put an unreviewed product in front of a customer.
 *
 *   GET  /api/author/products              -> this author's products
 *   POST /api/author/products              -> create a draft
 *   POST /api/author/products  {id, patch} -> edit own draft
 *   POST /api/author/products  {id, action:"submit"|"withdraw"}
 */

const SUMMARY =
  "id,name,slug,description,category_id,subcategory,demo_url,thumbnail_url,price_label," +
  "content_status,moderation_status,visible,seller_id,created_at,updated_at,approved_at,version";

export const Route = createFileRoute("/api/author/products")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireAuthor(request, { allowPending: true });
        if (!gate.ok) return gate.response;

        const response = await rest(
          `marketplace_products?select=${SUMMARY}` +
            `&seller_id=eq.${encodeURIComponent(gate.seller.id)}&order=updated_at.desc&limit=200`,
        );
        if (!response.ok) {
          return Response.json({ error: "Could not read your products" }, { status: 502 });
        }
        const products = await response.json();
        return Response.json({
          seller: {
            id: gate.seller.id,
            display_name: gate.seller.display_name,
            status: gate.seller.status,
          },
          products,
        });
      },

      POST: async ({ request }) => {
        const gate = await requireAuthor(request);
        if (!gate.ok) return gate.response;

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const id = typeof body.id === "string" ? body.id.trim() : "";
        const action = typeof body.action === "string" ? body.action : "";

        // ---------------------------------------------------- create a draft
        if (!id) {
          const fields = pickAuthorFields(body);
          const name = String(fields.name ?? "").trim();
          if (name.length < 3) {
            return Response.json({ error: "A product name of at least 3 characters is required" }, { status: 400 });
          }
          const suffix = Math.random().toString(36).slice(2, 8);
          const created = await rest("marketplace_products", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              ...fields,
              name,
              slug: String(fields.slug ?? "").trim() || slugify(name, suffix),
              // Ownership and state are set here, never accepted from the caller.
              seller_id: gate.seller.id,
              content_status: "draft",
              moderation_status: "draft",
              visible: false,
            }),
          });
          if (!created.ok) {
            const detail = await created.text();
            console.error("[author products] create failed", created.status, detail.slice(0, 300));
            return Response.json(
              { error: created.status === 409 ? "That slug is already taken" : "Could not create the product" },
              { status: created.status === 409 ? 409 : 502 },
            );
          }
          const rows = (await created.json()) as { id: string }[];
          return Response.json({ ok: true, created: true, product: rows[0] }, { status: 201 });
        }

        // Everything below acts on an existing product, so ownership first.
        if (!(await ownsProduct(gate.seller.id, id))) {
          return Response.json({ error: "That product does not belong to this author" }, { status: 403 });
        }

        const currentResponse = await rest(
          `marketplace_products?select=id,moderation_status,content_status&id=eq.${encodeURIComponent(id)}&limit=1`,
        );
        const current = ((await currentResponse.json()) as { moderation_status: string }[])[0];
        const state = String(current?.moderation_status ?? "draft");

        // ------------------------------------------------- submit / withdraw
        if (action === "submit" || action === "withdraw") {
          const target = action === "submit" ? "submitted" : "draft";
          const allowed = AUTHOR_TRANSITIONS[state] ?? [];
          if (!allowed.includes(target)) {
            return Response.json(
              { error: `A product that is "${state}" cannot be moved to "${target}"`, allowed },
              { status: 409 },
            );
          }
          const patched = await rest(`marketplace_products?id=eq.${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              moderation_status: target,
              content_status: target === "submitted" ? "in_review" : "draft",
              updated_at: new Date().toISOString(),
            }),
          });
          if (!patched.ok) {
            return Response.json({ error: "Could not update the product" }, { status: 502 });
          }
          return Response.json({ ok: true, action, from: state, to: target });
        }

        // ------------------------------------------------------------- edit
        // Once a product is with Software Vala or live, its content is frozen
        // to the author; they withdraw it to a draft to work on it again.
        if (!["draft", "changes_requested", "rejected"].includes(state)) {
          return Response.json(
            { error: `A product that is "${state}" cannot be edited. Withdraw it to a draft first.` },
            { status: 409 },
          );
        }
        const fields = pickAuthorFields(body);
        if (Object.keys(fields).length === 0) {
          return Response.json({ error: "Nothing to change" }, { status: 400 });
        }
        const patched = await rest(`marketplace_products?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
        });
        if (!patched.ok) {
          const detail = await patched.text();
          return Response.json(
            { error: patched.status === 409 ? "That slug is already taken" : "Could not save the product",
              detail: detail.slice(0, 200) },
            { status: patched.status === 409 ? 409 : 502 },
          );
        }
        const rows = (await patched.json()) as unknown[];
        return Response.json({ ok: true, updated: true, product: rows[0] });
      },
    },
  },
});
