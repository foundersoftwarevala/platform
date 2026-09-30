import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

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
    <AmsEngineView
      view="notifications"
      title="Notification Engine"
      description="Templates, rules, channels (in-app, email, push, sms) and delivery analytics."
      columns={[
        {
          key: "template",
          label: "Template"
        },
        {
          key: "channel",
          label: "Channel"
        },
        {
          key: "event",
          label: "Event"
        },
        {
          key: "status",
          label: "Status"
        }
      ]}
      filters={[
        {
          label: "Channel",
          key: "channel",
          values: []
        }
      ]}
    />
  );
}
