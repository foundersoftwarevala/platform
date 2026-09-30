import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

export const Route = createFileRoute("/ams/collections")({
  head: () => ({
    meta: [
      { title: "Collection Engine — AMS" },
      { name: "description", content: "Curated sets of awards, badges, certificates, passports, stamps and trophies." },
      { property: "og:title", content: "Collection Engine — AMS" },
      { property: "og:description", content: "Curated sets of awards, badges, certificates, passports, stamps and trophies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="collections"
      title="Collection Engine"
      description="Curated sets of awards, badges, certificates, passports, stamps and trophies."
      columns={[
        {
          key: "collection",
          label: "Collection"
        },
        {
          key: "kind",
          label: "Kind"
        },
        {
          key: "items",
          label: "Items",
          align: "right"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[
        {
          label: "Status",
          key: "status",
          values: []
        }
      ]}
    />
  );
}
