import { useMemo, useState } from "react";
import { Plus, Search, Star, BellOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "./media";
import type { ConversationSummary } from "@/services/chat/types";
import { cn } from "@/lib/utils";
import { useTranslation, type Translate } from "@/lib/i18n/use-translation";
import softwareValaLogo from "@/assets/software-vala-logo.jpg";

interface Props {
  conversations: ConversationSummary[];
  loading: boolean;
  activeId: string | null;
  userId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** False for a person who may only talk to Software Vala and already has that conversation. */
  canStartNew?: boolean;
}

function relativeTime(
  iso: string,
  t: Translate,
  formatDate: (value: string, options: Intl.DateTimeFormatOptions) => string,
) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return t("chat.time.now");
  if (minutes < 60) return t("chat.time.minutes_short", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("chat.time.hours_short", { count: hours });
  return formatDate(iso, { day: "numeric", month: "short" });
}

export function ConversationSidebar({
  conversations,
  loading,
  activeId,
  userId,
  onSelect,
  onNew,
  canStartNew = true,
}: Props) {
  const { t, formatDate } = useTranslation();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "favorites">("all");

  const visible = useMemo(() => {
    const clean = term.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unreadCount === 0) return false;
      if (filter === "favorites" && !c.membership?.favorite) return false;
      if (!clean) return true;
      const names = c.participants.map((p) => p.profile?.display_name ?? "").join(" ");
      return (
        c.subject.toLowerCase().includes(clean) ||
        names.toLowerCase().includes(clean) ||
        (c.lastMessage?.body ?? "").toLowerCase().includes(clean)
      );
    });
  }, [conversations, term, filter]);

  return (
    <div className="flex h-full w-full min-w-0 flex-col border-r border-border/60 bg-sidebar">
      <div data-no-translate className="flex items-center gap-3 px-5 pt-5">
        <img
          src={softwareValaLogo}
          alt="Software Vala"
          width={42}
          height={42}
          className="size-10 shrink-0 rounded-2xl border border-border/60 bg-card object-contain shadow-sm"
        />
        <div className="min-w-0">
          <p className="chat-heading truncate text-sm font-bold tracking-tight">SOFTWARE VALA</p>
          <p className="truncate text-[11px] text-muted-foreground">Connect · AI Workspace</p>
        </div>
      </div>

      <div className="space-y-3 border-b border-border/60 px-4 pb-4 pt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("chat.sidebar.title")}
          </h2>
          {canStartNew ? (
            <Button
              size="sm"
              onClick={onNew}
              className="chat-brand-gradient h-10 gap-1.5 rounded-2xl px-3 font-semibold transition hover:-translate-y-0.5 hover:opacity-95 motion-reduce:transform-none"
            >
              <Plus className="size-4" /> {t("chat.sidebar.new")}
            </Button>
          ) : null}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("chat.sidebar.search_placeholder")}
            aria-label={t("chat.sidebar.search_label")}
            className="h-10 rounded-xl border-border/70 bg-background/75 pl-9 shadow-sm"
          />
        </div>
        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <TabsList className="grid h-9 w-full grid-cols-3 rounded-full bg-muted/70 p-1">
            <TabsTrigger value="all">{t("chat.sidebar.filter_all")}</TabsTrigger>
            <TabsTrigger value="unread">{t("chat.sidebar.filter_unread")}</TabsTrigger>
            <TabsTrigger value="favorites">{t("chat.sidebar.filter_starred")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <ul className="space-y-1 p-2">
          {loading ? (
            <li className="space-y-2 p-2">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/40" />
              ))}
            </li>
          ) : null}

          {!loading && visible.length === 0 ? (
            <li className="p-6 text-center text-sm text-muted-foreground">
              {t("chat.sidebar.empty")}
            </li>
          ) : null}

          {visible.map((conversation) => {
            const others = conversation.participants.filter((p) => p.user_id !== userId);
            const headline =
              conversation.subject ||
              others
                .map((p) => p.profile?.display_name)
                .filter(Boolean)
                .join(", ") ||
              t("chat.sidebar.untitled");
            const lead = others[0]?.profile;
            const active = conversation.id === activeId;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all",
                    active
                      ? "border-primary/25 bg-card/80 shadow-md ring-1 ring-primary/10"
                      : "border-transparent hover:border-border/60 hover:bg-card/60",
                  )}
                >
                  <UserAvatar
                    name={lead?.display_name ?? headline}
                    avatarPath={lead?.avatar_path}
                    presence={lead?.presence}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold tracking-tight">
                        {headline}
                      </span>
                      {conversation.membership?.favorite ? (
                        <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                      ) : null}
                      {conversation.membership?.muted ? (
                        <BellOff className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : null}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        {relativeTime(conversation.last_message_at, t, formatDate)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="line-clamp-1 flex-1 text-xs text-muted-foreground">
                        {conversation.lastMessage?.body || t("chat.sidebar.no_messages")}
                      </span>
                      {conversation.unreadCount > 0 ? (
                        <Badge className="h-5 min-w-5 justify-center px-1.5 text-[11px]">
                          {conversation.unreadCount}
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
