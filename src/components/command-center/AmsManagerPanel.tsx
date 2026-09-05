import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@/lib/serverFn";
import { getCommandCenter } from "@/lib/ams/dashboard.functions";
import {
  Row1Totals, Row2Progress, Row3Collections, Row4Leaderboards, Row5Missions,
  Row6Engagement, Row7Wallets, Row8Rewards, Row9Timelines, Row10AI,
  Row11Heatmaps, Row12Analytics, Row13Halls, SectionTitle,
} from "@/components/dashboard/Widgets";
import { RoleAchievementShowcase } from "@/components/ams/shared/RoleAchievementShowcase";

const dashboardOptions = (fn: () => Promise<any>) =>
  queryOptions({ queryKey: ["ams-command-center"], queryFn: fn });

export function AmsManagerPanel() {
  const fetchDashboard = useServerFn(getCommandCenter);
  const { data } = useSuspenseQuery(dashboardOptions(fetchDashboard));

  return (
    <div className="ams-manager-panel max-h-[calc(100vh-150px)] space-y-6 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1020] p-4 text-foreground shadow-[0_24px_70px_-35px_rgba(80,80,255,0.8)] md:p-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AMS Manager · Command Center</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-gradient-primary">{data.profile?.display_name ?? "Operator"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Achievement management, recognition, progression and rewards.</p>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-300">
          {data.profile ? "LIVE DATA" : "EMPTY STATE"}
        </span>
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
