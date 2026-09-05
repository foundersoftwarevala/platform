import { createFileRoute } from "@tanstack/react-router";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/ai")({
  head: () => ({
    meta: [
      { title: "AI Center — AMS" },
      { name: "description", content: "Recommendations, anomaly detection, cheat scoring, generative award design and copy assistants." },
      { property: "og:title", content: "AI Center — AMS" },
      { property: "og:description", content: "Recommendations, anomaly detection, cheat scoring, generative award design and copy assistants." },
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
      title="AI Recommendation Center"
      description="Recommendations, anomaly detection, cheat scoring, generative award design and copy assistants."
      primaryAction="New Assistant"
      kpis={[
        { label: "Assistants", value: "8" },
        { label: "Recs Served (7d)", value: "84,204", delta: "+22%", trend: "up" },
        { label: "Anomalies Flagged", value: "48", accent: "#ef4444" },
        { label: "Auto-Approvals", value: "1,204" },
        { label: "Model Confidence", value: "94%" },
        { label: "Tokens (24h)", value: "1.2M" },
      ]}
      filters={[
        { label: "Kind", values: ["Recommendation", "Anomaly", "Generative", "Assistant"] },
        { label: "Model", values: ["Gemini 2.5", "GPT-5", "Claude", "Custom"] },
      ]}
      columns={[
        { key: "name", label: "Assistant" },
        { key: "kind", label: "Kind" },
        { key: "model", label: "Model" },
        { key: "runs", label: "Runs", align: "right" },
        { key: "acc", label: "Accuracy", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "ai1", name: "Next-mission suggester", kind: "Recommendation", model: "Gemini 2.5", runs: "12,481", acc: "92%", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "ai2", name: "XP anomaly guardian", kind: "Anomaly", model: "Custom", runs: "48,204", acc: "97%", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "ai3", name: "Award emblem designer", kind: "Generative", model: "GPT-5", runs: "412", acc: "—", status: <StatusChip tone="info">Beta</StatusChip> },
      ]}
    />
  );
}
