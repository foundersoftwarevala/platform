import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCommandCenter } from "@/lib/ams/dashboard.functions";
import { getUserAMSProfile } from "@/lib/ams/core.functions";
import { Msg, useTranslation } from "@/lib/i18n/use-translation";
import {
  Row1Totals, Row2Progress, Row3Collections, Row4Leaderboards, Row5Missions,
  Row6Engagement, Row7Wallets, Row8Rewards, Row9Timelines, Row10AI,
  Row11Heatmaps, Row12Analytics, Row13Halls, SectionTitle,
} from "@/components/dashboard/Widgets";

type CommandCenterData = Awaited<ReturnType<typeof getCommandCenter>>;

const dashOpts = (fn: () => Promise<CommandCenterData>) =>
  queryOptions({ queryKey: ["command-center"], queryFn: fn });

export const Route = createFileRoute("/ams/overview")({
  head: () => ({
    meta: [
      { title: "Command Center — AMS" },
      { name: "description", content: "Command Center inside the AMS achievement management suite — live data, controls and insights for your recognition program." },
      { property: "og:title", content: "Command Center — AMS" },
      { property: "og:description", content: "Command Center inside the AMS achievement management suite — live data, controls and insights for your recognition program." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashOpts(getCommandCenter)),
  component: CommandCenter,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  pendingComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">
      <Msg k="ams.booting_command_center" />
    </div>
  ),
});

function CommandCenter() {
  const { t } = useTranslation();
  const fn = useServerFn(getCommandCenter);
  const { data } = useSuspenseQuery(dashOpts(fn));
  const profileName =
    data.profile?.full_name?.trim() ||
    data.profile?.username?.trim() ||
    t("ams.member");

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t("ams.welcome_back")}</div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient-primary">
            {profileName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("ams.command_center_description")}</p>
        </div>
      </div>

      <CoreProgress />



      <section><SectionTitle kicker={t("ams.totals_section")} title={t("ams.at_a_glance")} /><Row1Totals data={data} /></section>
      <section><SectionTitle kicker={t("ams.progression_section")} title={t("ams.progression_summary")} /><Row2Progress data={data} /></section>
      <section><SectionTitle kicker={t("ams.collections_section")} title={t("ams.collections_summary")} /><Row3Collections data={data} /></section>
      <section><SectionTitle kicker={t("ams.leaderboards_section")} title={t("ams.leaderboards_summary")} /><Row4Leaderboards data={data} /></section>
      <section><SectionTitle kicker={t("ams.missions_section")} title={t("ams.missions_summary")} /><Row5Missions data={data} /></section>
      <section><SectionTitle kicker={t("ams.engagement_section")} title={t("ams.engagement_summary")} /><Row6Engagement data={data} /></section>
      <section><SectionTitle kicker={t("ams.wallets_section")} title={t("ams.wallets_summary")} /><Row7Wallets data={data} /></section>
      <section><SectionTitle kicker={t("ams.rewards_section")} title={t("ams.rewards_summary")} /><Row8Rewards data={data} /></section>
      <section><SectionTitle kicker={t("ams.timelines_section")} title={t("ams.timelines_summary")} /><Row9Timelines data={data} /></section>
      <section><SectionTitle kicker={t("ams.ai_center_section")} title={t("ams.ai_center_summary")} /><Row10AI /></section>
      <section><SectionTitle kicker={t("ams.heatmaps_section")} title={t("ams.heatmaps_summary")} /><Row11Heatmaps data={data} /></section>
      <section><SectionTitle kicker={t("ams.analytics_section")} title={t("ams.analytics_summary")} /><Row12Analytics data={data} /></section>
      <section><SectionTitle kicker={t("ams.halls_section")} title={t("ams.halls_summary")} /><Row13Halls data={data} /></section>
    </div>
  );
}

function CoreProgress() {
  const { t } = useTranslation();
  const fetchProfile = useServerFn(getUserAMSProfile);
  const profileQuery = useQuery({
    queryKey: ["ams", "core-profile"],
    queryFn: () => fetchProfile({ data: {} }),
    staleTime: 30_000,
  });

  if (profileQuery.isPending) {
    return <div className="surface-card p-5 text-sm text-muted-foreground">{t("ams.loading_progression")}</div>;
  }
  if (profileQuery.isError) {
    return (
      <div className="surface-card p-5 text-sm text-destructive" role="alert">
        {t("ams.progression_load_error", { error: profileQuery.error.message })}
      </div>
    );
  }

  const profile = profileQuery.data;
  const standing = profile.standings[0];
  const unlocked = profile.achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <section className="surface-card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" aria-label={t("ams.verified_progression")}>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("ams.highest_role_xp")}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{standing?.totalXp.toLocaleString() ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{standing?.role ?? t("ams.no_role_recorded")}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("ams.highest_role_level")}</div>
        <div className="mt-1 text-2xl font-semibold">{standing ? t("ams.level_value", { level: standing.level }) : "—"}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("ams.highest_role_rank")}</div>
        <div className="mt-1 text-2xl font-semibold">{standing ? t("ams.rank_value", { rank: standing.rank }) : "—"}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("ams.achievements")}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {unlocked} / {profile.achievements.length}
        </div>
      </div>
    </section>
  );
}
