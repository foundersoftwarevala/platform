import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Globe2, LoaderCircle, Sparkles } from "lucide-react";

import { JarvisCore, type CoreState } from "@/components/JarvisCore";
import { Textarea } from "@/components/ui/textarea";
import { streamChat, type ChatTurn } from "@/components/vala-ai/chat-stream";
import "./ayra-jarvis.css";

const QUICK_ACTIONS = [
  { label: "Plan", prompt: "Help me create a clear plan for my next priority." },
  { label: "Search", prompt: "Help me find the key information I need for my current priority." },
  {
    label: "Analyze",
    prompt: "Help me analyze the main risks and opportunities in my current priority.",
  },
];

export function AyraHeroBanner({
  connected,
  notConnected,
}: {
  connected?: number;
  notConnected?: number;
}) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const avatarState: CoreState = sending ? "thinking" : messages.length > 0 ? "speaking" : "idle";
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  async function sendMessage(text: string) {
    const content = text.trim();
    if (content.length < 3 || sending) return;

    const priorMessages = messages;
    const userTurn: ChatTurn = { role: "user", content };
    const assistantTurn: ChatTurn = { role: "assistant", content: "" };
    const conversation = [...priorMessages, userTurn, assistantTurn];
    const requestController = new AbortController();
    controller.current = requestController;
    setMessages(conversation);
    setPrompt("");
    setError(null);
    setSending(true);

    try {
      const response = await streamChat([...priorMessages, userTurn], {
        signal: requestController.signal,
        onDelta: (full) => {
          setMessages([...priorMessages, userTurn, { role: "assistant", content: full }]);
        },
      });
      if (!response.trim()) {
        setMessages(priorMessages);
        setError("The chat service returned an empty response. Please try again.");
        return;
      }
      setMessages([...priorMessages, userTurn, { role: "assistant", content: response }]);
    } catch (cause) {
      if (!requestController.signal.aborted) {
        setMessages(priorMessages);
        setError(cause instanceof Error ? cause.message : "AYRA could not complete the request.");
      }
    } finally {
      if (!requestController.signal.aborted) setSending(false);
      if (controller.current === requestController) controller.current = null;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(prompt);
  }

  return (
    <section
      aria-labelledby="ayra-hero-title"
      data-testid="ayra-hero-banner"
      className="hero-surface relative isolate overflow-hidden rounded-3xl border border-white/15 p-5 shadow-2xl sm:p-8 lg:p-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-36 -z-10 h-96 w-96 rounded-full bg-primary/35 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-1/4 -z-10 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-center lg:gap-10">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
            EXECUTIVE INTELLIGENCE
          </div>
          <h1
            id="ayra-hero-title"
            className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl"
          >
            Meet AYRA
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
            Your executive AI companion. Ask a question, explore an idea, or shape your next plan.
          </p>

          <form
            onSubmit={submit}
            className="mt-7 rounded-2xl border border-white/20 bg-black/20 p-3 shadow-xl backdrop-blur-xl"
          >
            <label htmlFor="ayra-prompt" className="sr-only">
              Ask AYRA
            </label>
            <Textarea
              id="ayra-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask AYRA..."
              maxLength={4000}
              rows={2}
              disabled={sending}
              className="min-h-16 resize-none border-0 bg-transparent text-white placeholder:text-white/45 focus-visible:ring-0"
            />
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <span className="text-[11px] text-white/55">VPS chat service</span>
              <button
                type="submit"
                disabled={sending || prompt.trim().length < 3}
                aria-label="Send message to AYRA"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-100">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2" aria-label="AYRA quick actions">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={sending}
                onClick={() => void sendMessage(action.prompt)}
                className="rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-medium text-white/85 transition hover:bg-white/20 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
          {connected !== undefined && notConnected !== undefined && (
            <p className="mt-5 text-xs text-white/60">
              {connected} connected capabilities · {notConnected} not connected
            </p>
          )}
          <p className="mt-1 text-[11px] text-white/45">
            Chat responses do not execute AYRA orders or read the capability register.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="overflow-hidden rounded-2xl border border-white/20 bg-[#07111f]/85 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
              <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-[11px] text-white/55">
                <Globe2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">softwarevala.net / ayra</span>
              </div>
            </div>
            <div className="grid min-h-[260px] grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-center gap-2 p-3 sm:min-h-[300px] sm:p-5">
              <div className="ayra-source-avatar relative flex h-full min-h-[220px] items-end justify-center overflow-hidden rounded-xl bg-gradient-to-b from-sky-400/10 via-blue-500/10 to-transparent">
                <JarvisCore state={avatarState} />
              </div>
              <div className="min-w-0 self-stretch rounded-xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                  <p className="text-xs font-medium text-white/90">AYRA assistant</p>
                </div>
                <div className="mt-4 max-h-52 overflow-y-auto">
                  {latestAssistantMessage?.content ? (
                    <p
                      aria-live="polite"
                      className="whitespace-pre-wrap text-xs leading-5 text-white/75"
                    >
                      {latestAssistantMessage.content}
                    </p>
                  ) : (
                    <p className="text-xs leading-5 text-white/45">
                      {sending
                        ? "AYRA is preparing a response…"
                        : "Your live conversation will appear here."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
