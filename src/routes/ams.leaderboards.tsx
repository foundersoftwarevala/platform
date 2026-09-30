import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

export const Route = createFileRoute("/ams/leaderboards")({
  head: () => ({
    meta: [
      { title: "Leaderboard — AMS" },
      { name: "description", content: "Global, department, seasonal, guild and role-specific leaderboards with anti-abuse." },
      { property: "og:title", content: "Leaderboard — AMS" },
      { property: "og:description", content: "Global, department, seasonal, guild and role-specific leaderboards with anti-abuse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="leaderboards"
      title="Leaderboard"
      description="Global, department, seasonal, guild and role-specific leaderboards with anti-abuse."
      columns={[
        {
          key: "rank",
          label: "#"
        },
        {
          key: "user",
          label: "User"
        },
        {
          key: "role",
          label: "Board"
        },
        {
          key: "score",
          label: "Score",
          align: "right"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[
        {
          label: "Board",
          key: "role",
          values: []
        }
      ]}
    />
  );
}
