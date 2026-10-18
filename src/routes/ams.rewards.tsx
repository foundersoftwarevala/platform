import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

export const Route = createFileRoute("/ams/rewards")({
  head: () => ({
    meta: [
      { title: "Reward Engine — AMS" },
      { name: "description", content: "Lucky Wheel · Mystery Box · Treasure Chest · Golden Ticket · Commission Booster · Premium bundles." },
      { property: "og:title", content: "Reward Engine — AMS" },
      { property: "og:description", content: "Lucky Wheel · Mystery Box · Treasure Chest · Golden Ticket · Commission Booster · Premium bundles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="rewards"
      title="Reward Engine"
      description="Lucky Wheel · Mystery Box · Treasure Chest · Golden Ticket · Commission Booster · Premium bundles."
      columns={[
        {
          key: "reward",
          label: "Reward"
        },
        {
          key: "type",
          label: "Stock"
        },
        {
          key: "rarity",
          label: "Rarity"
        },
        {
          key: "issued",
          label: "Issued",
          align: "right"
        },
        {
          key: "value",
          label: "Value",
          align: "right"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[
        {
          label: "Rarity",
          key: "rarity",
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
