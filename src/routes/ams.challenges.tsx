import { createFileRoute } from "@tanstack/react-router";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

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
    <EngineDashboard
      kicker="AMS Manager"
      title="Challenges"
      description="1-vs-1, guild-vs-guild, department-vs-department, seasonal and community challenges."
      primaryAction="New Challenge"
      kpis={[
        { label: "Live", value: "12", accent: "#22d3ee" },
        { label: "Participants", value: "8,412", delta: "+18%", trend: "up" },
        { label: "Completed (7d)", value: "204" },
        { label: "Avg Reward", value: "1,240 XP" },
        { label: "Season", value: "3" },
        { label: "Days Left", value: "42" },
      ]}
      filters={[
        { label: "Mode", values: ["1v1", "Guild", "Department", "Community", "Seasonal"] },
        { label: "Status", values: ["Live", "Scheduled", "Ended"] },
      ]}
      columns={[
        { key: "name", label: "Challenge" },
        { key: "mode", label: "Mode" },
        { key: "reward", label: "Reward" },
        { key: "participants", label: "Players", align: "right" },
        { key: "ends", label: "Ends" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "c1", name: "Ship 50 PRs — 30d", mode: "Department", reward: "5,000 XP + Trophy", participants: "412", ends: "in 12d", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "c2", name: "Winter Sales Sprint", mode: "Guild", reward: "Legendary Box", participants: "1,204", ends: "in 42d", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "c3", name: "SEO Ranking Duel", mode: "1v1", reward: "Golden Ticket", participants: "48", ends: "in 3d", status: <StatusChip tone="warn">Ending soon</StatusChip> },
      ]}
    />
  );
}
