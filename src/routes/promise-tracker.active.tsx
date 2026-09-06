import { createFileRoute } from "@tanstack/react-router";

import { PTPageHeader } from "@/components/promise-tracker/PTPrimitives";
import { PromiseTable } from "@/components/promise-tracker/PromiseTable";
import { usePromises } from "@/hooks/usePromiseTracker";

export const Route = createFileRoute("/promise-tracker/active")({
  head: () => ({
    meta: [
      { title: "Active Promises — Promise Tracker" },
      {
        name: "description",
        content:
          "Live view of every active Software Vala promise with countdowns to deadline, owners and escalation levels.",
      },
      { property: "og:title", content: "Active Promises — Promise Tracker" },
      {
        property: "og:description",
        content: "Live countdowns for every in-flight commitment in Software Vala.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTActivePromises,
});

function PTActivePromises() {
  const { data = [], isLoading } = usePromises();
  const rows = data.filter((row) => row.status === "active" || row.status === "pending");

  return (
    <div>
      <PTPageHeader
        title="Active Promises"
        description="Commitments currently running against their deadline, including drafts awaiting activation."
      />
      <PromiseTable
        promises={rows}
        isLoading={isLoading}
        exportName="active-promises"
        emptyTitle="No active promises"
        emptyDescription="Create a promise to start tracking a new commitment."
      />
    </div>
  );
}
