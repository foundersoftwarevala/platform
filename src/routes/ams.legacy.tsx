import { createFileRoute } from "@tanstack/react-router";
import { Archive } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

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
    <EngineDashboard
      kicker="AMS Manager"
      title="Legacy Engine"
      description="Career timeline, major milestones, historic achievements, lifetime journey, digital museum."
      primaryAction="New Legacy"
      kpis={[
        { label: "Timelines", value: "84,204" },
        { label: "Milestones", value: "1.2M" },
        { label: "Museum Exhibits", value: "36" },
        { label: "Featured", value: "12", accent: "#facc15" },
        { label: "Visitors (30d)", value: "48,204" },
        { label: "Curators", value: "6" },
      ]}
      filters={[{ label: "Type", values: ["Timeline", "Milestone", "Museum", "Story"] }]}
      columns={[
        { key: "title", label: "Entry" },
        { key: "owner", label: "Owner" },
        { key: "type", label: "Type" },
        { key: "date", label: "Date" },
        { key: "views", label: "Views", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "lg1", title: <div className="flex items-center gap-2"><Archive className="h-4 w-4 text-purple-400" /><span className="font-medium">First 100 sales — Meera</span></div>, owner: "@meera.s", type: "Milestone", date: "2024-06-04", views: "12,481", status: <StatusChip tone="success">Featured</StatusChip> },
        { id: "lg2", title: <span className="font-medium">Founder story — Arjun</span>, owner: "@arjun.k", type: "Story", date: "2024-01-12", views: "48,204", status: <StatusChip tone="success">Featured</StatusChip> },
        { id: "lg3", title: <span className="font-medium">10K commit celebration</span>, owner: "Community", type: "Museum", date: "2025-08-22", views: "8,412", status: <StatusChip tone="info">Live</StatusChip> },
      ]}
    />
  );
}
