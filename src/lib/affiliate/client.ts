import { authHeaders } from "@/lib/auth/operator-fetch";
import { affiliateDashboardSchema, type AffiliateDashboard } from "@/lib/affiliate/contracts";

async function request(init: RequestInit = {}): Promise<unknown> {
  const response = await fetch("/api/affiliate/account", {
    ...init,
    headers: {
      ...(await authHeaders()),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Affiliate request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function fetchAffiliateDashboard(): Promise<AffiliateDashboard> {
  return affiliateDashboardSchema.parse(await request());
}

export async function createAffiliateLink(): Promise<void> {
  await request({ method: "POST", body: JSON.stringify({ action: "create-link" }) });
}

export async function toggleAffiliateLink(linkId: string, active: boolean): Promise<void> {
  await request({ method: "POST", body: JSON.stringify({ action: "toggle-link", linkId, active }) });
}

export async function submitAffiliatePayout(amount: number, currency: string): Promise<void> {
  await request({
    method: "POST",
    body: JSON.stringify({ action: "request-payout", amount, currency }),
  });
}
