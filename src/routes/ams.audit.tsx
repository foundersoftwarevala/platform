import { createFileRoute } from "@tanstack/react-router";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

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
    <EngineDashboard
      kicker="AMS Governance"
      title="Audit Logs"
      description="Every user, reward, XP, achievement, admin and system action — captured with actor, target, scope and outcome."
      primaryAction="Export Trail"
      kpis={[
        { label: "Events (24h)", value: "18,402", delta: "+6%", trend: "up" },
        { label: "Admin Actions", value: "412", delta: "+3%", trend: "up" },
        { label: "Reward Events", value: "5,128", delta: "+11%", trend: "up" },
        { label: "XP Events", value: "9,644", delta: "+8%", trend: "up" },
        { label: "Failed / Denied", value: "37", delta: "-14%", trend: "down" },
        { label: "Retention", value: "365d" },
      ]}
      filters={[
        { label: "Scope", values: ["User", "Reward", "XP", "Achievement", "Admin", "System"] },
        { label: "Outcome", values: ["Success", "Denied", "Failed"] },
        { label: "Window", values: ["24h", "7d", "30d", "90d"] },
      ]}
      columns={[
        { key: "time", label: "Timestamp" },
        { key: "scope", label: "Scope" },
        { key: "action", label: "Action" },
        { key: "actor", label: "Actor" },
        { key: "target", label: "Target" },
        { key: "outcome", label: "Outcome" },
      ]}
      rows={[
        { id: "a1", time: "2026-07-30 09:41", scope: "Achievement", action: "achievement.unlocked", actor: "system", target: "priya@demo.app · Recognition Legend", outcome: <StatusChip tone="success">Success</StatusChip> },
        { id: "a2", time: "2026-07-30 09:36", scope: "XP", action: "xp.granted (+250)", actor: "rules-engine", target: "arjun@demo.app", outcome: <StatusChip tone="success">Success</StatusChip> },
        { id: "a3", time: "2026-07-30 09:22", scope: "Reward", action: "reward.claim.approved", actor: "admin@demo.app", target: "Claim #48213", outcome: <StatusChip tone="success">Success</StatusChip> },
        { id: "a4", time: "2026-07-30 09:05", scope: "Admin", action: "role.assigned (admin)", actor: "superadmin@demo.app", target: "meera@demo.app", outcome: <StatusChip tone="success">Success</StatusChip> },
        { id: "a5", time: "2026-07-30 08:58", scope: "User", action: "profile.updated", actor: "kabir@demo.app", target: "self", outcome: <StatusChip tone="success">Success</StatusChip> },
        { id: "a6", time: "2026-07-30 08:44", scope: "Reward", action: "reward.claim.rejected", actor: "admin@demo.app", target: "Claim #48198", outcome: <StatusChip tone="warn">Denied</StatusChip> },
        { id: "a7", time: "2026-07-30 08:31", scope: "System", action: "leaderboard.rebuild", actor: "scheduler", target: "Global · Weekly", outcome: <StatusChip tone="success">Success</StatusChip> },
        { id: "a8", time: "2026-07-30 08:12", scope: "Admin", action: "policy.update (xp cap)", actor: "superadmin@demo.app", target: "XP Engine", outcome: <StatusChip tone="success">Success</StatusChip> },
        { id: "a9", time: "2026-07-30 07:57", scope: "XP", action: "xp.revoked (-120)", actor: "admin@demo.app", target: "rahul@demo.app", outcome: <StatusChip tone="warn">Reversal</StatusChip> },
        { id: "a10", time: "2026-07-30 07:40", scope: "System", action: "notification.dispatch", actor: "notification-engine", target: "Rank promotion · 3,412 users", outcome: <StatusChip tone="success">Success</StatusChip> },
        { id: "a11", time: "2026-07-30 07:18", scope: "User", action: "login.failed", actor: "unknown", target: "vendor@demo.app", outcome: <StatusChip tone="danger">Failed</StatusChip> },
        { id: "a12", time: "2026-07-30 06:55", scope: "Achievement", action: "achievement.published", actor: "admin@demo.app", target: "Mentor of the Month", outcome: <StatusChip tone="success">Success</StatusChip> },
      ]}
      emptyLabel="No audit events match these filters."
    />
  );
}
