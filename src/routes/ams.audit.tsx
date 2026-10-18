import { createFileRoute } from "@tanstack/react-router";
import { AmsEngineView } from "@/components/ams/shared/AmsEngineView";

const TITLE = "Audit Logs — AMS";
const DESCRIPTION =
  "Immutable audit trail across users, rewards, XP, achievements, admin actions and system events with actor, target and outcome.";

export const Route = createFileRoute("/ams/audit")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AmsEngineView
      view="audit"
      title="Audit Logs"
      description="Every user, reward, XP, achievement, admin and system action — captured with actor, target, scope and outcome."
      statusKey="outcome"
      columns={[
        {
          key: "time",
          label: "Timestamp"
        },
        {
          key: "scope",
          label: "Scope"
        },
        {
          key: "action",
          label: "Action"
        },
        {
          key: "actor",
          label: "Actor"
        },
        {
          key: "target",
          label: "Target"
        },
        {
          key: "outcome",
          label: "Outcome"
        }
      ]}
      filters={[
        {
          label: "Scope",
          key: "scope",
          values: []
        }
      ]}
    />
  );
}
