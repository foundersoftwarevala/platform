import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

export const Route = createFileRoute("/ams/identity")({
  head: () => ({
    meta: [
      { title: "Identity Engine — AMS" },
      { name: "description", content: "Role motto, vision, mission, philosophy, signature, greeting, celebration and motivation language." },
      { property: "og:title", content: "Identity Engine — AMS" },
      { property: "og:description", content: "Role motto, vision, mission, philosophy, signature, greeting, celebration and motivation language." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="identity"
      title="Identity Engine"
      description="Role motto, vision, mission, philosophy, signature, greeting, celebration and motivation language."
      columns={[
        {
          key: "role",
          label: "Role"
        },
        {
          key: "motto",
          label: "Motto"
        },
        {
          key: "signature",
          label: "Signature"
        },
        {
          key: "celebration",
          label: "Celebration"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[
        {
          label: "Role",
          key: "role",
          values: []
        }
      ]}
    />
  );
}
