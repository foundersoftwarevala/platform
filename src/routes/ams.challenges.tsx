import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

export const Route = createFileRoute("/ams/challenges")({
  head: () => ({
    meta: [
      { title: "Challenges — AMS" },
      { name: "description", content: "1-vs-1, guild-vs-guild, department-vs-department, seasonal and community challenges." },
      { property: "og:title", content: "Challenges — AMS" },
      { property: "og:description", content: "1-vs-1, guild-vs-guild, department-vs-department, seasonal and community challenges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="challenges"
      title="Challenges"
      description="1-vs-1, guild-vs-guild, department-vs-department, seasonal and community challenges."
      columns={[
        {
          key: "challenge",
          label: "Challenge"
        },
        {
          key: "mode",
          label: "Mode"
        },
        {
          key: "reward",
          label: "Reward"
        },
        {
          key: "ends",
          label: "Ends"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[
        {
          label: "Mode",
          key: "mode",
          values: []
        },
        {
          label: "Status",
          key: "status",
          values: []
        }
      ]}
    />
  );
}
