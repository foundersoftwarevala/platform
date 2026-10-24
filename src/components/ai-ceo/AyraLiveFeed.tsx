import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAyraLiveFeed } from "@/lib/ayra/functions";
import { useTranslation } from "@/lib/i18n/use-translation";

export function AyraLiveFeed() {
  const { t, formatDate } = useTranslation();
  const loadFeed = useServerFn(getAyraLiveFeed);
  const feed = useQuery({
    queryKey: ["ayra", "platform-health"],
    queryFn: () => loadFeed(),
    staleTime: 60_000,
  });

  return (
    <Card className="card3d premium-halo rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <AlertTriangle className="h-5 w-5 text-accent-amber" />
          {t("ceo.ayra_live_feed")}
          {feed.data && (
            <Badge variant="secondary">
              {t("ceo.ayra_alert_count", { count: feed.data.alerts.length })}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {feed.isPending ? (
          <p className="text-sm text-muted-foreground">{t("ceo.ayra_feed_loading")}</p>
        ) : feed.isError ? (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{t("ceo.ayra_feed_failed")}</p>
            <p>
              {feed.error instanceof Error ? feed.error.message : t("ceo.ayra_feed_data_error")}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void feed.refetch()}>
              {t("ceo.ayra_retry")}
            </Button>
          </div>
        ) : feed.data.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ceo.ayra_feed_empty")}</p>
        ) : (
          <ul className="max-h-80 space-y-3 overflow-y-auto">
            {feed.data.alerts.map((alert) => (
              <li key={`${alert.kind}:${alert.id}`} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={alert.kind === "deadline_overdue" ? "destructive" : "secondary"}>
                    {alert.kind === "deadline_overdue"
                      ? t("ceo.ayra_overdue_task")
                      : t("ceo.ayra_broken_promise")}
                  </Badge>
                  <time className="text-xs text-muted-foreground" dateTime={alert.occurredAt}>
                    {formatDate(alert.occurredAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
                <p className="mt-2 text-sm text-foreground">{alert.taskTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("ceo.ayra_developer_task", {
                    developer: alert.developerId.slice(0, 8),
                    task: alert.taskId.slice(0, 8),
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
        {feed.data && (
          <p className="mt-3 text-xs text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
