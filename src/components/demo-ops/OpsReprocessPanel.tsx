import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";

import { useOpsOverview } from "@/hooks/useDemoOps";
import { useTranslation } from "@/lib/i18n/use-translation";
import { OpsSection } from "./OpsPrimitives";

/**
 * Running a demo through the pipeline again.
 *
 * The seventeen demos live today were branded by whatever the investigation
 * produced on the day they were added. When the presentation changes - and it
 * did, twice this week, for the platform badge and the contact replacement -
 * there was no way to apply it to a demo already live short of deleting and
 * re-adding it.
 *
 * This is the production pipeline, not a copy: /api/demo/process with the
 * investigate action re-reads the page, recomputes the branding rules and writes
 * them to the same product_demo_urls row, which is why it can be run twice
 * without creating a second mapping. The result shown is the server's, and a
 * failure is shown as a failure.
 *
 * It stops at review. Publishing is still a separate, deliberate act, with the
 * category and product checks that go with it.
 */
export function OpsReprocessPanel() {
  const { t } = useTranslation();
  const overview = useOpsOverview();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Record<string, string>>({});

  const demos = (overview.data?.demos ?? []) as unknown as {
    id: string;
    title: string;
    url: string;
    product_id: string | null;
    product_name: string | null;
    processing_status: string;
    status: string;
  }[];
  const assigned = demos.filter((d) => d.product_id);

  const reprocess = async (demo: (typeof assigned)[number]) => {
    setBusy(demo.id);
    try {
      const { authHeaders } = await import("@/lib/auth/operator-fetch");
      const response = await fetch("/api/demo/process", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "investigate", productId: demo.product_id, url: demo.url }),
      });
      const body = (await response.json()) as { error?: string; demo?: { processing_status?: string } };
      if (!response.ok) throw new Error(body.error ?? t("demo.reprocess.refused"));

      const state = body.demo?.processing_status ?? "unknown";
      setOutcome((o) => ({ ...o, [demo.id]: state }));
      toast.success(t("demo.reprocess.done", { title: demo.title }), {
        description:
          state === "review"
            ? t("demo.reprocess.done_review")
            : t("demo.reprocess.done_state", { state }),
      });
      await qc.invalidateQueries({ queryKey: ["demo-ops"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOutcome((o) => ({ ...o, [demo.id]: `failed: ${message}` }));
      toast.error(t("demo.reprocess.failed", { title: demo.title }), { description: message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <OpsSection
      icon={RefreshCcw}
      title={t("demo.reprocess.title")}
      description={t("demo.reprocess.description")}
      badge={t("demo.reprocess.assigned", { count: assigned.length })}
    >
      {overview.isLoading ? (
        <p className="flex items-center gap-2 p-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("demo.reprocess.loading")}
        </p>
      ) : assigned.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">{t("demo.reprocess.empty")}</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {assigned.map((demo) => (
            <li key={demo.id} className="flex flex-wrap items-center justify-between gap-3 p-4" data-reprocess={demo.id}>
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{demo.title}</p>
                <p className="truncate text-xs text-slate-400">
                  {demo.product_name ?? t("demo.reprocess.product_fallback")} · {demo.status}/{demo.processing_status}
                  {outcome[demo.id] && <span className="ml-2 text-slate-300">→ {outcome[demo.id]}</span>}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === demo.id}
                onClick={() => void reprocess(demo)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50"
              >
                {busy === demo.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5" />
                )}
                {t("demo.reprocess.title")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </OpsSection>
  );
}

export default OpsReprocessPanel;
