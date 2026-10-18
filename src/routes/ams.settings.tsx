import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

export const Route = createFileRoute("/ams/settings")({
  head: () => ({
    meta: [
      { title: "Global Settings — AMS" },
      { name: "description", content: "System, security, branding, integrations, feature flags, anti-abuse and localization." },
      { property: "og:title", content: "Global Settings — AMS" },
      { property: "og:description", content: "System, security, branding, integrations, feature flags, anti-abuse and localization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="settings"
      title="Global Settings"
      description="System, security, branding, integrations, feature flags, anti-abuse and localization."
      columns={[
        {
          key: "key",
          label: "Key"
        },
        {
          key: "group",
          label: "Group"
        },
        {
          key: "value",
          label: "Value"
        },
        {
          key: "updated",
          label: "Updated"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[
        {
          label: "Group",
          key: "group",
          values: []
        }
      ]}
    />
  );
}
