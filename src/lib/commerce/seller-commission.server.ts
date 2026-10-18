import { rest } from "@/lib/marketplace/author-guard";
import { rateForAgreement } from "@/lib/commerce/commission-rates";

/**
 * The commission rule an approved seller carries: the rate their agreement
 * promised. The Vendor Marketplace Agreement promises 15%; the Author
 * Publishing Agreement is a 70/30 split. Without a rule per seller the engine
 * falls back to one rate and one of the two contracts is broken on every sale.
 *
 * Shared by the two places a seller can be approved - the Vendor Manager's
 * seller administration and the Control Panel's application decisions - so
 * both attach the same rule the same way. Returns the rate applied.
 */
export async function applySellerCommissionRule(
  sellerId: string,
  agreement: unknown,
): Promise<number> {
  const rate = rateForAgreement(typeof agreement === "string" ? agreement : null);
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
        seller_id: sellerId,
        rate_percent: rate,
        priority: 50,
        active: true,
        currency: "USD",
      }),
    });
  }
  return rate;
}
