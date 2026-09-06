import { createFileRoute } from "@tanstack/react-router";

import { PTPageHeader } from "@/components/promise-tracker/PTPrimitives";
import { PromiseTable } from "@/components/promise-tracker/PromiseTable";
import { usePromises } from "@/hooks/usePromiseTracker";

export const Route = createFileRoute("/promise-tracker/all")({
  head: () => ({
    meta: [
      { title: "All Promises — Promise Tracker" },
      {
        name: "description",
        content:
          "Complete register of every promise tracked in Software Vala with search, status and priority filters plus CSV export.",
      },
      { property: "og:title", content: "All Promises — Promise Tracker" },
      {
        property: "og:description",
        content: "Search, filter and export the full Software Vala promise register.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PTAllPromises,
});

function PTAllPromises() {
  const { data = [], isLoading } = usePromises();

  return (
    <div>
      <PTPageHeader
        title="All Promises"
        description={`${data.length} commitments in the register across every category and status.`}
      />
      <PromiseTable promises={data} isLoading={isLoading} exportName="all-promises" />
    </div>
  );
}
