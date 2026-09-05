import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/trophies")({
  head: () => ({
    meta: [
      { title: "Trophy Engine — AMS" },
      { name: "description", content: "Bronze · Silver · Gold · Diamond · Elite · Legend · Founder · Special Event · Limited Edition." },
      { property: "og:title", content: "Trophy Engine — AMS" },
      { property: "og:description", content: "Bronze · Silver · Gold · Diamond · Elite · Legend · Founder · Special Event · Limited Edition." },
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
      title="Trophy Engine"
      description="Bronze · Silver · Gold · Diamond · Elite · Legend · Founder · Special Event · Limited Edition."
      primaryAction="New Trophy"
      kpis={[
        { label: "Bronze", value: "1,024", accent: "#b87333" },
        { label: "Silver", value: "612", accent: "#c0c0c0" },
        { label: "Gold", value: "284", accent: "#facc15" },
        { label: "Diamond", value: "96", accent: "#60a5fa" },
        { label: "Elite", value: "24", accent: "#c084fc" },
        { label: "Legend", value: "6", accent: "#f97316" },
      ]}
      filters={[
        { label: "Tier", values: ["Bronze", "Silver", "Gold", "Diamond", "Elite", "Legend", "Founder"] },
        { label: "Event", values: ["Regular", "Special", "Limited Edition"] },
      ]}
      columns={[
        { key: "name", label: "Trophy" },
        { key: "tier", label: "Tier" },
        { key: "event", label: "Event" },
        { key: "holders", label: "Holders", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "t1", name: <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /><span className="font-medium">Golden Architect</span></div>, tier: "Gold", event: "Regular", holders: "284", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "t2", name: <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-cyan-400" /><span className="font-medium">Diamond Reseller</span></div>, tier: "Diamond", event: "Regular", holders: "96", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "t3", name: <span className="font-medium">Founder's Cup — 2024</span>, tier: "Legend", event: "Limited Edition", holders: "12", status: <StatusChip tone="warn">Limited</StatusChip> },
        { id: "t4", name: <span className="font-medium">Winter Champion</span>, tier: "Elite", event: "Special", holders: "48", status: <StatusChip tone="info">Seasonal</StatusChip> },
      ]}
    />
  );
}
