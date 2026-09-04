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

export function ChatWorkspace() {
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
    if (!sessionLoading && !userId) void navigate({ to: "/auth" });
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

  const displayName = myProfile?.display_name ?? "Member";
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
          if (result.escalated) toast.info("Moved to a human agent — Sales & Support has been notified.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "AI is unavailable right now.");
      } finally {
        setAiThinking(false);
      }
    },
    [askAi, queryClient],
  );

  const onSend = async (body: string, mentions: string[]) => {
    setSending(true);
    try {
      await send({ body, parentId: replyTo?.id ?? null, mentions });
      setReplyTo(null);
      playCue("sent", prefs.sound);
      if (activeId && active?.ai_enabled && !replyTo) void runAiTurn(activeId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Message could not be sent");
    } finally {
      setSending(false);
    }
  };

  const mobilePane = useRef<HTMLDivElement>(null);
  const showList = !activeId;

  if (sessionLoading) {
    return <div className="grid h-screen place-items-center bg-background text-sm text-muted-foreground">Loading…</div>;
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
              aria-label="Back to conversations"
              onClick={() => setActiveId(null)}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{active?.subject ?? "Select a conversation"}</p>
              <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    connection === "live" ? "bg-emerald-500" : connection === "offline" ? "bg-destructive" : "bg-amber-500",
                  )}
                />
                {connection === "live" ? "Live" : connection}
                {active ? ` · ${onlineUsers.length} online · ${active.participants.length} members` : ""}
              </p>
            </div>
            <Badge variant="secondary" className="hidden gap-1 text-[10px] sm:flex">
              <ShieldCheck className="size-3" /> Immutable
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={prefs.autoTranslate ? "default" : "ghost"}
                  size="icon"
                  className="size-8"
                  aria-label="Toggle real-time translation"
                  onClick={() => update({ autoTranslate: !prefs.autoTranslate })}
                >
                  <Languages className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Real-time translate ({prefs.language.toUpperCase()})</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Search in conversation"
                  onClick={() => setSearchOpen((v) => !v)}
                >
                  <Search className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search in conversation</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Conversation details"
                  onClick={() => setDetailsOpen((v) => !v)}
                >
                  <Info className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Details</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Preferences" onClick={() => setPrefsOpen(true)}>
                  <Settings className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preferences</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="My profile" onClick={() => setProfileOpen(true)}>
                  <UserAvatar name={displayName} avatarPath={myProfile?.avatar_path} className="size-8" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{displayName}{roles[0] ? ` · ${roles[0]}` : ""}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Sign out"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    queryClient.clear();
                    void navigate({ to: "/auth" });
                  }}
                >
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
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
                  placeholder="Search this conversation…"
                  className="h-7 flex-1 text-sm"
                  aria-label="Search this conversation"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Close search"
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
                    <li className="px-2 py-2 text-xs text-muted-foreground">No matches</li>
                  ) : (
                    searchResults.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => scrollTo(m.id)}
                          className="block w-full truncate px-2 py-1.5 text-left text-xs hover:bg-secondary/60"
                        >
                          <span className="font-medium">
                            {profilesById.get(m.sender_id)?.display_name ?? "Member"}:{" "}
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
                <p className="mt-2 text-sm font-medium">No conversation selected</p>
                <p className="text-xs text-muted-foreground">Pick a conversation or start a new one.</p>
                <Button className="mt-3 h-8 text-xs" onClick={() => setNewOpen(true)}>
                  New conversation
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
