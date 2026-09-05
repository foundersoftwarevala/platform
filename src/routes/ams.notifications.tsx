import { createFileRoute } from "@tanstack/react-router";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Engine — AMS" },
      { name: "description", content: "Templates, rules, channels (in-app, email, push, sms) and delivery analytics." },
      { property: "og:title", content: "Notification Engine — AMS" },
      { property: "og:description", content: "Templates, rules, channels (in-app, email, push, sms) and delivery analytics." },
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
      title="Notification Engine"
      description="Templates, rules, channels (in-app, email, push, sms) and delivery analytics."
      primaryAction="New Template"
      kpis={[
        { label: "Templates", value: "84" },
        { label: "Sent (7d)", value: "142,481", delta: "+9%", trend: "up" },
        { label: "Open Rate", value: "62%", delta: "+3%", trend: "up" },
        { label: "Click Rate", value: "18%", delta: "+1%", trend: "up" },
        { label: "Failed", value: "204", delta: "-12%", trend: "down" },
        { label: "Channels", value: "4" },
      ]}
      filters={[
        { label: "Channel", values: ["In-App", "Email", "Push", "SMS"] },
        { label: "Event", values: ["Unlock", "Promotion", "Mission", "Reward", "System"] },
      ]}
      columns={[
        { key: "name", label: "Template" },
        { key: "channel", label: "Channel" },
        { key: "event", label: "Event" },
        { key: "sent", label: "Sent", align: "right" },
        { key: "open", label: "Open %", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "n1", name: "Achievement unlocked", channel: "In-App", event: "Unlock", sent: "48,204", open: "94%", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "n2", name: "Weekly digest", channel: "Email", event: "System", sent: "12,481", open: "42%", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "n3", name: "Rank promotion", channel: "Push", event: "Promotion", sent: "3,412", open: "78%", status: <StatusChip tone="success">Active</StatusChip> },
      ]}
    />
  );
}
