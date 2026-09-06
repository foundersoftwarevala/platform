/**
 * The platform commission rates Software Vala has actually committed to.
 *
 * These are not preferences — each one is quoted in the agreement a partner
 * accepts when they apply, in `lib/applications/config.ts`:
 *
 *   Vendor   "Vendor Marketplace Agreement — 12 month term, 15% platform
 *             commission, 7 day dispatch SLA…"
 *   Author   "Author Publishing Agreement — 70/30 royalty split…"  (30% platform)
 *
 * The settlement engine previously fell back to a single hard-coded 30% for
 * everyone, which silently overcharged every vendor by fifteen points against a
 * signed agreement. There is no one house rate: the rate depends on which
 * agreement the seller signed, so it is attached to the seller as a commission
 * rule when their account is approved, and the engine reads that rule.
 *
 * The fallback below is used only when a seller somehow has no rule at all. It
 * is deliberately the *lower* of the two, because undercharging the platform is
 * a recoverable bookkeeping error while overcharging a partner against a signed
 * agreement is a breach.
 */

export type PartnerAgreement = "vendor" | "author" | "reseller" | "affiliate" | "franchise";

/** Platform share, as a percentage of the gross sale. */
export const AGREED_PLATFORM_RATE: Record<PartnerAgreement, number> = {
  vendor: 15,     // "15% platform commission"
  author: 30,     // "70/30 royalty split"
  reseller: 30,   // "up to 30% margin" — the reseller keeps up to 30
  affiliate: 25,  // "10-25% commission" — the affiliate earns up to 25
  franchise: 12,  // "revenue share of 12%"
};

/**
 * Used only when a seller has no commission rule of their own. See the note
 * above on why this is the lower rate rather than the higher one.
 */
export const FALLBACK_PLATFORM_RATE = AGREED_PLATFORM_RATE.vendor;

export function rateForAgreement(agreement: string | null | undefined): number {
  if (!agreement) return FALLBACK_PLATFORM_RATE;
  const key = agreement.trim().toLowerCase() as PartnerAgreement;
  return AGREED_PLATFORM_RATE[key] ?? FALLBACK_PLATFORM_RATE;
}
