import { type ReactNode } from "react";
import { Activity, ArrowUpRight, BellRing, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { SECTIONS, type SectionId } from "./TopBar";
import { useUnreadCount } from "./notifications";
import { BrandMark } from "./BrandMark";

/** 4K-friendly dense content container used by every marketplace screen. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] 2xl:max-w-[1840px]">{children}</div>
  );
}

/**
 * Branded hero banner rendered on every screen — mirrors the launchpad
 * hero-surface treatment and surfaces live notification state.
 */
export function SectionBanner({
  active,
  onNavigate,
}: {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
}) {
  const { translate: t } = useLanguage();
  const section = SECTIONS.find((s) => s.id === active);
  const Icon = section?.icon ?? Sparkles;
  const unread = useUnreadCount();

  return (
    <div className="px-4 pt-6 md:px-8">
    <section className="hero-surface relative overflow-hidden p-5 sm:p-7 lg:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent-pink/30 blur-3xl" />

      <div className="relative grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              Software Vala · {section?.groupLabel ? t(section.groupLabel) : t("Marketplace")}
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[34px]">
            {section?.label ? t(section.label) : t("Dashboard")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/80">
            {t("Manage {thing} end to end — content, configuration and live storefront behaviour from one command center.",).replace("{thing}", section?.label ? t(section.label).toLowerCase() : t("your marketplace"))}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate("notifications" as SectionId)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90"
            >
              <BellRing className="h-4 w-4" />
              {unread > 0 ? `${unread} ${t("new alerts")}` : t("All caught up")}
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => onNavigate("analytics" as SectionId)}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-5 py-2.5 text-sm font-medium backdrop-blur transition hover:bg-white/25"
            >
              <Sparkles className="h-4 w-4" /> {t("Insights")}
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-emerald/40 bg-accent-emerald/15 px-3 py-1.5 text-[11px] font-medium text-accent-emerald">
              <Activity className="h-3 w-3" /> {t("Live")}
            </span>
          </div>
        </div>

        <div className="w-full max-w-sm lg:justify-self-end">
          <div className="rounded-2xl border border-white/15 bg-black/25 p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <BrandMark size={48} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t("Marketplace Manager")}</p>
                <p className="text-[11px] text-white/70">{t("Software Vala")} · {t("The Name of Trust")}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Alerts", String(unread)],
                ["Modules", String(SECTIONS.length)],
                ["Status", "OK"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-white/15 bg-white/10 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/60">{t(l)}</p>
                  <p className="text-sm font-semibold">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
    </div>
  );
}
