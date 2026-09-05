import { createFileRoute } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/ranks")({
  head: () => ({
    meta: [
      { title: "Rank Engine — AMS" },
      { name: "description", content: "Promotion, demotion, prestige and seasonal rank ladders for every role." },
      { property: "og:title", content: "Rank Engine — AMS" },
      { property: "og:description", content: "Promotion, demotion, prestige and seasonal rank ladders for every role." },
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
      title="Rank Engine"
      description="Promotion, demotion, prestige and seasonal rank ladders for every role."
      primaryAction="New Rank"
      kpis={[
        { label: "Ranks", value: "24" },
        { label: "Promotions (7d)", value: "312", delta: "+11%", trend: "up" },
        { label: "Demotions (7d)", value: "18", delta: "-4%", trend: "down" },
        { label: "Prestige Users", value: "84", accent: "#facc15" },
        { label: "Ladder Season", value: "3" },
        { label: "Days Left", value: "42" },
      ]}
      filters={[{ label: "Role", values: ["Developer", "Reseller", "Support", "SEO", "Author"] }]}
      columns={[
        { key: "name", label: "Rank" },
        { key: "role", label: "Role" },
        { key: "min", label: "Min Level", align: "right" },
        { key: "holders", label: "Holders", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "r1", name: <div className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /><span className="font-medium">Grandmaster</span></div>, role: "Developer", min: "80", holders: "12", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "r2", name: <span className="font-medium">Master Reseller</span>, role: "Reseller", min: "60", holders: "84", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "r3", name: <span className="font-medium">Support Hero</span>, role: "Support", min: "40", holders: "204", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "r4", name: <span className="font-medium">SEO Sage</span>, role: "SEO", min: "50", holders: "48", status: <StatusChip tone="success">Active</StatusChip> },
      ]}
    />
  );
}
