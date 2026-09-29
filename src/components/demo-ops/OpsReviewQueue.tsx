import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, Inbox, Loader2, Search } from "lucide-react";

import { useOpsOverview, type OpsReviewRow } from "@/hooks/useDemoOps";
import { OpsSection } from "./OpsPrimitives";

/**
 * The queue an operator works through.
 *
 * Intake never guesses a product: an address the matcher cannot place is taken
 * in with no product and waits here. Until now nothing could give it one, so
 * those rows would have sat unreachable forever - which is the other half of
 * "never guess" and the part that was missing.
 *
 * Nothing is assigned silently. The machine's own reason and its candidates are
 * shown, the operator picks, and the decision is recorded as theirs.
 */
export function OpsReviewQueue() {
  const overview = useOpsOverview();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [term, setTerm] = useState<Record<string, string>>({});
  const [hits, setHits] = useState<Record<string, { id: string; name: string; slug: string }[]>>({});

  const review = overview.data?.review ?? [];
  const [suggested, setSuggested] = useState<Record<string, { id: string; name: string; slug: string }[]>>({});

  /**
   * A suggestion, not an answer.
   *
   * The matcher refuses to place these rows, and that refusal stands. This only
   * offers what the catalogue holds under the demo's own title so the operator
   * does not have to type it - picking one is still their decision, and the
   * assignment is recorded as theirs.
   */
  const suggest = async (row: OpsReviewRow) => {
    if (suggested[row.id]) return;
    const { authHeaders } = await import("@/lib/auth/operator-fetch");
    const response = await fetch(`/api/demo/process?products=${encodeURIComponent(row.title)}`, {
      headers: await authHeaders(),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { products?: { id: string; name: string; slug: string }[] };
    setSuggested((s) => ({ ...s, [row.id]: body.products ?? [] }));
  };
  const mismatches = overview.data?.category_mismatches ?? [];

  const search = async (row: OpsReviewRow) => {
    const q = (term[row.id] ?? "").trim();
    if (q.length < 2) return;
    const { authHeaders } = await import("@/lib/auth/operator-fetch");
    const response = await fetch(`/api/demo/process?products=${encodeURIComponent(q)}`, {
      headers: await authHeaders(),
    });
    if (!response.ok) {
      toast.error("The catalogue could not be searched");
      return;
    }
    const body = (await response.json()) as { products?: { id: string; name: string; slug: string }[] };
    setHits((h) => ({ ...h, [row.id]: body.products ?? [] }));
  };

  const assign = async (row: OpsReviewRow, product: { id: string; name: string }) => {
    setBusy(row.id);
    try {
      const { authHeaders } = await import("@/lib/auth/operator-fetch");
      const response = await fetch("/api/demo/assign", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", demoUrlId: row.id, product: product.id }),
      });
      const body = (await response.json()) as { error?: string; productSlug?: string };
      if (!response.ok) throw new Error(body.error ?? "That did not go through");
      toast.success(`Assigned to ${product.name}`, {
        description: "It is not live yet — investigate and activate it next.",
      });
      await qc.invalidateQueries({ queryKey: ["demo-ops"] });
    } catch (error) {
      toast.error("Not assigned", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <OpsSection
        icon={Inbox}
        title="Review queue"
        description="Addresses taken in that the matcher would not place. Nothing here was guessed at."
        badge={`${review.length} waiting`}
      >
        {overview.isLoading ? (
          <p className="flex items-center gap-2 p-4 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the queue
          </p>
        ) : review.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">
            Nothing is waiting for a product. Every address taken in has one.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {review.map((row) => (
              <li key={row.id} className="space-y-3 p-4" data-review-row={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{row.title}</p>
                    <p className="truncate font-mono text-xs text-slate-400">{row.url}</p>
                  </div>
                  <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs text-amber-300">
                    {row.state}
                  </span>
                </div>

                {/* Why the machine would not place it. */}
                {row.reason && <p className="text-xs text-slate-400">{row.reason}</p>}

                {/* What it thought the candidates were, when it found several. */}
                {row.candidates && row.candidates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {row.candidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={busy === row.id}
                        onClick={() => void assign(row, c)}
                        className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-blue-500/60"
                      >
                        <Check className="mr-1 inline h-3 w-3" />
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Offered from the demo's own title; never applied on its own. */}
                {suggested[row.id] === undefined ? (
                  <button
                    type="button"
                    onClick={() => void suggest(row)}
                    className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    Suggest products from the title
                  </button>
                ) : suggested[row.id].length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">
                      Suggested from the title — confirm one, or search below.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggested[row.id].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={busy === row.id}
                          onClick={() => void assign(row, c)}
                          className="rounded-lg border border-blue-500/40 px-2.5 py-1.5 text-xs text-blue-200"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Nothing in the catalogue is called "{row.title}".
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <input
                    value={term[row.id] ?? ""}
                    onChange={(e) => setTerm((t) => ({ ...t, [row.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void search(row);
                      }
                    }}
                    placeholder="Search the catalogue"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void search(row)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <Search className="h-3.5 w-3.5" /> Search
                  </button>
                </div>

                {hits[row.id] && hits[row.id].length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800">
                    {hits[row.id].map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        disabled={busy === row.id}
                        onClick={() => void assign(row, product)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                      >
                        <span className="truncate">{product.name}</span>
                        <span className="ml-2 shrink-0 font-mono text-xs text-slate-500">{product.slug}</span>
                      </button>
                    ))}
                  </div>
                )}
                {hits[row.id] && hits[row.id].length === 0 && (
                  <p className="text-xs text-slate-500">Nothing in the catalogue matched that.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </OpsSection>

      {/* Shown, never acted on: taking a working demo down is the owner's call. */}
      <OpsSection
        icon={AlertTriangle}
        title="Category mismatches"
        description="Live demos whose detected category is not their product's. Listed for a decision, not changed."
        badge={`${mismatches.length} to decide`}
      >
        {mismatches.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No live demo is on a product of another category.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {mismatches.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-4" data-mismatch={m.id}>
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{m.title}</p>
                  <p className="truncate text-xs text-slate-400">
                    on {m.product_name ?? "a product"}{" "}
                    <span className="font-mono text-slate-500">{m.product_slug}</span>
                  </p>
                </div>
                <p className="text-xs text-slate-300">
                  <span className="text-amber-300">{m.detected_category ?? "unknown"}</span>
                  {" vs "}
                  <span className="text-slate-400">{m.product_category ?? "unknown"}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </OpsSection>
    </div>
  );
}

export default OpsReviewQueue;
