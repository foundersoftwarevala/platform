import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Search, Pin, Mic, Paperclip, ImageIcon, FileText, Code2,
  Send, Sparkles, Copy, RotateCcw, Pencil, Download, Share2, Bookmark, Save,
  TrendingUp, Megaphone, LifeBuoy, Globe, BarChart3, Package, Boxes, Lightbulb,
  Bot, ChevronRight, MessageSquare,
} from "lucide-react";

type Mode = {
  key: string;
  label: string;
  icon: any;
  hint: string;
};

const MODES: Mode[] = [
  { key: "sales",       label: "Sales AI",       icon: TrendingUp, hint: "Pipeline, scripts, objection handling." },
  { key: "marketing",   label: "Marketing AI",   icon: Megaphone,  hint: "Campaigns, copy, audience targeting." },
  { key: "support",     label: "Support AI",     icon: LifeBuoy,   hint: "Triage tickets and craft replies." },
  { key: "seo",         label: "SEO AI",         icon: Globe,      hint: "Keywords, briefs, technical audits." },
  { key: "business",    label: "Business AI",    icon: BarChart3,  hint: "Reports, planning, decision support." },
  { key: "marketplace", label: "Marketplace AI", icon: Boxes,      hint: "Product matching & catalog insights." },
  { key: "product",     label: "Product AI",     icon: Package,    hint: "Recommend the right software for clients." },
  { key: "analytics",   label: "Analytics AI",   icon: BarChart3,  hint: "Cohorts, funnels, anomaly detection." },
];

const ASSISTANTS = [
  { key: "marketplace", label: "Marketplace Assistant", icon: Boxes },
  { key: "product",     label: "Product Recommendation", icon: Package },
  { key: "lead",        label: "Lead Assistant",        icon: TrendingUp },
  { key: "sales",       label: "Sales Assistant",       icon: TrendingUp },
  { key: "marketing",   label: "Marketing Assistant",   icon: Megaphone },
  { key: "support",     label: "Support Assistant",     icon: LifeBuoy },
];

type Msg = { id: string; role: "user" | "assistant"; content: string; pending?: boolean };

