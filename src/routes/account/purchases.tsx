import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, Package, RefreshCw, ShieldCheck } from "lucide-react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dateLabel, friendlyThrown, money, readJson } from "@/lib/portal/format";
import { CopyButton } from "@/components/portal/CopyButton";
import { useOnlineRecovery } from "@/lib/portal/use-online";
import { supportMailto } from "@/lib/portal/config";
import "@/styles/marketplace-home.css";
import { PortalError } from "@/components/portal/PortalError";

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
  /* Both nullable: the server sends the figure that was actually charged with
     the currency it was charged in, and sends null rather than inventing either
     one. `money` renders a missing amount as an em dash and a missing currency
     as a plain number, which is the truthful reading of both. */
  amount: number | null;
  currency: string | null;
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

/*
 * Formatting moved to lib/portal/format. What was here forced every amount
 * through the "en-IN" locale with the decimals suppressed, which is right for
 * rupees and wrong for everything else this catalogue sells in: a dollar total
 * came out grouped the Indian way, and a customer charged $1,299.50 was shown
 * "$1,299" on their own receipt.
 */

/**
 * One browser client for the page's lifetime.
 *
 * A fresh `createClient` on every load — which is what happened when the loader
 * lived inline in the effect and the effect could be re-run — builds another auth
 * instance with its own storage listener each time. Building it once, lazily,
 * means a retry and a reconnection reuse the client rather than stacking
 * listeners behind them (§31).
 */
let client: SupabaseClient | null = null;
function browserClient(): SupabaseClient {
  if (client) return client;
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const supabaseUrl = env?.VITE_SUPABASE_URL ?? "";
  const publishable = env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? env?.VITE_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !publishable) throw new Error("This page is not configured.");
  client = createClient(supabaseUrl, publishable);
  return client;
}

