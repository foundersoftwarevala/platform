import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Package, ShieldCheck } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import "@/styles/marketplace-home.css";
import { isMessageKey } from "@/lib/i18n/messages";
import { richText, useTranslation } from "@/lib/i18n/use-translation";

/**
 * What a customer has bought.
 *
 * Until now a buyer had nowhere to see their own licence — the key existed in
 * the database and was emailed, but the site never showed it back. This is that
 * page. It sends the customer's session to the server, which returns only the
 * orders and licences belonging to them.
 */

type Purchase = {
  id: string;
  order_no: string | null;
  product: string;
  status: string;
  amount: number;
  currency: string;
  gateway: string | null;
  placed: string;
  licence_key: string | null;
  licence_status: string | null;
  invoice_id: string | null;
  invoice_no: string | null;
};

const TONE: Record<string, string> = {
  paid: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  "awaiting payment": "border-amber-400/40 bg-amber-500/10 text-amber-300",
  failed: "border-rose-400/40 bg-rose-500/10 text-rose-300",
  cancelled: "border-white/15 bg-white/5 text-white/60",
};

function PurchasesPage() {
  const { t, formatCurrency, formatDate } = useTranslation();
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
        const supabaseUrl = env?.VITE_SUPABASE_URL ?? "";
        const publishable =
          env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? env?.VITE_SUPABASE_ANON_KEY ?? "";
        if (!supabaseUrl || !publishable) throw new Error("account.not_configured");

        const supabase = createClient(supabaseUrl, publishable);
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (!cancelled) {
            setError("signed-out");
            setPurchases([]);
          }
          return;
        }

        const response = await fetch("/api/account/purchases", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(payload?.error ?? "account.load_failed");
        setPurchases(payload.purchases ?? []);
      } catch (problem) {
        if (cancelled) return;
        setError(problem instanceof Error ? problem.message : "account.error");
        setPurchases([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard can be blocked; the key is on screen either way */
    }
  };

  return (
    <main className="min-h-screen bg-[#050b18] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
          {t("account.back")}
        </a>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{t("account.purchases.title")}</h1>
        <p className="mt-1.5 text-sm text-white/60">{t("account.purchases.intro")}</p>

        <div className="mt-8" aria-live="polite">
          {purchases === null ? (
            <p className="flex items-center gap-2 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("account.loading")}
            </p>
          ) : error === "signed-out" ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-white/30" aria-hidden="true" />
              <p className="mt-3 text-sm text-white/70">{t("account.signed_out")}</p>
              <a href="/login" className="mt-5 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900">
                {t("account.sign_in")}
              </a>
            </div>
          ) : error ? (
            <p className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center text-sm text-white/60">
              {/* A key of ours, or the server's own message. */}
              {isMessageKey(error) ? t(error) : error}
            </p>
          ) : purchases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
              <Package className="mx-auto h-8 w-8 text-white/30" aria-hidden="true" />
              <p className="mt-3 text-sm text-white/70">{t("account.empty")}</p>
              <a href="/marketplace" className="mt-5 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900">
                {t("account.browse")}
              </a>
            </div>
          ) : (
            <ul className="space-y-3">
              {purchases.map((p) => (
                <li key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold">{p.product}</h2>
                      <p className="mt-0.5 text-[11px] text-white/50">
                        {p.order_no ? `${t("account.order", { order: p.order_no })} · ` : ""}
                        {formatDate(p.placed)}
                        {p.gateway ? ` · ${p.gateway}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-bold">{formatCurrency(p.amount, p.currency)}</span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          TONE[p.status] ?? TONE.cancelled
                        }`}
                      >
                        {t("account.status", { status: p.status.replace(/\s+/g, "_") })}
                      </span>
                    </div>
                  </div>

                  {p.licence_key ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                      <KeyRound className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
                      <code className="min-w-0 flex-1 truncate font-mono text-xs font-bold tracking-wide">
                        {p.licence_key}
                      </code>
                      {p.licence_status && p.licence_status !== "active" && (
                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                          {t("account.licence_status", { status: p.licence_status })}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void copy(p.licence_key!)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                      >
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        {copied === p.licence_key ? t("account.copied") : t("account.copy")}
                      </button>
                    </div>
                  ) : p.status === "paid" ? (
                    <p className="mt-3 text-[11px] text-white/50">{t("account.licence_pending")}</p>
                  ) : null}

                  {p.invoice_id && (
                    <p className="mt-2 text-[11px] text-white/50">
                      {richText(t("account.invoice"), {
                        number: p.invoice_no,
                        link: (
                      <a
                        href={`/api/account/invoice/${p.invoice_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-cyan-300 underline"
                      >
                        {t("account.invoice_open")}
                      </a>
                        ),
                      })}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-8 text-[11px] text-white/40">
          {richText(t("account.setup_note"), {
            link: (
              <a href="/support" className="text-cyan-300 underline">
                {t("account.talk_to_support")}
              </a>
            ),
          })}
        </p>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/account/purchases")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Your purchases | Software Vala" }, { name: "robots", content: "noindex" }],
  }),
  component: PurchasesPage,
});
