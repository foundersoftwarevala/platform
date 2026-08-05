import {
  Activity, ArrowUpRight, Award, ChevronRight, Flame, Play, Sparkles, Star,
  Trophy, Zap, type LucideIcon,
} from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { KpiCard } from "@/components/creator/KpiCard";
import { Sparkline } from "@/components/creator/Sparkline";
import type { NavGroup, NavItem } from "@/components/creator/navigation";
import { moduleAnalyticsQueryOptions, type ModuleId } from "@/lib/creator/analytics.functions";
import type { MetricKey } from "@/lib/creator/types";

export interface KpiDef {
  key: MetricKey;
  label: string;
  icon: LucideIcon;
  tint: string;
}

export interface WallDef {
  title: string;
  icon: LucideIcon;
  tint: string;
  action: string;
  target: string;
  empty: string;
}

export interface ModuleConfig {
  id: ModuleId;
  brand: string;
  brandMark: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  primary: NavItem[];
  groups: NavGroup[];
  defaultModule: string;
  kpis: KpiDef[];
  primaryCta: { label: string; target: string };
  secondaryCta: { label: string; target: string };
  profile: { title: string; caption: string; stats: Array<[string, string]> };
  plan: Array<[string, string, string]>;
  balance: { label: string; key: MetricKey; action: string; target: string };
  walls: [WallDef, WallDef];
  leaderboardEmpty: string;
  suggestions: string[];
}

/**
 * Dashboard CONTENT only — the sidebar, top bar, page shell and toaster are
 * owned by the single workspace shell (ManagerWorkspace). Never render layout
 * chrome here: that is what caused duplicate sidebars.
 */