function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** How many are shown when the server had to cap the list; 0 when it did not. */
  const [truncated, setTruncated] = useState(0);
  /** A reload the customer asked for, as opposed to the page's first load. */
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Which load owns the screen, and whatever is currently in flight.
   *
   * The page can now be loaded more than once — the customer can retry, ask for
   * a refresh, or come back from a dropped connection — and two loads racing must
   * not let the older answer win. The generation counter settles that (§3, §32),
   * and the controller lets a superseded read be abandoned rather than left to
   * complete into nothing.
   */
  const generation = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    generation.current += 1;
    const mine = generation.current;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    try {
      const supabase = browserClient();
      const { data } = await supabase.auth.getSession();
      if (!alive.current || mine !== generation.current) return;

      const token = data.session?.access_token;
      if (!token) {
        setError("signed-out");
        setPurchases([]);
        return;
      }

      const response = await fetch("/api/account/purchases", {
        headers: { Authorization: `Bearer ${token}` },
        // Cancelled when the customer navigates away mid-load, and when a newer
        // load supersedes this one. This is a read, so stopping it costs nothing
        // and frees the connection.
        signal: controller.signal,
      });
      if (!alive.current || mine !== generation.current) return;

      // Read through the safe reader rather than `response.json()`. A proxy
      // returning an HTML error page used to surface to the customer as
      // "Unexpected token < in JSON at position 0", which tells them nothing
      // and looks like the site is broken rather than briefly unavailable.
      const parsed = await readJson<{
        purchases?: Purchase[];
        truncated?: boolean;
        limit?: number;
      }>(response);
      if (!alive.current || mine !== generation.current) return;

      if (!parsed.ok) {
        // 401 means the session went away — expired, or signed out in another
        // tab — and that is a different thing from a failure to load. Sending
        // the customer to the sign-in state is the honest answer and the only
        // one they can act on (§27).
        setError(response.status === 401 ? "signed-out" : parsed.error);
        setPurchases([]);
        return;
      }
      setError(null);
      setPurchases(Array.isArray(parsed.data.purchases) ? parsed.data.purchases : []);
      setTruncated(parsed.data.truncated === true ? Number(parsed.data.limit) || 0 : 0);
    } catch (problem) {
      if (!alive.current || mine !== generation.current) return;
      // An abort is this page superseding its own read, not a failure worth
      // showing anyone.
      if (problem instanceof DOMException && problem.name === "AbortError") return;
      setError(friendlyThrown(problem, "We could not load your purchases just now."));
      setPurchases([]);
    } finally {
      if (alive.current && mine === generation.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      generation.current += 1;
      inFlight.current?.abort();
    };
  }, [load]);

  /**
   * Signed out somewhere else, so signed out here (§28).
   *
   * This page displays licence keys, which is exactly the thing that must not
   * stay on screen after the person has signed out in another tab — a shared
   * computer is the whole reason the rule exists. Supabase already broadcasts the
   * session change between tabs through its own storage listener; what was
   * missing was anything on this page listening, so the keys simply stayed up
   * until somebody reloaded.
   *
   * Nothing is sent between tabs by us and no token is read out of the event:
   * the event is used only as a signal to re-read the session, and the page then
   * shows the signed-in state or the signed-out one accordingly.
   */
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const { data } = browserClient().auth.onAuthStateChange((event) => {
        if (!alive.current) return;
        if (event === "SIGNED_OUT") {
          generation.current += 1;
          inFlight.current?.abort();
          setPurchases([]);
          setTruncated(0);
          setError("signed-out");
          return;
        }
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") void load();
      });
      subscription = data.subscription;
    } catch {
      // An unconfigured page has no session to follow. The load above has
      // already said so.
    }
    return () => subscription?.unsubscribe();
  }, [load]);

  // The connection came back: ask for the list again rather than leaving the
  // customer looking at whatever failed while they were offline (§13). A read,
  // and nothing is retried on their behalf beyond it.
  useOnlineRecovery(() => {
    setRefreshing(true);
    void load();
  });

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  return (
    <main className="min-h-screen bg-[#050b18] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
          ← Back to marketplace
        </a>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Your purchases</h1>
        <p className="mt-1.5 text-sm text-white/60">
          Every order you have placed, and the licence for each one that is paid.
        </p>

        <div className="mt-8" aria-live="polite">
          {purchases === null ? (
            <p className="flex items-center gap-2 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
            </p>
          ) : error === "signed-out" ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-white/30" aria-hidden="true" />
              <p className="mt-3 text-sm text-white/70">Sign in to see what you have bought.</p>
              <a href="/login" className="mt-5 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900">
                Sign in
              </a>
            </div>
          ) : error ? (
            /* The load failed. This used to be the message alone, which left the
               only way out being a reload the page never mentioned — a dead end
               on the one screen a customer comes to for their licence key. */
            <div className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center">
              <p className="text-sm text-white/60">{error}</p>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {refreshing ? "Trying again…" : "Try again"}
              </button>
            </div>
          ) : purchases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
              <Package className="mx-auto h-8 w-8 text-white/30" aria-hidden="true" />
              <p className="mt-3 text-sm text-white/70">You have not bought anything yet.</p>
              <a href="/marketplace" className="mt-5 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900">
                Browse the catalogue
              </a>
            </div>
          ) : (
            <ul className="space-y-3">
              {purchases.map((p) => (
                <li key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold">{p.product}</h2>
                      {/* An order with no usable date shows an em dash rather
                          than the words "Invalid Date". */}
                      <p className="mt-0.5 text-[11px] text-white/50">
                        {p.order_no ? `Order ${p.order_no} · ` : ""}
                        {dateLabel(p.placed)}
                        {p.gateway ? ` · ${p.gateway}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-bold">{money(p.amount, p.currency)}</span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          TONE[p.status] ?? TONE.cancelled
                        }`}
                      >
                        {p.status}
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
                          {p.licence_status}
                        </span>
                      )}
                      {/* Named after the product, so a screen reader reaching
                          the fourth "Copy" on the page says which one it is. */}
                      <CopyButton value={p.licence_key} label={`licence key for ${p.product}`} />
                    </div>
                  ) : p.status === "paid" ? (
                    /* The licence is issued a moment after the payment settles.
                       This told the customer to refresh and then gave them
                       nothing to refresh with, on the one row they are waiting
                       on — so the instruction is now the control (§19, §14). */
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                      Your licence is being issued.
                      <button
                        type="button"
                        onClick={refresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
                          aria-hidden="true"
                        />
                        {refreshing ? "Checking…" : "Check now"}
                      </button>
                    </p>
                  ) : null}

                  {p.invoice_id && (
                    <p className="mt-2 text-[11px] text-white/50">
                      Invoice {p.invoice_no} —{" "}
                      <a
                        href={`/api/account/invoice/${p.invoice_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-cyan-300 underline"
                      >
                        open
                      </a>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Said plainly, because an older order that is simply not on this
              page looks exactly like an order that was never placed. */}
          {truncated > 0 && purchases && purchases.length > 0 ? (
            <p className="mt-4 text-center text-[11px] text-white/40">
              Showing your {truncated} most recent orders. Contact support for anything older.
            </p>
          ) : null}
        </div>

        <p className="mt-8 text-[11px] text-white/40">
          Our team contacts you on your email and WhatsApp to set up your domain, hosting and
          branding. Questions?{" "}
          {/* /support is the support team's own console and refuses a customer
              outright; this is the inbox they can actually reach. */}
          <a href={supportMailto("Question about my purchase")} className="text-cyan-300 underline">
            Talk to support
          </a>
          .
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
  // One order row shaped unexpectedly must not cost the customer the page
  // their licence keys are on.
  errorComponent: PortalError,
});
