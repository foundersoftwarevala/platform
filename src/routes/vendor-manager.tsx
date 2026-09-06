import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Boxes, CheckCircle2, Clock, Loader2, PauseCircle, Store, XCircle } from "lucide-react";
import { toast } from "sonner";

import { RequireRole } from "@/components/auth/RequireRole";
import { supabase } from "@/integrations/supabase/client";
import "@/styles/marketplace-home.css";

/**
 * Vendor Manager.
 *
 * This console did not exist: /vendor-manager returned 404, there was no entry
 * in the Control Panel, and no way to approve a vendor at all. A vendor and an
 * author are the same record — `marketplace_sellers` — so this administers
 * both, and shows the real counts behind each one rather than a directory of
 * names.
 *
 * Everything it does goes through the operator-guarded endpoints, using the
 * signed-in operator's own session. Nothing is computed in the browser.
 */

export const Route = createFileRoute("/vendor-manager")({
  head: () => ({
    meta: [
      { title: "Vendor Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Approve vendors and authors, apply their agreed commission rate, and review the products they submit.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole role={["finance", "support", "sales_support_manager"]}>
      <VendorManager />
    </RequireRole>
  ),
});

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

type Seller = {
  id: string;
  display_name: string | null;
  slug: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  commissionRate: number | null;
  counts: { products: number; published: number; sales: number; earned: number };
};

type QueueProduct = {
  id: string;
  name: string;
  slug: string;
  seller_id: string;
  moderation_status: string;
  updated_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  suspended: "bg-rose-500/15 text-rose-300 border-rose-400/30",
};

function VendorManager() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"sellers" | "queue">("sellers");

  const sellers = useQuery({
    queryKey: ["seller-admin"],
    queryFn: async () => {
      const response = await fetch("/api/internal/seller-admin", { headers: await authHeaders() });
      if (!response.ok) throw new Error("Could not load the seller directory");
      return (await response.json()) as {
        count: number;
        sellers: Seller[];
        agreedRates: Record<string, number>;
      };
    },
  });

  const queue = useQuery({
    queryKey: ["author-review-queue"],
    queryFn: async () => {
      const response = await fetch("/api/internal/author-review", { headers: await authHeaders() });
      if (!response.ok) throw new Error("Could not load the review queue");
      return (await response.json()) as {
        count: number;
        products: QueueProduct[];
        sellers: Record<string, { display_name: string }>;
      };
    },
  });

  const decide = useMutation({
    mutationFn: async (input: { sellerId: string; decision: string; agreement?: string }) => {
      const response = await fetch("/api/internal/seller-admin", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "That did not work");
      return payload as { to: string; commissionRate: number | null };
    },
    onSuccess: (result) => {
      toast.success(
        result.commissionRate !== null
          ? `Approved at ${result.commissionRate}% platform commission`
          : `Seller is now ${result.to}`,
      );
      void queryClient.invalidateQueries({ queryKey: ["seller-admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const review = useMutation({
    mutationFn: async (input: { productId: string; decision: string; reason?: string }) => {
      const response = await fetch("/api/internal/author-review", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "That did not work");
      return payload as { to: string };
    },
    onSuccess: (result) => {
      toast.success(`Product is now ${result.to.replace(/_/g, " ")}`);
      void queryClient.invalidateQueries({ queryKey: ["author-review-queue"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const requestChanges = useCallback(
    (productId: string) => {
      const reason = window.prompt("What does the vendor need to change?");
      if (!reason?.trim()) return;
      review.mutate({ productId, decision: "changes_requested", reason: reason.trim() });
    },
    [review],
  );

  const rates = sellers.data?.agreedRates ?? {};

  return (
    <main className="mpc-home min-h-screen bg-[#0a1628] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Vendor Manager</h1>
            <p className="text-sm text-white/60">
              Vendors and authors share one seller record. Approving one applies the commission
              rate their agreement promises.
            </p>
          </div>
        </header>

        <div className="mt-6 flex gap-2">
          {(["sellers", "queue"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tab === key
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
              }`}
            >
              {key === "sellers"
                ? `Sellers${sellers.data ? ` (${sellers.data.count})` : ""}`
                : `Product review${queue.data ? ` (${queue.data.count})` : ""}`}
            </button>
          ))}
        </div>

        {tab === "sellers" ? (
          <section className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
            {sellers.isLoading ? (
              <p className="flex items-center gap-2 p-8 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading sellers…
              </p>
            ) : sellers.error ? (
              <p className="p-8 text-sm text-rose-300">{(sellers.error as Error).message}</p>
            ) : !sellers.data?.sellers.length ? (
              <p className="p-8 text-sm text-white/60">
                No sellers yet. A vendor or author appears here once they apply.
              </p>
            ) : (
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="px-4 py-3">Seller</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Products</th>
                    <th className="px-4 py-3 text-right">Live</th>
                    <th className="px-4 py-3 text-right">Sales</th>
                    <th className="px-4 py-3 text-right">Earned</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                    <th className="px-4 py-3">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.data.sellers.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{s.display_name ?? "Unnamed"}</div>
                        <div className="font-mono text-[11px] text-white/40">{s.slug ?? s.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[s.status] ?? "border-white/15 bg-white/5"}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.counts.products}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.counts.published}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.counts.sales}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {s.counts.earned ? `$${s.counts.earned.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {s.commissionRate === null ? (
                          <span className="text-amber-300">no rule</span>
                        ) : (
                          `${s.commissionRate}%`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {s.status !== "approved" && (
                            <>
                              <button
                                type="button"
                                disabled={decide.isPending}
                                onClick={() => decide.mutate({ sellerId: s.id, decision: "approved", agreement: "vendor" })}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Vendor {rates.vendor ?? 15}%
                              </button>
                              <button
                                type="button"
                                disabled={decide.isPending}
                                onClick={() => decide.mutate({ sellerId: s.id, decision: "approved", agreement: "author" })}
                                className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50"
                              >
                                <BadgeCheck className="h-3 w-3" /> Author {rates.author ?? 30}%
                              </button>
                            </>
                          )}
                          {s.status !== "suspended" && (
                            <button
                              type="button"
                              disabled={decide.isPending}
                              onClick={() => decide.mutate({ sellerId: s.id, decision: "suspended" })}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-400/20 disabled:opacity-50"
                            >
                              <PauseCircle className="h-3 w-3" /> Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : (
          <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03]">
            {queue.isLoading ? (
              <p className="flex items-center gap-2 p-8 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading the queue…
              </p>
            ) : queue.error ? (
              <p className="p-8 text-sm text-rose-300">{(queue.error as Error).message}</p>
            ) : !queue.data?.products.length ? (
              <p className="flex items-center gap-2 p-8 text-sm text-white/60">
                <Clock className="h-4 w-4" /> Nothing is waiting for review.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {queue.data.products.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white/60">
                      <Boxes className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="text-[11px] text-white/50">
                        {queue.data.sellers?.[p.seller_id]?.display_name ?? "Unknown seller"} ·{" "}
                        {p.moderation_status.replace(/_/g, " ")}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ productId: p.id, decision: "approved" })}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ productId: p.id, decision: "published" })}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50"
                      >
                        <Store className="h-3 w-3" /> Publish
                      </button>
                      <button
                        type="button"
                        disabled={review.isPending}
                        onClick={() => requestChanges(p.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
                      >
                        <XCircle className="h-3 w-3" /> Request changes
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
