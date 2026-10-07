import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  CheckCheck,
  Languages,
  Loader2,
  MessageSquareReply,
  Pin,
  RotateCcw,
  ShieldCheck,
  Smile,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { translateChatMessages } from "@/services/chat/chat-service";
import type { ChatMessage, Profile } from "@/services/chat/types";
import type { ConnectionState, PendingMessage } from "@/hooks/use-chat";
import { UserAvatar, AttachmentCard } from "./media";
import { cn } from "@/lib/utils";
import { useTranslation, type Translate } from "@/lib/i18n/use-translation";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "✅"];

interface MessageListProps {
  messages: ChatMessage[];
  pending: PendingMessage[];
  userId: string;
  profilesById: Map<string, Profile>;
  typingUsers: string[];
  connection: ConnectionState;
  canReact: boolean;
  canReply: boolean;
  canBookmark: boolean;
  canDownload: boolean;
  /** Chat Manager reviewers see a moderated message's original text. */
  canSeeOriginal?: boolean | undefined;
  hasEarlier?: boolean | undefined;
  loadingEarlier?: boolean | undefined;
  onLoadEarlier?: (() => void) | undefined;
  translateTarget: string;
  autoTranslate?: boolean | undefined;
  density?: "comfortable" | "compact" | undefined;
  highlightId?: string | null | undefined;
  onReact: (messageId: string, emoji: string, active: boolean) => void;
  onBookmark: (messageId: string, pinned: boolean, active: boolean) => void;
  onReply: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => void;
  onRetry: (clientRef: string) => void;
  onDiscard: (clientRef: string) => void;
}

type Row =
  | { type: "date"; key: string; label: string }
  | {
      type: "group";
      key: string;
      senderId: string;
      mine: boolean;
      items: (ChatMessage | PendingMessage)[];
    };

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

type FormatDate = (value: Date, options: Intl.DateTimeFormatOptions) => string;

function dayLabel(iso: string, t: Translate, formatDate: FormatDate) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (date.toDateString() === today.toDateString()) return t("chat.messages.today");
  if (date.toDateString() === yesterday.toDateString()) return t("chat.messages.yesterday");
  return formatDate(date, { day: "numeric", month: "short", year: "numeric" });
}

function timeLabel(iso: string, formatDate: FormatDate) {
  return formatDate(new Date(iso), { hour: "2-digit", minute: "2-digit" });
}

/**
 * What a reader sees of a message Chat Manager moderated. The original row is
 * never altered; people who may review it (Chat Manager) still see the original.
 */
function visibleText(message: ChatMessage | PendingMessage, canSeeOriginal: boolean) {
  const moderation = message.moderation;
  if (!moderation || canSeeOriginal) return message.body;
  return moderation.action === "corrected" ? (moderation.corrected_body ?? "") : "";
}

