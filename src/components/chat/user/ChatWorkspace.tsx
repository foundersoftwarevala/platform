import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  Info,
  Languages,
  LifeBuoy,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useMyPermissions, useMyProfile, useSupabaseSession } from "@/hooks/use-session";
import {
  useConversationRealtime,
  useConversations,
  useMessageActions,
  useMessages,
  useReadReceipts,
  useSendMessage,
} from "@/hooks/use-chat";
import { usePreferences, playCue } from "@/hooks/use-preferences";
import { fetchProfiles, setFavorite, setMuted, updatePresence } from "@/services/chat/chat-service";
import type { ChatMessage, Profile } from "@/services/chat/types";
import {
  generateAiReply,
  requestHumanHandoff,
  setConversationAi,
} from "@/lib/chat/ai.functions";
import { ConversationSidebar } from "./ConversationSidebar";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { ContextPanel } from "./ContextPanel";
import { ThreadPanel } from "./ThreadPanel";
import { NewConversationDialog } from "./NewConversationDialog";
import { PreferencesDialog } from "./PreferencesDialog";
import { ProfileDialog } from "./ProfileDialog";
import { UserAvatar } from "./media";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";

export function ChatWorkspace() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, loading: sessionLoading } = useSupabaseSession();
  const { data: myProfile } = useMyProfile(userId);
  const { can, roles } = useMyPermissions(userId);
  const { prefs, update } = usePreferences();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [threadParent, setThreadParent] = useState<ChatMessage | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !userId) void navigate({ to: "/login" });
  }, [sessionLoading, userId, navigate]);

  const conversationsQuery = useConversations(userId);
  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);

  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0]!.id);
  }, [activeId, conversations]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messagesQuery = useMessages(activeId, userId);
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  const participantIds = useMemo(() => {
    const ids = new Set<string>();
    active?.participants.forEach((p) => ids.add(p.user_id));
    messages.forEach((m) => ids.add(m.sender_id));
    return Array.from(ids);
  }, [active, messages]);

  const profilesQuery = useQuery({
    queryKey: ["profiles", participantIds.join(",")],
    enabled: participantIds.length > 0,
    queryFn: () => fetchProfiles(participantIds),
  });
  const profilesById = useMemo<Map<string, Profile>>(
    () => profilesQuery.data ?? new Map<string, Profile>(),
    [profilesQuery.data],
  );

  // Sent to other participants as the typing/presence name, so it stays language-neutral.
  const displayName = myProfile?.display_name ?? "Member";
  const shownName = myProfile?.display_name ?? t("chat.member");
  const onIncoming = useCallback(() => playCue("incoming", prefs.sound), [prefs.sound]);
  const { connection, typingUsers, onlineUsers, broadcastTyping } = useConversationRealtime({
    conversationId: activeId,
    userId,
    displayName,
    onIncomingMessage: onIncoming,
  });

  const { pending, uploads, queueFiles, cancelUpload, send, retry, discard } = useSendMessage(activeId, userId);
  const actions = useMessageActions(activeId, userId);
  useReadReceipts(activeId, userId, messages);

  // Presence heartbeat.
  useEffect(() => {
    if (!userId) return;
    void updatePresence(userId, "online");
    const timer = window.setInterval(() => void updatePresence(userId, "online"), 45_000);
    const onHide = () => void updatePresence(userId, document.hidden ? "away" : "online");
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      void updatePresence(userId, "offline");
    };
  }, [userId]);

  const searchResults = useMemo(() => {
    const clean = term.trim().toLowerCase();
    if (!clean) return [];
    return messages.filter((m) => m.body.toLowerCase().includes(clean)).slice(-40).reverse();
  }, [messages, term]);

  const scrollTo = (id: string) => {
    setHighlightId(id);
    window.setTimeout(() => {
      document.getElementById(`message-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 30);
    window.setTimeout(() => setHighlightId(null), 2600);
  };

  const askAi = useServerFn(generateAiReply);
  const toggleAi = useServerFn(setConversationAi);
  const askHuman = useServerFn(requestHumanHandoff);

  /** Runs the real AI turn on the server; failures never break the sent message. */
  const runAiTurn = useCallback(
    async (conversationId: string) => {
      setAiThinking(true);
      try {
        const result = await askAi({ data: { conversationId } });
        if (!result.ok) {
          toast.error(result.error);
        } else {
          await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          await queryClient.invalidateQueries({ queryKey: ["conversations"] });
          if (result.escalated) toast.info(t("chat.handoff_escalated"));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("chat.ai_unavailable"));
      } finally {
        setAiThinking(false);
      }
    },
    [askAi, queryClient, t],
  );

  const onSend = async (body: string, mentions: string[]) => {
    setSending(true);
    try {
      await send({ body, parentId: replyTo?.id ?? null, mentions });
      setReplyTo(null);
      playCue("sent", prefs.sound);
      if (activeId && active?.ai_enabled && !replyTo) void runAiTurn(activeId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chat.send_failed"));
    } finally {
      setSending(false);
    }
  };

  const mobilePane = useRef<HTMLDivElement>(null);
  const showList = !activeId;

  if (sessionLoading) {
    return <div className="grid h-screen place-items-center bg-background text-sm text-muted-foreground">{t("chat.loading")}</div>;
  }
  if (!userId) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <main className="flex h-[100dvh] w-full overflow-hidden bg-background">
        <div className={cn("h-full w-full shrink-0 md:w-80 md:border-r md:border-border/60", showList ? "flex" : "hidden md:flex")}>
          <ConversationSidebar
            conversations={conversations}
            loading={conversationsQuery.isLoading}
            activeId={activeId}
            userId={userId}
            onSelect={(id) => {
              setActiveId(id);
              setThreadParent(null);
              setReplyTo(null);
            }}
            onNew={() => setNewOpen(true)}
          />
        </div>

        <section
          ref={mobilePane}
          className={cn("flex h-full min-w-0 flex-1 flex-col", showList ? "hidden md:flex" : "flex")}
        >
          <header className="flex items-center gap-2 border-b border-border/60 bg-card/50 px-2 py-1.5 sm:px-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 md:hidden"
              aria-label={t("chat.header.back")}
              onClick={() => setActiveId(null)}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{active?.subject ?? t("chat.header.select_conversation")}</p>
              <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    connection === "live" ? "bg-emerald-500" : connection === "offline" ? "bg-destructive" : "bg-amber-500",
                  )}
                />
                {t("chat.header.connection", { state: connection })}
                {active
                  ? ` · ${t("chat.header.online_count", { count: onlineUsers.length })} · ${t("chat.members_count", { count: active.participants.length })}`
                  : ""}
                {aiThinking ? ` · ${t("chat.header.ai_typing")}` : ""}
              </p>
            </div>
            <Badge variant="secondary" className="hidden gap-1 text-[10px] sm:flex">
              <ShieldCheck className="size-3" /> {t("chat.header.immutable")}
            </Badge>
            {active ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={active.ai_enabled ? "default" : "ghost"}
                      size="icon"
                      className="size-8"
                      aria-label={t("chat.header.toggle_ai")}
                      onClick={async () => {
                        const result = await toggleAi({
                          data: { conversationId: active.id, enabled: !active.ai_enabled },
                        });
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
                      }}
                    >
                      <Bot className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{active.ai_enabled ? t("chat.header.ai_on") : t("chat.header.ai_off")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t("chat.header.talk_to_human_agent")}
                      onClick={async () => {
                        const result = await askHuman({
                          data: { conversationId: active.id, reason: "User asked for a human agent." },
                        });
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
                        toast.success(t("chat.handoff_requested"));
                      }}
                    >
                      <LifeBuoy className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("chat.header.talk_to_human")}</TooltipContent>
                </Tooltip>
              </>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={prefs.autoTranslate ? "default" : "ghost"}
                  size="icon"
                  className="size-8"
                  aria-label={t("chat.header.toggle_translation")}
                  onClick={() => update({ autoTranslate: !prefs.autoTranslate })}
                >
                  <Languages className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("chat.header.realtime_translate", { language: prefs.language.toUpperCase() })}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t("chat.header.search")}
                  onClick={() => setSearchOpen((v) => !v)}
                >
                  <Search className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("chat.header.search")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t("chat.header.details")}
                  onClick={() => setDetailsOpen((v) => !v)}
                >
                  <Info className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("chat.header.details_short")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label={t("chat.header.preferences")} onClick={() => setPrefsOpen(true)}>
                  <Settings className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("chat.header.preferences")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={t("chat.header.my_profile")} onClick={() => setProfileOpen(true)}>
                  <UserAvatar name={shownName} avatarPath={myProfile?.avatar_path} className="size-8" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{shownName}{roles[0] ? ` · ${roles[0]}` : ""}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t("chat.sign_out")}
                  onClick={async () => {
                    await supabase.auth.signOut();
                    queryClient.clear();
                    void navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("chat.sign_out")}</TooltipContent>
            </Tooltip>
          </header>

          {searchOpen ? (
            <div className="border-b border-border/60 bg-card/30 px-2 py-1.5 sm:px-3">
              <div className="flex items-center gap-2">
                <Search className="size-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder={t("chat.search.placeholder")}
                  className="h-7 flex-1 text-sm"
                  aria-label={t("chat.search.label")}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={t("chat.search.close")}
                  onClick={() => {
                    setSearchOpen(false);
                    setTerm("");
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              {term.trim() ? (
                <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border/60">
                  {searchResults.length === 0 ? (
                    <li className="px-2 py-2 text-xs text-muted-foreground">{t("chat.search.no_matches")}</li>
                  ) : (
                    searchResults.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => scrollTo(m.id)}
                          className="block w-full truncate px-2 py-1.5 text-left text-xs hover:bg-secondary/60"
                        >
                          <span className="font-medium">
                            {t("chat.search.sender", { name: profilesById.get(m.sender_id)?.display_name ?? t("chat.member") })}{" "}
                          </span>
                          {m.body}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          ) : null}

          {active ? (
            <>
              <MessageList
                messages={messages}
                pending={pending}
                userId={userId}
                profilesById={profilesById}
                typingUsers={typingUsers}
                connection={connection}
                canReact={can("message.react")}
                canReply={can("message.send")}
                canBookmark={can("message.bookmark")}
                translateTarget={prefs.language}
                autoTranslate={prefs.autoTranslate}
                density={prefs.density}
                highlightId={highlightId}
                onReact={(id, emoji, activeState) => void actions.react(id, emoji, activeState)}
                onBookmark={(id, pinned, activeState) => void actions.bookmark(id, pinned, activeState)}
                onReply={setReplyTo}
                onOpenThread={setThreadParent}
                onRetry={(ref) => void retry(ref)}
                onDiscard={discard}
              />
              <Composer
                canSend={can("message.send")}
                canUpload={can("attachment.upload")}
                canMention={can("message.send")}
                participants={active.participants}
                profilesById={profilesById}
                uploads={uploads}
                replyTo={replyTo}
                sending={sending}
                enterToSend={prefs.enterToSend}
                onQueueFiles={queueFiles}
                onCancelUpload={cancelUpload}
                onCancelReply={() => setReplyTo(null)}
                onSend={onSend}
                onTyping={broadcastTyping}
              />
            </>
          ) : (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <div>
                <UserRound className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">{t("chat.empty.title")}</p>
                <p className="text-xs text-muted-foreground">{t("chat.empty.hint")}</p>
                <Button className="mt-3 h-8 text-xs" onClick={() => setNewOpen(true)}>
                  {t("chat.new_conversation")}
                </Button>
              </div>
            </div>
          )}
        </section>

        {active && threadParent ? (
          <div className="fixed inset-0 z-40 bg-background md:static md:z-auto md:flex">
            <ThreadPanel
              parent={threadParent}
              messages={messages}
              profilesById={profilesById}
              userId={userId}
              canSend={can("message.send")}
              onClose={() => setThreadParent(null)}
              onSend={async (body, parentId) => {
                await send({ body, parentId });
                playCue("sent", prefs.sound);
              }}
            />
          </div>
        ) : active && detailsOpen ? (
          <div className="fixed inset-0 z-40 bg-background md:static md:z-auto md:flex">
            <ContextPanel
              conversation={active}
              profilesById={profilesById}
              userId={userId}
              onClose={() => setDetailsOpen(false)}
              onToggleFavorite={async () => {
                await setFavorite(active.id, userId, !(active.membership?.favorite ?? false));
                await queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
              }}
              onToggleMute={async () => {
                await setMuted(active.id, userId, !(active.membership?.muted ?? false));
                await queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
              }}
            />
          </div>
        ) : null}

        <NewConversationDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          userId={userId}
          onCreated={(id) => {
            void queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
            setActiveId(id);
          }}
        />
        <PreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} prefs={prefs} update={update} />
        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} userId={userId} profile={myProfile ?? null} />
      </main>
    </TooltipProvider>
  );
}
