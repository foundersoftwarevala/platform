import { requireJson, type Json } from "@/lib/json";
import { affiliateDashboardSchema, type AffiliateDashboard } from "@/lib/affiliate/contracts";
import { rest } from "@/lib/affiliate/core";

function publicKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    ""
  ).trim();
}

function supabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
}

async function affiliateRpc(
  token: string,
  fn: string,
  args: Record<string, Json>,
): Promise<Json> {
  const url = supabaseUrl();
  const key = publicKey();
  if (!url || !key) throw new Error("Affiliate data service is not configured");

  const response = await fetch(`${url}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Affiliate request failed (${response.status})`;
    throw new Error(message);
  }
  return requireJson(payload, `Affiliate RPC ${fn}`);
}

export async function getAffiliateDashboard(token: string): Promise<AffiliateDashboard> {
  const payload = await affiliateRpc(token, "affiliate_dashboard_summary", {});
  return affiliateDashboardSchema.parse(payload);
}

export async function requestAffiliatePayout(
  token: string,
  amount: number,
  currency: string,
): Promise<Json> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid positive payout amount");
  }
  const normalizedCurrency = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new Error("Enter a valid three-letter payout currency");
  }

  return affiliateRpc(token, "request_affiliate_payout", {
    p_amount: amount,
    p_currency: normalizedCurrency,
  });
}

export function affiliateAttributionAllowed(affiliateUserId: string, buyerId: string): boolean {
  return affiliateUserId !== buyerId;
}

export async function isAffiliateSelfReferral(
  affiliatePartnerId: string,
  buyerId: string,
): Promise<boolean> {
  const response = await rest(
    `marketplace_affiliate_partners?select=user_id&id=eq.${encodeURIComponent(affiliatePartnerId)}&limit=2`,
  );
  if (!response.ok) throw new Error("Could not verify affiliate ownership");
  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new Error("Affiliate ownership could not be verified");
  }
  const row: unknown = payload[0];
  if (typeof row !== "object" || row === null || !("user_id" in row) || typeof row.user_id !== "string") {
    throw new Error("Affiliate ownership record is invalid");
  }
  return !affiliateAttributionAllowed(row.user_id, buyerId);
}
