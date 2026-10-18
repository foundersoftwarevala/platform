import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

export const Route = createFileRoute("/ams/legacy")({
  head: () => ({
    meta: [
      { title: "Legacy Engine — AMS" },
      { name: "description", content: "Career timeline, major milestones, historic achievements, lifetime journey, digital museum." },
      { property: "og:title", content: "Legacy Engine — AMS" },
      { property: "og:description", content: "Career timeline, major milestones, historic achievements, lifetime journey, digital museum." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="legacy"
      title="Legacy Engine"
      description="Career timeline, major milestones, historic achievements, lifetime journey, digital museum."
      columns={[
        {
          key: "title",
          label: "Entry"
        },
        {
          key: "owner",
          label: "Owner"
        },
        {
          key: "type",
          label: "Type"
        },
        {
          key: "date",
          label: "Date"
        }
      ]}
      filters={[]}
    />
  );
}
