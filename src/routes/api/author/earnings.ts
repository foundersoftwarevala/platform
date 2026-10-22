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
  payout_id: string | null;
  status: string;
  created_at: string;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number): number => Math.round(n * 100) / 100;
const PAGE_SIZE = 1000;

async function readAllRows<T extends Record<string, unknown>>(path: string): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const response = await rest(`${path}&order=id.asc`, {
      headers: {
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
        Prefer: "count=exact",
      },
    });
    if (!response.ok) {
      throw new Error(`Marketplace earnings data could not be read (${response.status})`);
    }

    const total = Number(response.headers.get("content-range")?.split("/")[1]);
    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error("Marketplace earnings data returned no exact row count");
    }

    const page: unknown = await response.json();
    if (!Array.isArray(page)) {
      throw new Error("Marketplace earnings data returned an invalid row set");
    }
    rows.push(...(page as T[]));

    if (rows.length >= total) return rows;
    if (page.length === 0) {
      throw new Error("Marketplace earnings data returned an incomplete row set");
    }
    offset += page.length;
  }
}

export const Route = createFileRoute("/api/author/earnings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireAuthor(request, { allowPending: true });
        if (!gate.ok) return gate.response;
        const sellerId = gate.seller.id;

        try {
          const sellerFilter = `seller_id=eq.${encodeURIComponent(sellerId)}`;
          const [commissions, payouts, products] = await Promise.all([
            readAllRows<CommissionRow & Record<string, unknown>>(
              `marketplace_commissions?select=id,order_item_id,gross_amount,commission_amount,seller_amount,payout_id,status,created_at&${sellerFilter}`,
            ),
            readAllRows<{
              id: string;
              amount: number | string;
              status: string;
              created_at: string;
            }>(
              `marketplace_payouts?select=id,amount,status,created_at,provider_reference&${sellerFilter}`,
            ),
            readAllRows<{ id: string }>(
              `marketplace_products?select=id&${sellerFilter}&deleted_at=is.null`,
            ),
          ]);

          const live = commissions.filter((c) => c.status !== "reversed");
          const reversedRows = commissions.filter((c) => c.status === "reversed");

          const gross = money(live.reduce((sum, c) => sum + num(c.gross_amount), 0));
          const platformFee = money(live.reduce((sum, c) => sum + num(c.commission_amount), 0));
          const earned = money(live.reduce((sum, c) => sum + num(c.seller_amount), 0));
          const pending = money(
            live
              .filter((c) => c.status === "pending")
              .reduce((sum, c) => sum + num(c.seller_amount), 0),
          );
          const availableCommissions = live.filter((c) => c.status === "available" && !c.payout_id);
          const approved = money(
            availableCommissions.reduce((sum, c) => sum + num(c.seller_amount), 0),
          );
          const reversed = money(reversedRows.reduce((sum, c) => sum + num(c.seller_amount), 0));
          const paidOut = money(
            payouts
              .filter((p) => p.status === "paid" || p.status === "completed")
              .reduce((sum, p) => sum + num(p.amount), 0),
          );
          const pendingPayout = money(
            payouts
              .filter((p) => ["pending", "approved", "processing"].includes(p.status))
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
              products: products.length,
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
              available: money(
                availableCommissions.reduce((sum, c) => sum + num(c.seller_amount), 0),
              ),
            },
            // The rows behind the totals, so the dashboard can show its working.
            commissions: commissions
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 100),
            payouts: payouts.sort((a, b) => b.created_at.localeCompare(a.created_at)),
          });
        } catch (error) {
          console.error("[author earnings] read failed", error);
          return Response.json({ error: "Could not read your earnings" }, { status: 502 });
        }
      },
    },
  },
});
