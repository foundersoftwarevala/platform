import { useMemo, useState } from "react";
import { X, CornerDownRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "./media";
import type { ChatMessage, Profile } from "@/services/chat/types";

interface Props {
  parent: ChatMessage;
  messages: ChatMessage[];
  profilesById: Map<string, Profile>;
  userId: string;
  canSend: boolean;
  onClose: () => void;
  onSend: (body: string, parentId: string) => Promise<unknown>;
}

export function ThreadPanel({ parent, messages, profilesById, userId, canSend, onClose, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const replies = useMemo(
    () => messages.filter((m) => m.parent_id === parent.id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, parent.id],
  );

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSend(body, parent.id);
      setText("");
    } finally {
      setSending(false);
    }
  };

  const row = (message: ChatMessage) => {
    const profile = profilesById.get(message.sender_id) ?? null;
    const name = message.sender_id === userId ? "You" : (profile?.display_name ?? "Member");
    return (
      <div key={message.id} className="flex gap-2 px-3 py-2">
        <UserAvatar name={name} avatarPath={profile?.avatar_path} className="size-7" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">
            {name}
            <span className="ml-2 font-normal text-muted-foreground">
              {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
          <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
        </div>
      </div>
    );
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-border/60 bg-card/40 xl:w-96">
      <header className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <CornerDownRight className="size-4 text-primary" /> Thread
        </h2>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Close thread" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="border-b border-border/60 bg-secondary/30">{row(parent)}</div>
        {replies.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">No replies yet.</p>
        ) : (
          replies.map(row)
        )}
      </ScrollArea>

      <div className="border-t border-border/60 p-2">
        <div className="flex items-end gap-1 rounded-lg border border-border/60 bg-background/70 px-1 py-0.5 focus-within:border-primary/50">
          <textarea
            rows={1}
            value={text}
            disabled={!canSend}
            aria-label="Reply in thread"
            placeholder={canSend ? "Reply…" : "No permission to reply"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            className="max-h-24 min-h-[28px] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm leading-5 outline-none placeholder:text-muted-foreground/70"
          />
          <Button
            size="icon"
            className="size-7 shrink-0 rounded-md"
            aria-label="Send reply"
            disabled={!canSend || sending || !text.trim()}
            onClick={() => void submit()}
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <CornerDownRight className="size-3.5" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
