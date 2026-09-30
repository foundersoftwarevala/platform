import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

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
    <AmsEngineView
      view="ai"
      title="AI Recommendation Center"
      description="Recommendations, anomaly detection, cheat scoring, generative award design and copy assistants."
      columns={[
        {
          key: "assistant",
          label: "Run"
        },
        {
          key: "model",
          label: "Model"
        },
        {
          key: "runs",
          label: "When"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[
        {
          label: "Model",
          key: "model",
          values: []
        }
      ]}
    />
  );
}
