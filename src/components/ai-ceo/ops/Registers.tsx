import {
  Bell,
  BrainCircuit,
  DollarSign,
  Gauge,
  Lightbulb,
  Shield,
  ShieldAlert,
} from "lucide-react";

import {
  DegradedNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  PageBanner,
  PageShell,
} from "@/components/ai-ceo/PageShell";
import { useCEOOps } from "@/hooks/useCEOOps";
import { useTranslation } from "@/lib/i18n/use-translation";

import { Day, Figure, OpsTable, OpsTile, SourceNote, ToneBadge } from "./shared";

/**
 * Four registers that are the same shape: notifications, paid-API usage,
 * security signals and AI insights.
 *
 * They share a file because they share a structure — a row of counts, a named
 * source, and a list that is allowed to be empty — and keeping them together
 * is what stops the four drifting apart. Each still has its own route and its
 * own screen; only the code lives side by side.
 *
 * Every one of them reads a table the platform already has. The imported
 * module had all four written into components as fixed arrays, which is why an
 * executive could not tell a quiet week from a disconnected feed.
 */

/** Shared frame: banner, degraded notice, tiles, source line, table. */
function Register({
  title,
  subtitle,
  icon,
  status,
  tiles,
  source,
  count,
  head,
  rows,
  empty,
  degraded,
  isLoading,
  failed,
  onRetry,
  loadingLabel,
}: {
  title: string;
  subtitle: string;
  icon: typeof Bell;
  status?: string;
  tiles: React.ReactNode;
  source?: string;
  count: number;
  head: string[];
  rows: React.ReactNode[][];
  empty: React.ReactNode;
  degraded: string[];
  isLoading: boolean;
  failed: boolean;
  onRetry: () => void;
  loadingLabel: string;
}) {
  if (isLoading) {
    return (
      <PageShell>
        <PageBanner eyebrow="AI CEO · Operations" title={title} subtitle={subtitle} icon={icon} />
        <LoadingState label={loadingLabel} />
      </PageShell>
    );
  }

  if (failed) {
    return (
      <PageShell>
        <PageBanner eyebrow="AI CEO · Operations" title={title} icon={icon} />
        <ErrorState
          title={`${title} didn't load`}
          description={`${source ?? "The source"} could not be read, so this screen cannot say what it holds.`}
          onRetry={onRetry}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageBanner
        eyebrow="AI CEO · Operations"
        title={title}
        subtitle={subtitle}
        icon={icon}
        status={status}
      />
      {degraded.length > 0 && <DegradedNotice sources={degraded} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{tiles}</div>
      <SourceNote source={source} count={count} />
      <OpsTable head={head} rows={rows} empty={empty} />
    </PageShell>
  );
}

export function NotificationCenter() {
  const { t } = useTranslation();
  const { notifications, summary, sources, degraded, isLoading, failed, refetch } = useCEOOps();
  const unread = notifications.filter((n) => !n.readAt);

  return (
    <Register
      title={t("ceo.notifications")}
      subtitle="What the platform has raised to an operator, newest first."
      icon={Bell}
      status={
        summary.notificationsUnread === null ? undefined : `${summary.notificationsUnread} unread`
      }
      loadingLabel={t("ceo.notifications_loading")}
      degraded={degraded}
      isLoading={isLoading}
      failed={failed}
      onRetry={() => void refetch()}
      source={sources.notifications}
      count={notifications.length}
      tiles={
        <>
          <OpsTile label={t("ceo.raised")} value={notifications.length || null} icon={Bell} />
          <OpsTile
            label={t("ceo.unread")}
            value={summary.notificationsUnread}
            icon={Bell}
            tone={unread.length > 0 ? "warning" : "success"}
          />
          <OpsTile
            label={t("ceo.kinds")}
            value={new Set(notifications.map((n) => n.kind).filter(Boolean)).size || null}
            icon={Bell}
          />
          <OpsTile
            label={t("ceo.newest")}
            value={notifications[0]?.createdAt?.slice(0, 10) ?? null}
            icon={Bell}
          />
        </>
      }
      head={["Title", "Kind", "State", t("ceo.raised")]}
      rows={notifications.map((n) => [
        <span key="t" className="font-medium">
          {n.title}
          {n.body && (
            <span className="mt-0.5 block max-w-[420px] truncate text-[11px] font-normal text-muted-foreground">
              {n.body}
            </span>
          )}
        </span>,
        <ToneBadge key="k" value={n.kind} />,
        <span key="s" className="text-xs text-muted-foreground">
          {n.readAt ? t("ceo.read_state") : t("ceo.unread_state")}
        </span>,
        <Day key="d" value={n.createdAt} />,
      ])}
      empty={
        <EmptyState
          icon={Bell}
          title={t("ceo.notifications_empty")}
          description="The notifications table holds no rows. This screen shows what that table contains and nothing else."
        />
      }
    />
  );
}

export function UsageWorkspace() {
  const { t } = useTranslation();
  const { usage, summary, sources, degraded, isLoading, failed, refetch } = useCEOOps();

  return (
    <Register
      title={t("ceo.usage")}
      subtitle="What the platform spent on paid providers, by day and service."
      icon={DollarSign}
      status={summary.spendUsd === null ? "Not recorded" : `$${summary.spendUsd.toLocaleString()}`}
      loadingLabel={t("ceo.usage_loading")}
      degraded={degraded}
      isLoading={isLoading}
      failed={failed}
      onRetry={() => void refetch()}
      source={sources.usage}
      count={usage.length}
      tiles={
        <>
          <OpsTile
            label={t("ceo.spend_recorded")}
            value={summary.spendUsd === null ? null : `$${summary.spendUsd.toLocaleString()}`}
            icon={DollarSign}
            tone="warning"
          />
          <OpsTile
            label={t("ceo.requests")}
            value={usage.reduce<number | null>(
              (t, r) => (r.requests === null ? t : (t ?? 0) + r.requests),
              null,
            )}
            icon={Gauge}
          />
          <OpsTile
            label={t("ceo.tokens")}
            value={usage.reduce<number | null>(
              (t, r) => (r.tokens === null ? t : (t ?? 0) + r.tokens),
              null,
            )}
            icon={BrainCircuit}
          />
          <OpsTile
            label={t("ceo.providers")}
            value={new Set(usage.map((r) => r.provider)).size || null}
            icon={DollarSign}
          />
        </>
      }
      head={["Day", "Provider", "Service", t("ceo.requests"), t("ceo.tokens"), "Cost", "Table"]}
      rows={usage.map((row) => [
        <Day key="d" value={row.day} />,
        <span key="p" className="font-medium">
          {row.provider}
        </span>,
        <span key="s" className="text-xs text-muted-foreground">
          {row.service ?? "—"}
        </span>,
        <Figure key="r" value={row.requests} />,
        <Figure key="t" value={row.tokens} />,
        <span key="c" className="tabular-nums">
          {row.costUsd === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            `$${row.costUsd}`
          )}
        </span>,
        <code key="src" className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px]">
          {row.source}
        </code>,
      ])}
      empty={
        <EmptyState
          icon={DollarSign}
          title={t("ceo.usage_empty")}
          description="Neither finance_ai_api_usage nor usage_daily holds a row. Spend appears here as soon as a paid call is recorded."
        />
      }
    />
  );
}

