import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark, Check, CheckCheck, Languages, Loader2, MessageSquareReply, Pin,
  RotateCcw, ShieldCheck, Smile, Trash2, WifiOff,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { translateMessage } from "@/lib/translate.functions";
import type { ChatMessage, Profile } from "@/services/chat/types";
import type { ConnectionState, PendingMessage } from "@/hooks/use-chat";
import { UserAvatar, AttachmentCard } from "./media";
import { cn } from "@/lib/utils";

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
  | { type: "group"; key: string; senderId: string; mine: boolean; items: (ChatMessage | PendingMessage)[] };

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Render message text with @mentions highlighted. */
function Body({ text, profilesById }: { text: string; profilesById: Map<string, Profile> }) {
  const handles = Array.from(profilesById.values()).map((p) => p.handle);
  if (handles.length === 0 || !text.includes("@")) return <>{text}</>;
  const pattern = new RegExp(`(@(?:${handles.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b)`, "g");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") && handles.includes(part.slice(1)) ? (
          <span key={i} className="rounded bg-primary/15 px-0.5 font-medium text-primary">{part}</span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function ReceiptTick({ message, userId }: { message: ChatMessage; userId: string }) {
  if (message.sender_id !== userId) return null;
  const others = message.receipts.filter((r) => r.user_id !== userId);
  const read = others.length > 0 && others.every((r) => r.read_at);
  const delivered = others.length > 0 && others.every((r) => r.delivered_at);
  const label = read ? "Read" : delivered ? "Delivered" : "Sent";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={`Message ${label.toLowerCase()}`} className="inline-flex">
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
    messages, pending, userId, profilesById, typingUsers, connection,
    canReact, canReply, canBookmark, translateTarget, autoTranslate, density, highlightId,
    onReact, onBookmark, onReply, onOpenThread, onRetry, onDiscard,
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [translations, setTranslations] = useState<Record<string, { loading: boolean; text?: string; error?: string }>>({});

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
        result.push({ type: "date", key: `d-${message.created_at.slice(0, 10)}`, label: dayLabel(message.created_at) });
        group = null;
      }
      const gap = previous ? new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() : Infinity;
      if (group && group.senderId === message.sender_id && gap < 5 * 60 * 1000 && !message.parent_id) {
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
  }, [all, userId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [all.length, typingUsers.length]);

  useEffect(() => {
    if (!highlightId) return;
    const el = scrollRef.current?.querySelector(`[data-message-id="${highlightId}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId]);

  const translate = useCallback(
    async (message: ChatMessage) => {
      setTranslations((prev) => ({ ...prev, [message.id]: { loading: true } }));
      const result = await translateMessage({ data: { text: message.body, target: translateTarget } });
      setTranslations((prev) => ({
        ...prev,
        [message.id]: result.ok ? { loading: false, text: result.text } : { loading: false, error: result.error },
      }));
    },
    [translateTarget],
  );

  // Real-time auto translate: translate incoming messages as they arrive.
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    if (!autoTranslate) return;
    for (const message of messages.slice(-25)) {
      if (message.sender_id === userId || !message.body || attempted.current.has(message.id)) continue;
      attempted.current.add(message.id);
      void translate(message);
    }
  }, [autoTranslate, messages, userId, translate]);

  const renderMessage = (message: ChatMessage | PendingMessage, mine: boolean, first: boolean) => {
    const optimistic = message.optimistic;
    const translation = translations[message.id];
    const sender = profilesById.get(message.sender_id);
    const groupedReactions = message.reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
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
          "group/msg relative flex flex-col gap-0.5 rounded-xl px-2 py-1 transition-colors",
          mine ? "items-end" : "items-start",
          highlightId === message.id && "bg-primary/10 ring-1 ring-primary/30",
        )}
      >
        <div className={cn("flex max-w-[85%] items-end gap-2 sm:max-w-[75%]", mine && "flex-row-reverse")}>
          {!mine && first ? (
            <UserAvatar name={sender?.display_name ?? "?"} avatarPath={sender?.avatar_path} className="size-7" />
          ) : !mine ? (
            <span className="size-7 shrink-0" />
          ) : null}

          <div
            className={cn(
              "min-w-0 rounded-2xl text-sm shadow-sm",
              density === "compact" ? "px-2.5 py-1 leading-5" : "px-3 py-1.5 leading-6",
              mine
                ? "rounded-br-md bg-primary text-primary-foreground"
                : "rounded-bl-md border border-border/60 bg-card",
              optimistic?.state === "pending" && "opacity-70",
              optimistic?.state === "failed" && "border-destructive/60 bg-destructive/10",
            )}
          >
            {message.parent_id ? (
              <p className={cn("mb-0.5 border-l-2 pl-2 text-xs opacity-80", mine ? "border-primary-foreground/40" : "border-primary/50")}>
                Reply in thread
              </p>
            ) : null}
            {message.body ? (
              <p className="whitespace-pre-wrap break-words">
                <Body text={message.body} profilesById={profilesById} />
              </p>
            ) : null}
            {message.attachments.map((attachment) => (
              <AttachmentCard key={attachment.id} attachment={attachment} />
            ))}

            <div className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
              {message.pinned ? <Pin className="size-3 fill-current" aria-label="Pinned" /> : null}
              {message.bookmarked ? <Bookmark className="size-3 fill-current" aria-label="Bookmarked" /> : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-default items-center" aria-label="Immutable enterprise record">
                    <ShieldCheck className="size-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Enterprise record — messages cannot be edited or deleted</TooltipContent>
              </Tooltip>
              <span>{timeLabel(message.created_at)}</span>
              {optimistic?.state === "pending" ? (
                <Loader2 className="size-3 animate-spin" aria-label="Sending" />
              ) : optimistic?.state === "failed" ? (
                <span className="font-medium text-destructive">Failed</span>
              ) : (
                <ReceiptTick message={message} userId={userId} />
              )}
            </div>
          </div>

          {/* hover actions — only allowed operations (no edit/delete/copy/forward) */}
          {!optimistic && (
            <div
              className={cn(
                "flex items-center gap-0.5 self-center rounded-lg border border-border/60 bg-popover p-0.5 opacity-0 shadow-sm transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100",
              )}
            >
              {canReact ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label="React" className="rounded-md p-1.5 hover:bg-secondary">
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
                          onClick={() => onReact(message.id, emoji, groupedReactions[emoji]?.mine ?? false)}
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
                    <button type="button" aria-label="Reply" onClick={() => onReply(message)} className="rounded-md p-1.5 hover:bg-secondary">
                      <MessageSquareReply className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Reply</TooltipContent>
                </Tooltip>
              ) : null}
              {canBookmark ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={message.pinned ? "Unpin" : "Pin"}
                        onClick={() => onBookmark(message.id, true, message.pinned)}
                        className="rounded-md p-1.5 hover:bg-secondary"
                      >
                        <Pin className={cn("size-3.5", message.pinned && "fill-current text-primary")} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{message.pinned ? "Unpin" : "Pin"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={message.bookmarked ? "Remove bookmark" : "Bookmark"}
                        onClick={() => onBookmark(message.id, false, message.bookmarked)}
                        className="rounded-md p-1.5 hover:bg-secondary"
                      >
                        <Bookmark className={cn("size-3.5", message.bookmarked && "fill-current text-primary")} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{message.bookmarked ? "Remove bookmark" : "Bookmark"}</TooltipContent>
                  </Tooltip>
                </>
              ) : null}
              {message.body ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Translate message" onClick={() => void translate(message)} className="rounded-md p-1.5 hover:bg-secondary">
                      <Languages className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Translate</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          )}
        </div>

        {Object.keys(groupedReactions).length > 0 ? (
          <div className={cn("flex flex-wrap gap-1", mine ? "pr-1 justify-end" : "pl-9")}>
            {Object.entries(groupedReactions).map(([emoji, info]) => (
              <button
                key={emoji}
                type="button"
                disabled={!canReact}
                onClick={() => onReact(message.id, emoji, info.mine)}
                aria-label={`${info.count} reacted with ${emoji}`}
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                  info.mine ? "border-primary/50 bg-primary/10" : "border-border/60 bg-secondary/60 hover:bg-secondary",
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
            className={cn("text-xs font-medium text-primary hover:underline", mine ? "pr-1 self-end" : "pl-9")}
          >
            {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"} — open thread
          </button>
        ) : null}

        {translation ? (
          <div className={cn("max-w-[85%] rounded-lg border border-border/50 bg-secondary/40 px-2.5 py-1 text-xs sm:max-w-[75%]", mine && "self-end")}>
            {translation.loading ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Translating…</span>
            ) : translation.error ? (
              <span className="text-destructive">{translation.error}</span>
            ) : (
              <span className="whitespace-pre-wrap">{translation.text}</span>
            )}
          </div>
        ) : null}

        {optimistic?.state === "failed" ? (
          <div className="flex items-center gap-2 pr-1 text-xs">
            <span className="text-destructive">{optimistic.error ?? "Message could not be sent"}</span>
            <button type="button" onClick={() => onRetry(message.id)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <RotateCcw className="size-3" /> Retry
            </button>
            <button type="button" onClick={() => onDiscard(message.id)} className="inline-flex items-center gap-1 text-muted-foreground hover:underline">
              <Trash2 className="size-3" /> Discard
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
      className="flex-1 overflow-y-auto px-3 py-3 sm:px-5"
      aria-live="polite"
      aria-label="Conversation messages"
    >
      {connection !== "live" ? (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
          <WifiOff className="size-3.5" />
          {connection === "connecting" ? "Connecting…" : connection === "reconnecting" ? "Connection lost — reconnecting…" : "Offline — messages will send when reconnected"}
        </div>
      ) : null}

      {all.length === 0 ? (
        <div className="grid h-full place-items-center">
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            No messages yet. Send the first message — every message is stored as an immutable enterprise record.
          </p>
        </div>
      ) : null}

      {rows.map((row) =>
        row.type === "date" ? (
          <div key={row.key} className="my-3 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-border/60" />
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{row.label}</span>
            <span className="h-px flex-1 bg-border/60" />
          </div>
        ) : (
          <div key={row.key} className={cn("mb-2 flex flex-col gap-0.5", row.mine ? "items-end" : "items-start")}>
            {!row.mine ? (
              <span className={cn("pl-9 text-xs font-medium text-muted-foreground")}>
                {profilesById.get(row.senderId)?.display_name ?? "Unknown user"}
              </span>
            ) : null}
            {row.items.map((message, index) => renderMessage(message, row.mine, index === 0))}
          </div>
        ),
      )}

      {typingUsers.length > 0 ? (
        <div className="flex items-center gap-2 pl-9 pt-1 text-xs text-muted-foreground" role="status">
          <span className="flex gap-1">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
          {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
        </div>
      ) : null}
    </div>
  );
}
