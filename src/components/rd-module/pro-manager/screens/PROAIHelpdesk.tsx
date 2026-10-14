import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import { usePMConversations, usePMMessages } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { PMBadge, PMEmpty, PMLoading, PMPanel, PMSection, StatusBadge, formatDate } from "../pm-ui";
import { cn } from "@/lib/rd-module/utils";

export const PROAIHelpdesk = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMConversations();
  const { startConversation, updateConversation, sendHelpdeskMessage, run } =
    useProManagerActions();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [userCode, setUserCode] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("English");

  const term = search.trim().toLowerCase();
  const conversations = (data ?? []).filter((row) =>
    term
      ? [row.code, row.user_code, row.topic, row.language, row.status]
          .join(" ")
          .toLowerCase()
          .includes(term)
      : true,
  );
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const { data: messages } = usePMMessages(activeId);

  return (
    <PMSection
      title="AI helpdesk"
      description="Multilingual AI support conversations with auto-resolution, ticket creation and escalation."
    >
      <PMPanel title="Start a conversation" icon={Bot}>
        <div className="flex flex-wrap gap-2">
          <Input
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            placeholder="Account code (PRO-1042)"
            className="w-52"
            aria-label="Account code"
          />
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic"
            className="w-64"
            aria-label="Conversation topic"
          />
          <Input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="Language"
            className="w-40"
            aria-label="Language"
          />
          <Button
            size="sm"
            disabled={userCode.trim().length < 3 || topic.trim().length < 3}
            onClick={async () => {
              const row = await run(
                "Conversation started",
                startConversation({
                  data: { user_code: userCode.trim(), topic: topic.trim(), language },
                }),
              );
              if (row && typeof row === "object" && "id" in row) {
                setActiveId((row as { id: string }).id);
                setTopic("");
              }
            }}
          >
            Start
          </Button>
        </div>
      </PMPanel>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <PMPanel title="Conversations">
          {isLoading ? (
            <PMLoading rows={4} />
          ) : conversations.length === 0 ? (
            <PMEmpty message="No AI conversations yet." />
          ) : (
            <ul className="space-y-2">
              {conversations.map((chat) => (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(chat.id)}
                    className={cn(
                      "w-full rounded-xl border border-border bg-surface-2/60 p-3 text-left transition-colors hover:bg-surface-2",
                      activeId === chat.id && "border-brand/40 shadow-glow",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {chat.code} • {chat.user_code}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <PMBadge tone="muted">{chat.language}</PMBadge>
                        <StatusBadge value={chat.status} />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {chat.topic} • {chat.resolution} • {formatDate(chat.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PMPanel>

        <PMPanel title={active ? `${active.code} — ${active.topic}` : "Select a conversation"}>
          {!active ? (
            <PMEmpty message="Pick a conversation to read and reply with AI." />
          ) : (
            <>
              <div className="scroll-slim max-h-80 space-y-2 overflow-y-auto pr-1">
                {(messages ?? []).length === 0 ? (
                  <PMEmpty message="No messages yet — send the first one." />
                ) : (
                  (messages ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-xl border border-border p-3 text-sm",
                        m.role === "assistant"
                          ? "brand-soft text-foreground"
                          : "bg-surface-2/60 text-muted-foreground",
                      )}
                    >
                      <p className="mb-1 text-xs uppercase tracking-wide text-brand">{m.role}</p>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write a message for the AI helpdesk…"
                  aria-label="Helpdesk message"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && message.trim() && !sending) e.currentTarget.blur();
                  }}
                />
                <Button
                  size="sm"
                  disabled={sending || message.trim().length === 0}
                  onClick={async () => {
                    setSending(true);
                    await run(
                      "AI reply generated",
                      sendHelpdeskMessage({
                        data: {
                          conversation_id: active.id,
                          code: active.code,
                          message: message.trim(),
                          language: active.language,
                          topic: active.topic,
                        },
                      }),
                    );
                    setMessage("");
                    setSending(false);
                  }}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" /> {sending ? "Sending…" : "Send"}
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void run(
                      "Conversation auto-resolved",
                      updateConversation({
                        data: {
                          id: active.id,
                          code: active.code,
                          intent: "auto_resolve",
                          user_code: active.user_code,
                          topic: active.topic,
                        },
                      }),
                    )
                  }
                >
                  Auto-resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void run(
                      "Ticket created",
                      updateConversation({
                        data: {
                          id: active.id,
                          code: active.code,
                          intent: "create_ticket",
                          user_code: active.user_code,
                          topic: active.topic,
                        },
                      }),
                    )
                  }
                >
                  Create ticket
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    void run(
                      "Conversation escalated",
                      updateConversation({
                        data: {
                          id: active.id,
                          code: active.code,
                          intent: "escalate",
                          user_code: active.user_code,
                          topic: active.topic,
                        },
                      }),
                    )
                  }
                >
                  Escalate
                </Button>
              </div>
            </>
          )}
        </PMPanel>
      </div>
    </PMSection>
  );
};
