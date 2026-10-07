import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Card, EmptyHint } from "@/components/marketplace-manager/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getChatManagerAttachmentUrl,
  getChatAiGovernance,
  getChatManagerParticipants,
  getConversationTranscript,
  moderateMessage,
  sendChatManagerMessage,
  setAgentChatAccess,
} from "@/lib/chat/manager.functions";
import { useTranslation } from "@/lib/i18n/use-translation";
import { ConversationLinks } from "@/components/chat/user/ConversationLinks";
import { storageUrl } from "@/services/chat/upload";
import type { ChatAssignableHandler, ChatQueueRow } from "@/lib/chat/manager.functions";

/**
 * Chat Manager oversight beyond the conversation table: the complete history of
 * a conversation with recorded moderation, and the AI CEO agents customers can
 * reach through Chat.
 */

function LoadError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <Card>
      <div className="flex items-start gap-3 p-1 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
        <div>
          <p className="font-semibold text-foreground">{t("chat.manager.load_failed")}</p>
          <p className="mt-1 text-muted-foreground">{message}</p>
        </div>
      </div>
    </Card>
  );
}

const when = (value: string) => new Date(value).toLocaleString();

/** Complete history of one conversation with Chat Manager's moderation controls. */
export function TranscriptDialog({
  conversationId,
  subject,
  canModerate,
  canReply,
  canHandle,
  canManage,
  canAssign,
  isUpdating,
  rows,
  handlers,
  onSelect,
  onUpdate,
  onClose,
}: {
  conversationId: string | null;
  subject: string;
  canModerate: boolean;
  canReply: boolean;
  canHandle: boolean;
  canManage: boolean;
  canAssign: boolean;
  isUpdating: boolean;
  rows: ChatQueueRow[];
  handlers: ChatAssignableHandler[];
  onSelect: (row: ChatQueueRow) => void;
  onUpdate: (input: {
    conversationId: string;
    status?: "open" | "pending" | "escalated" | "closed" | "resolved";
    priority?: "low" | "normal" | "high" | "urgent";
    aiEnabled?: boolean;
    assignedAgentId?: string | null;
  }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchTranscript = useServerFn(getConversationTranscript);
  const fetchAttachmentUrl = useServerFn(getChatManagerAttachmentUrl);
  const moderate = useServerFn(moderateMessage);
  const sendMessage = useServerFn(sendChatManagerMessage);
  const fetchParticipants = useServerFn(getChatManagerParticipants);
  const [reason, setReason] = useState("");
  const [reply, setReply] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [correction, setCorrection] = useState<{ id: string; text: string } | null>(null);
  const participants = useQuery({
    queryKey: ["chat-manager", "participants", conversationId],
    enabled: !!conversationId,
    queryFn: () => fetchParticipants({ data: { conversationId: conversationId! } }),
  });
  const transcript = useInfiniteQuery({
    queryKey: ["chat-manager", "transcript", conversationId],
    enabled: !!conversationId,
    initialPageParam: null as { createdAt: string; id: string } | null,
    queryFn: ({ pageParam }) =>
      fetchTranscript({
        data: { conversationId: conversationId!, before: pageParam, limit: 100 },
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 100) return undefined;
      const first = lastPage[0];
      return first ? { createdAt: first.created_at, id: first.id } : undefined;
    },
  });
  const transcriptRows = useMemo(
    () =>
      (transcript.data?.pages.flatMap((page) => page) ?? []).sort((left, right) =>
        left.created_at.localeCompare(right.created_at),
      ),
    [transcript.data],
  );
  const mutation = useMutation({
    mutationFn: (input: {
      messageId: string;
      action: "hidden" | "corrected" | "restored";
      body?: string;
    }) => moderate({ data: { ...input, reason } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("chat.manager.transcript.recorded"));
      setCorrection(null);
      void queryClient.invalidateQueries({
        queryKey: ["chat-manager", "transcript", conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ["chat-manager", "overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const needsReason = reason.trim().length === 0;
  const prepareAttachment = useMutation({
    mutationFn: (attachmentId: string) => fetchAttachmentUrl({ data: { attachmentId } }),
    onSuccess: (result, attachmentId) => {
      setAttachmentUrls((previous) => ({
        ...previous,
        [attachmentId]: storageUrl(result.signedPath),
      }));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const replyMutation = useMutation({
    mutationFn: () => sendMessage({ data: { conversationId: conversationId!, body: reply } }),
    onSuccess: () => {
      setReply("");
      void queryClient.invalidateQueries({
        queryKey: ["chat-manager", "transcript", conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ["chat-manager", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-manager", "queue"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={!!conversationId} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="grid h-[88vh] max-h-[900px] max-w-[min(96vw,1500px)] grid-cols-1 gap-0 overflow-hidden p-0 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_280px]">
        <aside className="hidden min-h-0 flex-col border-r border-border/60 bg-muted/20 md:flex">
          <div className="border-b border-border/60 px-4 py-4">
            <h2 className="text-sm font-semibold">{t("chat.sidebar.title")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("chat.manager.workspace.queue_count", { count: rows.length })}
            </p>
          </div>
          <nav
            aria-label="Conversations in current queue"
            className="min-h-0 flex-1 overflow-y-auto p-2"
          >
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                aria-current={row.id === conversationId ? "true" : undefined}
                onClick={() => onSelect(row)}
                className={`mb-1 w-full rounded-md border p-3 text-left transition ${
                  row.id === conversationId
                    ? "border-primary/40 bg-primary/10"
                    : "border-transparent hover:bg-muted/70"
                }`}
              >
                <span className="block truncate text-sm font-medium">{row.subject}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {row.customer_name ?? row.customer_id}
                </span>
                <span className="mt-2 flex flex-wrap gap-1">
                  <Badge variant={row.status === "escalated" ? "destructive" : "secondary"}>
                    {row.status}
                  </Badge>
                  {row.pending_handoff ? <Badge variant="destructive">Handoff</Badge> : null}
                </span>
              </button>
            ))}
            {rows.length === 0 ? (
              <EmptyHint text={t("chat.manager.workspace.no_conversations")} />
            ) : null}
          </nav>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col">
          <label className="border-b border-border/60 px-5 py-2 md:hidden">
            <span className="sr-only">{t("chat.manager.workspace.mobile_select")}</span>
            <select
              value={conversationId ?? ""}
              onChange={(event) => {
                const row = rows.find((item) => item.id === event.target.value);
                if (row) onSelect(row);
              }}
              aria-label={t("chat.manager.workspace.mobile_select")}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.subject}
                </option>
              ))}
            </select>
          </label>
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-12">
            <DialogTitle className="truncate">{subject}</DialogTitle>
            <DialogDescription>{t("chat.manager.transcript.description")}</DialogDescription>
          </DialogHeader>
          {canModerate ? (
            <div className="shrink-0 border-b border-border/60 px-5 py-3">
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("chat.manager.transcript.reason_placeholder")}
                aria-label={t("chat.manager.transcript.reason_label")}
              />
            </div>
          ) : null}
          {transcript.isLoading ? (
            <p className="shrink-0 px-5 py-3 text-sm text-muted-foreground">
              {t("chat.manager.transcript.loading")}
            </p>
          ) : null}
          {transcript.error ? (
            <div className="shrink-0 px-5 py-3">
              <LoadError message={transcript.error.message} />
            </div>
          ) : null}
          {transcript.hasNextPage ? (
            <div className="shrink-0 border-b border-border/60 px-5 py-2 text-center">
              <Button
                size="sm"
                variant="outline"
                disabled={transcript.isFetchingNextPage}
                onClick={() => void transcript.fetchNextPage()}
              >
                {transcript.isFetchingNextPage
                  ? t("chat.manager.transcript.loading")
                  : t("chat.messages.load_earlier")}
              </Button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <ul className="space-y-3">
              {transcriptRows.map((m) => (
                <li key={m.id} className="rounded-lg border border-border/60 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {m.sender}
                      {m.kind === "ai" ? ` · ${t("chat.manager.transcript.ai_suffix")}` : ""}
                    </span>
                    <span>{when(m.created_at)}</span>
                  </div>
                  <p dir="auto" className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {m.body}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {m.reactions.length > 0 ? (
                      <span
                        className="flex flex-wrap gap-1"
                        aria-label={t("chat.manager.workspace.reactions", {
                          count: m.reactions.reduce((sum, reaction) => sum + reaction.count, 0),
                        })}
                      >
                        {m.reactions.map((reaction) => (
                          <Badge key={reaction.emoji} variant="secondary">
                            {reaction.emoji} {reaction.count}
                          </Badge>
                        ))}
                      </span>
                    ) : null}
                    {m.receipts.total > 0 ? (
                      <span>
                        {t("chat.manager.workspace.receipts", {
                          read: m.receipts.read,
                          total: m.receipts.total,
                          delivered: m.receipts.delivered,
                        })}
                      </span>
                    ) : null}
                  </div>
                  {m.attachments.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {m.attachments.map((attachment) => (
                        <li
                          key={attachment.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs"
                        >
                          <span className="min-w-0 truncate">
                            {attachment.file_name} · {attachment.mime_type} ·{" "}
                            {Math.max(1, Math.round(attachment.size_bytes / 1024))} KB
                          </span>
                          {attachmentUrls[attachment.id] ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                className="font-medium text-primary underline-offset-4 hover:underline"
                                href={attachmentUrls[attachment.id]}
                                target="_blank"
                                rel="noreferrer"
                                download={attachment.file_name}
                              >
                                Download
                              </a>
                              {attachment.media_kind === "image" ? (
                                <img
                                  src={attachmentUrls[attachment.id]}
                                  alt={attachment.file_name}
                                  loading="lazy"
                                  className="mt-2 max-h-64 max-w-full rounded-md object-contain"
                                />
                              ) : attachment.media_kind === "video" ? (
                                <video
                                  src={attachmentUrls[attachment.id]}
                                  controls
                                  preload="metadata"
                                  className="mt-2 max-h-64 max-w-full rounded-md"
                                >
                                  {t("chat.manager.workspace.video_unsupported")}
                                </video>
                              ) : attachment.media_kind === "audio" ||
                                attachment.media_kind === "voice" ? (
                                <audio
                                  src={attachmentUrls[attachment.id]}
                                  controls
                                  preload="metadata"
                                  className="mt-2 max-w-full"
                                >
                                  {t("chat.manager.workspace.audio_unsupported")}
                                </audio>
                              ) : null}
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={prepareAttachment.isPending}
                              onClick={() => prepareAttachment.mutate(attachment.id)}
                            >
                              Prepare download
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {m.translations.length > 0 ? (
                    <div className="mt-2 space-y-1 rounded-md border border-border/60 p-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("chat.manager.workspace.translation")}
                      </p>
                      {m.translations.map((translation) => (
                        <div key={translation.target_language} className="text-xs">
                          <p className="text-muted-foreground">
                            {translation.source_language ? `${translation.source_language} → ` : ""}
                            {translation.target_language} · {translation.status}
                            {translation.provider ? ` · ${translation.provider}` : ""}
                          </p>
                          {translation.translated_text ? (
                            <p dir="auto" className="mt-0.5 whitespace-pre-wrap">
                              {translation.translated_text}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {m.moderation ? (
                    <p className="mt-1 text-xs text-destructive">
                      {m.moderation.action === "hidden"
                        ? t("chat.manager.transcript.hidden_note")
                        : t("chat.manager.transcript.corrected_note")}
                      : {m.moderation.reason}
                      {m.moderation.corrected_body ? ` → “${m.moderation.corrected_body}”` : ""}
                    </p>
                  ) : null}
                  {canModerate && correction?.id === m.id ? (
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={correction.text}
                        onChange={(event) => setCorrection({ id: m.id, text: event.target.value })}
                        aria-label={t("chat.manager.transcript.corrected_label")}
                      />
                      <Button
                        size="sm"
                        disabled={needsReason || !correction.text.trim() || mutation.isPending}
                        onClick={() =>
                          mutation.mutate({
                            messageId: m.id,
                            action: "corrected",
                            body: correction.text,
                          })
                        }
                      >
                        {t("chat.manager.transcript.save")}
                      </Button>
                    </div>
                  ) : canModerate ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={needsReason || mutation.isPending}
                        onClick={() => mutation.mutate({ messageId: m.id, action: "hidden" })}
                      >
                        {t("chat.manager.transcript.hide")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={needsReason || mutation.isPending}
                        onClick={() => setCorrection({ id: m.id, text: m.body })}
                      >
                        {t("chat.manager.transcript.correct")}
                      </Button>
                      {m.moderation ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ messageId: m.id, action: "restored" })}
                        >
                          {t("chat.manager.transcript.restore")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {transcriptRows.length === 0 ? (
              <EmptyHint text={t("chat.manager.transcript.empty")} />
            ) : null}
          </div>
          {canReply ? (
            <form
              className="flex shrink-0 items-end gap-2 border-t border-border/60 px-5 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (reply.trim()) replyMutation.mutate();
              }}
            >
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (reply.trim() && !replyMutation.isPending) replyMutation.mutate();
                  }
                }}
                maxLength={12_000}
                rows={2}
                aria-label="Reply to customer"
                placeholder="Write an operator reply…"
                className="min-h-10 min-w-0 flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button type="submit" disabled={!reply.trim() || replyMutation.isPending}>
                {replyMutation.isPending ? "Sending…" : "Send reply"}
              </Button>
            </form>
          ) : null}
        </section>
        <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-border/60 bg-muted/20 p-4 xl:flex">
          {(() => {
            const row = rows.find((item) => item.id === conversationId);
            if (!row) return <EmptyHint text={t("chat.manager.workspace.details_unavailable")} />;
            return (
              <>
                <div className="border-b border-border/60 pb-4">
                  <h2 className="text-sm font-semibold">{t("chat.manager.workspace.details")}</h2>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                    {row.id}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-4 py-4 text-xs">
                  <dt className="text-muted-foreground">{t("chat.manager.workspace.customer")}</dt>
                  <dd className="break-words text-right font-medium">
                    {row.customer_name ?? row.customer_id}
                  </dd>
                  <dt className="text-muted-foreground">
                    {t("chat.manager.workspace.participants")}
                  </dt>
                  <dd className="text-right">{row.participants}</dd>
                  <dt className="text-muted-foreground">
                    {t("chat.manager.workspace.last_activity")}
                  </dt>
                  <dd className="text-right">{when(row.last_message_at)}</dd>
                  <dt className="text-muted-foreground">
                    {t("chat.manager.workspace.ai_handler")}
                  </dt>
                  <dd className="break-words text-right">{row.agent_key ?? "—"}</dd>
                  <dt className="text-muted-foreground">
                    {t("chat.manager.workspace.translation")}
                  </dt>
                  <dd className="text-right">
                    {row.translation_failed
                      ? t("chat.manager.workspace.translation_failed")
                      : t("chat.manager.workspace.no_translation_failure")}
                  </dd>
                  <dt className="text-muted-foreground">
                    {t("chat.manager.workspace.related_work")}
                  </dt>
                  <dd className="text-right">
                    {row.tasks} / {row.leads}
                  </dd>
                </dl>
                <div className="border-b border-border/60 pb-4">
                  <h3 className="mb-2 text-xs font-semibold">
                    {t("chat.manager.workspace.participant_list")}
                  </h3>
                  {participants.isLoading ? (
                    <p className="text-xs text-muted-foreground">
                      {t("chat.manager.workspace.participants_loading")}
                    </p>
                  ) : participants.error ? (
                    <p className="text-xs text-destructive">{participants.error.message}</p>
                  ) : (
                    <ul className="space-y-2">
                      {(participants.data?.participants ?? []).map((participant) => (
                        <li
                          key={participant.user_id}
                          className="flex min-w-0 items-center justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 truncate font-medium">
                            {participant.display_name}
                            {participant.handle ? (
                              <span className="ml-1 font-normal text-muted-foreground">
                                @{participant.handle}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {participant.presence}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-3 border-y border-border/60 py-4">
                  {canManage ? (
                    <>
                      <label className="block text-xs">
                        <span className="mb-1 block text-muted-foreground">
                          {t("chat.manager.workspace.status")}
                        </span>
                        <select
                          value={row.status}
                          onChange={(event) =>
                            onUpdate({
                              conversationId: row.id,
                              status: event.target.value as
                                "open" | "pending" | "escalated" | "closed" | "resolved",
                            })
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-2"
                          disabled={isUpdating}
                        >
                          {["open", "pending", "escalated", "closed", "resolved"].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs">
                        <span className="mb-1 block text-muted-foreground">
                          {t("chat.manager.workspace.priority")}
                        </span>
                        <select
                          value={row.priority}
                          onChange={(event) =>
                            onUpdate({
                              conversationId: row.id,
                              priority: event.target.value as "low" | "normal" | "high" | "urgent",
                            })
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-2"
                          disabled={isUpdating}
                        >
                          {["low", "normal", "high", "urgent"].map((priority) => (
                            <option key={priority} value={priority}>
                              {priority}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center justify-between gap-2 text-xs">
                        {t("chat.manager.workspace.ai_assistance")}
                        <Switch
                          checked={row.ai_enabled}
                          disabled={isUpdating}
                          onCheckedChange={(enabled) =>
                            onUpdate({ conversationId: row.id, aiEnabled: enabled })
                          }
                          aria-label={
                            row.ai_enabled
                              ? t("chat.manager.workspace.ai_enabled")
                              : t("chat.manager.workspace.ai_disabled")
                          }
                        />
                      </label>
                    </>
                  ) : null}
                  {canAssign ? (
                    <label className="block text-xs">
                      <span className="mb-1 block text-muted-foreground">
                        {t("chat.manager.workspace.assigned_handler")}
                      </span>
                      <select
                        value={row.assigned_agent_id ?? ""}
                        onChange={(event) =>
                          onUpdate({
                            conversationId: row.id,
                            assignedAgentId: event.target.value || null,
                          })
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-2"
                        disabled={isUpdating}
                      >
                        <option value="">Unassigned</option>
                        {handlers.map((handler) => (
                          <option key={handler.id} value={handler.id}>
                            {handler.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {!canManage && !canAssign ? (
                    <p className="text-xs text-muted-foreground">
                      {t("chat.manager.workspace.read_only")}
                    </p>
                  ) : null}
                </div>
                {canHandle ? (
                  <div className="pt-4">
                    <ConversationLinks conversationId={row.id} />
                  </div>
                ) : null}
              </>
            );
          })()}
        </aside>
      </DialogContent>
    </Dialog>
  );
}

/** The AI CEO registry: which existing agents customers can reach through Chat, and what they did. */
export function AgentAccess() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchGovernance = useServerFn(getChatAiGovernance);
  const setAccess = useServerFn(setAgentChatAccess);
  const governance = useQuery({
    queryKey: ["chat-manager", "ai-governance"],
    queryFn: () => fetchGovernance(),
  });
  const mutation = useMutation({
    mutationFn: (input: { agentKey: string; enabled: boolean }) => setAccess({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["chat-manager", "ai-governance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const agents = governance.data?.agents ?? [];
  const events = governance.data?.events ?? [];

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Card>
        <h3 className="mb-1 text-sm font-semibold">{t("chat.manager.agents.title")}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{t("chat.manager.agents.description")}</p>
        {governance.error ? <LoadError message={governance.error.message} /> : null}
        <div className="max-h-96 overflow-y-auto">
          {agents.map((a) => (
            <div
              key={a.agent_key}
              className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.specialization ?? a.agent_key} ·{" "}
                  {(a.permissions ?? []).join(", ") || t("chat.manager.agents.no_permissions")}
                </p>
              </div>
              <Switch
                checked={a.enabled}
                disabled={mutation.isPending}
                onCheckedChange={(value) =>
                  mutation.mutate({ agentKey: a.agent_key, enabled: value })
                }
                aria-label={t("chat.manager.agents.access_label", { name: a.name })}
              />
            </div>
          ))}
        </div>
        {!governance.isLoading && agents.length === 0 ? (
          <EmptyHint text={t("chat.manager.agents.empty")} />
        ) : null}
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold">{t("chat.manager.events.title")}</h3>
        <div className="max-h-96 overflow-y-auto">
          {events.map((e) => (
            <div key={e.id} className="border-b border-border/60 py-2 text-xs last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono">{e.agent_key ?? t("chat.manager.events.general")}</span>
                <Badge variant={e.outcome === "replied" ? "secondary" : "destructive"}>
                  {e.outcome}
                </Badge>
              </div>
              <p className="mt-0.5 text-muted-foreground">
                {[
                  e.domain,
                  e.language,
                  e.latency_ms != null ? `${e.latency_ms} ms` : null,
                  e.lead_id ? t("chat.manager.events.lead_linked") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                · {when(e.created_at)}
              </p>
              {e.error ? <p className="mt-0.5 text-destructive">{e.error}</p> : null}
            </div>
          ))}
        </div>
        {!governance.isLoading && events.length === 0 ? (
          <EmptyHint text={t("chat.manager.events.empty")} />
        ) : null}
      </Card>
    </div>
  );
}