export function ModuleDashboard({
  config,
  onNavigate,
}: {
  config: ModuleConfig;
  onNavigate?: (label: string) => void;
}) {
  const { data: analytics } = useSuspenseQuery(moduleAnalyticsQueryOptions(config.id, "7d"));
  const { metrics, connected } = analytics;
  const balance = metrics[config.balance.key];

  const selectModule = (label: string) => {
    if (onNavigate) onNavigate(label);
    else toast.info(`${label} — connect the Software Vala API to stream live data.`);
  };

  return (
    <>
          {/* HERO */}
          <section className="hero-surface relative overflow-hidden p-6 md:p-10">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent-pink/40 blur-3xl" />

            <div className="relative grid items-start gap-8 lg:grid-cols-2">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" /> {config.eyebrow}
                </div>
                <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">
                  {config.title}
                </h1>
                <p className="mt-3 max-w-md text-white/80">{config.subtitle}</p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => selectModule(config.primaryCta.target)}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90"
                  >
                    {config.primaryCta.label} <ArrowUpRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => selectModule(config.secondaryCta.target)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-5 py-2.5 text-sm font-medium backdrop-blur transition hover:bg-white/25"
                  >
                    <Sparkles className="h-4 w-4" /> {config.secondaryCta.label}
                  </button>
                  <span
                    className={
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium " +
                      (connected
                        ? "border-accent-emerald/40 bg-accent-emerald/15 text-accent-emerald"
                        : "border-white/20 bg-white/10 text-white/80")
                    }
                  >
                    <Activity className="h-3 w-3" />
                    {connected ? `Live · ${analytics.source}` : "Not connected"}
                  </span>
                </div>
              </div>

              <div className="w-full max-w-sm lg:justify-self-end">
                <div className="rounded-2xl border border-white/15 bg-black/25 p-5 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="block h-14 w-14 rounded-full bg-gradient-to-br from-accent-pink to-primary-glow" />
                      <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-accent-amber text-black">
                        <Star className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold">{config.profile.title}</p>
                        <Award className="h-4 w-4 text-accent-amber" />
                      </div>
                      <p className="text-xs text-white/70">
                        {connected ? "Live profile" : config.profile.caption}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {config.profile.stats.map(([l, v]) => (
                      <div key={l} className="rounded-xl border border-white/15 bg-white/10 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-white/60">{l}</p>
                        <p className="text-sm font-semibold">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* KPI GRID */}
          <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {config.kpis.map(({ key, label, icon, tint }) => (
              <KpiCard
                key={key}
                label={label}
                icon={icon}
                tint={tint}
                connected={connected}
                snap={metrics[key]}
              />
            ))}
          </section>

          {/* BENTO ROW */}
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="bento-card lg:col-span-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Today's plan</h3>
                <span className="text-xs text-muted-foreground">
                  {connected ? "Live" : "Awaiting data"}
                </span>
              </div>
              <p className="mt-1 text-3xl font-bold tracking-tight">Your day</p>
              <ul className="mt-5 divide-y divide-border">
                {config.plan.map(([task, ch, time]) => (
                  <li key={task} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
                        <Play className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{task}</p>
                        <p className="text-xs text-muted-foreground">{ch}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{time}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div
                className="rounded-2xl border border-border p-5"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.78 0.16 350 / 0.25), oklch(0.62 0.24 295 / 0.15))",
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Team XP</p>
                    <p className="mt-1 text-3xl font-bold">0 pts</p>
                  </div>
                  <Flame className="h-5 w-5 text-accent-pink" />
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/30">
                  <div className="h-full w-[6%] bg-gradient-to-r from-accent-pink to-primary" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Reach Rookie 100 XP to unlock the next rank
                </p>
              </div>

              <div
                className="rounded-2xl border border-border p-5"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.85 0.17 85 / 0.22), oklch(0.74 0.16 165 / 0.12))",
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Reviews</p>
                    <p className="mt-1 text-3xl font-bold">—</p>
                  </div>
                  <Star className="h-5 w-5 text-accent-amber" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Customer reviews appear here after the first recorded sale.
                </p>
              </div>
            </div>

            <div className="bento-card relative overflow-hidden">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
              <div className="relative">
                <p className="text-xs text-muted-foreground">{config.balance.label}</p>
                <p className="mt-1 text-4xl font-bold tracking-tight">
                  {connected || balance.value > 0
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(balance.value)
                    : "—"}
                </p>

                <div className="mt-6 text-primary-glow">
                  <Sparkline
                    data={balance.series}
                    height={70}
                    width={240}
                    strokeWidth={2}
                    fill="oklch(0.72 0.22 305 / 0.18)"
                  />
                </div>

                <button
                  onClick={() => selectModule(config.balance.target)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-glow hover:underline"
                >
                  {config.balance.action} <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </section>

          {/* WALLS */}
          <section className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {config.walls.map((wall) => (
              <div key={wall.title} className="bento-card">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <wall.icon className={`h-4 w-4 ${wall.tint}`} /> {wall.title}
                  </h3>
                  <button
                    onClick={() => selectModule(wall.target)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {wall.action}
                  </button>
                </div>
                <div className="rounded-xl border border-dashed border-border py-12 text-center">
                  <p className="text-sm text-muted-foreground">{wall.empty}</p>
                </div>
              </div>
            ))}

            <div className="bento-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Trophy className="h-4 w-4 text-accent-amber" /> Leaderboard
                </h3>
                <button
                  onClick={() => selectModule("Leaderboard")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Full board
                </button>
              </div>
              <ul className="divide-y divide-border">
                {[1, 2, 3, 4, 5].map((r) => (
                  <li key={r} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-xs font-semibold">
                      {r}
                    </span>
                    <span className="h-7 w-7 rounded-full bg-gradient-to-br from-accent-pink to-primary" />
                    <p className="flex-1 text-sm">{config.leaderboardEmpty}</p>
                    <span className="text-xs text-muted-foreground">— XP</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bento-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Zap className="h-4 w-4 text-accent-emerald" /> AI Suggestions
                </h3>
                <button
                  onClick={() => selectModule("AI Chat")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Open AI
                </button>
              </div>
              <ul className="space-y-2.5">
                {config.suggestions.map((t) => (
                  <li
                    key={t}
                    className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-glow" />
                    <p className="text-sm text-foreground/90">{t}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            {connected
              ? `Source: ${analytics.source} · updated ${new Date(analytics.generatedAt).toUTCString()}`
              : "Configure SOFTWARE_VALA_API_URL and SOFTWARE_VALA_API_KEY to stream live data. No mock data is shown."}
          </p>
    </>
  );
}
