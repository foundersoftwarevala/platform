import { useState } from "react";
import {
  ArrowLeft, Brain, PenLine, Search, Tags, DollarSign,
  Boxes, TrendingUp, Users, MessageSquare, Sparkles, Lock,
} from "lucide-react";

type ToolKey =
  | "product-gen" | "seo" | "tags" | "pricing"
  | "forecast-inv" | "forecast-sales" | "insights" | "auto-reply";

type Tool = {
  key: ToolKey;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "success" | "warning" | "violet" | "cyan" | "danger";
  inputLabel: string;
  placeholder: string;
};

const TOOLS: Tool[] = [
  { key: "product-gen", title: "AI Product Generator", desc: "Generate product titles, descriptions and bullet copy.", icon: PenLine, tone: "brand", inputLabel: "Describe the product", placeholder: "e.g. wireless noise-cancelling over-ear headphones, premium" },
  { key: "seo",         title: "AI SEO",               desc: "Meta titles, descriptions and keyword sets per product.", icon: Search, tone: "cyan", inputLabel: "Target page or product", placeholder: "Paste a product name or URL" },
  { key: "tags",        title: "AI Tags",              desc: "Suggest tags, categories and search synonyms.", icon: Tags, tone: "violet", inputLabel: "Source text", placeholder: "Paste product description" },
  { key: "pricing",     title: "AI Pricing",           desc: "Suggest competitive pricing windows from market data.", icon: DollarSign, tone: "success", inputLabel: "Product + cost", placeholder: "SKU + landed cost" },
  { key: "forecast-inv",title: "AI Inventory Forecast",desc: "Project stock-outs and reorder points.", icon: Boxes, tone: "warning", inputLabel: "SKU range", placeholder: "All / specific SKUs" },
  { key: "forecast-sales", title: "AI Sales Forecast", desc: "Forecast revenue and unit volume by period.", icon: TrendingUp, tone: "success", inputLabel: "Horizon", placeholder: "Next 30 / 60 / 90 days" },
  { key: "insights",    title: "AI Customer Insights", desc: "Segments, churn risk and lifetime value clusters.", icon: Users, tone: "violet", inputLabel: "Segment", placeholder: "All customers / VIP / churned" },
  { key: "auto-reply",  title: "AI Auto Reply",        desc: "Draft replies for messages, reviews and tickets.", icon: MessageSquare, tone: "cyan", inputLabel: "Incoming message", placeholder: "Paste the customer's message" },
];

export function AISuitePage({ onBack }: { onBack: () => void }) {
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
            <h2 className="text-lg font-bold tracking-tight">AI Suite</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning border border-warning/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              <Lock className="h-3 w-3" /> UI preview
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Production-grade AI workspace. Backend model execution will be wired in a later phase.
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
              <div className={`grid h-10 w-10 place-items-center rounded-xl bg-surface-2 border border-border tone-${t.tone}`}>
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
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "preview">("idle");
  const Icon = tool.icon;

  function runDemo() {
    if (!input.trim()) return;
    setStatus("preview");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden animate-scale-in origin-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface border border-border">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{tool.title}</div>
            <div className="text-[11px] text-muted-foreground">{tool.desc}</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning border border-warning/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            <Lock className="h-3 w-3" /> UI only
          </span>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{tool.inputLabel}</label>
            <textarea
              value={input}
              onChange={(e) => { setInput(e.target.value); setStatus("idle"); }}
              placeholder={tool.placeholder}
              rows={4}
              className="mt-1 w-full rounded-lg bg-surface border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {status === "idle" ? (
            <EmptyPreview />
          ) : (
            <PendingPreview />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-surface/40">
          <button
            onClick={onClose}
            className="rounded-lg bg-surface hover:bg-surface-2 border border-border px-3 py-2 text-xs font-medium transition"
          >
            Close
          </button>
          <button
            onClick={runDemo}
            disabled={!input.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-2 text-xs font-semibold text-brand-foreground shadow-glow hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
      <div className="mt-2 text-sm font-medium">AI output appears here</div>
      <div className="text-[11px] text-muted-foreground">Provide input and tap Generate.</div>
    </div>
  );
}

function PendingPreview() {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-center gap-2 text-warning text-xs font-semibold">
        <Lock className="h-3.5 w-3.5" /> Backend not connected
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        This is the production UI for this AI tool. The model call will be wired in
        a later backend phase — no LLMs are invoked from this preview.
      </p>
    </div>
  );
}
