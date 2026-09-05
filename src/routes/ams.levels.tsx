import { createFileRoute } from "@tanstack/react-router";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/levels")({
  head: () => ({
    meta: [
      { title: "Level Engine — AMS" },
      { name: "description", content: "Level curve, requirements, unlocks, rewards and prestige loops per role." },
      { property: "og:title", content: "Level Engine — AMS" },
      { property: "og:description", content: "Level curve, requirements, unlocks, rewards and prestige loops per role." },
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
      title="Level Engine"
      description="Level curve, requirements, unlocks, rewards and prestige loops per role."
      primaryAction="New Level"
      kpis={[
        { label: "Max Level", value: "100" },
        { label: "Prestige Tiers", value: "5", accent: "#facc15" },
        { label: "Active Users", value: "84,204" },
        { label: "Avg Level", value: "12" },
        { label: "Level-Ups (7d)", value: "4,182", delta: "+6%", trend: "up" },
        { label: "Prestige-Ups", value: "48", delta: "+2", trend: "up" },
      ]}
      filters={[{ label: "Tier", values: ["1-10", "11-25", "26-50", "51-100", "Prestige"] }]}
      columns={[
        { key: "level", label: "Level", align: "right" },
        { key: "xp", label: "XP Required", align: "right" },
        { key: "title", label: "Title" },
        { key: "unlocks", label: "Unlocks" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "l1", level: "1", xp: "0", title: "Rookie", unlocks: "Passport", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "l5", level: "5", xp: "500", title: "Explorer", unlocks: "Mission board", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "l10", level: "10", xp: "1,800", title: "Rising Star", unlocks: "Bronze trophies", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "l25", level: "25", xp: "8,400", title: "Professional", unlocks: "Elite missions", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "l50", level: "50", xp: "42,000", title: "Master", unlocks: "Legendary trophies", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "l100", level: "100", xp: "250,000", title: "Legend", unlocks: "Prestige gate", status: <StatusChip tone="info">Locked</StatusChip> },
      ]}
    />
  );
}
