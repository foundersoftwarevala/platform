import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useValaChat } from "./useValaChat";
import { ValaAvatarLive } from "./ValaAvatarLive";

/* --------------------------- command execution ---------------------------- */

const COMMANDS: { match: RegExp; label: string }[] = [
  { match: /marketplace/i, label: "Marketplace" },
  { match: /finance|revenue|wallet/i, label: "Finance" },
  { match: /crm|customer/i, label: "CRM" },
  { match: /\bhr\b|human resource|hiring/i, label: "HR" },
  { match: /analytic|report|insight/i, label: "Analytics" },
  { match: /invoice/i, label: "Invoice Builder" },
  { match: /approval/i, label: "Approvals" },
  { match: /backup|database/i, label: "Database Backup" },
  { match: /server|infra/i, label: "Server Management" },
  { match: /franchise/i, label: "Franchise Control" },
];

function runCommand(text: string) {
  if (!/^(open|show|go to|create|generate|run|start)\b/i.test(text.trim())) return;
  const hit = COMMANDS.find((c) => c.match.test(text));
  if (hit) toast.success(`Vala AI → opening ${hit.label}`);
}

/* ------------------------------ voice helpers ----------------------------- */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]) as
    | (new () => SpeechRecognitionLike)
    | undefined;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-IN";
  rec.continuous = false;
  rec.interimResults = false;
  return rec;
}

/* --------------------------------- panel ---------------------------------- */

export function ValaAiAgent() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const { messages, status, send, reset } = useValaChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const avatarState = listening ? "listening" : status === "idle" ? "idle" : status;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, status]);

  const speak = useCallback(
    (text: string) => {
      if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ""));
      u.rate = 1.02;
      u.pitch = 1.15;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
    [voiceOn],
  );

  const submit = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      runCommand(clean);
      setInput("");
      void send(clean, speak);
    },
    [send, speak],
  );

  const toggleMic = useCallback(() => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = createRecognition();
    if (!rec) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }
    recRef.current = rec;
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) submit(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }, [listening, submit]);

  const suggestions = useMemo(
    () => ["Daily brief", "Show today's revenue", "Open Finance", "Risk scan", "Generate report"],
    [],
  );

  return (
    <>
      {/* Floating trigger */}
      <button
        data-vala-launcher
        onClick={() => setOpen((v) => !v)}

        aria-label="Open Vala AI assistant"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border-2 border-primary-glow/50 bg-gradient-to-r from-primary to-accent px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-primary-foreground shadow-[0_18px_44px_-14px_rgba(40,140,255,0.9)] transition-transform hover:scale-105 active:scale-95"
      >
        <Bot className="h-4 w-4" />
        {open ? "Close Vala" : "Ask Vala AI"}
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-20 right-5 z-50 flex w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border-2 border-primary/45 shadow-[0_36px_90px_-30px_rgba(30,120,255,0.95)] transition-all duration-300",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
        )}
        style={{
          background:
            "linear-gradient(180deg, #102042 0%, #091327 55%, #060d1d 100%)",
          height: "min(620px, calc(100vh - 7rem))",
        }}
      >
        {/* Header with avatar */}
        <header className="relative flex items-center gap-3 border-b-2 border-primary/35 px-3 py-2.5">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120px_80px_at_10%_0%,rgba(56,160,255,0.35),transparent)]" />
          <ValaAvatarLive state={avatarState} className="h-24" showWaveform={false} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold tracking-tight text-foreground">VALA · Founder AI</p>
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              {listening
                ? "Listening"
                : status === "thinking"
                  ? "Thinking"
                  : status === "speaking"
                    ? "Responding"
                    : "Online"}
            </span>
          </div>
          <button
            onClick={() => setVoiceOn((v) => !v)}
            aria-label="Toggle voice output"
            className="rounded-lg border border-primary/40 bg-primary/15 p-1.5 text-foreground/80 transition-colors hover:bg-primary/30"
          >
            {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={reset}
            aria-label="Reset conversation"
            className="rounded-lg border border-primary/40 bg-primary/15 p-1.5 text-foreground/80 transition-colors hover:bg-primary/30"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
            className="rounded-lg border border-primary/40 bg-primary/15 p-1.5 text-foreground/80 transition-colors hover:bg-primary/30"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap text-[12.5px] leading-relaxed",
                  m.role === "user"
                    ? "rounded-2xl rounded-br-sm bg-primary px-3 py-2 font-medium text-primary-foreground"
                    : "text-foreground/90",
                )}
              >
                {m.content || (
                  <span className="inline-flex items-center gap-1.5 text-foreground/60">
                    <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[9.5px] font-semibold text-foreground/80 transition-colors hover:bg-primary/25"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-end gap-2 border-t-2 border-primary/35 p-2.5"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder="Ask Vala anything… e.g. Open Finance"
            className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-primary/40 bg-background/60 px-3 py-2 text-[12.5px] text-foreground outline-none placeholder:text-foreground/40 focus:border-accent focus:ring-2 focus:ring-accent/35"
          />
          <button
            type="button"
            onClick={toggleMic}
            aria-label="Voice input"
            className={cn(
              "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border-2 transition-colors",
              listening
                ? "border-destructive/60 bg-destructive/25 text-foreground"
                : "border-primary/40 bg-primary/15 text-foreground/80 hover:bg-primary/30",
            )}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="submit"
            disabled={status !== "idle" || !input.trim()}
            aria-label="Send message"
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_10px_24px_-12px_rgba(40,140,255,0.9)] transition-transform active:scale-95 disabled:opacity-40"
          >
            {status === "idle" ? <Send className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
          </button>
        </form>
      </div>
    </>
  );
}

export default ValaAiAgent;
