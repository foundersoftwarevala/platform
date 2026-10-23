import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/use-translation";

import {
  createAffiliateLink,
  fetchAffiliateDashboard,
  submitAffiliatePayout,
  toggleAffiliateLink,
} from "@/lib/affiliate/client";
import type { AffiliateDashboardLink } from "@/lib/affiliate/contracts";

const dashboardKey = ["affiliate-dashboard"];

function money(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
}

export function AffiliateWorkspace({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: dashboardKey,
    queryFn: fetchAffiliateDashboard,
    staleTime: 30_000,
  });
  const dashboard = query.data;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const refresh = () => queryClient.invalidateQueries({ queryKey: dashboardKey });

  const createLink = async () => {
    setBusy(true);
    try {
      await createAffiliateLink();
      toast.success(t("affiliate.referral_link_created"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("affiliate.create_link_failed"));
    } finally {
      setBusy(false);
    }
  };

  const changeLink = async (link: AffiliateDashboardLink) => {
    setBusy(true);
    try {
      await toggleAffiliateLink(link.id, !link.active);
      toast.success(
        link.active
          ? t("affiliate.referral_link_paused")
          : t("affiliate.referral_link_activated"),
      );
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("affiliate.update_link_failed"));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${origin}/?ref=${encodeURIComponent(code)}`);
      toast.success(t("affiliate.referral_link_copied"));
    } catch {
      toast.error(t("affiliate.copy_failed_manual"));
    }
  };

  const requestPayout = async (amount: number, currency: string) => {
    setBusy(true);
    try {
      await submitAffiliatePayout(amount, currency);
      toast.success(t("affiliate.payout_request_submitted"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("affiliate.submit_payout_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {onBack && (
            <button type="button" onClick={onBack} className="mb-2 text-xs text-muted-foreground hover:text-foreground">
              {t("affiliate.back_to_dashboard")}
            </button>
          )}
          <h2 className="text-xl font-semibold">{t("affiliate.performance")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("affiliate.attribution_window", { days: dashboard?.attributionWindowDays ?? 60 })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void createLink()}
          disabled={busy || query.isLoading || query.isError}
          className="press-3d inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> {t("affiliate.new_referral_link")}
        </button>
      </header>

      {query.isLoading && <p role="status" className="text-sm text-muted-foreground">{t("affiliate.loading_records")}</p>}
      {query.isError && <p role="alert" className="text-sm text-destructive">{query.error.message}</p>}
      {dashboard && (
        <>
          <section aria-label={t("affiliate.referral_links_label")} className="space-y-3">
            <h3 className="font-medium">{t("affiliate.referral_links")}</h3>
            {dashboard.links.length === 0 ? (
              <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                {t("affiliate.no_referral_links")}
              </p>
            ) : (
              <ul className="space-y-2">
                {dashboard.links.map((link) => (
                  <li key={link.id} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-mono text-xs">
                          <span data-no-translate>{origin}/?ref={encodeURIComponent(link.code)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyLink(link.code)}
                          aria-label={t("affiliate.copy_referral_link", { code: link.code })}
                          className="press-3d inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs"
                        >
                          <Copy className="h-3.5 w-3.5" /> {t("affiliate.copy")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void changeLink(link)}
                          disabled={busy}
                          className="press-3d rounded-lg border border-border px-2 py-1 text-xs disabled:opacity-50"
                        >
                          {link.active ? t("affiliate.pause") : t("affiliate.activate")}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{link.active ? t("affiliate.active") : t("affiliate.paused")}</span>
                      <span>{t("affiliate.clicks", { count: link.clicks })}</span>
                      <span>{t("affiliate.visitors", { count: link.visitors })}</span>
                      <span>{t("affiliate.attributed_orders", { count: link.conversions })}</span>
                      <span>{t("affiliate.created", { date: new Date(link.created_at).toLocaleDateString() })}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label={t("affiliate.earnings_payouts_label")} className="space-y-3">
            <h3 className="font-medium">{t("affiliate.earnings_payouts")}</h3>
            {dashboard.earnings.length === 0 ? (
              <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                {t("affiliate.no_commissions")}
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {dashboard.earnings.map((earning) => (
                  <li key={earning.currency} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-center gap-2 font-medium">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      {earning.currency}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div><dt className="text-muted-foreground">{t("affiliate.recorded")}</dt><dd>{money(earning.earned, earning.currency)}</dd></div>
                      <div><dt className="text-muted-foreground">{t("affiliate.pending_review")}</dt><dd>{money(earning.pending, earning.currency)}</dd></div>
                      <div><dt className="text-muted-foreground">{t("affiliate.available")}</dt><dd>{money(earning.available, earning.currency)}</dd></div>
                      <div><dt className="text-muted-foreground">{t("affiliate.paid")}</dt><dd>{money(earning.paid, earning.currency)}</dd></div>
                    </dl>
                    <button
                      type="button"
                      onClick={() => void requestPayout(earning.available, earning.currency)}
                      disabled={busy || earning.available <= 0}
                      className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("affiliate.request_available_balance")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label={t("affiliate.recent_commission_records_label")} className="space-y-3">
            <h3 className="font-medium">{t("affiliate.recent_commission_records")}</h3>
            {dashboard.commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("affiliate.no_commission_entries")}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface text-muted-foreground">
                    <tr>
                      <th className="p-3 font-medium">{t("affiliate.earned")}</th>
                      <th className="p-3 font-medium">{t("affiliate.order")}</th>
                      <th className="p-3 font-medium">{t("affiliate.amount")}</th>
                      <th className="p-3 font-medium">{t("affiliate.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.commissions.map((commission) => (
                      <tr key={commission.id} className="border-t border-border">
                        <td className="p-3">{new Date(commission.earned_at).toLocaleDateString()}</td>
                        <td className="p-3 font-mono">{commission.order_id ?? t("affiliate.unavailable")}</td>
                        <td className="p-3">{money(commission.commission_amount, commission.currency)}</td>
                        <td className="p-3 capitalize">{commission.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-label={t("affiliate.payout_history_label")} className="space-y-3">
            <h3 className="font-medium">{t("affiliate.payout_history")}</h3>
            {dashboard.payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("affiliate.no_payout_requests")}</p>
            ) : (
              <ul className="space-y-2">
                {dashboard.payouts.map((payout) => (
                  <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                    <span>{money(payout.amount, payout.currency)}</span>
                    <span className="capitalize text-muted-foreground">{payout.status}</span>
                    <time dateTime={payout.requested_at}>{new Date(payout.requested_at).toLocaleDateString()}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
