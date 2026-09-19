import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BadgePercent, Loader2, Receipt, Search } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { listMarketplaceOrders } from "@/lib/marketplace-commerce.functions";
import { useServerFn } from "@/lib/serverFn";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Reseller pricing, from the server only.
 *
 * The reseller discount is the profit_percent of the plan of an active,
 * unexpired membership (reseller_pricing_for in the database). This screen
 * shows that standing, the plans as the database defines them, a quote for any
 * product (/api/partner/quote), and the reseller's own orders with the
 * discount checkout actually recorded. Nothing here computes a price.
 */

type Props = { onBack: () => void };

type Standing = {
  partner: { kind: string; plan: string | null; eligible: boolean; state: string } | null;
  reseller_plans: { id: string; label: string; joiningFeeUsd: number; discount: number }[];
};

type Quote = {
  product?: { id: string; slug: string; name: string };
  listPriceUsd?: number;
  discountLabel?: string;
  savingUsd?: number;
  finalPriceUsd?: number;
  reason?: string;
  planName?: string | null;
  currency?: string;
  error?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: await authHeaders() });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok && !body.error) throw new Error(`HTTP ${response.status}`);
  return body;
}

const money = (currency: string | undefined, value: number | string | undefined) =>
  `${currency ?? "USD"} ${Number(value ?? 0).toFixed(2)}`;

export function ResellerPricingWorkspace({ onBack }: Props) {
  const { t } = useTranslation();
  const listOrders = useServerFn(listMarketplaceOrders);
  const [product, setProduct] = useState("");
  const [asked, setAsked] = useState("");

  const standing = useQuery({
    queryKey: ["reseller-pricing", "standing"],
    queryFn: () => getJson<Standing>("/api/partner/quote"),
  });
  const quote = useQuery({
    queryKey: ["reseller-pricing", "quote", asked],
    enabled: Boolean(asked),
    queryFn: () => getJson<Quote>(`/api/partner/quote?product=${encodeURIComponent(asked)}`),
  });
  const orders = useQuery({
    queryKey: ["reseller-pricing", "orders"],
    queryFn: () =>
      listOrders() as Promise<
        {
          id: string;
          order_number: string;
          status: string;
          currency: string;
          subtotal: number;
          discount_total: number;
          total: number;
          created_at: string;
        }[]
      >,
  });

  const partner = standing.data?.partner;
  const plans = standing.data?.reseller_plans ?? [];
  const active = partner?.kind === "reseller" && partner.eligible;

  return (
    <div className="space-y-5" data-reseller-pricing>
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm hover:bg-card"
        >
          <ArrowLeft className="h-4 w-4" /> {t("reseller.pricing.back")}
        </button>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("reseller.pricing.eyebrow")}
          </div>
          <h1 className="text-xl font-semibold md:text-2xl">{t("reseller.pricing.title")}</h1>
        </div>
      </div>

      <section
        className="rounded-xl border border-border bg-card/40 p-5"
        data-pricing-standing={active ? "active" : "inactive"}
      >
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <BadgePercent className="h-4 w-4 text-primary" /> {t("reseller.pricing.standing")}
        </h2>
        {standing.isLoading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("reseller.pricing.loading")}
          </p>
        ) : standing.error ? (
          <p className="mt-2 text-sm text-destructive">{(standing.error as Error).message}</p>
        ) : active ? (
          <p className="mt-2 text-sm" data-pricing-plan={partner?.plan ?? ""}>
            {t("reseller.pricing.active", {
              plan: plans.find((p) => p.id === partner?.plan)?.label ?? partner?.plan ?? "",
              percent: Math.round((plans.find((p) => p.id === partner?.plan)?.discount ?? 0) * 100),
            })}
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-300">{t("reseller.pricing.inactive")}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{t("reseller.pricing.rule")}</p>
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="text-base font-semibold">{t("reseller.pricing.plans")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              data-pricing-plan-row={p.id}
              className={`rounded-lg border p-3 ${partner?.plan === p.id && active ? "border-primary" : "border-border"}`}
            >
              <p className="font-semibold">{p.label}</p>
              <p className="text-2xl font-bold">{Math.round(p.discount * 100)}%</p>
              <p className="text-xs text-muted-foreground">
                {t("reseller.pricing.plan_fee", { fee: money("USD", p.joiningFeeUsd) })}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="text-base font-semibold">{t("reseller.pricing.quote_title")}</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setAsked(product.trim());
          }}
        >
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder={t("reseller.pricing.quote_placeholder")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              data-quote-input
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            data-quote-submit
          >
            {t("reseller.pricing.quote_button")}
          </button>
        </form>
        {asked && (
          <div className="mt-3 text-sm" data-quote-result>
            {quote.isLoading ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("reseller.pricing.loading")}
              </p>
            ) : quote.data?.error || quote.error ? (
              <p className="text-destructive">
                {quote.data?.error ?? (quote.error as Error).message}
              </p>
            ) : quote.data ? (
              <dl className="space-y-1" data-quote-final={quote.data.finalPriceUsd}>
                <div className="flex justify-between">
                  <dt>{quote.data.product?.name}</dt>
                  <dd />
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>{t("reseller.pricing.list_price")}</dt>
                  <dd data-quote-list>{money(quote.data.currency, quote.data.listPriceUsd)}</dd>
                </div>
                <div className="flex justify-between text-emerald-300">
                  <dt>
                    {t("reseller.pricing.discount", { percent: quote.data.discountLabel ?? "0%" })}
                  </dt>
                  <dd>−{money(quote.data.currency, quote.data.savingUsd)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1 font-semibold">
                  <dt>{t("reseller.pricing.you_pay")}</dt>
                  <dd>{money(quote.data.currency, quote.data.finalPriceUsd)}</dd>
                </div>
                <p className="text-xs text-muted-foreground" data-quote-reason={quote.data.reason}>
                  {quote.data.reason === "active_membership"
                    ? t("reseller.pricing.reason_active", { plan: quote.data.planName ?? "" })
                    : quote.data.reason === "no_active_membership"
                      ? t("reseller.pricing.reason_no_membership")
                      : quote.data.reason === "reseller_not_active"
                        ? t("reseller.pricing.reason_not_active")
                        : quote.data.reason}
                </p>
              </dl>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Receipt className="h-4 w-4 text-primary" /> {t("reseller.pricing.orders")}
        </h2>
        {orders.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("reseller.pricing.loading")}</p>
        ) : (orders.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("reseller.pricing.no_orders")}{" "}
            <Link to="/marketplace" className="text-primary hover:underline">
              {t("reseller.pricing.browse")}
            </Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {(orders.data ?? []).map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
                data-reseller-order={o.order_number}
              >
                <span className="font-mono text-xs">{o.order_number}</span>
                <span className="text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString()}
                </span>
                <span>{money(o.currency, o.subtotal)}</span>
                <span className="text-emerald-300">−{money(o.currency, o.discount_total)}</span>
                <span className="font-semibold">{money(o.currency, o.total)}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {o.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
