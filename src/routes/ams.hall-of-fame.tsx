import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

export const Route = createFileRoute("/ams/hall-of-fame")({
  head: () => ({
    meta: [
      { title: "Hall of Fame — AMS" },
      { name: "description", content: "Legendary users, historic achievements, career milestones and digital museum." },
      { property: "og:title", content: "Hall of Fame — AMS" },
      { property: "og:description", content: "Legendary users, historic achievements, career milestones and digital museum." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="hall-of-fame"
      title="Hall of Fame"
      description="Legendary users, historic achievements, career milestones and digital museum."
      statusKey="tier"
      columns={[
        {
          key: "inductee",
          label: "Inductee"
        },
        {
          key: "inducted",
          label: "Inducted"
        },
        {
          key: "awards",
          label: "Awards",
          align: "right"
        },
        {
          key: "tier",
          label: "Tier"
        }
      ]}
      filters={[
        {
          label: "Tier",
          key: "tier",
          values: []
        }
      ]}
    />
  );
}
