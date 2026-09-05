import { createFileRoute } from "@tanstack/react-router";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";
import { MotionSoundPanel } from "@/components/ams/ui/MotionSoundPanel";

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
    <EngineDashboard
      kicker="AMS Manager"
      title="Global Settings"
      description="System, security, branding, integrations, feature flags, anti-abuse and localization."
      primaryAction="New Setting"
      extraPanels={<MotionSoundPanel />}
      kpis={[
        { label: "Settings", value: "142" },
        { label: "Feature Flags", value: "48" },
        { label: "Integrations", value: "12" },
        { label: "Env", value: "Prod", accent: "#22d3ee" },
        { label: "Last Deploy", value: "2h ago" },
        { label: "Uptime", value: "99.98%" },
      ]}
      filters={[
        { label: "Group", values: ["System", "Security", "Branding", "Integrations", "Flags", "Anti-Abuse"] },
      ]}
      columns={[
        { key: "key", label: "Key" },
        { key: "group", label: "Group" },
        { key: "value", label: "Value" },
        { key: "updated", label: "Updated" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "s1", key: "ams.season", group: "System", value: "3", updated: "2h ago", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "s2", key: "xp.daily_cap", group: "Anti-Abuse", value: "10,000", updated: "1d ago", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "s3", key: "features.mystery_box_v2", group: "Flags", value: "on (rollout 40%)", updated: "3d ago", status: <StatusChip tone="warn">Rollout</StatusChip> },
        { id: "s4", key: "brand.primary_color", group: "Branding", value: "#facc15", updated: "1w ago", status: <StatusChip tone="success">Live</StatusChip> },
      ]}
    />
  );
}
