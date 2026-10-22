import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, LoaderCircle, Send, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { askAyra, getAyraLiveFeed } from "@/lib/ayra/functions";
import { useTranslation } from "@/lib/i18n/use-translation";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AyraLiveFeedChat() {
  const { t, formatDate } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const loadFeed = useServerFn(getAyraLiveFeed);
  const sendPrompt = useServerFn(askAyra);
  const feed = useQuery({
    queryKey: ["ayra", "platform-health"],
    queryFn: () => loadFeed(),
    staleTime: 60_000,
  });
  const chat = useMutation({
    mutationFn: (question: string) => sendPrompt({ data: { prompt: question } }),
    onSuccess: (result) => {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: result.answer },
      ]);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || chat.isPending) return;
    setMessages((previous) => [...previous, { role: "user", content: question }]);
    setPrompt("");
    chat.mutate(question);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
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
              <p>{feed.error instanceof Error ? feed.error.message : t("ceo.ayra_feed_data_error")}</p>
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
                      {formatDate(alert.occurredAt, { dateStyle: "medium", timeStyle: "short" })}
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
              })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="card3d premium-halo rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("ceo.ayra_ask")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("ceo.ayra_chat_description")}
          </p>
        </CardHeader>
        <CardContent>
          <div aria-live="polite" className="mb-4 max-h-72 space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("ceo.ayra_chat_empty")}
              </p>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-lg p-3 text-sm ${
                    message.role === "user"
                      ? "ml-8 bg-primary/10 text-foreground"
                      : "mr-4 border border-border bg-surface text-foreground"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    {message.role === "user" ? t("ceo.ayra_you") : t("ceo.ayra_title")}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))
            )}
            {chat.isPending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {t("ceo.ayra_thinking")}
              </p>
            )}
            {chat.isError && (
              <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
                {t("ceo.ayra_chat_failed", {
                  error: chat.error instanceof Error ? chat.error.message : t("ceo.ayra_feed_data_error"),
                })}
              </p>
            )}
          </div>
          <form onSubmit={submit} className="space-y-2">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={4000}
              rows={3}
              placeholder={t("ceo.ayra_question_placeholder")}
              aria-label={t("ceo.ayra_question_label")}
              disabled={chat.isPending}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!prompt.trim() || chat.isPending}>
                {chat.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Send aria-hidden="true" />
                )}
                {t("ceo.ayra_send")}
              </Button>
            </div>
          </form>
          {chat.data?.toolsUsed.length ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("ceo.ayra_inspected", { tools: chat.data.toolsUsed.join(", ") })}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
