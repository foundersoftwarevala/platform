import { createFileRoute } from "@tanstack/react-router";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/xp")({
  head: () => ({
    meta: [
      { title: "XP Engine — AMS" },
      { name: "description", content: "XP sources, multipliers, decay, boosters, transactions and anti-farming rules." },
      { property: "og:title", content: "XP Engine — AMS" },
      { property: "og:description", content: "XP sources, multipliers, decay, boosters, transactions and anti-farming rules." },
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
      title="XP Engine"
      description="XP sources, multipliers, decay, boosters, transactions and anti-farming rules."
      primaryAction="New XP Rule"
      kpis={[
        { label: "XP Issued (30d)", value: "12.4M", delta: "+22%", trend: "up", accent: "#22d3ee" },
        { label: "Active Rules", value: "42" },
        { label: "Sources", value: "18" },
        { label: "Boosters", value: "6" },
        { label: "Avg / User", value: "1,284", delta: "+8%", trend: "up" },
        { label: "Fraud Blocked", value: "204", delta: "-14%", trend: "down" },
      ]}
      filters={[
        { label: "Source", values: ["Sales", "Commit", "Ticket", "Review", "Referral", "Login"] },
        { label: "Status", values: ["Active", "Paused", "Draft"] },
      ]}
      columns={[
        { key: "rule", label: "Rule" },
        { key: "source", label: "Source" },
        { key: "amount", label: "XP", align: "right" },
        { key: "cap", label: "Daily Cap", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "x1", rule: "Successful sale", source: "Sales", amount: "+250", cap: "10,000", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "x2", rule: "Merged PR", source: "Commit", amount: "+120", cap: "2,400", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "x3", rule: "Ticket resolved", source: "Ticket", amount: "+40", cap: "1,600", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "x4", rule: "First login of day", source: "Login", amount: "+10", cap: "10", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "x5", rule: "Weekend booster ×2", source: "Sales", amount: "×2", cap: "—", status: <StatusChip tone="warn">Scheduled</StatusChip> },
      ]}
    />
  );
}
