import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { REVIEW_TRANSITIONS, rest } from "@/lib/marketplace/author-guard";

/**
 * The review queue an author's submission goes to, and the decision that
 * publishes it.
 *
 * Approval and publication are deliberately here, behind the operator guard,
 * and nowhere in the author's own endpoints: an author must never be able to
 * put an unreviewed product in front of a customer. A rejection carries a
 * reason so the author is told why, rather than watching a product sit.
 *
 *   GET  /api/internal/author-review                 -> the queue
 *   POST /api/internal/author-review {productId, decision, reason}
 *        decision: under_review | approved | published | changes_requested
 *                | rejected | suspended | archived
 */

const QUEUE_FIELDS =
  "id,name,slug,description,demo_url,thumbnail_url,price_label,category_id,subcategory," +
  "seller_id,content_status,moderation_status,visible,created_at,updated_at,approved_at,approved_by";

/**
 * What a decision means for the two status columns and for visibility.
 *
 * `moderation` is what is written to moderation_status, whose check constraint
 * (moderation_schema.sql) has no "published": writing the decision name there
 * made every Publish fail with 502. A published product is moderation-approved
 * and content-published - the pair every public read already checks.
 */
const EFFECTS: Record<
  string,
  { moderation: string; content: string; visible?: boolean; approved?: boolean }
> = {
  under_review: { moderation: "under_review", content: "in_review" },
  changes_requested: { moderation: "changes_requested", content: "changes_requested" },
  approved: { moderation: "approved", content: "approved", approved: true },
  published: { moderation: "approved", content: "published", visible: true, approved: true },
  rejected: { moderation: "rejected", content: "rejected", visible: false },
  suspended: { moderation: "suspended", content: "suspended", visible: false },
  archived: { moderation: "archived", content: "archived", visible: false },
};

/** Where a product stands in the review flow, from the two columns together. */
function reviewState(moderation: string, content: string): string {
  if (moderation === "approved" && content === "published") return "published";
  return moderation || "draft";
}

export const Route = createFileRoute("/api/internal/author-review")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        const url = new URL(request.url);
        const state = url.searchParams.get("status");
        // An approved submission waits here until it is published; it used to
        // drop out of the queue the moment it was approved, leaving the Publish
        // step with nothing to act on.
        const filter = state
          ? `moderation_status=eq.${encodeURIComponent(state)}`
          : `or=(moderation_status.in.(submitted,under_review,changes_requested),` +
            `and(moderation_status.eq.approved,content_status.neq.published))`;

        const response = await rest(
          `marketplace_products?select=${QUEUE_FIELDS}&${filter}` +
            `&seller_id=not.is.null&order=updated_at.asc&limit=200`,
        );
        if (!response.ok) {
          return Response.json({ error: "Could not read the review queue" }, { status: 502 });
        }
        const products = (await response.json()) as { seller_id: string }[];

        // Attach the author behind each submission so a reviewer sees who it is from.
        const sellerIds = Array.from(new Set(products.map((p) => p.seller_id).filter(Boolean)));
        let sellers: Record<string, unknown> = {};
        if (sellerIds.length) {
          const list = sellerIds.map((id) => `"${id}"`).join(",");
          const sellerResponse = await rest(
            `marketplace_sellers?select=id,display_name,slug,status&id=in.(${list})`,
          );
          if (sellerResponse.ok) {
            const rows = (await sellerResponse.json()) as { id: string }[];
            sellers = Object.fromEntries(rows.map((r) => [r.id, r]));
          }
        }

        return Response.json({ count: products.length, products, sellers });
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { productId?: string; decision?: string; reason?: string; reviewerId?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const productId = String(body.productId ?? "").trim();
        const decision = String(body.decision ?? "").trim();
        if (!productId) return Response.json({ error: "productId is required" }, { status: 400 });
        if (!EFFECTS[decision]) {
          return Response.json(
            { error: "Unknown decision", allowed: Object.keys(EFFECTS) },
            { status: 400 },
          );
        }
        if ((decision === "rejected" || decision === "changes_requested") && !String(body.reason ?? "").trim()) {
          return Response.json(
            { error: "A reason is required so the author knows what to fix" },
            { status: 400 },
          );
        }

        const currentResponse = await rest(
          `marketplace_products?select=id,seller_id,moderation_status,content_status,name&id=eq.${encodeURIComponent(productId)}&limit=1`,
        );
        const current = ((await currentResponse.json()) as
          { seller_id: string | null; moderation_status: string; content_status: string | null; name: string }[])[0];
        if (!current) return Response.json({ error: "No such product" }, { status: 404 });
        if (!current.seller_id) {
          return Response.json(
            { error: "This is a platform product, not an author submission" },
            { status: 409 },
          );
        }

        const from = reviewState(
          String(current.moderation_status ?? "draft"),
          String(current.content_status ?? ""),
        );
        const allowed = REVIEW_TRANSITIONS[from] ?? [];
        if (!allowed.includes(decision)) {
          return Response.json(
            { error: `A product that is "${from}" cannot be moved to "${decision}"`, allowed },
            { status: 409 },
          );
        }

        const effect = EFFECTS[decision];
        const patch: Record<string, unknown> = {
          moderation_status: effect.moderation,
          content_status: effect.content,
          updated_at: new Date().toISOString(),
        };
        if (effect.visible !== undefined) patch.visible = effect.visible;
        if (effect.approved) {
          patch.approved_at = new Date().toISOString();
          if (body.reviewerId) patch.approved_by = body.reviewerId;
        }

        const patched = await rest(`marketplace_products?id=eq.${encodeURIComponent(productId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(patch),
        });
        if (!patched.ok) {
          const detail = await patched.text();
          console.error("[author review] patch failed", patched.status, detail.slice(0, 300));
          return Response.json({ error: "Could not record the decision" }, { status: 502 });
        }

        // Tell the author. A decision they never hear about is not a decision.
        await rest("notifications", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            title: `Your product "${current.name}" is now ${decision.replace(/_/g, " ")}`,
            body: String(body.reason ?? "").trim() || null,
            kind: "author_review",
          }),
        }).catch(() => undefined);

        const rows = (await patched.json()) as unknown[];
        return Response.json({ ok: true, productId, from, to: decision, product: rows[0] });
      },
    },
  },
});
