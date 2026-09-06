import { createFileRoute } from "@tanstack/react-router";

import { requireAuthor, rest } from "@/lib/marketplace/author-guard";

/**
 * What this author has actually earned.
 *
 * Every figure is derived from `marketplace_commissions` rows written by the
 * settlement engine after a verified payment — nothing is computed in the
 * browser, nothing is seeded, and an author with no sales gets zeroes rather
 * than an invented number.
 *
 * The shape mirrors how the money really moves:
 *   gross          what customers paid for this author's products
 *   platformFee    Software Vala's share, per the commission rules
 *   earned         the author's share of settled, non-reversed sales
 *   pending        earned but not yet approved for payout
 *   reversed       clawed back after a refund
 *   paidOut        already sent, from marketplace_payouts
 *   available      earned minus reversed minus paid out
 */

type CommissionRow = {
  id: string;
  order_item_id: string;
  gross_amount: number | string | null;
  commission_amount: number | string | null;
  seller_amount: number | string | null;
  status: string;
  created_at: string;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number): number => Math.round(n * 100) / 100;

export const Route = createFileRoute("/api/author/earnings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireAuthor(request, { allowPending: true });
        if (!gate.ok) return gate.response;
        const sellerId = gate.seller.id;

        const [commissionsResponse, payoutsResponse, productsResponse] = await Promise.all([
          rest(
            `marketplace_commissions?select=id,order_item_id,gross_amount,commission_amount,seller_amount,status,created_at` +
              `&seller_id=eq.${encodeURIComponent(sellerId)}&order=created_at.desc&limit=1000`,
          ),
          rest(
            `marketplace_payouts?select=id,amount,currency,status,created_at,provider_reference` +
              `&seller_id=eq.${encodeURIComponent(sellerId)}&order=created_at.desc&limit=200`,
          ),
          rest(
            `marketplace_products?select=id&seller_id=eq.${encodeURIComponent(sellerId)}&limit=1000`,
          ),
        ]);

        if (!commissionsResponse.ok) {
          return Response.json({ error: "Could not read your earnings" }, { status: 502 });
        }

        const commissions = (await commissionsResponse.json()) as CommissionRow[];
        const payouts = payoutsResponse.ok
          ? ((await payoutsResponse.json()) as { amount: number | string; status: string }[])
          : [];
        const productCount = productsResponse.ok
          ? ((await productsResponse.json()) as unknown[]).length
          : 0;

        const live = commissions.filter((c) => c.status !== "reversed");
        const reversedRows = commissions.filter((c) => c.status === "reversed");

        const gross = money(live.reduce((sum, c) => sum + num(c.gross_amount), 0));
        const platformFee = money(live.reduce((sum, c) => sum + num(c.commission_amount), 0));
        const earned = money(live.reduce((sum, c) => sum + num(c.seller_amount), 0));
        const pending = money(
          live.filter((c) => c.status === "pending").reduce((sum, c) => sum + num(c.seller_amount), 0),
        );
        const approved = money(
          live.filter((c) => c.status === "approved" || c.status === "payable")
            .reduce((sum, c) => sum + num(c.seller_amount), 0),
        );
        const reversed = money(reversedRows.reduce((sum, c) => sum + num(c.seller_amount), 0));
        const paidOut = money(
          payouts.filter((p) => p.status === "paid" || p.status === "completed")
            .reduce((sum, p) => sum + num(p.amount), 0),
        );
        const pendingPayout = money(
          payouts.filter((p) => p.status === "pending" || p.status === "processing")
            .reduce((sum, p) => sum + num(p.amount), 0),
        );

        return Response.json({
          seller: {
            id: sellerId,
            display_name: gate.seller.display_name,
            status: gate.seller.status,
            currency: gate.seller.payout_currency ?? "USD",
          },
          totals: {
            products: productCount,
            sales: live.length,
            refunded: reversedRows.length,
            gross,
            platformFee,
            earned,
            pending,
            approved,
            reversed,
            paidOut,
            pendingPayout,
            available: money(earned - paidOut - pendingPayout),
          },
          // The rows behind the totals, so the dashboard can show its working.
          commissions: commissions.slice(0, 100),
          payouts,
        });
      },
    },
  },
});
