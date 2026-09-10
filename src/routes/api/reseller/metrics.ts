import { createFileRoute } from "@tanstack/react-router";

import { requireReseller, rest } from "@/lib/reseller/core";

type CommissionRow = {
  gross_amount: number | string | null;
  commission_amount: number | string | null;
  status: string;
  created_at: string;
};

type LicenseRow = {
  status: string | null;
  issued_at: string | null;
  revoked_at: string | null;
};

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const money = (value: number): number => Math.round(value * 100) / 100;

export const Route = createFileRoute("/api/reseller/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireReseller(request, { allowPending: true });
        if (!gate.ok) return gate.response;
        const resellerId = gate.reseller.id;

        const [codesResponse, sessionsResponse, attributionsResponse, commissionsResponse, payoutsResponse, licensesResponse] =
          await Promise.all([
            rest(
              `marketplace_referral_codes?select=id,code,active,created_at` +
                `&reseller_id=eq.${encodeURIComponent(resellerId)}&limit=500`,
            ),
            rest(
              `marketplace_referral_sessions?select=id,converted_order_id,first_seen_at` +
                `&reseller_id=eq.${encodeURIComponent(resellerId)}&limit=2000`,
            ),
            rest(
              `marketplace_order_attributions?select=id,order_id,created_at` +
                `&reseller_id=eq.${encodeURIComponent(resellerId)}&limit=2000`,
            ),
            rest(
              `reseller_commissions?select=gross_amount,commission_amount,status,created_at` +
                `&reseller_id=eq.${encodeURIComponent(resellerId)}&limit=2000`,
            ),
            rest(
              `reseller_payouts?select=amount,status,created_at` +
                `&reseller_id=eq.${encodeURIComponent(resellerId)}&limit=1000`,
            ),
            rest(
              `licenses?select=status,issued_at,revoked_at` +
                `&reseller_id=eq.${encodeURIComponent(resellerId)}&limit=2000`,
            ),
          ]);

        const codes = codesResponse.ok ? ((await codesResponse.json()) as unknown[]) : [];
        const sessions = sessionsResponse.ok
          ? ((await sessionsResponse.json()) as { converted_order_id: string | null }[])
          : [];
        const attributions = attributionsResponse.ok ? ((await attributionsResponse.json()) as unknown[]) : [];
        const commissions = commissionsResponse.ok ? ((await commissionsResponse.json()) as CommissionRow[]) : [];
        const payouts = payoutsResponse.ok
          ? ((await payoutsResponse.json()) as { amount: number | string | null; status: string }[])
          : [];
        const licenses = licensesResponse.ok ? ((await licensesResponse.json()) as LicenseRow[]) : [];

        const activeCommissions = commissions.filter((row) => row.status !== "reversed");
        const availableCommission = activeCommissions
          .filter((row) => row.status === "available")
          .reduce((sum, row) => sum + num(row.commission_amount), 0);
        const pendingCommission = activeCommissions
          .filter((row) => row.status === "pending")
          .reduce((sum, row) => sum + num(row.commission_amount), 0);
        const paidCommission = activeCommissions
          .filter((row) => row.status === "paid")
          .reduce((sum, row) => sum + num(row.commission_amount), 0);
        const pendingPayout = payouts
          .filter((row) => ["pending", "approved", "processing"].includes(row.status))
          .reduce((sum, row) => sum + num(row.amount), 0);

        const metrics: Record<string, number | null> = {
          clients: null,
          licenses: licenses.filter((row) => String(row.status ?? "").toLowerCase() === "active").length,
          "trial-clients": null,
          "expired-licenses": licenses.filter((row) =>
            ["expired", "revoked", "suspended"].includes(String(row.status ?? "").toLowerCase()),
          ).length,
          leads: sessions.filter((row) => !row.converted_order_id).length,
          "leads-won": sessions.filter((row) => row.converted_order_id).length,
          "leads-lost": null,
          "leads-pending": sessions.filter((row) => !row.converted_order_id).length,
          commissions: money(activeCommissions.reduce((sum, row) => sum + num(row.commission_amount), 0)),
          "payout-pending": money(pendingPayout),
          revenue: money(activeCommissions.reduce((sum, row) => sum + num(row.gross_amount), 0)),
          renewals: null,
        };

        return Response.json({
          reseller: gate.reseller,
          metrics,
          summary: {
            referralLinks: codes.length,
            clicks: sessions.length,
            attributedOrders: attributions.length,
            commissionPending: money(pendingCommission),
            commissionAvailable: money(availableCommission),
            commissionPaid: money(paidCommission),
          },
          source: "supabase:reseller",
          generatedAt: new Date().toISOString(),
        });
      },
    },
  },
});
