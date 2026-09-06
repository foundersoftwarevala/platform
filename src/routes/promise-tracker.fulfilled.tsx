import { createFileRoute } from "@tanstack/react-router";

import { MetricCard, PTPageHeader } from "@/components/promise-tracker/PTPrimitives";
import { FineTipDialog } from "@/components/promise-tracker/FineTipDialog";
import { PromiseTable } from "@/components/promise-tracker/PromiseTable";
import { usePromises } from "@/hooks/usePromiseTracker";
import { formatCurrency } from "@/lib/promise-tracker/constants";

export const Route = createFileRoute("/promise-tracker/fulfilled")({
  head: () => ({
    meta: [
      { title: "Fulfilled Promises — Promise Tracker" },
      {
        name: "description",
        content:
          "Completed and locked commitments in Software Vala, including on-time performance and tips released.",
      },
      { property: "og:title", content: "Fulfilled Promises — Promise Tracker" },
      {
        property: "og:description",
        content: "Completed commitments with on-time performance and released tips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTFulfilled,
});

function PTFulfilled() {
  const { data = [], isLoading } = usePromises();
  const rows = data.filter((row) => row.status === "fulfilled");
  const onTime = rows.filter(
    (row) => row.fulfilled_at && new Date(row.fulfilled_at) <= new Date(row.deadline),
  );
  const tips = rows.reduce((sum, row) => sum + Number(row.tip_amount), 0);

  return (
    <div>
      <PTPageHeader
        title="Fulfilled Promises"
        description="Closed commitments. Fulfilled records are locked by default so the delivery history stays auditable."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Fulfilled" value={rows.length} tone="success" />
        <MetricCard
          label="Delivered on time"
          value={`${rows.length ? Math.round((onTime.length / rows.length) * 100) : 0}%`}
          hint={`${onTime.length} of ${rows.length}`}
          tone="success"
        />
        <MetricCard label="Tips released" value={formatCurrency(tips)} tone="success" />
      </div>

      <PromiseTable
        promises={rows}
        isLoading={isLoading}
        exportName="fulfilled-promises"
        emptyTitle="Nothing fulfilled yet"
        emptyDescription="Fulfilled promises will be archived here."
      />

      {rows.length > 0 ? (
        <div className="glass-panel mt-6 divide-y divide-border">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{row.title}</p>
                  <span className="mono text-xs text-muted-foreground">{row.code}</span>
                </div>
                <p className="mt-1 text-xs text-success">
                  Tip released: {formatCurrency(Number(row.tip_amount))}
                </p>
              </div>
              <FineTipDialog promise={row} kind="tip" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
