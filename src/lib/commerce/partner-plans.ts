/**
 * What a partner pays, decided on the server.
 *
 * The plans below are the only definition of a price or a discount anywhere in
 * the system. Nothing about a partner's entitlement is ever taken from the
 * request: the tier is read from their own row in the database, and a discount
 * is applied only when that row is both active and approved. A reseller cannot
 * name their own tier, choose their own discount, or pay a price they invented
 * in the browser.
 *
 * Numbers are those the business set. Changing a price means changing this
 * file, and nowhere else.
 */

export type PartnerKind = "reseller" | "franchise";

export type Plan = {
  id: string;
  label: string;
  /** What joining the plan costs, in USD. */
  joiningFeeUsd: number;
  /** Share off an eligible product, as a fraction. */
  discount: number;
  /** Aliases seen in existing data, so old tier values still resolve. */
  aliases: string[];
  /** Franchise only. */
  leadAllowance?: number;
  territory?: string;
};

export const RESELLER_PLANS: Plan[] = [
  { id: "starter", label: "Starter", joiningFeeUsd: 99, discount: 0.20,
    aliases: ["bronze", "basic", "start"] },
  { id: "professional", label: "Professional", joiningFeeUsd: 249, discount: 0.30,
    aliases: ["silver", "pro", "professional"] },
  { id: "master", label: "Master", joiningFeeUsd: 499, discount: 0.40,
    aliases: ["gold", "platinum", "master"] },
];

export const FRANCHISE_PLANS: Plan[] = [
  { id: "city", label: "City / Local Partner", joiningFeeUsd: 5000, discount: 0.30,
    aliases: ["local", "city"], leadAllowance: 1000, territory: "City" },
  { id: "district", label: "District / Regional Partner", joiningFeeUsd: 10000, discount: 0.40,
    aliases: ["regional", "district"], leadAllowance: 2500, territory: "District" },
  { id: "division", label: "Division / Master Partner", joiningFeeUsd: 20000, discount: 0.60,
    aliases: ["master", "division"], leadAllowance: 5000, territory: "Division" },
];

/** What an influencer earns. Influencer membership itself is free. */
export const INFLUENCER_REWARDS = {
  qualifiedLeadInr: 10,
  convertedLeadInr: 1000,
  membershipFeeUsd: 0,
} as const;

export function plansFor(kind: PartnerKind): Plan[] {
  return kind === "reseller" ? RESELLER_PLANS : FRANCHISE_PLANS;
}

/**
 * Resolve whatever the database holds to a real plan.
 * An unrecognised tier earns no discount — it never falls through to the
 * most generous plan.
 */
export function resolvePlan(kind: PartnerKind, tier: unknown): Plan | null {
  const value = String(tier ?? "").trim().toLowerCase();
  if (!value) return null;
  return (
    plansFor(kind).find((p) => p.id === value || p.aliases.includes(value)) ?? null
  );
}

export type Quote = {
  listPriceUsd: number;
  discount: number;
  discountLabel: string;
  savingUsd: number;
  finalPriceUsd: number;
  plan: string | null;
  reason: string;
};

/** Round to whole cents so a quote and the charge can never disagree. */
function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The price this partner pays for a product.
 *
 * `eligible` is decided by the caller from the database — a partner row that is
 * active and approved. When it is false the list price stands, whatever tier
 * the row claims.
 */
export function quoteFor(
  listPriceUsd: number,
  plan: Plan | null,
  eligible: boolean,
): Quote {
  const list = cents(Math.max(0, listPriceUsd));
  if (!plan) {
    return {
      listPriceUsd: list, discount: 0, discountLabel: "0%", savingUsd: 0,
      finalPriceUsd: list, plan: null,
      reason: "No partner plan applies to this account.",
    };
  }
  if (!eligible) {
    return {
      listPriceUsd: list, discount: 0, discountLabel: "0%", savingUsd: 0,
      finalPriceUsd: list, plan: plan.id,
      reason: "This partner account is not active and approved, so list price applies.",
    };
  }
  const saving = cents(list * plan.discount);
  return {
    listPriceUsd: list,
    discount: plan.discount,
    discountLabel: `${Math.round(plan.discount * 100)}%`,
    savingUsd: saving,
    finalPriceUsd: cents(list - saving),
    plan: plan.id,
    reason: `${plan.label} — ${Math.round(plan.discount * 100)}% partner discount.`,
  };
}
