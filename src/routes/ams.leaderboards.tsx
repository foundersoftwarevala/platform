import { createFileRoute } from "@tanstack/react-router";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

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
    <EngineDashboard
      kicker="AMS Manager"
      title="Leaderboard"
      description="Global, department, seasonal, guild and role-specific leaderboards with anti-abuse."
      primaryAction="New Board"
      kpis={[
        { label: "Boards", value: "24" },
        { label: "Ranked Users", value: "84,204" },
        { label: "Snapshots / day", value: "48" },
        { label: "Cheaters Blocked", value: "12", delta: "-3", trend: "down", accent: "#ef4444" },
        { label: "Current Season", value: "3" },
        { label: "Days Left", value: "42" },
      ]}
      filters={[
        { label: "Scope", values: ["Global", "Department", "Role", "Seasonal", "Guild"] },
        { label: "Metric", values: ["XP", "Sales", "Commits", "CSAT", "Rankings"] },
      ]}
      columns={[
        { key: "rank", label: "#", align: "right" },
        { key: "user", label: "User" },
        { key: "role", label: "Role" },
        { key: "score", label: "Score", align: "right" },
        { key: "delta", label: "Δ", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "L1", rank: "1", user: <span className="font-medium">@arjun.k</span>, role: "Developer", score: "48,204", delta: "+2", status: <StatusChip tone="success">Rising</StatusChip> },
        { id: "L2", rank: "2", user: <span className="font-medium">@meera.s</span>, role: "Reseller", score: "42,118", delta: "-1", status: <StatusChip tone="muted">Stable</StatusChip> },
        { id: "L3", rank: "3", user: <span className="font-medium">@dev.rj</span>, role: "SEO", score: "38,412", delta: "+4", status: <StatusChip tone="success">Rising</StatusChip> },
        { id: "L4", rank: "4", user: <span className="font-medium">@vivek.p</span>, role: "Support", score: "34,204", delta: "0", status: <StatusChip tone="muted">Stable</StatusChip> },
        { id: "L5", rank: "5", user: <span className="font-medium">@shreya.n</span>, role: "Creator", score: "31,884", delta: "+1", status: <StatusChip tone="success">Rising</StatusChip> },
      ]}
    />
  );
}
