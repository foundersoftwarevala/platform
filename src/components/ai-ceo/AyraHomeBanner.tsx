import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  Eye,
  LoaderCircle,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAyra, getAyraLiveFeed } from "@/lib/ayra/functions";
import { useTranslation } from "@/lib/i18n/use-translation";

export function AyraHomeBanner() {
  const { t, formatDate } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const readLiveFeed = useServerFn(getAyraLiveFeed);
  const ask = useServerFn(askAyra);

  const feed = useQuery({
    queryKey: ["ayra", "platform-health"],
    queryFn: () => readLiveFeed(),
    staleTime: 60_000,
  });

  const chat = useMutation({
    mutationFn: (question: string) => ask({ data: { prompt: question } }),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || chat.isPending) return;

    setLastQuestion(question);
    setPrompt("");
    chat.mutate(question);
  };

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

        <div className="flex flex-col gap-4 lg:w-[min(100%,22rem)]">
          <div className="flex items-center gap-4 lg:justify-end">
            <div
              aria-hidden="true"
              className="relative grid h-16 w-16 shrink-0 place-items-center sm:h-20 sm:w-20"
            >
              <span className="absolute inset-0 rounded-full border border-cyan-100/35 motion-safe:animate-[spin_18s_linear_infinite] motion-reduce:animate-none" />
              <span className="absolute inset-2 rounded-full border border-dashed border-white/40 motion-safe:animate-[spin_24s_linear_infinite_reverse] motion-reduce:animate-none" />
              <span className="absolute inset-3 rounded-full bg-cyan-200/15 blur-md" />
              <span className="relative grid h-10 w-10 place-items-center rounded-full border border-cyan-100/60 bg-white/15 shadow-[0_0_30px_rgba(125,211,252,0.45)] sm:h-12 sm:w-12">
                <Brain className="h-5 w-5 text-white sm:h-6 sm:w-6" />
              </span>
            </div>
            <div className="min-w-0 lg:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
                {t("ceo.ayra_ask")}
              </p>
              <p className="mt-1 text-sm font-medium text-primary-foreground">
                {t("ceo.ayra_chat_description")}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={4000}
              placeholder={t("ceo.ayra_question_placeholder")}
              aria-label={t("ceo.ayra_question_label")}
              disabled={chat.isPending}
              className="min-w-0 border-white/25 bg-black/10 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-white/70"
            />
            <Button
              type="submit"
              disabled={!prompt.trim() || chat.isPending}
              aria-label={t("ceo.ayra_send")}
              className="shrink-0 bg-white text-primary hover:bg-white/90"
            >
              {chat.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </form>

          {lastQuestion && (
            <div
              aria-live="polite"
              className="max-h-40 overflow-y-auto rounded-xl border border-white/15 bg-black/10 p-3 text-xs"
            >
              <p className="font-medium text-primary-foreground/80">{lastQuestion}</p>
              {chat.isPending && (
                <p className="mt-2 flex items-center gap-2 text-primary-foreground/75">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {t("ceo.ayra_thinking")}
                </p>
              )}
              {chat.isError && (
                <p role="alert" className="mt-2 text-primary-foreground">
                  {t("ceo.ayra_chat_failed", {
                    error:
                      chat.error instanceof Error
                        ? chat.error.message
                        : t("ceo.ayra_feed_data_error"),
                  })}
                </p>
              )}
              {chat.data && (
                <>
                  <p className="mt-2 whitespace-pre-wrap text-primary-foreground">
                    {chat.data.answer}
                  </p>
                  {chat.data.toolsUsed.length > 0 && (
                    <p className="mt-2 text-primary-foreground/70">
                      {t("ceo.ayra_inspected", { tools: chat.data.toolsUsed.join(", ") })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <Link
            to="/ai-ceo/ayra"
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-white/25 bg-white/10 px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary lg:self-end"
          >
            {t("ceo.ayra_home_open")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
