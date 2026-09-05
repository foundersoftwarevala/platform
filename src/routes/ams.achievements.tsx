import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/achievements")({
  head: () => ({
    meta: [
      { title: "Achievement Engine — AMS" },
      { name: "description", content: "Categories, difficulty, dependencies, hidden, secret, seasonal, founder & lifetime achievements." },
      { property: "og:title", content: "Achievement Engine — AMS" },
      { property: "og:description", content: "Categories, difficulty, dependencies, hidden, secret, seasonal, founder & lifetime achievements." },
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
      title="Achievement Engine"
      description="Categories, difficulty, dependencies, hidden, secret, seasonal, founder & lifetime achievements."
      primaryAction="New Achievement"
      kpis={[
        { label: "Total", value: "1,284", delta: "+12%", trend: "up" },
        { label: "Active", value: "912", delta: "+4%", trend: "up" },
        { label: "Hidden", value: "84" },
        { label: "Seasonal", value: "36", accent: "#c084fc" },
        { label: "Unlocked (7d)", value: "24,918", delta: "+18%", trend: "up" },
        { label: "Completion", value: "68%", delta: "-2%", trend: "down" },
      ]}
      filters={[
        { label: "Category", values: ["Developer", "Sales", "Support", "SEO", "Creator", "Community"] },
        { label: "Difficulty", values: ["Easy", "Medium", "Hard", "Legendary"] },
        { label: "Status", values: ["Draft", "Active", "Archived"] },
      ]}
      columns={[
        { key: "name", label: "Achievement" },
        { key: "category", label: "Category" },
        { key: "difficulty", label: "Difficulty" },
        { key: "rarity", label: "Rarity" },
        { key: "unlocks", label: "Unlocks", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "a1", name: <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-trophy" /><span className="font-medium">First Commit</span></div>, category: "Developer", difficulty: "Easy", rarity: "Common", unlocks: "12,481", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "a2", name: <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-legendary" /><span className="font-medium">Ship 100 PRs</span></div>, category: "Developer", difficulty: "Hard", rarity: "Legendary", unlocks: "184", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "a3", name: <span className="font-medium">Sales Streak — 30 days</span>, category: "Sales", difficulty: "Medium", rarity: "Epic", unlocks: "612", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "a4", name: <span className="font-medium">Zero-Escalation Week</span>, category: "Support", difficulty: "Medium", rarity: "Rare", unlocks: "1,204", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "a5", name: <span className="font-medium">Founder Circle</span>, category: "Founder", difficulty: "Legendary", rarity: "Founder", unlocks: "12", status: <StatusChip tone="info">Hidden</StatusChip> },
        { id: "a6", name: <span className="font-medium">Winter Ascendant</span>, category: "Community", difficulty: "Hard", rarity: "Mythic", unlocks: "804", status: <StatusChip tone="warn">Seasonal</StatusChip> },
      ]}
    />
  );
}