export function SecurityCenter() {
  const { t } = useTranslation();
  const { security, summary, sources, degraded, isLoading, failed, refetch } = useCEOOps();
  const critical = security.filter((s) => ["critical", "high"].includes(s.severity.toLowerCase()));

  return (
    <Register
      title={t("ceo.security")}
      subtitle="Alerts the platform raised and findings its scanners recorded."
      icon={Shield}
      status={summary.securityOpen === null ? undefined : `${summary.securityOpen} unresolved`}
      loadingLabel={t("ceo.security_loading")}
      degraded={degraded}
      isLoading={isLoading}
      failed={failed}
      onRetry={() => void refetch()}
      source={sources.security}
      count={security.length}
      tiles={
        <>
          <OpsTile label={t("ceo.signals")} value={security.length || null} icon={Shield} />
          <OpsTile
            label={t("ceo.unresolved")}
            value={summary.securityOpen}
            icon={ShieldAlert}
            tone={(summary.securityOpen ?? 0) > 0 ? "danger" : "success"}
          />
          <OpsTile
            label={t("ceo.high_or_critical")}
            value={critical.length || null}
            icon={ShieldAlert}
            tone={critical.length > 0 ? "danger" : "success"}
          />
          <OpsTile
            label={t("ceo.categories")}
            value={new Set(security.map((s) => s.category).filter(Boolean)).size || null}
            icon={Shield}
          />
        </>
      }
      head={["Signal", "Severity", "Category", "State", "Detected", "Table"]}
      rows={security.map((row) => [
        <span key="t" className="font-medium">
          {row.title}
        </span>,
        <ToneBadge key="s" value={row.severity} />,
        <span key="c" className="text-xs text-muted-foreground">
          {row.category ?? "—"}
        </span>,
        <ToneBadge key="st" value={row.status} />,
        <Day key="d" value={row.detectedAt} />,
        <code key="src" className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px]">
          {row.source}
        </code>,
      ])}
      empty={
        <EmptyState
          icon={Shield}
          title={t("ceo.security_empty")}
          description="Neither security_alerts nor security_findings holds a row. A quiet register and a disconnected one look alike, which is why the source is named above."
        />
      }
    />
  );
}

