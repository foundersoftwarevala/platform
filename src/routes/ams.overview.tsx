import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCommandCenter } from "@/lib/ams/dashboard.functions";
import {
  Row1Totals, Row2Progress, Row3Collections, Row4Leaderboards, Row5Missions,
  Row6Engagement, Row7Wallets, Row8Rewards, Row9Timelines, Row10AI,
  Row11Heatmaps, Row12Analytics, Row13Halls, SectionTitle,
} from "@/components/dashboard/Widgets";
import { RoleAchievementShowcase } from "@/components/ams/shared/RoleAchievementShowcase";

const dashOpts = (fn: () => Promise<any>) =>
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
  pendingComponent: () => <div className="p-8 text-sm text-muted-foreground">Booting command center…</div>,
});

function CommandCenter() {
  const fn = useServerFn(getCommandCenter);
  const { data } = useSuspenseQuery(dashOpts(fn));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">welcome back</div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient-primary">
            {data.profile?.display_name ?? "Operator"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your achievement command center. Live data, every signal.</p>
        </div>
      </div>

      <RoleAchievementShowcase name={data.profile?.display_name ?? "Operator"} />



      <section><SectionTitle kicker="01 · Totals" title="At a glance" /><Row1Totals data={data} /></section>
      <section><SectionTitle kicker="02 · Progression" title="XP, levels, ranks, streaks" /><Row2Progress data={data} /></section>
      <section><SectionTitle kicker="03 · Collections" title="Achievements, badges, trophies" /><Row3Collections data={data} /></section>
      <section><SectionTitle kicker="04 · Leaderboards" title="Where you stand" /><Row4Leaderboards data={data} /></section>
      <section><SectionTitle kicker="05 · Missions" title="Daily through seasonal" /><Row5Missions data={data} /></section>
      <section><SectionTitle kicker="06 · Engagement" title="Challenges, quests, campaigns, events" /><Row6Engagement data={data} /></section>
      <section><SectionTitle kicker="07 · Wallets" title="Your economy" /><Row7Wallets data={data} /></section>
      <section><SectionTitle kicker="08 · Rewards" title="Store, claims, history" /><Row8Rewards data={data} /></section>
      <section><SectionTitle kicker="09 · Activity timelines" title="What just happened" /><Row9Timelines data={data} /></section>
      <section><SectionTitle kicker="10 · AI Center" title="Growth, recommendations, suggestions" /><Row10AI /></section>
      <section><SectionTitle kicker="11 · Heatmaps" title="Patterns over time" /><Row11Heatmaps data={data} /></section>
      <section><SectionTitle kicker="12 · Analytics" title="Drill-down metrics" /><Row12Analytics data={data} /></section>
      <section><SectionTitle kicker="13 · Halls" title="Champions, legends, top performers" /><Row13Halls data={data} /></section>
    </div>
  );
}
