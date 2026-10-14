import { useState } from "react";
import { Brain, Loader2, Send } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import { ScrollArea } from "@/components/rd-module/ui/scroll-area";
import { cn } from "@/lib/rd-module/utils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIAssistantChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (message: string) => void;
}

/** Conversational surface for the free-form R&D assistant. */
export const AIAssistantChat = ({ messages, isLoading, onSend }: AIAssistantChatProps) => {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const message = draft.trim();
    if (!message || isLoading) return;
    onSend(message);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="mb-4 h-[400px] pr-4">
        <div aria-live="polite" className="space-y-4">
          {messages.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <Brain aria-hidden="true" className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Ask me anything about R&amp;D strategy, innovation, or technology trends.</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn(
                "rounded-xl border p-4",
                message.role === "user"
                  ? "ml-8 border-brand/30 bg-brand/10"
                  : "mr-8 border-border bg-surface-2/50",
              )}
            >
              <p className="mb-1 text-xs text-muted-foreground">
                {message.role === "user" ? "You" : "AI Assistant"}
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          aria-label="Message the R&D assistant"
          placeholder="Ask about innovation, trends, technology..."
          className="bg-surface-2/50"
        />
        <Button
          onClick={submit}
          disabled={isLoading || !draft.trim()}
          aria-label="Send message"
          className="brand-soft min-h-11 min-w-11 text-foreground"
        >
          <Send aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
