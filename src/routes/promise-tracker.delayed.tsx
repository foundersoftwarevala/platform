import { createFileRoute } from "@tanstack/react-router";

import { PTPageHeader } from "@/components/promise-tracker/PTPrimitives";
import { PromiseTable } from "@/components/promise-tracker/PromiseTable";
import { usePromises } from "@/hooks/usePromiseTracker";

export const Route = createFileRoute("/promise-tracker/delayed")({
  head: () => ({
    meta: [
      { title: "Delayed Promises — Promise Tracker" },
      {
        name: "description",
        content:
          "Promises that slipped past their agreed deadline but are still recoverable, with extension and escalation controls.",
      },
      { property: "og:title", content: "Delayed Promises — Promise Tracker" },
      {
        property: "og:description",
        content: "Recover slipping commitments with extensions and escalation controls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTDelayed,
});

function PTDelayed() {
  const { data = [], isLoading } = usePromises();
  const rows = data.filter(
    (row) =>
      row.status === "delayed" ||
      (row.status !== "fulfilled" &&
        row.status !== "broken" &&
        new Date(row.deadline).getTime() < Date.now()),
  );

  return (
    <div>
      <PTPageHeader
        title="Delayed Promises"
        description="Commitments past deadline that have not yet been declared broken. Extend, escalate or close them out."
      />
      <PromiseTable
        promises={rows}
        isLoading={isLoading}
        exportName="delayed-promises"
        emptyTitle="Nothing is delayed"
        emptyDescription="Every promise is currently within its deadline."
      />
    </div>
  );
}