export function AIChatWorkspace({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>(MODES[0]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatQuery, setChatQuery] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { taRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  function send() {
    const text = input.trim();
    if (!text) return;
    const u: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
    const a: Msg = {
      id: `a-${Date.now()}`,
      role: "assistant",
      pending: true,
      content:
        "AI Chat workspace is ready. Connect your existing AI provider (or Lovable AI) to enable live responses — the UI, history, modes and tool actions are all wired and waiting.",
    };
    setMessages((m) => [...m, u, a]);
    setInput("");
  }

  function newChat() {
    setMessages([]);
    setInput("");
    taRef.current?.focus();
  }

  function useAssistant(key: string, label: string) {
    const target = MODES.find((m) => m.key === key);
    if (target) setMode(target);
    setInput(`${label}: `);
    taRef.current?.focus();
  }

  return (
    <div className="h-[calc(100vh-7.5rem)] -mx-4 md:-mx-6 -my-5 flex bg-background overflow-hidden">
      {/* Left sidebar — chat history */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="p-3 border-b border-border space-y-2">
          <button onClick={onBack} className="w-full inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </button>
          <button onClick={newChat} className="press-3d w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2.5 text-sm font-semibold shadow-glow">
            <Plus className="h-4 w-4" /> New chat
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              aria-label="Search chats"
              placeholder="Search chats…"
              className="w-full rounded-lg bg-surface border border-border pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <SidebarSection title="Pinned">
            <EmptyHint icon={Pin} text="Pin a chat to keep it here." />
          </SidebarSection>
          <SidebarSection title="Today">
            <EmptyHint icon={MessageSquare} text="Your conversations will appear here." />
          </SidebarSection>
          <SidebarSection title="Earlier">
            <EmptyHint icon={MessageSquare} text="Older chats will move down here." />
          </SidebarSection>
        </div>

        <div className="p-3 border-t border-border space-y-1">
          <div className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Assistants</div>
          {ASSISTANTS.filter((a) => a.label.toLowerCase().includes(chatQuery.trim().toLowerCase())).map((a) => (
            <button
              key={a.key}
              onClick={() => useAssistant(a.key, a.label)}
              className="press-3d w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs hover:bg-surface transition text-left"
            >
              <a.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{a.label}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      </aside>

      {/* Main chat area */}
      <section className="flex-1 min-w-0 flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border bg-background/80 backdrop-blur px-4 md:px-6 h-14 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Software Vala AI</div>
            <div className="text-[11px] text-muted-foreground leading-tight">Enterprise assistant · {mode.label}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            {MODES.map((m) => {
              const active = m.key === mode.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium border transition whitespace-nowrap",
                    active
                      ? "bg-gradient-brand text-brand-foreground border-transparent shadow-glow"
                      : "bg-surface border-border text-foreground/80 hover:bg-surface-2",
                  ].join(" ")}
                  title={m.hint}
                >
                  <Icon className="h-3 w-3" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? <EmptyState mode={mode} onPick={(t) => setInput(t)} /> : (
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background px-4 md:px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border bg-card shadow-card focus-within:ring-2 focus-within:ring-ring transition">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                rows={1}
                placeholder={`Message ${mode.label}…  (Shift + Enter for new line)`}
                className="block w-full bg-transparent px-4 pt-3 pb-2 text-sm placeholder:text-muted-foreground outline-none resize-none max-h-48"
              />
              <div className="flex items-center gap-1 px-2 pb-2">
                <ComposerBtn icon={Paperclip} label="Attach file" />
                <ComposerBtn icon={ImageIcon} label="Image" />
                <ComposerBtn icon={FileText} label="PDF analysis" />
                <ComposerBtn icon={Code2} label="Code analysis" />
                <ComposerBtn icon={Mic} label="Voice input" />
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground hidden md:block">{mode.hint}</span>
                  <button
                    onClick={send}
                    disabled={!input.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand text-brand-foreground px-3.5 py-2 text-xs font-semibold shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <Send className="h-3.5 w-3.5" /> Send
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              Software Vala AI · responses depend on the connected AI provider.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* --- pieces --- */

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-3">
      <div className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function EmptyHint({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ mode, onPick }: { mode: Mode; onPick: (t: string) => void }) {
  const Icon = mode.icon;
  const suggestions = [
    `Help me draft a ${mode.label.toLowerCase()} plan for this month.`,
    "Recommend a software stack for a 10-seat SMB client.",
    "Summarise yesterday's leads and rank by intent.",
    "Write a renewal reminder email for a client whose plan expires in 7 days.",
  ];
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground shadow-glow">
          <Bot className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-2xl md:text-3xl font-bold tracking-tight">How can I help you today?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You're talking to <span className="text-foreground font-semibold">{mode.label}</span>. {mode.hint}
        </p>
        <div className="mt-7 grid sm:grid-cols-2 gap-3">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="group rounded-xl bg-card border border-border p-3.5 text-left text-sm hover:border-brand/50 hover:bg-surface/40 transition flex items-start gap-3"
            >
              <Lightbulb className="h-4 w-4 mt-0.5 text-warning shrink-0" />
              <span className="flex-1 text-foreground/90 group-hover:text-foreground">{s}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          Switch mode anytime from the top bar.
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand text-brand-foreground shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? "" : "space-y-2"}`}>
        <div
          className={[
            "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-card border",
            isUser
              ? "bg-gradient-brand text-brand-foreground border-transparent"
              : "bg-card border-border text-foreground",
          ].join(" ")}
        >
          {msg.content}
        </div>
        {!isUser && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <ActionBtn icon={Copy} label="Copy" onAct={() => copyText(msg.content)} />
            <ActionBtn icon={Pencil} label="Edit" onAct={() => toast.info("Editing is available on the next assistant turn.")} />
            <ActionBtn icon={RotateCcw} label="Regenerate" onAct={() => toast.info("Connect an AI provider to regenerate this reply.")} />
            <ActionBtn icon={Download} label="Export TXT" onAct={() => downloadText("software-vala-chat.txt", msg.content)} />
            <ActionBtn icon={FileText} label="Export MD" onAct={() => downloadText("software-vala-chat.md", `# Software Vala AI\n\n${msg.content}\n`)} />
            <ActionBtn icon={Share2} label="Share" onAct={() => shareText(msg.content)} />
            <ActionBtn icon={Save} label="Save prompt" onAct={() => { savePrompt(msg.content); }} />
            <ActionBtn icon={Bookmark} label="Bookmark" onAct={() => { savePrompt(msg.content, "bookmark"); }} />
          </div>
        )}
      </div>
    </div>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Clipboard permission denied");
  }
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${filename}`);
}

async function shareText(text: string) {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ title: "Software Vala AI", text });
      return;
    } catch { /* user cancelled — fall through to copy */ }
  }
  await copyText(text);
}

function savePrompt(text: string, kind: "prompt" | "bookmark" = "prompt") {
  try {
    const key = kind === "bookmark" ? "sv.ai.bookmarks" : "sv.ai.prompts";
    const list: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    list.unshift(text);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
    toast.success(kind === "bookmark" ? "Bookmarked" : "Prompt saved");
  } catch {
    toast.error("Could not save locally");
  }
}

function ActionBtn({ icon: Icon, label, onAct }: { icon: any; label: string; onAct: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onAct}
      className="press-3d grid h-7 w-7 place-items-center rounded-md hover:bg-surface transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function ComposerBtn({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button title={label} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface transition text-muted-foreground hover:text-foreground">
      <Icon className="h-4 w-4" />
    </button>
  );
}
