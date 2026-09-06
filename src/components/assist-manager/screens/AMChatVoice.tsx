/**
 * CHAT & VOICE
 * Session messaging with voice controls and AI translation state.
 */

import { useState } from "react";
import { Bot, Languages, Mic, MicOff, PhoneCall, Send, Volume2, VolumeX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useChatMessages,
  useSendChat,
  useUpdateControlState,
} from "@/lib/assist-manager/hooks";
import { EmptyState, LoadingBlock, ScreenHeader } from "../am-ui";
import { SessionPicker, useActiveSession } from "../am-session";

export function AMChatVoice() {
  const { sessions, session, control, isLoading } = useActiveSession();
  const { data: messages = [], isLoading: chatLoading } = useChatMessages(session?.id);
  const sendChat = useSendChat(session?.id);
  const updateControl = useUpdateControlState();
  const [draft, setDraft] = useState("");

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingBlock />
      </div>
    );
  }

  if (!session) {
    return (
<div className="space-y-6 p-6">
        <ScreenHeader title="Chat & Voice" subtitle="Secure messaging and voice channel with the end user" />
        <EmptyState title="No session selected" description="Chat opens with a live session." />
      </div>
    );
  }

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    sendChat.mutate({ sessionId: session.id, body });
    setDraft("");
  };

  const patch = (p: Record<string, boolean>) =>
    updateControl.mutate({ sessionId: session.id, patch: p });

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <ScreenHeader
        title="Chat & Voice"
        subtitle={`Communication for ${session.session_code}`}
        actions={<SessionPicker sessions={sessions} value={session.id} />}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex min-h-0 flex-col lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Session Chat</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <ScrollArea className="min-h-[280px] flex-1 rounded-lg border border-border bg-muted/30 p-4">
              {chatLoading ? (
                <LoadingBlock rows={3} />
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn("flex", m.sender === "agent" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                          m.sender === "agent"
                            ? "bg-primary text-primary-foreground"
                            : m.sender === "ai"
                              ? "border border-info/40 bg-info/10 text-info"
                              : "border border-border bg-card",
                        )}
                      >
                        <p className="mb-0.5 text-[10px] uppercase tracking-wide opacity-70">
                          {m.sender}
                          {m.is_translation ? " · translated" : ""}
                        </p>
                        {m.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                value={draft}
                placeholder="Type a message…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <Button onClick={submit} disabled={sendChat.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PhoneCall className="h-4 w-4 text-primary" /> Voice Channel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                variant={control?.voice_active ? "destructive" : "default"}
                onClick={() => patch({ voice_active: !control?.voice_active })}
              >
                {control?.voice_active ? "End voice call" : "Start voice call"}
              </Button>
              <ToggleRow
                label="Microphone"
                on={Boolean(control?.microphone_enabled)}
                onIcon={Mic}
                offIcon={MicOff}
                onChange={(v) => patch({ microphone_enabled: v })}
              />
              <ToggleRow
                label="Speaker"
                on={Boolean(control?.speaker_enabled)}
                onIcon={Volume2}
                offIcon={VolumeX}
                onChange={(v) => patch({ speaker_enabled: v })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Languages className="h-4 w-4 text-info" /> AI Translation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                label="Auto translate"
                on={Boolean(control?.auto_translate)}
                onIcon={Languages}
                offIcon={Languages}
                onChange={(v) => patch({ auto_translate: v })}
              />
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Bot className="mt-0.5 h-3.5 w-3.5" />
                Translated messages are flagged in the transcript and stored with the session audit
                trail.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onIcon: OnIcon,
  offIcon: OffIcon,
  onChange,
}: {
  label: string;
  on: boolean;
  onIcon: React.ElementType;
  offIcon: React.ElementType;
  onChange: (v: boolean) => void;
}) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
      <span className="flex items-center gap-2 text-sm">
        <Icon className={cn("h-4 w-4", on ? "text-primary" : "text-muted-foreground")} />
        {label}
      </span>
      <Switch checked={on} onCheckedChange={onChange} />
    </div>
  );
}

export default AMChatVoice;
