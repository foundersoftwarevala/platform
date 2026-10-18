import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, Inbox, Loader2, Search } from "lucide-react";

import { useOpsOverview, type OpsReviewRow } from "@/hooks/useDemoOps";
import { useTranslation } from "@/lib/i18n/use-translation";
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
  const { t } = useTranslation();
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
      toast.error(t("demo.review.search_failed"));
      return;
    }
    const body = (await response.json()) as { products?: { id: string; name: string; slug: string }[] };
    setHits((h) => ({ ...h, [row.id]: body.products ?? [] }));
  };

  /**
   * Read this one page again. The same pipeline the batch uses, so a rerun
   * cannot reach a different conclusion by a different route, and it assigns
   * only what the matcher is certain of.
   */
  const reinvestigate = async (row: OpsReviewRow) => {
    setBusy(row.id);
    try {
      const { authHeaders } = await import("@/lib/auth/operator-fetch");
      const response = await fetch("/api/demo/investigate", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "one", demoUrlId: row.id, commit: true }),
      });
      const body = (await response.json()) as { error?: string; row?: { state: string; reason: string } };
      if (!response.ok) throw new Error(body.error ?? t("demo.review.investigation_not_run"));
      toast.success(body.row?.state ?? t("demo.review.done"), { description: body.row?.reason ?? "" });
      await qc.invalidateQueries({ queryKey: ["demo-ops"] });
    } catch (error) {
      toast.error(t("demo.review.investigation_failed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
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
      if (!response.ok) throw new Error(body.error ?? t("demo.review.assign_not_through"));
      toast.success(t("demo.review.assigned", { product: product.name }), {
        description: t("demo.review.assigned_next"),
      });
      await qc.invalidateQueries({ queryKey: ["demo-ops"] });
    } catch (error) {
      toast.error(t("demo.review.not_assigned"), {
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
        title={t("demo.review.title")}
        description={t("demo.review.description")}
        badge={t("demo.review.waiting", { count: review.length })}
      >
        {overview.isLoading ? (
          <p className="flex items-center gap-2 p-4 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("demo.review.loading")}
          </p>
        ) : review.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">
            {t("demo.review.empty")}
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

                {/* What reading the page found. */}
                {row.investigation ? (
                  <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-xs text-slate-300">
                      <span className="font-semibold">{row.investigation.state}</span>
                      {row.investigation.evidence?.title ? (
                        <span className="text-slate-400"> · {row.investigation.evidence.title}</span>
                      ) : null}
                    </p>
                    {row.investigation.reason ? (
                      <p className="text-xs text-slate-500">{row.investigation.reason}</p>
                    ) : null}
                    {row.investigation.ai_suggestion?.name ? (
                      <p className="text-xs text-blue-300">
                        {t("demo.review.ai_suggests", { name: row.investigation.ai_suggestion.name })}
                        {row.investigation.ai_suggestion.confidence
                          ? t("demo.review.ai_confidence", { confidence: row.investigation.ai_suggestion.confidence })
                          : ""}
                        {t("demo.review.ai_confirm_below")}
                      </p>
                    ) : null}
                    {row.investigation.ai_error ? (
                      <p className="text-xs text-amber-300">{t("demo.review.ai_unavailable")} {row.investigation.ai_error}</p>
                    ) : null}
                    <p className="text-[11px] text-slate-600">
                      {t("demo.review.investigated_at", { when: new Date(row.investigation.investigated_at).toLocaleString() })}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{t("demo.review.not_investigated")}</p>
                )}

                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => void reinvestigate(row)}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 disabled:opacity-50"
                >
                  {row.investigation ? t("demo.review.investigate_again") : t("demo.review.investigate_page")}
                </button>

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
                    {t("demo.review.suggest")}
                  </button>
                ) : suggested[row.id].length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">
                      {t("demo.review.suggested")}
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
                    {t("demo.review.no_title_match", { title: row.title })}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <input
                    value={term[row.id] ?? ""}
                    onChange={(e) => setTerm((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void search(row);
                      }
                    }}
                    placeholder={t("demo.review.search_placeholder")}
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void search(row)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <Search className="h-3.5 w-3.5" /> {t("demo.review.search")}
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
                  <p className="text-xs text-slate-500">{t("demo.review.no_search_match")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </OpsSection>

      {/* Shown, never acted on: taking a working demo down is the owner's call. */}
      <OpsSection
        icon={AlertTriangle}
        title={t("demo.review.mismatch_title")}
        description={t("demo.review.mismatch_description")}
        badge={t("demo.review.mismatch_badge", { count: mismatches.length })}
      >
        {mismatches.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">{t("demo.review.mismatch_empty")}</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {mismatches.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-4" data-mismatch={m.id}>
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{m.title}</p>
                  <p className="truncate text-xs text-slate-400">
                    {t("demo.review.on_product", { product: m.product_name ?? t("demo.review.a_product") })}{" "}
                    <span className="font-mono text-slate-500">{m.product_slug}</span>
                  </p>
                </div>
                <p className="text-xs text-slate-300">
                  <span className="text-amber-300">{m.detected_category ?? t("demo.review.unknown")}</span>
                  {` ${t("demo.review.versus")} `}
                  <span className="text-slate-400">{m.product_category ?? t("demo.review.unknown")}</span>
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
