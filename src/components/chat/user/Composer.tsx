import { useEffect, useMemo, useRef, useState } from "react";
import { FileIcon, Loader2, Paperclip, Reply, SendHorizontal, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatMessage, DraftAttachment, Participant, Profile } from "@/services/chat/types";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "😀","😄","😁","😂","🤣","😊","😍","🤩","😎","🤔","👍","👎","👏","🙏","💪","🎉","🔥","✨","❤️","💯",
  "✅","❌","⚠️","📌","📎","🚀","🤝","💡","🕒","📅","👀","😅","🙌","🤝","☕","🎯","📈","🛠️","🔒","🆗",
];

interface ComposerProps {
  canSend: boolean;
  canUpload: boolean;
  canMention: boolean;
  participants: Participant[];
  profilesById: Map<string, Profile>;
  uploads: DraftAttachment[];
  replyTo: ChatMessage | null;
  sending: boolean;
  enterToSend: boolean;
  onQueueFiles: (files: File[]) => void;
  onCancelUpload: (id: string) => void;
  onCancelReply: () => void;
  onSend: (body: string, mentions: string[]) => Promise<unknown>;
  onTyping: (typing: boolean) => void;
}

/** Slim, compact message composer with mentions, attachments and emoji. */
export function Composer(props: ComposerProps) {
  const {
    canSend, canUpload, canMention, participants, profilesById, uploads,
    replyTo, sending, enterToSend, onQueueFiles, onCancelUpload, onCancelReply, onSend, onTyping,
  } = props;
  const [text, setText] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | null>(null);

  const mentionCandidates = useMemo(() => {
    if (!canMention) return [];
    const q = mentionQuery.toLowerCase();
    return participants
      .map((p) => p.profile)
      .filter((p): p is Profile => !!p)
      .filter((p) => !q || p.handle.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [participants, mentionQuery, canMention]);

  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  useEffect(() => {
    autosize();
  }, [text]);

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const match = /(^|\s)@([\w-]*)$/.exec(before);
    if (match) {
      setMentionQuery(match[2] ?? "");
      setMentionOpen(true);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
  };

  const notifyTyping = () => {
    onTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => onTyping(false), 2500);
  };

  const insertMention = (profile: Profile) => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@[\w-]*$/, `@${profile.handle} `);
    const next = before + text.slice(caret);
    setText(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  };

  const resolveMentions = (body: string): string[] => {
    if (!canMention) return [];
    return participants
      .map((p) => p.profile)
      .filter((p): p is Profile => !!p)
      .filter((p) => new RegExp(`@${p.handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(body))
      .map((p) => p.id);
  };

  const submit = async () => {
    const body = text.trim();
    if ((!body && uploads.length === 0) || !canSend || sending) return;
    const mentions = resolveMentions(body);
    setText("");
    setMentionOpen(false);
    onTyping(false);
    await onSend(body, mentions);
    textareaRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && mentionCandidates.length > 0) {
      if (event.key === "ArrowDown") { event.preventDefault(); setMentionIndex((i) => (i + 1) % mentionCandidates.length); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length); return; }
      if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); insertMention(mentionCandidates[mentionIndex]!); return; }
      if (event.key === "Escape") { setMentionOpen(false); return; }
    }
    if (event.key === "Enter" && !event.shiftKey && enterToSend) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="border-t border-border/60 bg-card/50 px-2 py-1 sm:px-3">
      {replyTo ? (
        <div className="mb-1 flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/50 px-2 py-0.5 text-xs">
          <Reply className="size-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">Replying: </span>
            {replyTo.body || "Attachment"}
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="rounded p-0.5 hover:bg-secondary">
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {uploads.length > 0 ? (
        <ul className="mb-1 space-y-1">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-2 py-1">
              <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-xs">{u.file.name}</span>
              {u.state === "uploading" ? (
                <span className="flex w-24 items-center gap-1.5">
                  <Progress value={u.progress} className="h-1" />
                  <span className="w-8 text-right text-[10px] text-muted-foreground">{u.progress}%</span>
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">ready</span>
              )}
              <button type="button" onClick={() => onCancelUpload(u.id)} aria-label={`Remove ${u.file.name}`} className="rounded p-0.5 hover:bg-secondary">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        {mentionOpen && mentionCandidates.length > 0 ? (
          <ul
            role="listbox"
            aria-label="Mention a participant"
            className="absolute bottom-full left-0 z-20 mb-1 w-64 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg"
          >
            {mentionCandidates.map((p, index) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === mentionIndex}
                  onClick={() => insertMention(p)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
                    index === mentionIndex ? "bg-secondary" : "hover:bg-secondary/60",
                  )}
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {p.display_name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.display_name}</span>
                  <span className="text-xs text-muted-foreground">@{p.handle}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-end gap-0.5 rounded-lg border border-border/60 bg-background/70 px-1 py-0.5 transition-shadow focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
          {canUpload ? (
            <>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                aria-label="Attach files"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) onQueueFiles(files);
                  e.target.value = "";
                }}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Attach files"
                    className="size-7 shrink-0 rounded-md"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach files</TooltipContent>
              </Tooltip>
            </>
          ) : null}

          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label="Insert emoji" className="size-7 shrink-0 rounded-md">
                    <Smile className="size-3.5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Emoji</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64 p-2" align="start" side="top">
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded p-1 text-lg hover:bg-secondary"
                    onClick={() => {
                      setText((t) => t + emoji);
                      textareaRef.current?.focus();
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <textarea
            ref={textareaRef}
            value={text}
            rows={1}
            disabled={!canSend}
            aria-label="Message"
            placeholder={canSend ? "Type a message…  (@ to mention)" : "You don't have permission to send messages"}
            onChange={(e) => {
              setText(e.target.value);
              detectMention(e.target.value, e.target.selectionStart);
              notifyTyping();
            }}
            onKeyDown={onKeyDown}
            className="max-h-24 min-h-[28px] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm leading-5 outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                aria-label="Send message"
                disabled={!canSend || sending || (!text.trim() && uploads.length === 0)}
                onClick={() => void submit()}
                className="size-7 shrink-0 rounded-md"
              >
                {sending ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{enterToSend ? "Send (Enter)" : "Send"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
