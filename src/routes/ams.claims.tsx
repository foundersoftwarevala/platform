import { createFileRoute } from "@tanstack/react-router";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/claims")({
  head: () => ({
    meta: [
      { title: "Claims — AMS" },
      { name: "description", content: "Pending, approved, rejected reward claims — verify, dispatch and audit." },
      { property: "og:title", content: "Claims — AMS" },
      { property: "og:description", content: "Pending, approved, rejected reward claims — verify, dispatch and audit." },
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
      title="Claims"
      description="Pending, approved, rejected reward claims — verify, dispatch and audit."
      primaryAction="New Claim"
      kpis={[
        { label: "Pending", value: "48", accent: "#fbbf24" },
        { label: "Approved (7d)", value: "1,204", delta: "+6%", trend: "up" },
        { label: "Rejected (7d)", value: "18" },
        { label: "In Dispatch", value: "12" },
        { label: "Avg Time", value: "4h 12m" },
        { label: "Fraud Flags", value: "3", accent: "#ef4444" },
      ]}
      filters={[
        { label: "Status", values: ["Pending", "Approved", "Rejected", "Dispatched"] },
        { label: "Type", values: ["Cash", "Bundle", "Physical", "Digital"] },
      ]}
      columns={[
        { key: "id", label: "Claim ID" },
        { key: "user", label: "User" },
        { key: "reward", label: "Reward" },
        { key: "value", label: "Value", align: "right" },
        { key: "requested", label: "Requested" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "CLM-1042", user: "@arjun.k", reward: "Golden Ticket", value: "$500", requested: "12h ago", status: <StatusChip tone="warn">Pending</StatusChip> },
        { id: "CLM-1041", user: "@meera.s", reward: "Legendary Box", value: "$120", requested: "1d ago", status: <StatusChip tone="success">Approved</StatusChip> },
        { id: "CLM-1040", user: "@dev.rj", reward: "Commission ×2", value: "+100%", requested: "2d ago", status: <StatusChip tone="info">Dispatched</StatusChip> },
      ]}
    />
  );
}
