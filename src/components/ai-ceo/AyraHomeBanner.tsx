import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, Eye, RefreshCw, Sparkles } from "lucide-react";

import { AYRA_LOOKS } from "@/components/ai-ceo/ayra-assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAyraLiveFeed } from "@/lib/ayra/functions";
import { useTranslation } from "@/lib/i18n/use-translation";

export function AyraHomeBanner() {
  const { t, formatDate } = useTranslation();
  const readLiveFeed = useServerFn(getAyraLiveFeed);
  const feed = useQuery({
    queryKey: ["ayra", "platform-health"],
    queryFn: () => readLiveFeed(),
    staleTime: 60_000,
  });

  const statusKey = feed.isPending
    ? "ceo.ayra_home_syncing"
    : feed.isError
      ? "ceo.ayra_home_unavailable"
      : "ceo.ayra_home_live";

  const metrics = [
    {
      label: t("ceo.ayra_home_active_tasks"),
      value: feed.data?.activeTasks,
      icon: Activity,
    },
    {
      label: t("ceo.ayra_home_broken_promises"),
      value: feed.data?.brokenPromises,
      icon: AlertTriangle,
    },
    {
      label: t("ceo.ayra_home_priority_alerts"),
      value: feed.data?.alerts.length,
      icon: Sparkles,
    },
  ];
  const portrait = AYRA_LOOKS.find((look) => look.id === "cyanJacket") ?? AYRA_LOOKS[0];

  return (
    <section
      aria-labelledby="ayra-home-banner-title"
      className="hero-surface relative isolate overflow-hidden rounded-2xl border border-primary/25"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 left-1/4 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl"
      />

      <div className="relative grid gap-5 p-5 sm:gap-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-white/20 bg-white/10 text-primary-foreground hover:bg-white/10">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              <span data-no-translate>AYRA</span>
            </Badge>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-primary-foreground/90">
              <Eye className="h-3 w-3" aria-hidden="true" />
              {t("ceo.ayra_home_read_only")}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-primary-foreground/90"
              role="status"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  feed.isError
                    ? "bg-amber-300"
                    : feed.isPending
                      ? "animate-pulse bg-white"
                      : "animate-pulse bg-emerald-300 motion-reduce:animate-none"
                }`}
              />
              {t(statusKey)}
            </span>
          </div>

          <h2
            id="ayra-home-banner-title"
            className="mt-3 text-xl font-semibold tracking-tight text-primary-foreground sm:text-2xl"
          >
            {t("ceo.ayra_home_title")}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-primary-foreground/80">
            {t("ceo.ayra_home_description")}
          </p>

          <dl className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {metrics.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/10 px-3 py-2.5 backdrop-blur"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary-foreground/80" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="truncate text-[11px] text-primary-foreground/75">{label}</dt>
                  <dd className="text-base font-semibold tabular-nums text-primary-foreground">
                    {value === undefined ? "—" : value.toLocaleString()}
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          {feed.isPending && (
            <p role="status" className="mt-3 text-xs text-primary-foreground/80">
              <RefreshCw className="mr-1.5 inline h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t("ceo.ayra_feed_loading")}
            </p>
          )}
          {feed.isError && (
            <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-primary-foreground/90">
                {t("ceo.ayra_feed_failed")}{" "}
                {feed.error instanceof Error ? feed.error.message : t("ceo.ayra_feed_data_error")}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void feed.refetch()}
                className="h-7"
              >
                {t("ceo.ayra_retry")}
              </Button>
            </div>
          )}
          {feed.data && (
            <p className="mt-3 text-[11px] text-primary-foreground/75">
              {t("ceo.ayra_feed_counts", {
                date: formatDate(feed.data.asOf, { dateStyle: "medium", timeStyle: "short" }),
                active: feed.data.activeTasks,
                broken: feed.data.brokenPromises,
                pending: feed.data.pendingPayments,
                chatSessions: feed.data.chatSessions,
                chatMessages: feed.data.chatMessages,
                amsEvents: feed.data.amsEvents,
                amsAwards: feed.data.amsAwards,
              })}
            </p>
          )}
        </div>

        <div className="lg:w-[min(100%,22rem)]">
          <div className="relative isolate aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/30 bg-white shadow-[0_18px_55px_-25px_rgba(0,0,0,0.7)]">
            <img
              src={portrait.portrait}
              alt={`${t("ceo.ayra_title")} — ${portrait.name}`}
              width={768}
              height={1280}
              loading="eager"
              className="absolute inset-0 h-full w-full object-contain object-bottom"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-slate-950/75"
            />
            <div className="absolute inset-x-4 bottom-4">
              <p className="text-lg font-semibold tracking-tight text-white">
                {t("ceo.ayra_title")}
              </p>
              <p className="mt-0.5 text-xs text-white/80">{portrait.name}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
