import {
  attributionForSession,
  readCookie,
  rest,
  REFERRAL_COOKIE,
  type ResolvedAttribution,
} from "@/lib/affiliate/core";

export type ResellerPaymentPricing = {
  eligible: boolean;
  percent: number;
  reseller_id: string | null;
  membership_id?: string;
  plan_code?: string;
  plan_name?: string;
  starts_at?: string;
  expires_at?: string;
  reason: string;
};

export async function referralAttributionForRequest(
  request: Request,
): Promise<ResolvedAttribution | null> {
  const sessionKey = readCookie(request, REFERRAL_COOKIE);
  return sessionKey ? attributionForSession(sessionKey) : null;
}

export async function resellerPricingForReferral(
  resellerId: string | null,
  buyerId: string,
): Promise<ResellerPaymentPricing> {
  if (!resellerId) {
    return { eligible: false, percent: 0, reseller_id: null, reason: "no_reseller_referral" };
  }
  const response = await rest("rpc/reseller_discount_for_payment", {
    method: "POST",
    body: JSON.stringify({ p_reseller_id: resellerId, p_buyer_id: buyerId }),
  });
  if (!response.ok) {
    throw new Error(`Could not verify the referring reseller's plan (${response.status}).`);
  }
  const pricing = (await response.json()) as Partial<ResellerPaymentPricing>;
  const percent = Number(pricing.percent);
  if (
    typeof pricing.eligible !== "boolean" ||
    !Number.isFinite(percent) ||
    percent < 0 ||
    percent > 100 ||
    typeof pricing.reason !== "string"
  ) {
    throw new Error("The referring reseller's plan returned an invalid discount.");
  }
  return {
    eligible: pricing.eligible,
    percent: pricing.eligible ? percent : 0,
    reseller_id: pricing.reseller_id ?? null,
    ...(typeof pricing.membership_id === "string" ? { membership_id: pricing.membership_id } : {}),
    ...(typeof pricing.plan_code === "string" ? { plan_code: pricing.plan_code } : {}),
    ...(typeof pricing.plan_name === "string" ? { plan_name: pricing.plan_name } : {}),
    ...(typeof pricing.starts_at === "string" ? { starts_at: pricing.starts_at } : {}),
    ...(typeof pricing.expires_at === "string" ? { expires_at: pricing.expires_at } : {}),
    reason: pricing.reason,
  };
}
