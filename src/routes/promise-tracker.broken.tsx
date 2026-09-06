import { createFileRoute } from "@tanstack/react-router";

import { MetricCard, PTPageHeader } from "@/components/promise-tracker/PTPrimitives";
import { FineTipDialog } from "@/components/promise-tracker/FineTipDialog";
import { PromiseTable } from "@/components/promise-tracker/PromiseTable";
import { usePromises } from "@/hooks/usePromiseTracker";
import { formatCurrency } from "@/lib/promise-tracker/constants";

export const Route = createFileRoute("/promise-tracker/broken")({
  head: () => ({
    meta: [
      { title: "Broken Promises — Promise Tracker" },
      {
        name: "description",
        content:
          "Breached commitments in Software Vala with breach reasons, applied fines and escalation history.",
      },
      { property: "og:title", content: "Broken Promises — Promise Tracker" },
      {
        property: "og:description",
        content: "Breach register with reasons, fines and escalation history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTBroken,
});

function PTBroken() {
  const { data = [], isLoading } = usePromises();
  const rows = data.filter((row) => row.status === "broken");
  const fines = rows.reduce((sum, row) => sum + Number(row.fine_amount), 0);

  return (
    <div>
      <PTPageHeader
        title="Broken Promises"
        description="Commitments that were breached. Each breach carries a reason, an escalation trail and any fine applied."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Broken promises" value={rows.length} tone="danger" />
        <MetricCard label="Fines applied" value={formatCurrency(fines)} tone="danger" />
        <MetricCard
          label="At level 4"
          value={rows.filter((row) => row.escalation_level >= 4).length}
          tone="danger"
          hint="Legal / penalty stage"
        />
      </div>

      <PromiseTable
        promises={rows}
        isLoading={isLoading}
        exportName="broken-promises"
        emptyTitle="No broken promises"
        emptyDescription="No commitment has been declared breached."
      />

      {rows.length > 0 ? (
        <div className="glass-panel mt-6 divide-y divide-border">
          {rows.map((row) => (
            <div key={row.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{row.title}</p>
                <span className="mono text-xs text-muted-foreground">{row.code}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Breach reason: {row.breach_reason ?? "Not recorded"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-xs text-destructive">
                  Fine applied: {formatCurrency(Number(row.fine_amount))}
                </span>
                <FineTipDialog promise={row} kind="fine" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