/** Render message text with @mentions highlighted. */
function Body({ text, profilesById }: { text: string; profilesById: Map<string, Profile> }) {
  const handles = Array.from(profilesById.values()).map((p) => p.handle);
  if (handles.length === 0 || !text.includes("@")) return <>{text}</>;
  const pattern = new RegExp(
    `(@(?:${handles.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b)`,
    "g",
  );
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") && handles.includes(part.slice(1)) ? (
          <span key={i} className="rounded bg-primary/15 px-0.5 font-medium text-primary">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function ReceiptTick({ message, userId }: { message: ChatMessage; userId: string }) {
  const { t } = useTranslation();
  if (message.sender_id !== userId) return null;
  const others = message.receipts.filter((r) => r.user_id !== userId);
  const read = others.length > 0 && others.every((r) => r.read_at);
  const delivered = others.length > 0 && others.every((r) => r.delivered_at);
  const label = read
    ? t("chat.messages.receipt_read")
    : delivered
      ? t("chat.messages.receipt_delivered")
      : t("chat.messages.receipt_sent");
  const ariaLabel = read
    ? t("chat.messages.receipt_read_label")
    : delivered
      ? t("chat.messages.receipt_delivered_label")
      : t("chat.messages.receipt_sent_label");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={ariaLabel} className="inline-flex">
          {read ? (
            <CheckCheck className="size-3.5 text-emerald-500" />
          ) : delivered ? (
            <CheckCheck className="size-3.5 text-muted-foreground" />
          ) : (
            <Check className="size-3.5 text-muted-foreground" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MessageList(props: MessageListProps) {
  const {
    messages,
    pending,
    userId,
    profilesById,
    typingUsers,
    connection,
    canReact,
    canReply,
    canBookmark,
    canDownload,
    canSeeOriginal = false,
    hasEarlier = false,
    loadingEarlier = false,
    onLoadEarlier,
    translateTarget,
    autoTranslate,
    density,
    highlightId,
    onReact,
    onBookmark,
    onReply,
    onOpenThread,
    onRetry,
    onDiscard,
  } = props;
  const { t, formatDate } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [translations, setTranslations] = useState<
    Record<string, { loading: boolean; text?: string; error?: string; authRequired?: boolean }>
  >({});

  const all = useMemo(
    () => [...messages, ...pending].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, pending],
  );

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    let group: Extract<Row, { type: "group" }> | null = null;
    for (let i = 0; i < all.length; i++) {
      const message = all[i]!;
      const previous = i > 0 ? all[i - 1] : undefined;
      if (!previous || !sameDay(previous.created_at, message.created_at)) {
        result.push({
          type: "date",
          key: `d-${message.created_at.slice(0, 10)}`,
          label: dayLabel(message.created_at, t, formatDate),
        });
        group = null;
      }
      const gap = previous
        ? new Date(message.created_at).getTime() - new Date(previous.created_at).getTime()
        : Infinity;
      if (
        group &&
        group.senderId === message.sender_id &&
        gap < 5 * 60 * 1000 &&
        !message.parent_id
      ) {
        group.items.push(message);
      } else {
        const next: Extract<Row, { type: "group" }> = {
          type: "group",
          key: `g-${message.id}`,
          senderId: message.sender_id,
          mine: message.sender_id === userId,
          items: [message],
        };
        result.push(next);
        group = next;
      }
    }
    return result;
  }, [all, userId, t, formatDate]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [all.length, typingUsers.length]);

  useEffect(() => {
    if (!highlightId) return;
    const el = scrollRef.current?.querySelector(`[data-message-id="${highlightId}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId]);

  // The stored Chat pipeline (detect -> English -> this language). A row still
  // being translated, or waiting to retry, is asked for again when the server
  // says, a bounded number of times; failure is shown, never invented text.
  const translate = useCallback(
    async (message: ChatMessage, attempt = 0, retry = false): Promise<void> => {
      if (message.optimistic || !message.conversation_id) return;
      setTranslations((prev) => ({ ...prev, [message.id]: { loading: true } }));
      try {
        const [view] = await translateChatMessages(
          message.conversation_id,
          [message.id],
          translateTarget,
          retry,
        );
        if (!view) {
          setTranslations((prev) => ({
            ...prev,
            [message.id]: { loading: false, error: t("chat.messages.translation_unavailable") },
          }));
          return;
        }
        if (view.status === "completed" && view.identity) {
          // Already in the reader's language: nothing to show beside it.
          setTranslations((prev) => {
            const next = { ...prev };
            delete next[message.id];
            return next;
          });
          return;
        }
        if (view.status === "completed" && view.text) {
          setTranslations((prev) => ({
            ...prev,
            [message.id]: { loading: false, text: view.text! },
          }));
          return;
        }
        if (
          (view.status === "processing" ||
            view.status === "pending" ||
            view.status === "retrying") &&
          attempt < 6
        ) {
          window.setTimeout(
            () => void translate(message, attempt + 1),
            Math.min(view.retryAfterMs ?? 1500, 15_000),
          );
          return;
        }
        setTranslations((prev) => ({
          ...prev,
          [message.id]: { loading: false, error: t("chat.messages.translation_unavailable") },
        }));
      } catch (error) {
        setTranslations((prev) => ({
          ...prev,
          [message.id]: {
            loading: false,
            error:
              error instanceof Error ? error.message : t("chat.messages.translation_unavailable"),
          },
        }));
      }
    },
    [translateTarget, t],
  );

  // Real-time auto translate: translate incoming messages as they arrive.
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    if (!autoTranslate) return;
    for (const message of messages.slice(-25)) {
      if (message.sender_id === userId || !message.body || attempted.current.has(message.id))
        continue;
      attempted.current.add(message.id);
      void translate(message);
    }
  }, [autoTranslate, messages, userId, translate]);

  const renderMessage = (message: ChatMessage | PendingMessage, mine: boolean, first: boolean) => {
    const optimistic = message.optimistic;
    const translation = translations[message.id];
    const sender = profilesById.get(message.sender_id);
    const moderation = message.moderation ?? null;
    const removed = moderation?.action === "hidden" && !canSeeOriginal;
    const shownBody = visibleText(message, canSeeOriginal);
    const groupedReactions = message.reactions.reduce<
      Record<string, { count: number; mine: boolean }>
    >((acc, r) => {
      acc[r.emoji] ??= { count: 0, mine: false };
      acc[r.emoji]!.count += 1;
      if (r.user_id === userId) acc[r.emoji]!.mine = true;
      return acc;
    }, {});

    return (
      <div
        key={message.id}
        data-message-id={message.id}
        className={cn(
          "group/msg relative flex w-full min-w-0 flex-col gap-1 rounded-xl px-2 py-1 transition-colors",
          mine ? "items-end" : "items-start",
          highlightId === message.id && "bg-primary/10 ring-1 ring-primary/30",
        )}
      >
        <div
          className={cn(
            "flex w-fit min-w-0 max-w-[90%] items-end gap-2 sm:max-w-[80%]",
            mine && "flex-row-reverse",
          )}
        >
          {!mine && first ? (
            <UserAvatar
              name={sender?.display_name ?? "?"}
              avatarPath={sender?.avatar_path}
              className="size-7"
            />
          ) : !mine ? (
            <span className="size-7 shrink-0" />
          ) : null}

          <div
            className={cn(
              "chat-message-bubble min-w-0 max-w-full rounded-3xl text-sm",
              density === "compact" ? "px-3 py-2 leading-5" : "px-4 py-3 leading-6",
              mine
                ? optimistic?.state === "failed"
                  ? "rounded-br-lg bg-destructive text-destructive-foreground"
                  : "chat-brand-gradient rounded-br-lg"
                : "rounded-bl-lg border border-border/60 bg-card/80 backdrop-blur-md",
              optimistic?.state === "pending" && "opacity-70",
              optimistic?.state === "failed" && "border-destructive/60",
            )}
          >
            {message.parent_id ? (
              <p
                className={cn(
                  "mb-0.5 border-l-2 pl-2 text-xs opacity-80",
                  mine ? "border-primary-foreground/40" : "border-primary/50",
                )}
              >
                {t("chat.messages.reply_in_thread")}
              </p>
            ) : null}
            {removed ? (
              <p className="text-sm italic opacity-80">{t("chat.messages.removed_by_team")}</p>
            ) : shownBody ? (
              <p
                dir="auto"
                className="whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:normal]"
              >
                <Body text={shownBody} profilesById={profilesById} />
              </p>
            ) : null}
            {moderation ? (
              <p className="mt-1 text-[10px] opacity-70">
                {canSeeOriginal
                  ? t("chat.messages.moderated_note", { reason: moderation.reason })
                  : moderation.action === "corrected"
                    ? t("chat.messages.corrected_by_team")
                    : ""}
              </p>
            ) : null}
            {removed
              ? null
              : message.attachments.map((attachment) => (
                  <AttachmentCard
                    key={attachment.id}
                    attachment={attachment}
                    canDownload={canDownload}
                  />
                ))}

            <div
              className={cn(
                "mt-0.5 flex flex-wrap items-center justify-end gap-1 text-[10px]",
                mine ? "opacity-70" : "text-muted-foreground",
              )}
            >
              {message.pinned ? (
                <Pin className="size-3 fill-current" aria-label={t("chat.messages.pinned")} />
              ) : null}
              {message.bookmarked ? (
                <Bookmark
                  className="size-3 fill-current"
                  aria-label={t("chat.messages.bookmarked")}
                />
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex cursor-default items-center"
                    aria-label={t("chat.messages.immutable_record")}
                  >
                    <ShieldCheck className="size-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t("chat.messages.immutable_tooltip")}</TooltipContent>
              </Tooltip>
              <span className="whitespace-nowrap">{timeLabel(message.created_at, formatDate)}</span>
              {optimistic?.state === "pending" ? (
                <Loader2 className="size-3 animate-spin" aria-label={t("chat.messages.sending")} />
              ) : optimistic?.state === "failed" ? (
                <span className="font-medium text-destructive">{t("chat.messages.failed")}</span>
              ) : (
                <ReceiptTick message={message} userId={userId} />
              )}
            </div>
          </div>
        </div>

        {/* Actions do not participate in the bubble's available width. */}
        {!optimistic && (
          <div
            className={cn(
              "flex max-w-full flex-wrap items-center gap-0.5 rounded-full border border-border/60 bg-card p-1 opacity-100 shadow-sm transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100",
            )}
          >
            {canReact ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("chat.messages.react")}
                    className="rounded-full p-1.5 transition-colors hover:bg-secondary"
                  >
                    <Smile className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1" side="top">
                  <div className="flex gap-0.5">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded p-1 text-lg hover:bg-secondary"
                        onClick={() =>
                          onReact(message.id, emoji, groupedReactions[emoji]?.mine ?? false)
                        }
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
            {canReply ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("chat.messages.reply")}
                    onClick={() => onReply(message)}
                    className="rounded-full p-1.5 transition-colors hover:bg-secondary"
                  >
                    <MessageSquareReply className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("chat.messages.reply")}</TooltipContent>
              </Tooltip>
            ) : null}
            {canBookmark ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={
                        message.pinned ? t("chat.messages.unpin") : t("chat.messages.pin")
                      }
                      onClick={() => onBookmark(message.id, true, message.pinned)}
                      className="rounded-full p-1.5 transition-colors hover:bg-secondary"
                    >
                      <Pin
                        className={cn("size-3.5", message.pinned && "fill-current text-primary")}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {message.pinned ? t("chat.messages.unpin") : t("chat.messages.pin")}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={
                        message.bookmarked
                          ? t("chat.messages.remove_bookmark")
                          : t("chat.messages.bookmark")
                      }
                      onClick={() => onBookmark(message.id, false, message.bookmarked)}
                      className="rounded-full p-1.5 transition-colors hover:bg-secondary"
                    >
                      <Bookmark
                        className={cn(
                          "size-3.5",
                          message.bookmarked && "fill-current text-primary",
                        )}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {message.bookmarked
                      ? t("chat.messages.remove_bookmark")
                      : t("chat.messages.bookmark")}
                  </TooltipContent>
                </Tooltip>
              </>
            ) : null}
            {shownBody ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("chat.messages.translate_message")}
                    onClick={() => void translate(message)}
                    className="rounded-full p-1.5 transition-colors hover:bg-secondary"
                  >
                    <Languages className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("chat.messages.translate")}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        )}
        {Object.keys(groupedReactions).length > 0 ? (
          <div className={cn("flex flex-wrap gap-1", mine ? "pr-1 justify-end" : "pl-9")}>
            {Object.entries(groupedReactions).map(([emoji, info]) => (
              <button
                key={emoji}
                type="button"
                disabled={!canReact}
                onClick={() => onReact(message.id, emoji, info.mine)}
                aria-label={t("chat.messages.reactions", { count: info.count, emoji })}
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                  info.mine
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/60 bg-secondary/60 hover:bg-secondary",
                )}
              >
                {emoji} {info.count}
              </button>
            ))}
          </div>
        ) : null}

        {message.replyCount > 0 ? (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className={cn(
              "text-xs font-medium text-primary hover:underline",
              mine ? "pr-1 self-end" : "pl-9",
            )}
          >
            {t("chat.messages.open_thread", { count: message.replyCount })}
          </button>
        ) : null}

        {translation ? (
          <div
            className={cn(
              "w-fit min-w-0 max-w-[90%] rounded-2xl border border-primary/15 bg-card px-3 py-2 text-xs shadow-sm [overflow-wrap:anywhere] [word-break:normal] sm:max-w-[80%]",
              mine && "self-end",
            )}
          >
            {translation.loading ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> {t("chat.messages.translating")}
              </span>
            ) : translation.error ? (
              <span className="text-destructive">
                {translation.error}
                {translation.authRequired && (
                  <a
                    href="/language-manager"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-primary underline"
                  >
                    {t("common.language_native_sign_in")}
                  </a>
                )}
              </span>
            ) : (
              <span dir="auto" className="whitespace-pre-wrap">
                {translation.text}
              </span>
            )}
          </div>
        ) : null}

        {optimistic?.state === "failed" ? (
          <div className="flex items-center gap-2 pr-1 text-xs">
            <span className="text-destructive">{optimistic.error ?? t("chat.send_failed")}</span>
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <RotateCcw className="size-3" /> {t("chat.messages.retry")}
            </button>
            <button
              type="button"
              onClick={() => onDiscard(message.id)}
              className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
            >
              <Trash2 className="size-3" /> {t("chat.messages.discard")}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      }}
      className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5"
      aria-live="polite"
      aria-label={t("chat.messages.list_label")}
    >
      {connection !== "live" ? (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
          <WifiOff className="size-3.5" />
          {connection === "connecting"
            ? t("chat.messages.connecting")
            : connection === "reconnecting"
              ? t("chat.messages.reconnecting")
              : t("chat.messages.offline")}
        </div>
      ) : null}

      {hasEarlier && onLoadEarlier ? (
        <div className="mb-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              stickToBottom.current = false;
              onLoadEarlier();
            }}
            disabled={loadingEarlier}
            className="rounded-full border border-border/60 bg-card/75 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm hover:text-foreground disabled:opacity-60"
          >
            {loadingEarlier ? t("chat.messages.loading_earlier") : t("chat.messages.load_earlier")}
          </button>
        </div>
      ) : null}

      {all.length === 0 ? (
        <div className="grid h-full place-items-center">
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            {t("chat.messages.empty")}
          </p>
        </div>
      ) : null}

      {rows.map((row) =>
        row.type === "date" ? (
          <div key={row.key} className="my-5 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-border/60" />
            <span className="rounded-full border border-border/60 bg-card/75 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-md">
              {row.label}
            </span>
            <span className="h-px flex-1 bg-border/60" />
          </div>
        ) : (
          <div
            key={row.key}
            className={cn(
              "mb-2 flex w-full min-w-0 flex-col gap-0.5",
              row.mine ? "items-end" : "items-start",
            )}
          >
            {!row.mine ? (
              <span className={cn("pl-9 text-xs font-medium text-muted-foreground")}>
                {profilesById.get(row.senderId)?.display_name ?? t("chat.messages.unknown_user")}
              </span>
            ) : null}
            {row.items.map((message, index) => renderMessage(message, row.mine, index === 0))}
          </div>
        ),
      )}

      {typingUsers.length > 0 ? (
        <div
          className="flex items-center gap-2 pl-9 pt-1 text-xs text-muted-foreground"
          role="status"
        >
          <span className="flex gap-1">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
          {t("chat.messages.typing", { names: typingUsers.join(", "), count: typingUsers.length })}
        </div>
      ) : null}
    </div>
  );
}
