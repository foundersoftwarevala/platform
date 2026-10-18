import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

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
    <AmsEngineView
      view="xp"
      title="XP Engine"
      description="XP sources, multipliers, decay, boosters, transactions and anti-farming rules."
      columns={[
        {
          key: "rule",
          label: "Rule"
        },
        {
          key: "source",
          label: "Source"
        },
        {
          key: "xp",
          label: "XP",
          align: "right"
        },
        {
          key: "cap",
          label: "Daily Cap",
          align: "right"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[
        {
          label: "Source",
          key: "source",
          values: []
        },
        {
          label: "Status",
          key: "status",
          values: []
        }
      ]}
    />
  );
}
