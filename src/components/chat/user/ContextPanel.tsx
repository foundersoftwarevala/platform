import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Star, X, ShieldCheck, Users, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchSharedMedia } from "@/services/chat/chat-service";
import type { ConversationSummary, Profile } from "@/services/chat/types";
import { AttachmentCard, UserAvatar } from "./media";

interface Props {
  conversation: ConversationSummary;
  profilesById: Map<string, Profile>;
  userId: string;
  onClose: () => void;
  onToggleFavorite: () => void;
  onToggleMute: () => void;
}

export function ContextPanel({
  conversation,
  profilesById,
  userId,
  onClose,
  onToggleFavorite,
  onToggleMute,
}: Props) {
  const media = useQuery({
    queryKey: ["shared-media", conversation.id],
    queryFn: () => fetchSharedMedia(conversation.id),
  });

  const favorite = conversation.membership?.favorite ?? false;
  const muted = conversation.membership?.muted ?? false;

  return (
    <aside className="flex h-full w-full flex-col border-l border-border/60 bg-card/40 xl:w-80">
      <header className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h2 className="text-sm font-semibold">Details</h2>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Close details" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex flex-col items-center gap-2 border-b border-border/60 px-4 py-4 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary/15 text-lg font-semibold text-primary">
          {conversation.subject.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold">{conversation.subject}</p>
          <p className="text-xs text-muted-foreground">
            {conversation.kind} · {conversation.participants.length} members
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant={favorite ? "default" : "secondary"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onToggleFavorite}
          >
            <Star className="size-3.5" /> {favorite ? "Starred" : "Star"}
          </Button>
          <Button variant="secondary" size="sm" className="h-7 gap-1.5 text-xs" onClick={onToggleMute}>
            {muted ? <BellOff className="size-3.5" /> : <Bell className="size-3.5" />}
            {muted ? "Muted" : "Mute"}
          </Button>
        </div>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3" /> Immutable audit log
        </p>
      </div>

      <Tabs defaultValue="people" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-2 grid grid-cols-2">
          <TabsTrigger value="people" className="gap-1.5 text-xs">
            <Users className="size-3.5" /> People
          </TabsTrigger>
          <TabsTrigger value="media" className="gap-1.5 text-xs">
            <Images className="size-3.5" /> Files
          </TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-2">
            <ul className="space-y-1">
              {conversation.participants.map((p) => {
                const profile = p.profile ?? profilesById.get(p.user_id) ?? null;
                const name = profile?.display_name ?? "Member";
                return (
                  <li key={p.user_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/50">
                    <UserAvatar name={name} avatarPath={profile?.avatar_path} presence={profile?.presence} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {name}
                        {p.user_id === userId ? " (you)" : ""}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {profile?.job_title || `@${profile?.handle ?? "member"}`}
                      </span>
                    </span>
                    {p.role_label ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {p.role_label}
                      </Badge>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="media" className="min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-2">
            {media.isLoading ? (
              <p className="px-1 py-4 text-xs text-muted-foreground">Loading files…</p>
            ) : (media.data ?? []).length === 0 ? (
              <p className="px-1 py-4 text-xs text-muted-foreground">No files shared yet.</p>
            ) : (
              <ul className="space-y-2">
                {(media.data ?? []).map((attachment) => (
                  <li key={attachment.id}>
                    <AttachmentCard attachment={attachment} />
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
