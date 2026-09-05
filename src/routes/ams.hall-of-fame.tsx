import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

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
    <EngineDashboard
      kicker="AMS Manager"
      title="Hall of Fame"
      description="Legendary users, historic achievements, career milestones and digital museum."
      primaryAction="Induct"
      kpis={[
        { label: "Inductees", value: "84" },
        { label: "Founders", value: "12", accent: "#e8d29a" },
        { label: "Legends", value: "48", accent: "#facc15" },
        { label: "Lifetime Awards", value: "204" },
        { label: "Museum Exhibits", value: "36" },
        { label: "Views (30d)", value: "12,481" },
      ]}
      filters={[{ label: "Tier", values: ["Legend", "Founder", "Lifetime"] }]}
      columns={[
        { key: "user", label: "Inductee" },
        { key: "role", label: "Role" },
        { key: "since", label: "Inducted" },
        { key: "awards", label: "Awards", align: "right" },
        { key: "tier", label: "Tier" },
      ]}
      rows={[
        { id: "h1", user: <div className="flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /><span className="font-medium">@arjun.k</span></div>, role: "Developer", since: "2024-01-12", awards: "48", tier: <StatusChip tone="warn">Founder</StatusChip> },
        { id: "h2", user: <span className="font-medium">@meera.s</span>, role: "Reseller", since: "2024-06-04", awards: "36", tier: <StatusChip tone="info">Legend</StatusChip> },
        { id: "h3", user: <span className="font-medium">@vivek.p</span>, role: "Support", since: "2025-02-18", awards: "24", tier: <StatusChip tone="info">Legend</StatusChip> },
      ]}
    />
  );
}
