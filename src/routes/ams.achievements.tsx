import { createFileRoute } from "@tanstack/react-router";
import { LockKeyhole, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";
import { getUserAMSProfile } from "@/lib/ams/core.functions";

/**
 * Shows the signed-in user's actual unlocked achievements and available
 * achievements from the canonical AMS catalogue.
 */
export const Route = createFileRoute("/ams/achievements")({
  head: () => ({
    meta: [
      { title: "Achievement Engine — AMS" },
      { name: "description", content: "Your unlocked achievements and available AMS badges." },
      { property: "og:title", content: "Achievement Engine — AMS" },
      { property: "og:description", content: "Your unlocked achievements and available AMS badges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function chip(unlocked: boolean) {
  return (
    <StatusChip tone={unlocked ? "success" : "muted"}>
      {unlocked ? "Unlocked" : "Locked"}
    </StatusChip>
  );
}

function Page() {
  const fetchProfile = useServerFn(getUserAMSProfile);
  const profileQuery = useQuery({
    queryKey: ["ams", "core-profile"],
    queryFn: () => fetchProfile({ data: {} }),
    staleTime: 30_000,
  });
  const achievements = profileQuery.data?.achievements ?? [];
  const unlocked = achievements.filter((achievement) => achievement.unlocked).length;
  const rarityCounts = achievements.reduce<Record<string, number>>((counts, achievement) => {
    counts[achievement.type] = (counts[achievement.type] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <EngineDashboard
      kicker="Developer AMS"
      title="My Achievements"
      description={
        profileQuery.isPending
          ? "Loading your achievement record…"
          : profileQuery.isError
            ? "Your achievement record is unavailable."
            : `${unlocked} of ${achievements.length} available achievements unlocked.`
      }
      kpis={[
        { label: "Available", value: achievements.length },
        { label: "Unlocked", value: unlocked },
        { label: "Locked", value: achievements.length - unlocked },
        { label: "Common", value: rarityCounts.common ?? 0 },
        { label: "Rare", value: rarityCounts.rare ?? 0 },
        { label: "Epic+", value: (rarityCounts.epic ?? 0) + (rarityCounts.legendary ?? 0) + (rarityCounts.mythic ?? 0) },
      ]}
      filters={[
        { label: "Type", key: "type", values: [] },
        { label: "Status", key: "status", values: ["Unlocked", "Locked"] },
      ]}
      columns={[
        { key: "title", label: "Achievement" },
        { key: "type", label: "Type" },
        { key: "xp", label: "XP reward", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={achievements.map((achievement) => ({
        id: achievement.id,
        title: (
          <div className="flex items-center gap-2">
            {achievement.unlocked
              ? <Trophy className="h-4 w-4 text-primary" />
              : <LockKeyhole className="h-4 w-4 text-muted-foreground" />}
            <span className="font-medium">{achievement.title}</span>
          </div>
        ),
        type: <span className="capitalize">{achievement.type}</span>,
        xp: achievement.xpReward.toLocaleString(),
        status: chip(achievement.unlocked),
      }))}
      loading={profileQuery.isPending}
      error={profileQuery.isError ? profileQuery.error.message : null}
      onRetry={() => void profileQuery.refetch()}
      emptyLabel="No achievements are available for this account."
    />
  );
}
