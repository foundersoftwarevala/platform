import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { rest } from "@/lib/marketplace/author-guard";
import { AGREED_PLATFORM_RATE, rateForAgreement } from "@/lib/commerce/commission-rates";

/**
 * Operator administration for the people who sell on the marketplace.
 *
 * Vendors and authors are the same record underneath — `marketplace_sellers` —
 * so one console administers both. This is what the Vendor Manager was missing:
 * there was no route, no console and no way to approve a seller at all.
 *
 * Approving a seller does one thing beyond flipping a status: it attaches the
 * commission rule for the agreement they signed. The Vendor Marketplace
 * Agreement promises 15%; the Author Publishing Agreement is a 70/30 split.
 * Without a rule per seller, the engine would apply one rate to both and
 * silently break one of the two contracts.
 *
 *   GET  /api/internal/seller-admin              -> every seller, with counts
 *   POST /api/internal/seller-admin
 *        {sellerId, decision: approved|suspended|pending, agreement?}
 */

const SELLER_FIELDS =
  "id,display_name,slug,status,owner_user_id,payout_currency,payout_metadata," +
  "approved_at,approved_by,created_at,updated_at";

export const Route = createFileRoute("/api/internal/seller-admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const filter = status ? `&status=eq.${encodeURIComponent(status)}` : "";

        const response = await rest(
          `marketplace_sellers?select=${SELLER_FIELDS}${filter}&order=created_at.desc&limit=500`,
        );
        if (!response.ok) {
          return Response.json({ error: "Could not read the seller directory" }, { status: 502 });
        }
        const sellers = (await response.json()) as { id: string }[];

        // Attach what each seller actually has, so the console shows real
        // counts rather than a directory of names with nothing behind them.
        const enriched = await Promise.all(
          sellers.map(async (seller) => {
            const [products, commissions, rules] = await Promise.all([
              rest(`marketplace_products?select=id,visible&seller_id=eq.${encodeURIComponent(seller.id)}&limit=1000`),
              rest(`marketplace_commissions?select=seller_amount,status&seller_id=eq.${encodeURIComponent(seller.id)}&limit=1000`),
              rest(`marketplace_commission_rules?select=rate_percent,fixed_amount,active&seller_id=eq.${encodeURIComponent(seller.id)}&limit=10`),
            ]);
            const productRows = products.ok ? ((await products.json()) as { visible: boolean }[]) : [];
            const commissionRows = commissions.ok
              ? ((await commissions.json()) as { seller_amount: number | string; status: string }[])
              : [];
            const ruleRows = rules.ok
              ? ((await rules.json()) as { rate_percent: number | null; active: boolean | null }[])
              : [];
            const live = commissionRows.filter((c) => c.status !== "reversed");
            return {
              ...seller,
              counts: {
                products: productRows.length,
                published: productRows.filter((p) => p.visible).length,
                sales: live.length,
                earned: Math.round(live.reduce((s, c) => s + Number(c.seller_amount ?? 0), 0) * 100) / 100,
              },
              commissionRate: ruleRows.find((r) => r.active)?.rate_percent ?? null,
            };
          }),
        );

        return Response.json({
          count: enriched.length,
          sellers: enriched,
          agreedRates: AGREED_PLATFORM_RATE,
        });
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { sellerId?: string; decision?: string; agreement?: string; reviewerId?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const sellerId = String(body.sellerId ?? "").trim();
        const decision = String(body.decision ?? "").trim();
        if (!sellerId) return Response.json({ error: "sellerId is required" }, { status: 400 });
        if (!["approved", "suspended", "pending"].includes(decision)) {
          return Response.json(
            { error: "decision must be approved, suspended or pending" },
            { status: 400 },
          );
        }

        const currentResponse = await rest(
          `marketplace_sellers?select=id,status,display_name&id=eq.${encodeURIComponent(sellerId)}&limit=1`,
        );
        const current = ((await currentResponse.json()) as { status: string; display_name: string }[])[0];
        if (!current) return Response.json({ error: "No such seller" }, { status: 404 });

        const patch: Record<string, unknown> = {
          status: decision,
          updated_at: new Date().toISOString(),
        };
        if (decision === "approved") {
          patch.approved_at = new Date().toISOString();
          if (body.reviewerId) patch.approved_by = body.reviewerId;
        }

        const patched = await rest(`marketplace_sellers?id=eq.${encodeURIComponent(sellerId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(patch),
        });
        if (!patched.ok) {
          return Response.json({ error: "Could not update the seller" }, { status: 502 });
        }

        // On approval, make sure the seller carries the rate their agreement
        // promised. Without this the engine falls back to a single rate and one
        // of the two contracts is broken on every sale.
        let ruleApplied: number | null = null;
        if (decision === "approved") {
          const rate = rateForAgreement(body.agreement);
          const existing = await rest(
            `marketplace_commission_rules?select=id&seller_id=eq.${encodeURIComponent(sellerId)}` +
              `&product_id=is.null&category_id=is.null&limit=1`,
          );
          const rows = existing.ok ? ((await existing.json()) as { id: string }[]) : [];
          if (rows.length) {
            await rest(`marketplace_commission_rules?id=eq.${encodeURIComponent(rows[0].id)}`, {
              method: "PATCH",
              headers: { Prefer: "return=minimal" },
              body: JSON.stringify({ rate_percent: rate, active: true }),
            });
          } else {
            await rest("marketplace_commission_rules", {
              method: "POST",
              headers: { Prefer: "return=minimal" },
              body: JSON.stringify({
                seller_id: sellerId, rate_percent: rate, priority: 50,
                active: true, currency: "USD",
              }),
            });
          }
          ruleApplied = rate;
        }

        const rows = (await patched.json()) as unknown[];
        return Response.json({
          ok: true,
          sellerId,
          from: current.status,
          to: decision,
          commissionRate: ruleApplied,
          seller: rows[0],
        });
      },
    },
  },
});
