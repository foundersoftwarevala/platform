import { createFileRoute } from "@tanstack/react-router";
import { LockKeyhole, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";
import { getUserAMSProfile } from "@/lib/ams/core.functions";
import { useTranslation } from "@/lib/i18n/use-translation";

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

function chip(unlocked: boolean, labels: { unlocked: string; locked: string }) {
  return (
    <StatusChip tone={unlocked ? "success" : "muted"}>
      {unlocked ? labels.unlocked : labels.locked}
    </StatusChip>
  );
}

function Page() {
  const { t } = useTranslation();
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
      kicker={t("ams.developer_ams")}
      title={t("ams.my_achievements")}
      description={
        profileQuery.isPending
          ? t("ams.loading_achievement_record")
          : profileQuery.isError
            ? t("ams.achievement_record_unavailable")
            : t("ams.achievements_unlocked_count", {
                unlocked,
                total: achievements.length,
              })
      }
      kpis={[
        { label: t("ams.available"), value: achievements.length },
        { label: t("ams.unlocked"), value: unlocked },
        { label: t("ams.locked"), value: achievements.length - unlocked },
        { label: t("ams.common"), value: rarityCounts.common ?? 0 },
        { label: t("ams.rare"), value: rarityCounts.rare ?? 0 },
        { label: t("ams.epic_plus"), value: (rarityCounts.epic ?? 0) + (rarityCounts.legendary ?? 0) + (rarityCounts.mythic ?? 0) },
      ]}
      filters={[
        { label: t("ams.type"), key: "type", values: [] },
        { label: t("ams.status"), key: "status", values: [t("ams.unlocked"), t("ams.locked")] },
      ]}
      columns={[
        { key: "title", label: t("ams.achievement") },
        { key: "type", label: t("ams.type") },
        { key: "xp", label: t("ams.xp_reward"), align: "right" },
        { key: "status", label: t("ams.status") },
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
        status: chip(achievement.unlocked, {
          unlocked: t("ams.unlocked"),
          locked: t("ams.locked"),
        }),
      }))}
      loading={profileQuery.isPending}
      error={profileQuery.isError ? profileQuery.error.message : null}
      onRetry={() => void profileQuery.refetch()}
      emptyLabel={t("ams.no_achievements_available")}
    />
  );
}
