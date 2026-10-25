import { createFileRoute } from "@tanstack/react-router";

import { AuthorBackendError, requireAuthor, rest } from "@/lib/marketplace/author-guard";

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

export const Route = createFileRoute("/api/author/earnings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireAuthor(request, { allowPending: true });
        if (!gate.ok) return gate.response;
        const sellerId = gate.seller.id;

        let summary: {
          product_count: number;
          sales: number;
          refunded: number;
          totals_by_currency: {
            currency: string;
            gross: number;
            platformFee: number;
            earned: number;
            pending: number;
            approved: number;
            reversed: number;
            paidOut: number;
            pendingPayout: number;
            available: number;
          }[];
          commissions: Record<string, unknown>[];
          payouts: Record<string, unknown>[];
          activities: Record<string, unknown>[];
        };
        try {
          const response = await rest("rpc/marketplace_author_earnings_summary", {
            method: "POST",
            body: JSON.stringify({ p_seller_id: sellerId }),
          });
          if (!response.ok) {
            throw new AuthorBackendError("Author earnings aggregation", response.status);
          }
          const data: unknown = await response.json();
          if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new AuthorBackendError("Author earnings aggregation response");
          }
          summary = data as typeof summary;
        } catch (error) {
          if (!(error instanceof AuthorBackendError)) throw error;
          console.error("[author earnings] source read failed", error.message);
          return Response.json({ error: "Could not read your earnings" }, { status: 502 });
        }
        const totalForCurrency = (field: keyof (typeof summary.totals_by_currency)[number]) =>
          summary.totals_by_currency.length > 1
            ? null
            : (summary.totals_by_currency[0]?.[field] ?? 0);

        return Response.json({
          seller: {
            id: sellerId,
            display_name: gate.seller.display_name,
            status: gate.seller.status,
            currency: gate.seller.payout_currency ?? "USD",
          },
          totals: {
            products: summary.product_count,
            sales: summary.sales,
            refunded: summary.refunded,
            gross: totalForCurrency("gross"),
            platformFee: totalForCurrency("platformFee"),
            earned: totalForCurrency("earned"),
            pending: totalForCurrency("pending"),
            approved: totalForCurrency("approved"),
            reversed: totalForCurrency("reversed"),
            paidOut: totalForCurrency("paidOut"),
            pendingPayout: totalForCurrency("pendingPayout"),
            available: totalForCurrency("available"),
          },
          totalsByCurrency: summary.totals_by_currency,
          revenueByCurrency: summary.totals_by_currency.map(({ currency, gross }) => ({
            currency,
            amount: gross,
          })),
          commissions: summary.commissions,
          payouts: summary.payouts,
          activities: summary.activities,
        });
      },
    },
  },
});
