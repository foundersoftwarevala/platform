import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

export const Route = createFileRoute("/ams/passport")({
  head: () => ({
    meta: [
      { title: "Passport Engine — AMS" },
      { name: "description", content: "Unique passport per role — cover, number, stamps, timeline, verification, expiry, renewal." },
      { property: "og:title", content: "Passport Engine — AMS" },
      { property: "og:description", content: "Unique passport per role — cover, number, stamps, timeline, verification, expiry, renewal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="passport"
      title="Passport Engine"
      description="Unique passport per role — cover, number, stamps, timeline, verification, expiry, renewal."
      columns={[
        {
          key: "passport",
          label: "Passport"
        },
        {
          key: "role",
          label: "Role"
        },
        {
          key: "level",
          label: "Level",
          align: "right"
        },
        {
          key: "stamps",
          label: "Stage"
        },
        {
          key: "verified",
          label: "Verified"
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
