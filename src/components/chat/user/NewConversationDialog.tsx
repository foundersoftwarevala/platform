import { useEffect, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createConversation, searchDirectory } from "@/services/chat/chat-service";
import type { Profile } from "@/services/chat/types";
import { UserAvatar } from "./media";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onCreated: (conversationId: string) => void;
}

/** Start a real conversation: search the directory, pick people, create. */
export function NewConversationDialog({ open, onOpenChange, userId, onCreated }: Props) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setSelected([]);
      setSubject("");
      return;
    }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchDirectory(term, userId);
        if (active) setResults(found);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [term, open, userId]);

  const toggle = (profile: Profile) => {
    setSelected((prev) =>
      prev.some((p) => p.id === profile.id) ? prev.filter((p) => p.id !== profile.id) : [...prev, profile],
    );
  };

  const create = async () => {
    if (selected.length === 0) {
      toast.error("Pick at least one person");
      return;
    }
    const isDirect = selected.length === 1;
    const title =
      subject.trim() || (isDirect ? selected[0]!.display_name : selected.map((p) => p.display_name).join(", "));
    setCreating(true);
    try {
      const id = await createConversation({
        subject: title.slice(0, 120),
        kind: isDirect ? "direct" : "group",
        createdBy: userId,
        participantIds: selected.map((p) => p.id),
      });
      toast.success("Conversation created");
      onOpenChange(false);
      onCreated(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create conversation");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>Search the workspace directory and start chatting.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search people by name or handle"
              aria-label="Search people"
              className="pl-9"
              autoFocus
            />
          </div>

          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p)}
                  className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                >
                  {p.display_name} ✕
                </button>
              ))}
            </div>
          ) : null}

          <ScrollArea className="h-56 rounded-xl border border-border/60">
            <ul className="p-1.5">
              {searching ? (
                <li className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Searching…
                </li>
              ) : results.length === 0 ? (
                <li className="flex flex-col items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Users className="size-5" /> No people found
                </li>
              ) : (
                results.map((p) => {
                  const isSelected = selected.some((s) => s.id === p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => toggle(p)}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                          isSelected ? "bg-primary/10" : "hover:bg-secondary/60",
                        )}
                      >
                        <UserAvatar name={p.display_name} avatarPath={p.avatar_path} presence={p.presence} className="size-8" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.display_name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            @{p.handle}
                            {p.job_title ? ` · ${p.job_title}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </ScrollArea>

          {selected.length > 1 ? (
            <div className="space-y-1.5">
              <Label htmlFor="conv-subject">Group subject (optional)</Label>
              <Input
                id="conv-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                placeholder="Project Phoenix launch"
              />
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void create()} disabled={creating || selected.length === 0}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : null}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
