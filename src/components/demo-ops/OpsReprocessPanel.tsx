import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";

import { useOpsOverview } from "@/hooks/useDemoOps";
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
      if (!response.ok) throw new Error(body.error ?? "The pipeline refused it");

      const state = body.demo?.processing_status ?? "unknown";
      setOutcome((o) => ({ ...o, [demo.id]: state }));
      toast.success(`Re-processed ${demo.title}`, {
        description:
          state === "review"
            ? "Branding recomputed. Activate it to put the new presentation live."
            : `The pipeline left it at ${state}.`,
      });
      await qc.invalidateQueries({ queryKey: ["demo-ops"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOutcome((o) => ({ ...o, [demo.id]: `failed: ${message}` }));
      toast.error(`Could not re-process ${demo.title}`, { description: message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <OpsSection
      icon={RefreshCcw}
      title="Re-process"
      description="Run a demo through the real pipeline again to apply the current branding. Stops at review; publishing stays a separate act."
      badge={`${assigned.length} assigned`}
    >
      {overview.isLoading ? (
        <p className="flex items-center gap-2 p-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the demos
        </p>
      ) : assigned.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">No demo has a product yet.</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {assigned.map((demo) => (
            <li key={demo.id} className="flex flex-wrap items-center justify-between gap-3 p-4" data-reprocess={demo.id}>
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{demo.title}</p>
                <p className="truncate text-xs text-slate-400">
                  {demo.product_name ?? "product"} · {demo.status}/{demo.processing_status}
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
                Re-process
              </button>
            </li>
          ))}
        </ul>
      )}
    </OpsSection>
  );
}

export default OpsReprocessPanel;
