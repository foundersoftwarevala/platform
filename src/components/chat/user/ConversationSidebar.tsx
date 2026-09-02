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

interface Props {
  conversations: ConversationSummary[];
  loading: boolean;
  activeId: string | null;
  userId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function ConversationSidebar({ conversations, loading, activeId, userId, onSelect, onNew }: Props) {
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
    <div className="flex h-full flex-col border-r border-border/60 bg-card/40">
      <div className="space-y-3 border-b border-border/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Conversations</h2>
          <Button size="sm" onClick={onNew} className="h-8 gap-1">
            <Plus className="size-4" /> New
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search people or subjects"
            aria-label="Search conversations"
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="favorites">Starred</TabsTrigger>
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
              No conversations yet. Start one with a teammate to begin.
            </li>
          ) : null}

          {visible.map((conversation) => {
            const others = conversation.participants.filter((p) => p.user_id !== userId);
            const headline =
              conversation.subject ||
              others.map((p) => p.profile?.display_name).filter(Boolean).join(", ") ||
              "Conversation";
            const lead = others[0]?.profile;
            const active = conversation.id === activeId;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border border-transparent p-3 text-left transition-colors",
                    active ? "border-border bg-secondary" : "hover:bg-secondary/60",
                  )}
                >
                  <UserAvatar
                    name={lead?.display_name ?? headline}
                    avatarPath={lead?.avatar_path}
                    presence={lead?.presence}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{headline}</span>
                      {conversation.membership?.favorite ? (
                        <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                      ) : null}
                      {conversation.membership?.muted ? (
                        <BellOff className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : null}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        {relativeTime(conversation.last_message_at)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="line-clamp-1 flex-1 text-xs text-muted-foreground">
                        {conversation.lastMessage?.body || "No messages yet"}
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
