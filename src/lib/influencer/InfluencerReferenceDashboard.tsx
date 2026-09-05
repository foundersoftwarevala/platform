import { ArrowUpRight, BarChart3, CheckCircle2, Megaphone, ShieldCheck, Sparkles, UserPlus, Users, Wallet } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { influencerDashboardQueryOptions } from "@/lib/influencer/analytics";
import type { ModuleConfig } from "@/components/creator/ModuleDashboard";
import { useLanguage } from "@/lib/language-catalog";

const links = [
  ["Creator Lifecycle", "Influencers", Users],
  ["Verification", "Verification", ShieldCheck],
  ["Campaigns", "Campaigns", Megaphone],
  ["Payouts", "Payouts", Wallet],
  ["Analytics", "Analytics", BarChart3],
  ["Applications", "Applications", UserPlus],
] as const;

export function InfluencerReferenceDashboard({
  config,
  onNavigate,
}: {
  config: ModuleConfig;
  onNavigate?: (label: string) => void;
}) {
  const { data } = useSuspenseQuery(influencerDashboardQueryOptions());
  const { translate: t } = useLanguage();
  const { metrics, connected } = data;
  const number = (key: keyof typeof metrics) => metrics[key]?.value ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="hero-surface relative overflow-hidden p-6 md:p-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent-pink/40 blur-3xl" />
        <div className="relative grid items-start gap-8 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Software Vala - Boss Panel Module
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">Influencer Manager</h1>
            <p className="mt-3 max-w-md text-white/80">Onboard creators, run campaigns, verify documents and settle payouts from one control surface.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => onNavigate?.("Campaigns")} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary hover:bg-white/90">
                <Megaphone className="h-4 w-4" /> {t("Create a Campaign")} <ArrowUpRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onNavigate?.("Applications")} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-white/20">
                <UserPlus className="h-4 w-4" /> {t("Review Applications")}
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium">
                <CheckCircle2 className="h-3 w-3" /> {connected ? `${t("Live")} - ${data.source}` : t("Sign in to load live data")}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:justify-self-end lg:w-full">
            {links.map(([label, target, Icon]) => (
              <button key={target} type="button" onClick={() => onNavigate?.(target)} className="group rounded-2xl border border-white/20 bg-white/10 p-4 text-left backdrop-blur hover:bg-white/20">
                <div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold leading-snug">{label}</span><Icon className="h-3.5 w-3.5 opacity-70" /></div>
                <div className="mt-3 h-1 w-8 rounded-full bg-white/40" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {config.kpis.map(({ key, label, icon: Icon, tint }) => (
          <div key={key} className="bento-card p-4">
            <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span><Icon className={`h-4 w-4 shrink-0 ${tint}`} /></div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{connected ? number(key) : "-"}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{connected ? t("Live records") : t("No live session")}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="bento-card lg:col-span-2">
          <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Network pulse</p><h2 className="mt-1 text-xl font-semibold">Real performance snapshot</h2></div><BarChart3 className="h-5 w-5 text-primary-glow" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[["Followers", "followers"], ["Campaign revenue", "revenue"], ["Won leads", "sales"]].map(([label, key]) => <div key={key} className="rounded-xl border border-border bg-background/40 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{connected ? number(key as keyof typeof metrics).toLocaleString() : "-"}</p></div>)}
          </div>
        </div>
          <div className="bento-card"><p className="text-xs uppercase tracking-wider text-muted-foreground">{t("Connected source")}</p><h2 className="mt-1 text-xl font-semibold">{connected ? t("Supabase marketing data") : t("Authentication required")}</h2><p className="mt-3 text-sm text-muted-foreground">{connected ? `${t("Updated")} ${new Date(data.generatedAt).toUTCString()}` : t("Sign in with an authorized manager account to access creator records.")}</p></div>
      </section>
    </div>
  );
}