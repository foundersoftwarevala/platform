import { createFileRoute } from "@tanstack/react-router";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics Engine — AMS" },
      { name: "description", content: "Engagement, retention, unlock funnels, cohort analysis and reward ROI." },
      { property: "og:title", content: "Analytics Engine — AMS" },
      { property: "og:description", content: "Engagement, retention, unlock funnels, cohort analysis and reward ROI." },
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
      title="Analytics Engine"
      description="Engagement, retention, unlock funnels, cohort analysis and reward ROI."
      primaryAction="New Report"
      kpis={[
        { label: "DAU", value: "12,481", delta: "+8%", trend: "up" },
        { label: "WAU", value: "42,204", delta: "+4%", trend: "up" },
        { label: "MAU", value: "84,412", delta: "+11%", trend: "up" },
        { label: "Retention D30", value: "48%", delta: "+2%", trend: "up" },
        { label: "Avg Session", value: "12m 42s" },
        { label: "Award ROI", value: "3.4×", delta: "+0.2×", trend: "up", accent: "#22d3ee" },
      ]}
      filters={[
        { label: "Report", values: ["Engagement", "Retention", "Funnel", "Cohort", "ROI"] },
        { label: "Range", values: ["7d", "30d", "90d", "1y"] },
      ]}
      columns={[
        { key: "name", label: "Report" },
        { key: "type", label: "Type" },
        { key: "runs", label: "Runs", align: "right" },
        { key: "owner", label: "Owner" },
        { key: "updated", label: "Updated" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "an1", name: "Weekly engagement", type: "Engagement", runs: "482", owner: "@ops", updated: "2h ago", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "an2", name: "Onboarding funnel", type: "Funnel", runs: "128", owner: "@growth", updated: "1d ago", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "an3", name: "Reward ROI — Q3", type: "ROI", runs: "12", owner: "@finance", updated: "3d ago", status: <StatusChip tone="info">Draft</StatusChip> },
      ]}
    />
  );
}
