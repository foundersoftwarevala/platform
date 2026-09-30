import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

export const Route = createFileRoute("/ams/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics Engine — AMS" },
      { name: "description", content: "Engagement, retention, unlock funnels, cohort analysis and reward ROI." },
      { property: "og:title", content: "Analytics Engine — AMS" },
      { property: "og:description", content: "Engagement, retention, unlock funnels, cohort analysis and reward ROI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="analytics"
      title="Analytics Engine"
      description="Engagement, retention, unlock funnels, cohort analysis and reward ROI."
      columns={[
        {
          key: "name",
          label: "Report"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[]}
    />
  );
}