export function InsightsFeed() {
  const { t } = useTranslation();
  const { insights, sources, degraded, isLoading, failed, refetch } = useCEOOps();
  const actionable = insights.filter((i) => i.recommendation);

  return (
    <Register
      title={t("ceo.insights")}
      subtitle="What the platform's own AI has concluded, with the action it proposed."
      icon={Lightbulb}
      status={`${insights.length} recorded`}
      loadingLabel={t("ceo.insights_loading")}
      degraded={degraded}
      isLoading={isLoading}
      failed={failed}
      onRetry={() => void refetch()}
      source={sources.insights}
      count={insights.length}
      tiles={
        <>
          <OpsTile
            label={t("ceo.insights_count")}
            value={insights.length || null}
            icon={Lightbulb}
          />
          <OpsTile
            label={t("ceo.with_an_action")}
            value={actionable.length || null}
            icon={Lightbulb}
            tone="success"
          />
          <OpsTile
            label={t("ceo.high_or_critical")}
            value={
              insights.filter((i) => ["critical", "high"].includes(i.severity.toLowerCase()))
                .length || null
            }
            icon={ShieldAlert}
            tone="warning"
          />
          <OpsTile
            label={t("ceo.sources")}
            value={new Set(insights.map((i) => i.source)).size || null}
            icon={BrainCircuit}
          />
        </>
      }
      head={["Insight", "Severity", "Recommended action", "Confidence", "State", "Recorded"]}
      rows={insights.map((row) => [
        <span key="t" className="font-medium">
          {row.title}
          {row.detail && (
            <span className="mt-0.5 block max-w-[380px] truncate text-[11px] font-normal text-muted-foreground">
              {row.detail}
            </span>
          )}
        </span>,
        <ToneBadge key="s" value={row.severity} />,
        <span key="r" className="block max-w-[320px] truncate text-xs">
          {row.recommendation ?? "—"}
        </span>,
        <Figure key="c" value={row.confidence} suffix="%" />,
        <ToneBadge key="st" value={row.status} />,
        <Day key="d" value={row.createdAt} />,
      ])}
      empty={
        <EmptyState
          icon={Lightbulb}
          title={t("ceo.insights_empty")}
          description="Neither server_ai_insights nor promise_ai_insights holds a row. Insights appear here when the systems that produce them record one."
        />
      }
    />
  );
}
