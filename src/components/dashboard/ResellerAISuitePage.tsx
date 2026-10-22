import { useState } from "react";
import { useServerFn } from "@/lib/serverFn";
import { generateResellerAi, type ResellerAiTool } from "@/lib/reseller-dashboard.functions";
import {
  ArrowLeft, Brain, Sparkles, Loader2,
  Bot, Gauge, FileText, Mail, MessageCircle, Repeat2, RotateCcw, TrendingUp,
} from "lucide-react";

type Tool = {
  key: ResellerAiTool;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  inputLabel: string;
  placeholder: string;
};

const TOOLS: Tool[] = [
  { key: "sales-assistant", title: "AI Sales Assistant", desc: "Conversational copilot for objections, pitches & demo notes.", icon: Bot,           inputLabel: "Ask the assistant",   placeholder: "How should I pitch the Pro plan to a 50-seat agency?" },
  { key: "lead-scoring",    title: "AI Lead Scoring",    desc: "Score leads by fit, intent and likelihood to convert.",      icon: Gauge,         inputLabel: "Lead details",        placeholder: "Paste lead notes, company info or CRM dump" },
  { key: "proposal",        title: "AI Proposal Generator", desc: "Generate tailored proposals, SOWs and pricing tables.",   icon: FileText,      inputLabel: "Client brief",        placeholder: "Industry, pain points, deal size, timeline" },
  { key: "email",           title: "AI Email Generator", desc: "Draft cold, follow-up and renewal emails in your voice.",    icon: Mail,          inputLabel: "Email goal",          placeholder: "Re-engage a trial client who went dark for 14 days" },
  { key: "whatsapp",        title: "AI WhatsApp Generator", desc: "Short, on-brand WhatsApp messages with CTAs.",            icon: MessageCircle, inputLabel: "Message intent",      placeholder: "Quote follow-up for SaaS bundle, friendly tone" },
  { key: "followup",        title: "AI Follow-up",       desc: "Suggest the next-best follow-up across every open deal.",    icon: Repeat2,       inputLabel: "Pipeline snapshot",   placeholder: "Paste deal stage / last activity / amount" },
  { key: "renewal",         title: "AI Renewal Prediction", desc: "Predict which licenses are at risk of churn.",            icon: RotateCcw,     inputLabel: "Account / segment",   placeholder: "All / specific account / annual cohort" },
  { key: "forecast",        title: "AI Revenue Forecast",desc: "Forecast commissions and revenue by horizon.",               icon: TrendingUp,    inputLabel: "Horizon",             placeholder: "Next 30 / 60 / 90 days" },
];

export function ResellerAISuitePage({ onBack }: { onBack: () => void }) {
  const [active, setActive] = useState<Tool | null>(null);

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-lg bg-surface hover:bg-surface-2 border border-border">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-[oklch(0.75_0.18_300)]" />
            <h2 className="text-lg font-bold tracking-tight">Reseller AI Suite</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            AI tools for sales, lead qualification and customer communication.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t)}
            className="group text-left rounded-2xl border border-border bg-surface hover:bg-surface-2 hover:border-brand/40 transition p-4 shadow-card"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 border border-border">
                <t.icon className="h-5 w-5 text-foreground" />
              </div>
              <Sparkles className="h-4 w-4 text-[oklch(0.75_0.18_300)] opacity-60 group-hover:opacity-100 transition" />
            </div>
            <div className="mt-3 text-sm font-semibold">{t.title}</div>
            <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.desc}</div>
            <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Open tool →
            </div>
          </button>
        ))}
      </div>

      {active && <ToolDialog tool={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function ToolDialog({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const generate = useServerFn(generateResellerAi);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<{ text: string; model: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const Icon = tool.icon;
  async function run() {
    if (!input.trim() || isGenerating) return;
    setIsGenerating(true);
    setOutput(null);
    setError(null);
    try {
      setOutput(await generate({ data: { tool: tool.key, input: input.trim() } }));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The AI request could not be completed.");
    } finally {
      setIsGenerating(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden animate-scale-in origin-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface border border-border">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{tool.title}</div>
            <div className="text-[11px] text-muted-foreground">{tool.desc}</div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{tool.inputLabel}</label>
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); setOutput(null); setError(null); }}
              placeholder={tool.placeholder}
              rows={4}
              className="mt-1 w-full rounded-lg bg-surface border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {isGenerating ? (
            <div className="rounded-xl border border-border bg-surface/40 p-6 text-center" role="status">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand" />
              <div className="mt-2 text-sm font-medium">Generating with AI…</div>
              <div className="text-[11px] text-muted-foreground">Using an available local or free AI provider.</div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-4" role="alert">
              <div className="text-xs font-semibold text-danger">Generation failed</div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{error}</p>
            </div>
          ) : output ? (
            <div className="rounded-xl border border-border bg-surface p-4" aria-live="polite">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-brand" /> AI-generated result
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{output.text}</p>
              {output.model && <div className="mt-3 text-[10px] text-muted-foreground">Model: {output.model}</div>}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
              <div className="mt-2 text-sm font-medium">AI output appears here</div>
              <div className="text-[11px] text-muted-foreground">Enter your information and select Generate.</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface/40">
          <button onClick={onClose} className="rounded-lg bg-surface hover:bg-surface-2 border border-border px-3 py-2 text-xs font-medium transition">
            Close
          </button>
          <button
            onClick={() => void run()}
            disabled={!input.trim() || isGenerating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-semibold text-brand-foreground shadow-glow hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isGenerating ? "Generating…" : output ? "Generate again" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
