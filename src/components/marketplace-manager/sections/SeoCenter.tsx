import { useState, useEffect, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import {
  Sparkles, Globe2, Hash, Tag as TagIcon, Link as LinkIcon, FileCode2, Languages,
  Map as MapIcon, Image as ImageIcon, ShieldCheck, CheckCircle2, Plus, Search,
  Smartphone, Monitor, AlertTriangle, Star, MessageSquare, Copy, TrendingUp,
  TrendingDown, Minus, ArrowUpRight, Download, Upload, Filter, MoreHorizontal,
  Play, Pause, RefreshCw, Eye, EyeOff, Edit3, Trash2, Zap, Bot, FileText,
  Rss, LayoutGrid, PieChart, BarChart3, Activity, Target, Compass, Radar,
  Award, Layers, Clock, Calendar, ChevronRight, ArrowRight, Rocket, Bell,
  MapPin, Video, HelpCircle, Building2, GitBranch, Code2, Wand2,
  ClipboardList, PenTool, Share2, Settings, Gauge, Boxes, LineChart,
  ExternalLink, ScanLine, ListFilter, Users2, Flame, Send, X, Save, CircleDot,
} from "lucide-react";
import { Card, PageHeader, PillButton, StatCard, SubNav } from "../ui";
import { SeoSection as LegacySeoEditor } from "./SeoSection";

import { notBuilt } from "@/lib/ui/not-built";
import { authHeaders } from "@/lib/auth/operator-fetch";
import {
  countWhere, figure, groupBy, mean, num, sum, text, useResource,
  type Row as ResourceRow,
} from "@/lib/manager/use-resource";
/* =========================================================
   UNIVERSAL ACTION DRAWER — wires every button to a workflow
   ========================================================= */
type DrawerKind =
  | "edit" | "create" | "preview" | "download" | "run" | "delete"
  | "connect" | "fix" | "history" | "info";

type DrawerState = { open: boolean; title: string; subtitle?: string; kind: DrawerKind };

function classifyAction(label: string): DrawerKind {
  const l = label.toLowerCase();
  if (/(new|add|create|generate|track|research)/.test(l)) return "create";
  if (/(edit|update|save|configure|rewrite)/.test(l)) return "edit";
  if (/(preview|view|open|inspect)/.test(l)) return "preview";
  if (/(download|export|report|pdf|csv)/.test(l)) return "download";
  if (/(delete|remove|disavow|trash)/.test(l)) return "delete";
  if (/(run|regen|ping|recrawl|refresh|fetch|scan|research|restore|merge)/.test(l)) return "run";
  if (/(connect|disconnect|configure)/.test(l)) return "connect";
  if (/(fix|wand|auto)/.test(l)) return "fix";
  if (/(history|log|audit|version)/.test(l)) return "history";
  return "info";
}

const KIND_META: Record<DrawerKind, { icon: any; tone: string; cta: string }> = {
  edit: { icon: Edit3, tone: "accent", cta: "Save changes" },
  create: { icon: Plus, tone: "premium", cta: "Create" },
  preview: { icon: Eye, tone: "accent", cta: "Close preview" },
  download: { icon: Download, tone: "success", cta: "Download" },
  run: { icon: Play, tone: "warning", cta: "Run now" },
  delete: { icon: Trash2, tone: "destructive", cta: "Confirm delete" },
  connect: { icon: Zap, tone: "accent", cta: "Continue" },
  fix: { icon: Wand2, tone: "premium", cta: "Apply fix" },
  history: { icon: Clock, tone: "default", cta: "Close" },
  info: { icon: CircleDot, tone: "default", cta: "OK" },
};

function DrawerBody({ kind, title }: { kind: DrawerKind; title: string }) {
  if (kind === "preview") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">softwarevala.com</div>
          <div className="mt-1 text-[16px] font-bold text-[hsl(210_100%_75%)]">{title} — Software Vala</div>
          <div className="text-[12px] text-muted-foreground">Live SERP preview · Desktop · Google IN</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-background/40 p-3 text-[11px]"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Position</div><div className="font-mono text-lg font-bold text-accent">3</div></div>
          <div className="rounded-lg border border-border bg-background/40 p-3 text-[11px]"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">CTR</div><div className="font-mono text-lg font-bold text-success">5.3%</div></div>
        </div>
        <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed">{`<title>${title} — Software Vala</title>\n<meta name="description" content="Enterprise-ready…" />\n<link rel="canonical" href="https://softwarevala.com/…" />`}</pre>
      </div>
    );
  }
  if (kind === "download") {
    return (
      <div className="space-y-3">
        <div className="text-[12px] text-muted-foreground">Choose export format for "{title}".</div>
        <div className="grid grid-cols-2 gap-2">
          {["CSV", "XLSX", "PDF", "JSON"].map((f) => (
            <label key={f} className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px] hover:border-accent/40">
              <span className="font-semibold">{f}</span>
              <input type="radio" name="fmt" defaultChecked={f === "CSV"} className="accent-[color:var(--accent)]" />
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" defaultChecked className="accent-[color:var(--accent)]" /> Include trend graphs (last 30d)</label>
        <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" className="accent-[color:var(--accent)]" /> Email me the report</label>
      </div>
    );
  }
  if (kind === "delete") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-[12px] text-destructive">
          <div className="mb-1 font-bold uppercase tracking-wider">This action cannot be undone.</div>
          "{title}" and its associated data will be permanently removed.
        </div>
        <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" className="accent-[color:var(--destructive)]" /> I understand this is permanent.</label>
        <input placeholder='Type "DELETE" to confirm' className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-destructive" />
      </div>
    );
  }
  if (kind === "run" || kind === "fix") {
    return (
      <div className="space-y-3">
        <div className="text-[12px] text-muted-foreground">Job will run in the background. You'll be notified when complete.</div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Scope</div>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {["All items", "Filtered results", "Selected only", "Uploaded CSV"].map((s, i) => (
              <label key={s} className="flex items-center gap-2"><input type="radio" name="scope" defaultChecked={i === 0} className="accent-[color:var(--accent)]" />{s}</label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" defaultChecked className="accent-[color:var(--accent)]" /> Send email digest when finished</label>
        <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" className="accent-[color:var(--accent)]" /> Auto-rollback on error</label>
      </div>
    );
  }
  if (kind === "connect") {
    return (
      <div className="space-y-3">
        <div className="text-[12px] text-muted-foreground">Paste your API credentials for {title}.</div>
        <input placeholder="Client ID" className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent" />
        <input placeholder="Client Secret" type="password" className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent" />
        <input placeholder="Property / Site URL" className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent" />
      </div>
    );
  }
  if (kind === "history") {
    return (
      <div className="space-y-2">
        {[
          { t: "2m ago", w: "Priya · updated meta title", tone: "accent" },
          { t: "1h ago", w: "AI Writer · regenerated FAQ", tone: "premium" },
          { t: "6h ago", w: "Rhea · added schema", tone: "success" },
          { t: "1d ago", w: "System · scheduled sitemap ping", tone: "default" },
          { t: "3d ago", w: "Vikram · fixed 12 broken links", tone: "success" },
        ].map((e, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3 text-[12px]">
            <div className="mt-1 h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
            <div className="flex-1"><div className="font-semibold">{e.w}</div><div className="text-[10px] text-muted-foreground">{e.t}</div></div>
            <button
        type="button"
        onClick={() => notBuilt("Restore")} className="text-[10px] font-bold uppercase tracking-wider text-accent">Restore</button>
          </div>
        ))}
      </div>
    );
  }
  // edit / create / info default: full form
  return (
    <div className="space-y-3">
      {[
        { l: "Meta Title", v: `${title} — Software Vala`, hint: "58 / 60" },
        { l: "Meta Description", v: "Enterprise-ready SEO copy tuned for search intent and CTR.", hint: "142 / 160", area: true },
        { l: "Focus Keyword", v: "" },
        { l: "Secondary Keyword", v: "" },
        { l: "Canonical URL", v: "https://softwarevala.com/" },
        { l: "Slug", v: title.toLowerCase().replace(/\s+/g, "-").slice(0, 40) },
      ].map((f) => (
        <div key={f.l}>
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <span>{f.l}</span>{f.hint && <span className="font-mono text-accent">{f.hint}</span>}
          </div>
          {f.area ? (
            <textarea rows={3} defaultValue={f.v} className="w-full rounded-lg border border-border bg-background/60 p-2.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent" />
          ) : (
            <input defaultValue={f.v} placeholder={`Enter ${f.l.toLowerCase()}…`} className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent" />
          )}
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        {[
          { l: "Index", v: "Yes" }, { l: "Follow", v: "Yes" }, { l: "Sitemap", v: "Yes" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px]">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="font-mono font-bold text-success">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionDrawer({ state, onClose }: { state: DrawerState; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (state.open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.open, onClose]);

  const meta = KIND_META[state.kind];
  const Icon = meta.icon;

  return (
    <div
      className={`fixed inset-0 z-[80] transition-opacity ${state.open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      aria-hidden={!state.open}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col border-l border-border bg-[oklch(0.18_0.035_240)] shadow-[var(--shadow-elegant)] transition-transform duration-300 ${state.open ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex items-start gap-3 border-b border-border p-4">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background/60 text-${meta.tone}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{state.kind}</div>
            <div className="truncate text-[15px] font-bold text-foreground">{state.title}</div>
            {state.subtitle && <div className="truncate text-[11px] text-muted-foreground">{state.subtitle}</div>}
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <DrawerBody kind={state.kind} title={state.title} />
        </div>
        <footer className="flex items-center justify-between gap-2 border-t border-border bg-background/40 p-3">
          <button onClick={onClose} className="rounded-full border border-border bg-background/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">Cancel</button>
          <div className="flex items-center gap-2">
            {state.kind === "edit" || state.kind === "create" ? (
              <button
        type="button"
        onClick={() => notBuilt("Save draft")} className="rounded-full border border-border bg-background/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-accent">Save draft</button>
            ) : null}
            <button
              onClick={onClose}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] ${
                state.kind === "delete" ? "bg-destructive" : "bg-gradient-to-r from-primary to-accent"
              }`}
            >
              <Save className="h-3.5 w-3.5" />{meta.cta}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

/* =========================================================
   MODULE NAV
   ========================================================= */
export const SEO_MODULE_GROUPS: { label: string; items: { id: string; label: string; icon: any }[] }[] = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: Gauge },
      { id: "health", label: "SEO Health", icon: Activity },
      { id: "reports", label: "SEO Reports", icon: BarChart3 },
    ],
  },
  {
    label: "On-Page",
    items: [
      { id: "page", label: "Page Editor", icon: PenTool },
      { id: "product", label: "Product SEO", icon: Boxes },
      { id: "category", label: "Category SEO", icon: LayoutGrid },
      { id: "blog", label: "Blog SEO", icon: Rss },
      { id: "landing", label: "Landing SEO", icon: Rocket },
      { id: "meta", label: "Meta Manager", icon: FileText },
      { id: "schema", label: "Schema", icon: FileCode2 },
      { id: "og", label: "Open Graph", icon: Share2 },
      { id: "twitter", label: "Twitter Card", icon: MessageSquare },
      { id: "tags", label: "Tag Manager", icon: TagIcon },
    ],
  },
  {
    label: "Ranking & Research",
    items: [
      { id: "keywords", label: "Keyword Center", icon: Hash },
      { id: "cluster", label: "Keyword Cluster", icon: GitBranch },
      { id: "ranking", label: "Google Ranking", icon: TrendingUp },
      { id: "competitor", label: "Competitor", icon: Radar },
      { id: "backlinks", label: "Backlinks", icon: LinkIcon },
      { id: "internal", label: "Internal Links", icon: Compass },
      { id: "external", label: "External Links", icon: ExternalLink },
    ],
  },
  {
    label: "Assets & Media",
    items: [
      { id: "image", label: "Image SEO", icon: ImageIcon },
      { id: "video", label: "Video SEO", icon: Video },
      { id: "faq", label: "FAQ SEO", icon: HelpCircle },
    ],
  },
  {
    label: "Technical",
    items: [
      { id: "redirect", label: "Redirects", icon: ArrowRight },
      { id: "canonical", label: "Canonical", icon: LinkIcon },
      { id: "sitemap", label: "Sitemap", icon: MapIcon },
      { id: "robots", label: "Robots.txt", icon: ShieldCheck },
      { id: "local", label: "Local SEO", icon: MapPin },
      { id: "intl", label: "International", icon: Languages },
    ],
  },
  {
    label: "Blog & AI",
    items: [
      { id: "blogcenter", label: "Blog Center", icon: Rss },
      { id: "aiwriter", label: "AI Writer", icon: Wand2 },
      { id: "aikeyword", label: "AI Keyword", icon: Bot },
    ],
  },
  {
    label: "Integrations",
    items: [
      { id: "google", label: "Google Tools", icon: Globe2 },
      { id: "others", label: "Other Tools", icon: Layers },
      { id: "bulk", label: "Bulk Ops", icon: ListFilter },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

/* =========================================================
   SHARED PRIMITIVES
   ========================================================= */
function Chip({
  children, tone = "default",
}: { children: ReactNode; tone?: "default" | "success" | "warning" | "destructive" | "premium" | "accent" }) {
  const toneMap: Record<string, string> = {
    default: "border-border bg-white/[0.03] text-muted-foreground",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
    destructive: "border-destructive/40 bg-destructive/10 text-destructive",
    premium: "border-premium/40 bg-premium/10 text-premium",
    accent: "border-accent/40 bg-accent/10 text-accent",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${toneMap[tone]}`}>
      {children}
    </span>
  );
}

function ScoreRing({ value, size = 56 }: { value: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const tone = value >= 80 ? "oklch(0.78 0.17 152)" : value >= 60 ? "oklch(0.82 0.16 75)" : "oklch(0.62 0.18 25)";
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth="4" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth="4" fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute font-mono text-[13px] font-bold tabular" style={{ color: tone }}>{value}</div>
    </div>
  );
}

function Delta({ v }: { v: number }) {
  const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
  const tone = v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[11px] tabular ${tone}`}>
      <Icon className="h-3 w-3" />{v > 0 ? "+" : ""}{v}
    </span>
  );
}

/**
 * The toolbar's search box and the table beneath it are rendered as siblings by
 * every section, so the query and the current rows are shared through this
 * small store rather than threaded through each one. Only one section is on
 * screen at a time, so a single shared value is enough.
 */
type TableSnapshot = { head: string[]; rows: string[][] };

const queryListeners = new Set<(value: string) => void>();
let currentQuery = "";
let currentSnapshot: TableSnapshot = { head: [], rows: [] };

function setTableQuery(value: string) {
  currentQuery = value;
  queryListeners.forEach((listener) => listener(value));
}

function useTableQuery() {
  const [value, setValue] = useState(currentQuery);
  useEffect(() => {
    queryListeners.add(setValue);
    return () => {
      queryListeners.delete(setValue);
    };
  }, []);
  return value;
}

/** Pull readable text out of a rendered cell so it can be searched and exported. */
function cellText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(cellText).join(" ");
  const element = node as { props?: { children?: ReactNode } };
  if (element?.props?.children !== undefined) return cellText(element.props.children);
  return "";
}

function downloadCsv(snapshot: TableSnapshot, name: string) {
  const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [snapshot.head, ...snapshot.rows].map((row) => row.map(escape).join(","));
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const SEARCH_INPUT_ID = "seo-center-search";

function Toolbar({
  title, count, right,
}: { title: string; count?: number; right?: ReactNode }) {
  const query = useTableQuery();
  const [notice, setNotice] = useState<string | null>(null);

  const focusSearch = () => {
    const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  };

  const importRows = () => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".csv,text/csv";
    picker.onchange = async () => {
      const file = picker.files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      // Nothing is written: this table has no import target yet, and saying so
      // is better than reporting a save that did not happen.
      setNotice(
        `Read ${Math.max(lines.length - 1, 0)} row(s) from ${file.name}. ` +
          `${title} has no import target yet, so nothing was saved.`,
      );
    };
    picker.click();
  };

  return (
    <div data-skip-drawer className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/40 p-2">
      <div className="flex items-center gap-2 pl-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
        {typeof count === "number" && (
          <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 font-mono text-[10px] tabular text-muted-foreground">{count.toLocaleString()}</span>
        )}
      </div>
      <div className="relative ml-2 flex-1 min-w-[180px] max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          id={SEARCH_INPUT_ID}
          value={query}
          onChange={(e) => setTableQuery(e.target.value)}
          placeholder="Search…"
          aria-label={`Search ${title}`}
          className="w-full rounded-md border border-border bg-background/60 py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <button
        type="button"
        onClick={focusSearch}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-[11px] font-semibold hover:border-accent/40 hover:text-accent"
      >
        <Filter className="h-3 w-3" /> Filters
      </button>
      <button
        type="button"
        onClick={() => downloadCsv(currentSnapshot, title)}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-[11px] font-semibold hover:border-accent/40 hover:text-accent"
      >
        <Download className="h-3 w-3" /> Export
      </button>
      <button
        type="button"
        onClick={importRows}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-[11px] font-semibold hover:border-accent/40 hover:text-accent"
      >
        <Upload className="h-3 w-3" /> Import
      </button>
      {right}
      {notice && (
        <p className="w-full px-2 pt-1 text-[11px] text-muted-foreground" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

const TABLE_PAGE_SIZE = 25;

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const query = useTableQuery();
  const [page, setPage] = useState(1);

  const needle = query.trim().toLowerCase();
  const matching = needle
    ? rows.filter((row) => row.some((cell) => cellText(cell).toLowerCase().includes(needle)))
    : rows;

  const pageCount = Math.max(1, Math.ceil(matching.length / TABLE_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * TABLE_PAGE_SIZE;
  const visible = matching.slice(start, start + TABLE_PAGE_SIZE);

  // A new search starts again from the first page.
  useEffect(() => {
    setPage(1);
  }, [needle, rows.length]);

  // Export takes whatever the table is showing, filter included.
  useEffect(() => {
    currentSnapshot = { head, rows: matching.map((row) => row.map(cellText)) };
  }, [head, matching]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-background/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {head.map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i} className="border-t border-border transition-colors hover:bg-white/[0.03]">
                {row.map((c, j) => (
                  <td key={j} className="whitespace-nowrap px-3 py-2 align-middle">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div data-skip-drawer className="flex items-center justify-between border-t border-border bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
        <div>
          {matching.length === 0
            ? "No rows match that search"
            : `Showing ${start + 1}–${start + visible.length} of ${matching.length.toLocaleString()}`}
          {needle && matching.length !== rows.length
            ? ` (filtered from ${rows.length.toLocaleString()})`
            : ""}
        </div>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={current <= 1}
            className="rounded border border-border px-2 py-0.5 hover:text-accent disabled:opacity-40"
          >
            Prev
          </button>
          {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
            // Keep the current page in view when there are many pages.
            const first = Math.max(1, Math.min(current - 2, pageCount - 4));
            return first + i;
          })
            .filter((n) => n >= 1 && n <= pageCount)
            .map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === current ? "page" : undefined}
                className={
                  n === current
                    ? "rounded border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-accent"
                    : "rounded border border-border px-2 py-0.5 hover:text-accent"
                }
              >
                {n}
              </button>
            ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={current >= pageCount}
            className="rounded border border-border px-2 py-0.5 hover:text-accent disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniSpark({ data, tone = "accent" }: { data: number[]; tone?: "accent" | "success" | "destructive" | "warning" }) {
  const max = Math.max(...data, 1);
  const stroke: Record<string, string> = {
    accent: "oklch(0.80 0.13 192)", success: "oklch(0.78 0.17 152)",
    destructive: "oklch(0.62 0.18 25)", warning: "oklch(0.82 0.16 75)",
  };
  const w = 84, h = 24;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(" ");
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={pts} fill="none" stroke={stroke[tone]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RowActs() {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => notBuilt("View")} className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:border-accent/40 hover:text-accent" title="View"><Eye className="h-3 w-3" /></button>
      <button
        type="button"
        onClick={() => notBuilt("Edit")} className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:border-accent/40 hover:text-accent" title="Edit"><Edit3 className="h-3 w-3" /></button>
      <button
        type="button"
        onClick={() => notBuilt("More")} className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:border-warning/40 hover:text-warning" title="More"><MoreHorizontal className="h-3 w-3" /></button>
    </div>
  );
}

/* =========================================================
   ROOT COMPONENT
   ========================================================= */
export function SeoCenter() {
  const [module, setModule] = useState("dashboard");
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, title: "", kind: "info" });

  const openFromClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const btn = target.closest("button");
    if (!btn) return;
    if (btn.closest("[data-skip-drawer]")) return;
    // skip form controls / drawer internals
    if (btn.getAttribute("type") === "submit") return;
    const raw = (btn.getAttribute("title") || btn.innerText || "").trim().replace(/\s+/g, " ");
    if (!raw) return;
    const kind = classifyAction(raw);
    setDrawer({
      open: true,
      title: raw.length > 60 ? raw.slice(0, 60) + "…" : raw,
      subtitle: `Module · ${module}`,
      kind,
    });
  };

  return (
    <div className="px-4 py-8 md:px-8" onClick={openFromClick}>
      <div data-skip-drawer>
        <PageHeader
          eyebrow="SEO Manager · Enterprise"
          title="SEO, Ranking & Blog Center"
          description="Semrush + Ahrefs + Search Console level control — indexing, keywords, schema, backlinks, blogs and AI, all inside your Marketplace Manager."
          actions={
            <>
              <button onClick={() => setDrawer({ open: true, title: "Recrawl entire site", kind: "run" })} className="rounded-full border border-border bg-white/[0.03] px-5 py-2 text-[12px] font-bold tracking-tight text-foreground transition-all hover:border-accent/40 hover:bg-white/[0.06] hover:text-accent"><span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Recrawl</span></button>
              <button onClick={() => setDrawer({ open: true, title: "Export Full SEO Report", kind: "download" })} className="rounded-full border border-border bg-white/[0.03] px-5 py-2 text-[12px] font-bold tracking-tight text-foreground transition-all hover:border-accent/40 hover:bg-white/[0.06] hover:text-accent"><span className="inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Export Report</span></button>
              <button onClick={() => setDrawer({ open: true, title: "AI SEO Assistant", kind: "create" })} className="rounded-full bg-accent px-5 py-2 text-[12px] font-bold tracking-tight text-accent-foreground shadow-[0_8px_24px_-8px_oklch(0.80_0.13_192/0.6),inset_0_1px_0_oklch(1_0_0/0.25)] transition-all hover:brightness-110"><span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> AI SEO Assistant</span></button>
            </>
          }
        />
      </div>

      {/* MODULE NAV — module switching, do not open drawer */}
      <div className="mb-6 rounded-2xl border border-border bg-background/40 p-3" data-skip-drawer>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {SEO_MODULE_GROUPS.map((g) => (
            <div key={g.label} className="min-w-[180px]">
              <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{g.label}</div>
              <div className="flex flex-wrap gap-1">
                {g.items.map((it) => {
                  const active = module === it.id;
                  const Icon = it.icon;
                  return (
                    <button key={it.id} onClick={() => setModule(it.id)}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                        active ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[var(--shadow-glow)]"
                          : "border border-border bg-background/60 text-muted-foreground hover:border-accent/40 hover:text-accent"
                      }`}
                    ><Icon className="h-3 w-3" />{it.label}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODULE RENDER */}
      {renderSeoModule(module)}

      <ActionDrawer state={drawer} onClose={() => setDrawer((d) => ({ ...d, open: false }))} />
    </div>
  );
}

export function renderSeoModule(id: string) {
  switch (id) {
    case "dashboard": return <DashboardModule />;
    case "health": return <HealthModule />;
    case "reports": return <ReportsModule />;
    case "page": return <PageEditorModule />;
    case "product": return <ProductSeoModule />;
    case "category": return <CategorySeoModule />;
    case "blog": return <BlogSeoModule />;
    case "landing": return <LandingSeoModule />;
    case "meta": return <MetaManagerModule />;
    case "schema": return <SchemaModule />;
    case "og": return <OgModule />;
    case "twitter": return <TwitterModule />;
    case "tags": return <TagManagerModule />;
    case "keywords": return <KeywordCenterModule />;
    case "cluster": return <KeywordClusterModule />;
    case "ranking": return <RankingModule />;
    case "competitor": return <CompetitorModule />;
    case "backlinks": return <BacklinkModule />;
    case "internal": return <InternalLinkModule />;
    case "external": return <ExternalLinkModule />;
    case "image": return <ImageSeoModule />;
    case "video": return <VideoSeoModule />;
    case "faq": return <FaqSeoModule />;
    case "redirect": return <RedirectModule />;
    case "canonical": return <CanonicalModule />;
    case "sitemap": return <SitemapModule />;
    case "robots": return <RobotsModule />;
    case "local": return <LocalSeoModule />;
    case "intl": return <IntlSeoModule />;
    case "blogcenter": return <BlogCenterModule />;
    case "aiwriter": return <AiWriterModule />;
    case "aikeyword": return <AiKeywordModule />;
    case "google": return <GoogleToolsModule />;
    case "others": return <OtherToolsModule />;
    case "bulk": return <BulkOpsModule />;
    case "settings": return <SettingsModule />;
    default: return null;
  }
}

/* =========================================================
   1) DASHBOARD — the mega-metric overview
   ========================================================= */
/**
 * The wall of numbers, counted rather than written.
 *
 * Thirty-four figures were typed into this file - 12,847 indexed pages, a 4.8%
 * CTR, a 91% health score - above a database holding ninety days of measured
 * performance, seventy-nine crawled pages, three and a half thousand tracked
 * keywords and two and a half thousand open issues. Not one of those tables
 * was read here.
 *
 * Every card below is counted from one of them when the screen opens. A figure
 * this platform does not measure is not shown: there is no Lighthouse run
 * behind an "Accessibility 96", so that card is gone rather than invented, and
 * the three Core Web Vitals that are measured stand in its place.
 */
function DashboardModule() {
  const perf = useResource("seo_performance", { limit: 90 });
  const pages = useResource("seo_pages", { limit: 200 });
  const keywords = useResource("keywords", { limit: 200 });
  const behaviour = useResource("seo_behaviour", { limit: 200 });
  const backlinks = useResource("seo_backlinks", { limit: 200 });

  const open = useResource("seo_issues", { limit: 1, filters: ["status.eq.open"] });
  const high = useResource("seo_issues", { limit: 1, filters: ["severity.eq.high"] });
  const medium = useResource("seo_issues", { limit: 1, filters: ["severity.eq.medium"] });
  const low = useResource("seo_issues", { limit: 1, filters: ["severity.eq.low"] });
  const metaIssues = useResource("seo_issues", { limit: 1, filters: ["category.eq.metadata"] });
  const contentIssues = useResource("seo_issues", { limit: 1, filters: ["category.eq.content"] });
  const technicalIssues = useResource("seo_issues", { limit: 1, filters: ["category.eq.technical"] });
  const measured = useResource("keywords", { limit: 1, filters: ["position.gte.1"] });

  const byStatus = (status: string) => countWhere(pages.rows, (row) => text(row, "index_status") === status);
  const score = mean(pages.rows, "seo_score");
  const ctr = mean(perf.rows, "ctr");
  const position = mean(perf.rows, "avg_position");
  const lcp = mean(perf.rows, "lcp_ms");
  const inp = mean(perf.rows, "inp_ms");
  const cls = mean(perf.rows, "cls");
  const days = perf.rows.length;

  const decimal = (value: number | null, source: { loading: boolean; failed: boolean }, digits = 1, suffix = "") =>
    source.loading ? "…" : value === null || source.failed ? "—" : `${value.toFixed(digits)}${suffix}`;

  const cards: {
    label: string; value: string; delta?: string;
    tone: "default" | "success" | "warning" | "premium" | "destructive"; icon: ReactNode;
  }[] = [
    { label: "SEO Score", value: decimal(score, pages, 0), tone: "success", delta: `mean of ${pages.rows.length} crawled pages`, icon: <Gauge className="h-4 w-4" /> },
    { label: "Pages Crawled", value: figure(pages.total, pages), tone: "default", delta: "seo_pages", icon: <ScanLine className="h-4 w-4" /> },
    { label: "Indexable", value: figure(byStatus("indexable"), pages), tone: "success", icon: <ShieldCheck className="h-4 w-4" /> },
    { label: "Indexed", value: figure(byStatus("indexed"), pages), tone: "success", icon: <FileText className="h-4 w-4" /> },
    { label: "Pending", value: figure(byStatus("pending"), pages), tone: "warning", delta: "Queue", icon: <Clock className="h-4 w-4" /> },
    { label: "Crawled, Not Indexed", value: figure(byStatus("crawled_not_indexed"), pages), tone: "warning", icon: <EyeOff className="h-4 w-4" /> },
    { label: "Noindex", value: figure(byStatus("noindex"), pages), tone: "warning", icon: <EyeOff className="h-4 w-4" /> },
    { label: "Errors", value: figure(byStatus("error"), pages), tone: "destructive", icon: <AlertTriangle className="h-4 w-4" /> },
    { label: "Open Issues", value: figure(open.total, open), tone: "warning", delta: "status = open", icon: <AlertTriangle className="h-4 w-4" /> },
    { label: "High Severity", value: figure(high.total, high), tone: "destructive", icon: <Flame className="h-4 w-4" /> },
    { label: "Medium Severity", value: figure(medium.total, medium), tone: "warning", icon: <AlertTriangle className="h-4 w-4" /> },
    { label: "Low Severity", value: figure(low.total, low), tone: "default", icon: <CircleDot className="h-4 w-4" /> },
    { label: "Metadata Issues", value: figure(metaIssues.total, metaIssues), tone: "warning", icon: <FileText className="h-4 w-4" /> },
    { label: "Content Issues", value: figure(contentIssues.total, contentIssues), tone: "warning", icon: <PenTool className="h-4 w-4" /> },
    { label: "Technical Issues", value: figure(technicalIssues.total, technicalIssues), tone: "warning", icon: <FileCode2 className="h-4 w-4" /> },
    { label: "Keywords", value: figure(keywords.total, keywords), tone: "premium", delta: "seo_keywords", icon: <Hash className="h-4 w-4" /> },
    { label: "Keywords Measured", value: figure(measured.total, measured), tone: "success", delta: "has a position", icon: <TrendingUp className="h-4 w-4" /> },
    { label: "Backlinks", value: figure(backlinks.total, backlinks), tone: "default", icon: <LinkIcon className="h-4 w-4" /> },
    { label: "Toxic Backlinks", value: figure(countWhere(backlinks.rows, (r) => text(r, "status") === "toxic"), backlinks), tone: "destructive", icon: <AlertTriangle className="h-4 w-4" /> },
    { label: "Organic Clicks", value: figure(sum(perf.rows, "clicks"), perf), tone: "success", delta: `${days} days recorded`, icon: <ArrowUpRight className="h-4 w-4" /> },
    { label: "Impressions", value: figure(sum(perf.rows, "impressions"), perf), tone: "premium", delta: `${days} days recorded`, icon: <Eye className="h-4 w-4" /> },
    { label: "Organic Sessions", value: figure(sum(perf.rows, "organic_sessions"), perf), tone: "success", icon: <Users2 className="h-4 w-4" /> },
    { label: "Conversions", value: figure(sum(perf.rows, "conversions"), perf), tone: "premium", icon: <Target className="h-4 w-4" /> },
    { label: "CTR", value: decimal(ctr, perf, 2, "%"), tone: "success", delta: "mean, measured", icon: <Target className="h-4 w-4" /> },
    { label: "Avg Position", value: decimal(position, perf, 1), tone: "success", delta: "mean, measured", icon: <Award className="h-4 w-4" /> },
    { label: "LCP", value: decimal(lcp === null ? null : lcp / 1000, perf, 2, "s"), tone: lcp !== null && lcp <= 2500 ? "success" : "warning", delta: "good ≤ 2.50s", icon: <Zap className="h-4 w-4" /> },
    { label: "INP", value: decimal(inp, perf, 0, "ms"), tone: inp !== null && inp <= 200 ? "success" : "warning", delta: "good ≤ 200ms", icon: <Activity className="h-4 w-4" /> },
    { label: "CLS", value: decimal(cls, perf, 3), tone: cls !== null && cls <= 0.1 ? "success" : "warning", delta: "good ≤ 0.100", icon: <Layers className="h-4 w-4" /> },
    { label: "Sessions Measured", value: figure(sum(behaviour.rows, "sessions"), behaviour), tone: "default", delta: "page behaviour", icon: <BarChart3 className="h-4 w-4" /> },
  ];

  const trend = [...perf.rows].reverse();
  const topPages = groupBy(behaviour.rows, "page_url")
    .map((group) => ({
      url: group.key,
      sessions: sum(group.rows, "sessions"),
      clicks: sum(group.rows, "clicks"),
      seconds: mean(group.rows, "avg_time_seconds"),
      scroll: mean(group.rows, "scroll_depth_pct"),
      bounce: mean(group.rows, "bounce_rate"),
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Mega stat wall */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {cards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} tone={s.tone} delta={s.delta} icon={s.icon} />
        ))}
      </div>

      {/* Measured performance + core web vitals */}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Organic performance · {days} days recorded
              </div>
              <div className="mt-0.5 text-sm font-bold">Clicks vs Impressions</div>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              seo_performance_metrics
            </div>
          </div>
          <PerformanceChart rows={trend} loading={perf.loading} failed={perf.failed} />
          <div className="mt-3 grid grid-cols-4 gap-3 border-t border-border pt-3 text-[11px]">
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Clicks</div><div className="font-mono text-lg font-bold tabular text-accent">{figure(sum(perf.rows, "clicks"), perf)}</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Impressions</div><div className="font-mono text-lg font-bold tabular text-premium">{figure(sum(perf.rows, "impressions"), perf)}</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">CTR</div><div className="font-mono text-lg font-bold tabular text-success">{decimal(ctr, perf, 2, "%")}</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Position</div><div className="font-mono text-lg font-bold tabular">{decimal(position, perf, 1)}</div></div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Core Web Vitals · measured over {days} days
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: "SEO Score", v: score === null ? null : Math.round(score), suffix: "", good: undefined as number | undefined },
              { l: "LCP", v: lcp, suffix: "ms", good: 2500 },
              { l: "INP", v: inp, suffix: "ms", good: 200 },
              { l: "CLS", v: cls, suffix: "", good: 0.1 },
            ].map((r) => {
              const passing = r.good === undefined ? (r.v ?? 0) >= 80 : r.v !== null && r.v <= r.good;
              const ringValue = r.good === undefined
                ? Math.round(r.v ?? 0)
                : r.v === null ? 0 : Math.max(0, Math.min(100, Math.round(100 - ((r.v / r.good) - 1) * 100)));
              return (
                <div key={r.l} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
                  <ScoreRing value={ringValue} />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.l}</div>
                    <div className="font-mono text-xs font-semibold text-foreground">
                      {r.v === null ? "—" : r.suffix === "ms" ? `${Math.round(r.v)}ms` : r.l === "CLS" ? r.v.toFixed(3) : String(r.v)}
                    </div>
                    <div className={`text-[10px] ${passing ? "text-success" : "text-warning"}`}>
                      {r.v === null ? "not measured" : passing ? "Good" : "Needs work"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
            Thresholds are the published Core Web Vitals ones: LCP 2.5s, INP 200ms, CLS 0.1. The SEO score
            is the mean of the scores held against the pages that have been crawled.
          </div>
        </Card>
      </div>

      {/* Top pages + Top keywords */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Busiest pages</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">seo_page_behavior</div>
          </div>
          <Table
            head={["URL", "Sessions", "Clicks", "Avg time", "Scroll", "Bounce"]}
            rows={topPages.map((p) => [
              <span key="u" className="font-mono text-[11px]">{p.url}</span>,
              <span key="s" className="font-mono tabular">{p.sessions.toLocaleString()}</span>,
              <span key="c" className="font-mono tabular">{p.clicks.toLocaleString()}</span>,
              <span key="t" className="font-mono tabular">{p.seconds === null ? "—" : `${Math.round(p.seconds)}s`}</span>,
              <span key="d" className="font-mono tabular">{p.scroll === null ? "—" : `${Math.round(p.scroll)}%`}</span>,
              <span key="b" className={`font-mono tabular ${(p.bounce ?? 0) > 50 ? "text-warning" : "text-success"}`}>{p.bounce === null ? "—" : `${p.bounce.toFixed(1)}%`}</span>,
            ])}
          />
          {!behaviour.loading && topPages.length === 0 && (
            <div className="px-1 py-3 text-[11px] text-muted-foreground">
              {behaviour.failed ? "Page behaviour could not be read." : "No page behaviour has been recorded yet."}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Top ranking keywords</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">seo_keywords</div>
          </div>
          <Table
            head={["Keyword", "Pos", "Δ", "Vol", "CPC", "URL"]}
            rows={keywords.rows.slice(0, 5).map((k) => [
              <span key="k" className="font-semibold">{text(k, "keyword")}</span>,
              <span key="p" className="font-mono tabular text-accent">{text(k, "position")}</span>,
              <Delta key="d" v={num(k, "previous_position") - num(k, "position")} />,
              <span key="v" className="font-mono tabular">{num(k, "search_volume").toLocaleString()}</span>,
              <span key="c" className="font-mono tabular">{k.cpc === null || k.cpc === undefined ? "—" : `$${num(k, "cpc").toFixed(2)}`}</span>,
              <span key="u" className="font-mono text-[11px] text-muted-foreground">{text(k, "target_url")}</span>,
            ])}
          />
          {!keywords.loading && keywords.rows.length === 0 && (
            <div className="px-1 py-3 text-[11px] text-muted-foreground">
              {keywords.failed ? "Keywords could not be read." : "No keywords are tracked yet."}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * The thirty-day curve, drawn from the rows.
 *
 * What stood here was called FakeAreaChart and drew two fixed polylines: the
 * same shape whatever the platform had done. This plots the measured clicks
 * and impressions, each scaled to its own highest day, and says plainly when
 * there is nothing to plot.
 */
function PerformanceChart({
  rows, loading, failed,
}: { rows: ResourceRow[]; loading: boolean; failed: boolean }) {
  const width = 400;
  const height = 120;
  const clicks = rows.map((r) => num(r, "clicks"));
  const impressions = rows.map((r) => num(r, "impressions"));
  const peakClicks = Math.max(1, ...clicks);
  const peakImpressions = Math.max(1, ...impressions);

  const path = (values: number[], peak: number) =>
    values
      .map((value, index) => {
        const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
        const y = height - (value / peak) * (height - 10);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  if (loading || failed || rows.length === 0) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg border border-border bg-background/40 text-[11px] text-muted-foreground">
        {loading
          ? "Reading the performance table…"
          : failed
            ? "Performance could not be read."
            : "No performance has been recorded yet."}
      </div>
    );
  }

  const first = text(rows[0], "recorded_on");
  const last = text(rows[rows.length - 1], "recorded_on");
  const middle = text(rows[Math.floor(rows.length / 2)], "recorded_on");

  return (
    <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border bg-background/40">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="oklch(0.80 0.13 192)" stopOpacity="0.4" />
            <stop offset="1" stopColor="oklch(0.80 0.13 192)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="oklch(0.85 0.16 92)" stopOpacity="0.3" />
            <stop offset="1" stopColor="oklch(0.85 0.16 92)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={path(impressions, peakImpressions)} fill="none" stroke="oklch(0.85 0.16 92)" strokeWidth="1.5" />
        <polygon points={`${path(impressions, peakImpressions)} ${width},${height} 0,${height}`} fill="url(#gb)" />
        <polyline points={path(clicks, peakClicks)} fill="none" stroke="oklch(0.80 0.13 192)" strokeWidth="1.8" />
        <polygon points={`${path(clicks, peakClicks)} ${width},${height} 0,${height}`} fill="url(#ga)" />
      </svg>
      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
        <span>{first}</span><span>{middle}</span><span>{last}</span>
      </div>
    </div>
  );
}

/* =========================================================
   2) HEALTH
   ========================================================= */
/** Severity names, which an audit breakdown sometimes uses as its keys. */
const SEVERITY_KEY = /^(low|medium|high|critical)$/;

/** A database key as a person reads it: issues_by_severity -> Issues By Severity. */
function humaniseKey(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Health, as the last audit found it.
 *
 * The ring said 91% and the six bars beneath it - on-page 88, technical 93 and
 * so on - were six numbers typed into this file. The platform runs audits and
 * keeps them: twenty-five of them, each with a score, a page count, an issue
 * count and a breakdown by category. This reads the most recent one.
 *
 * The list beside it was six invented issues. There are two and a half
 * thousand real ones. They are grouped by type, and the panel says how many of
 * them the grouping was taken from, because a count from a sample is a
 * different claim from a count of everything.
 */
function HealthModule() {
  const audits = useResource("seo_audits", { limit: 30 });
  const checks = useResource("seo_technical_checks", { limit: 50 });
  const sample = useResource("seo_issues", { limit: 200, filters: ["status.eq.open"] });
  const high = useResource("seo_issues", { limit: 1, filters: ["severity.eq.high"] });
  const medium = useResource("seo_issues", { limit: 1, filters: ["severity.eq.medium"] });
  const low = useResource("seo_issues", { limit: 1, filters: ["severity.eq.low"] });

  // The crawler has been running daily and its last several runs recorded
  // nothing - no score, no pages, no breakdown. Showing a ring at zero would
  // read as "this site scores zero", which is a different claim from "the last
  // run measured nothing". So the panel shows the most recent run that did
  // measure something, names its date, and says how many runs since then came
  // back empty.
  const scored = audits.rows.find((row) => num(row, "score") > 0);
  const newest = audits.rows[0];
  const emptyRuns = scored ? audits.rows.indexOf(scored) : audits.rows.length;
  const latest = scored ?? newest;
  const score = scored ? num(scored, "score") : null;
  const breakdown = (latest?.breakdown ?? null) as Record<string, number> | null;
  // An audit records whatever its kind records. The monthly site audit keeps
  // a score out of a hundred per category; the daily crawl keeps a count of
  // issues per severity; the catalogue audit keeps nested figures. Printing
  // any of them with a per-cent sign would turn "96 medium issues" into
  // "96% medium", so the values are shown as they are and the bars are scaled
  // to the largest of them.
  const entries = breakdown
    ? Object.entries(breakdown).filter(([, value]) => typeof value === "number")
    : [];
  const peak = entries.reduce((highest, [, value]) => Math.max(highest, Number(value)), 0);
  const scores =
    entries.length > 0 &&
    entries.every(([, value]) => Number(value) <= 100) &&
    entries.every(([key]) => !SEVERITY_KEY.test(key));
  const bars = entries.map(([key, value]) => ({
    l: humaniseKey(key),
    v: Number(value),
  }));

  const grouped = groupBy(sample.rows, "issue_type")
    .map((group) => ({
      type: group.key,
      count: group.rows.length,
      severity: text(group.rows[0], "severity", "low"),
      description: text(group.rows[0], "description", ""),
      fix: text(group.rows[0], "fix_suggestion", ""),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const verdict = score === null ? "Unknown" : score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Fair" : "Needs work";
  const verdictTone = score === null ? "text-muted-foreground" : score >= 75 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.5fr]">
      <Card>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Overall health</div>
        <div className="mt-3 flex items-center gap-4">
          <ScoreRing value={score ?? 0} size={96} />
          <div>
            <div className={`text-3xl font-bold ${verdictTone}`}>{audits.loading ? "…" : verdict}</div>
            <div className="text-xs text-muted-foreground">
              {audits.loading
                ? "Reading the audit table…"
                : audits.failed
                  ? "Audits could not be read."
                  : latest
                    ? `${text(latest, "started_at").slice(0, 10)} · ${num(latest, "pages_crawled").toLocaleString()} pages crawled, ${num(latest, "issues_found").toLocaleString()} issues found`
                    : "No audit has been run yet."}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {bars.length > 0 && (
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {scores ? "Score by category" : "Issues by severity, as this run counted them"}
            </div>
          )}
          {bars.map((r) => (
            <div key={r.l}>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{r.l}</span>
                <span className="font-mono tabular">{scores ? `${r.v}%` : r.v.toLocaleString()}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-background/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-glow"
                  style={{ width: `${peak > 0 ? Math.max(2, Math.round((r.v / peak) * 100)) : 0}%` }}
                />
              </div>
            </div>
          ))}
          {!audits.loading && bars.length === 0 && (
            <div className="text-[11px] text-muted-foreground">The latest audit carries no category breakdown.</div>
          )}
        </div>
        {emptyRuns > 0 && !audits.loading && (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[11px] leading-relaxed text-warning">
            The {emptyRuns} most recent {emptyRuns === 1 ? "audit run" : "audit runs"} recorded no score, no
            pages crawled and no breakdown. The figures above are from the last run that measured anything.
          </div>
        )}
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Technical checks</div>
          <div className="flex flex-wrap gap-1">
            {checks.rows.slice(0, 12).map((check) => {
              const status = text(check, "status");
              return (
                <Chip key={String(check.id)} tone={status === "pass" ? "success" : status === "warn" ? "warning" : "destructive"}>
                  {text(check, "name")}
                </Chip>
              );
            })}
            {!checks.loading && checks.rows.length === 0 && (
              <span className="text-[11px] text-muted-foreground">No technical check has been recorded.</span>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Issues to fix</div>
          <div className="flex gap-1">
            <Chip tone="destructive">{figure(high.total, high)} high</Chip>
            <Chip tone="warning">{figure(medium.total, medium)} medium</Chip>
            <Chip>{figure(low.total, low)} low</Chip>
          </div>
        </div>
        <div className="space-y-2">
          {grouped.map((i) => {
            const tone = i.severity === "high" ? "destructive" : i.severity === "medium" ? "warning" : "default";
            const Icon = i.severity === "low" ? CheckCircle2 : AlertTriangle;
            return (
              <div key={i.type} className="group flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-accent/40">
                <Icon className={`mt-0.5 h-4 w-4 ${tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-accent"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 truncate text-[13px] font-bold">{i.description || i.type}</div>
                    <Chip tone={tone as any}>{i.count}</Chip>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-mono">{i.type}</span>
                    {i.fix ? ` · ${i.fix}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {sample.loading && <div className="text-[11px] text-muted-foreground">{"Reading the issue table…"}</div>}
          {!sample.loading && grouped.length === 0 && (
            <div className="text-[11px] text-muted-foreground">
              {sample.failed ? "Issues could not be read." : "No open issue is recorded."}
            </div>
          )}
        </div>
        {grouped.length > 0 && (
          <div className="mt-3 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
            Grouped from the {sample.rows.length} most recently detected of {figure(sample.total, sample)} open issues.
            The counts on the chips above are of every issue at that severity, not of the sample.
          </div>
        )}
      </Card>
    </div>
  );
}

/* =========================================================
   3) REPORTS
   ========================================================= */
/**
 * The reports the platform has actually generated.
 *
 * Thirteen report cards were listed here - a daily digest, a 42-page monthly
 * PDF, a yearly retrospective - and every one of them said "Scheduled" over a
 * table that holds five generated reports and twenty-five completed audits.
 * None of the thirteen existed.
 *
 * These are the real ones, with the period each covers, the state it is in and
 * the figures it carries.
 */
function ReportsModule() {
  const reports = useResource("seo_reports_center", { limit: 50 });
  const audits = useResource("seo_audits", { limit: 25 });

  const icons: Record<string, typeof Calendar> = {
    monthly: Calendar, weekly: BarChart3, daily: Clock, technical: ScanLine,
    keyword: Hash, content: Rss, traffic: BarChart3, executive: Award,
  };

  return (
    <div className="space-y-4">
      <Toolbar title="Report Library" count={reports.total} />
      {reports.loading && <div className="text-[11px] text-muted-foreground">Reading the report table…</div>}
      {!reports.loading && reports.rows.length === 0 && (
        <div className="rounded-xl border border-border bg-background/40 p-4 text-[12px] text-muted-foreground">
          {reports.failed ? "Reports could not be read." : "No report has been generated yet."}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {reports.rows.map((r) => {
          const type = text(r, "report_type", "report");
          const Icon = icons[type] ?? FileText;
          const status = text(r, "status");
          const tone = status === "ready" ? "success" : status === "failed" ? "destructive" : "warning";
          const summary = (r.summary ?? null) as Record<string, unknown> | null;
          return (
            <Card key={String(r.id)}>
              <div className="flex items-start justify-between">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-accent"><Icon className="h-4 w-4" /></div>
                <Chip tone={tone as any}>{status}</Chip>
              </div>
              <div className="mt-3 text-sm font-bold">{text(r, "name")}</div>
              <div className="text-[11px] text-muted-foreground">
                {type} · {text(r, "period_start")} → {text(r, "period_end")}
              </div>
              {summary && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px]">
                  {Object.entries(summary).slice(0, 4).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{key.replace(/_/g, " ")}</div>
                      <div className="font-mono tabular">{typeof value === "number" ? value.toLocaleString() : String(value)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                Generated {text(r, "generated_at").slice(0, 10)}
              </div>
            </Card>
          );
        })}
      </div>

      <Toolbar title="Audits" count={audits.total} />
      <Table
        head={["Audit", "Status", "Score", "Pages crawled", "Issues found", "Started", "Completed"]}
        rows={audits.rows.map((a) => [
          <span key="n" className="font-semibold">{text(a, "name")}</span>,
          <Chip key="s" tone={text(a, "status") === "completed" ? "success" : "warning"}>{text(a, "status")}</Chip>,
          <ScoreRing key="sc" value={num(a, "score")} size={28} />,
          <span key="p" className="font-mono tabular">{num(a, "pages_crawled").toLocaleString()}</span>,
          <span key="i" className="font-mono tabular text-warning">{num(a, "issues_found").toLocaleString()}</span>,
          <span key="st" className="font-mono text-[11px] text-muted-foreground">{text(a, "started_at").slice(0, 10)}</span>,
          <span key="c" className="font-mono text-[11px] text-muted-foreground">{text(a, "completed_at").slice(0, 10)}</span>,
        ])}
      />
      {!audits.loading && audits.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {audits.failed ? "Audits could not be read." : "No audit has been run yet."}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   4) PAGE EDITOR — reuse existing editor
   ========================================================= */
function PageEditorModule() {
  // legacy editor already includes PageHeader; wrap to hide its own header via negative padding trick
  return <div className="-mx-4 -my-8 md:-mx-8"><LegacySeoEditor /></div>;
}

/* =========================================================
   5) PRODUCT SEO TABLE
   ========================================================= */
/**
 * The crawled pages of one kind.
 *
 * Product SEO, Blog SEO and Landing SEO each drew a table of four to eight
 * invented rows with a position, a click count and a CTR that no page-level
 * table records. What is recorded, per page, is its title, the meta title and
 * description it serves, its H1, its canonical, a word count, a score, an
 * index status and how many issues were found on it. That is one table and
 * three filters over it.
 */
function PagesOfType({
  kind, title, Icon,
}: { kind: string; title: string; Icon: typeof Boxes }) {
  const pages = useResource("seo_pages", { limit: 200, filters: [`page_type.eq.${kind}`] });
  const score = mean(pages.rows, "seo_score");
  const indexed = countWhere(pages.rows, (row) => text(row, "index_status") === "indexed");
  const issues = sum(pages.rows, "issues_count");
  const noDescription = countWhere(pages.rows, (row) => text(row, "meta_description", "") === "");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={title} value={figure(pages.total, pages)} icon={<Icon className="h-4 w-4" />} />
        <StatCard label="Avg SEO Score" value={score === null ? (pages.loading ? "…" : "—") : score.toFixed(0)} tone="success" />
        <StatCard label="Indexed" value={pages.loading ? "…" : String(indexed)} tone="success" />
        <StatCard label="Issues found" value={pages.loading ? "…" : String(issues)} tone={issues > 0 ? "warning" : "success"} />
      </div>
      <Toolbar title={title} count={pages.total} />
      <Table
        head={["URL", "Title", "Meta description", "H1", "Words", "Score", "Index", "Issues", "Crawled"]}
        rows={pages.rows.map((r) => [
          <span key="u" className="max-w-[240px] truncate font-mono text-[11px]">{text(r, "url")}</span>,
          <span key="t" className="max-w-[220px] truncate font-semibold">{text(r, "meta_title") || text(r, "title")}</span>,
          <span key="d" className="max-w-[260px] truncate text-[11px] text-muted-foreground">{text(r, "meta_description")}</span>,
          <span key="h" className="max-w-[180px] truncate text-[11px]">{text(r, "h1")}</span>,
          <span key="w" className="font-mono tabular">{num(r, "word_count").toLocaleString()}</span>,
          <ScoreRing key="sc" value={num(r, "seo_score")} size={28} />,
          <Chip key="i" tone={text(r, "index_status") === "indexed" || text(r, "index_status") === "indexable" ? "success" : text(r, "index_status") === "error" ? "destructive" : "warning"}>{text(r, "index_status")}</Chip>,
          <span key="is" className={`font-mono tabular ${num(r, "issues_count") > 0 ? "text-warning" : "text-muted-foreground"}`}>{num(r, "issues_count")}</span>,
          <span key="c" className="font-mono text-[11px] text-muted-foreground">{text(r, "last_crawled_at").slice(0, 10)}</span>,
        ])}
      />
      {pages.loading && <div className="text-[11px] text-muted-foreground">Reading the page table…</div>}
      {!pages.loading && pages.rows.length === 0 && (
        <div className="rounded-xl border border-border bg-background/40 p-4 text-[12px] text-muted-foreground">
          {pages.failed ? "Pages could not be read." : `No page of this kind has been crawled yet.`}
        </div>
      )}
      {noDescription > 0 && (
        <div className="text-[10px] leading-relaxed text-muted-foreground">
          {noDescription} of these {pages.rows.length} pages serve no meta description.
        </div>
      )}
    </div>
  );
}

function ProductSeoModule() {
  const entries = useResource("seo_product_entries", { limit: 100 });
  return (
    <div className="space-y-6">
      <PagesOfType kind="product" title="Product pages" Icon={Boxes} />
      <div>
        <Toolbar title="Product SEO entries" count={entries.total} />
        <Table
          head={["Product", "Category", "Meta title", "Meta description", "Status", "Updated"]}
          rows={entries.rows.map((r) => [
            <span key="p" className="font-semibold">{text(r, "product_name")}</span>,
            <Chip key="c">{text(r, "category")}</Chip>,
            <span key="t" className="max-w-[220px] truncate text-[11px]">{text(r, "meta_title")}</span>,
            <span key="d" className="max-w-[260px] truncate text-[11px] text-muted-foreground">{text(r, "meta_description")}</span>,
            <Chip key="s" tone={text(r, "status") === "published" ? "success" : "warning"}>{text(r, "status")}</Chip>,
            <span key="u" className="font-mono text-[11px] text-muted-foreground">{text(r, "updated_at").slice(0, 10)}</span>,
          ])}
        />
        {!entries.loading && entries.rows.length === 0 && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            {entries.failed ? "Product SEO entries could not be read." : "No product SEO entry is recorded."}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The marketplace categories, as the catalogue holds them.
 *
 * Six categories were listed with a meta title, a rank and a monthly traffic
 * figure. The catalogue has its own categories table with their real slugs,
 * order and visibility; traffic and rank are not recorded per category, so
 * those columns are gone rather than guessed.
 */
function CategorySeoModule() {
  const categories = useResource("categories", { limit: 200 });
  const hidden = countWhere(categories.rows, (row) => Boolean(row.is_hidden));
  const featured = countWhere(categories.rows, (row) => Boolean(row.is_featured));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Categories" value={figure(categories.total, categories)} icon={<LayoutGrid className="h-4 w-4" />} />
        <StatCard label="Visible" value={categories.loading ? "…" : String(categories.rows.length - hidden)} tone="success" />
        <StatCard label="Hidden" value={categories.loading ? "…" : String(hidden)} tone="warning" />
        <StatCard label="Featured" value={categories.loading ? "…" : String(featured)} tone="premium" />
      </div>
      <Toolbar title="Categories" count={categories.total} />
      <Table
        head={["Category", "Slug", "Icon", "Order", "Visible", "Featured", "Updated"]}
        rows={categories.rows.map((r) => [
          <span key="c" className="font-semibold">{text(r, "name")}</span>,
          <span key="s" className="font-mono text-[11px] text-muted-foreground">/{text(r, "slug")}</span>,
          <span key="i" className="text-[11px]">{text(r, "icon")}</span>,
          <span key="o" className="font-mono tabular">{num(r, "sort_order")}</span>,
          <Chip key="v" tone={r.is_hidden ? "warning" : "success"}>{r.is_hidden ? "hidden" : "visible"}</Chip>,
          <Chip key="f" tone={r.is_featured ? "premium" : "default"}>{r.is_featured ? "yes" : "no"}</Chip>,
          <span key="u" className="font-mono text-[11px] text-muted-foreground">{text(r, "updated_at").slice(0, 10)}</span>,
        ])}
      />
      {categories.loading && <div className="text-[11px] text-muted-foreground">Reading the category table…</div>}
      {!categories.loading && categories.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {categories.failed ? "Categories could not be read." : "No category is recorded."}
        </div>
      )}
    </div>
  );
}

function BlogSeoModule() {
  const posts = useResource("blog", { limit: 200 });
  const score = mean(posts.rows, "seo_score");
  const words = mean(posts.rows, "word_count");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Content items" value={figure(posts.total, posts)} icon={<Rss className="h-4 w-4" />} />
        <StatCard label="Avg SEO Score" value={score === null ? (posts.loading ? "…" : "—") : score.toFixed(0)} tone="success" />
        <StatCard label="Published" value={posts.loading ? "…" : String(countWhere(posts.rows, (r) => text(r, "status") === "published"))} tone="success" />
        <StatCard label="Avg words" value={words === null ? "—" : Math.round(words).toLocaleString()} tone="premium" />
      </div>
      <Toolbar title="Blog SEO" count={posts.total} />
      <Table
        head={["Title", "Type", "Target keyword", "Words", "SEO Score", "URL", "Status", "Published"]}
        rows={posts.rows.map((r) => [
          <span key="t" className="max-w-[240px] truncate font-semibold">{text(r, "title")}</span>,
          <Chip key="c">{text(r, "content_type")}</Chip>,
          <span key="k" className="text-[11px]">{text(r, "target_keyword")}</span>,
          <span key="w" className="font-mono tabular">{num(r, "word_count").toLocaleString()}</span>,
          <ScoreRing key="sc" value={num(r, "seo_score")} size={28} />,
          <span key="u" className="max-w-[200px] truncate font-mono text-[11px] text-muted-foreground">{text(r, "url")}</span>,
          <Chip key="st" tone={text(r, "status") === "published" ? "success" : text(r, "status") === "draft" ? "default" : "warning"}>{text(r, "status")}</Chip>,
          <span key="p" className="font-mono text-[11px] text-muted-foreground">{text(r, "published_at").slice(0, 10)}</span>,
        ])}
      />
      {posts.loading && <div className="text-[11px] text-muted-foreground">Reading the content table…</div>}
      {!posts.loading && posts.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {posts.failed ? "Content could not be read." : "No content item is recorded."}
        </div>
      )}
      <PagesOfType kind="blog" title="Crawled blog pages" Icon={Rss} />
    </div>
  );
}

function LandingSeoModule() {
  return <PagesOfType kind="landing" title="Landing pages" Icon={Rocket} />;
}

/* =========================================================
   8) META MANAGER
   ========================================================= */
/**
 * The meta rules the platform applies, and what a page actually serves.
 *
 * Thirty-eight field rows were listed here - og:locale, a Yandex verification,
 * a theme colour - every one of them marked "Set" in green. None was read from
 * anything. The platform holds five meta rules, each with the URL pattern it
 * matches and the title and description templates it fills, and seventy-nine
 * crawled pages with the title and description they really serve.
 */
function MetaManagerModule() {
  const rules = useResource("seo_meta_rules", { limit: 50 });
  const pages = useResource("seo_pages", { limit: 200 });
  const [chosen, setChosen] = useState(0);
  const page = pages.rows[Math.min(chosen, Math.max(pages.rows.length - 1, 0))];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Meta Tag Manager</div>
            <div className="mt-0.5 text-sm font-bold">The rules, in the order they are applied</div>
          </div>
          <Chip tone="accent">{figure(rules.total, rules)} rules</Chip>
        </div>
        <div className="space-y-3">
          {rules.rows.map((rule) => (
            <div key={String(rule.id)} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-bold">{text(rule, "name")}</div>
                <div className="flex items-center gap-1">
                  <Chip tone="default">priority {num(rule, "priority")}</Chip>
                  <Chip tone={text(rule, "status") === "active" ? "success" : "warning"}>{text(rule, "status")}</Chip>
                </div>
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">{text(rule, "url_pattern")} · {text(rule, "applies_to")}</div>
              <div className="mt-2 space-y-1 text-[11px]">
                <div><span className="text-muted-foreground">title</span> <span className="font-mono">{text(rule, "title_template")}</span></div>
                <div><span className="text-muted-foreground">description</span> <span className="font-mono">{text(rule, "description_template")}</span></div>
                {text(rule, "og_image_template", "") !== "" && (
                  <div><span className="text-muted-foreground">og:image</span> <span className="font-mono">{text(rule, "og_image_template")}</span></div>
                )}
              </div>
            </div>
          ))}
          {rules.loading && <div className="text-[11px] text-muted-foreground">Reading the meta rules…</div>}
          {!rules.loading && rules.rows.length === 0 && (
            <div className="text-[11px] text-muted-foreground">
              {rules.failed ? "Meta rules could not be read." : "No meta rule is configured; pages serve their own title and description."}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">What a page serves</div>
        <select
          value={chosen}
          onChange={(event) => setChosen(Number(event.target.value))}
          className="mb-3 w-full rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs"
        >
          {pages.rows.map((row, index) => (
            <option key={String(row.id)} value={index}>{text(row, "url")}</option>
          ))}
        </select>
        {page ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{text(page, "url")}</div>
              <div className="mt-1 text-[16px] font-bold text-[hsl(210_100%_75%)]">{text(page, "meta_title") || text(page, "title")}</div>
              <div className="text-[11px] text-muted-foreground">{text(page, "meta_description")}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">H1</div><div className="truncate">{text(page, "h1")}</div></div>
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Canonical</div><div className="truncate font-mono">{text(page, "canonical_url")}</div></div>
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Index</div><div>{text(page, "index_status")}</div></div>
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Words</div><div className="font-mono tabular">{num(page, "word_count").toLocaleString()}</div></div>
            </div>
            <div className="text-[10px] leading-relaxed text-muted-foreground">
              Read from the crawl record for this page. Open Graph and Twitter tags are shown on their own
              screens, from the same record.
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">
            {pages.loading ? "Reading the page table…" : pages.failed ? "Pages could not be read." : "No page has been crawled."}
          </div>
        )}
      </Card>
    </div>
  );
}

/* =========================================================
   9) SCHEMA MANAGER
   ========================================================= */
/**
 * The structured data the platform actually emits.
 *
 * Fourteen schema types were listed with counts - 26,882 deployed, 18,214 rich
 * results live, three validation errors - over a site that holds seventy-nine
 * crawled pages. The counts were invented and so were the types.
 *
 * These are read from the pages and product entries that carry structured
 * data, and the type of each one is taken from the JSON itself rather than
 * from a list of types someone expected to find.
 */
function SchemaModule() {
  const pages = useResource("seo_pages", { limit: 200 });
  const entries = useResource("seo_product_entries", { limit: 100 });

  const typesOf = (value: unknown): string[] => {
    if (!value) return [];
    const list = Array.isArray(value) ? value : [value];
    return list.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const type = (item as Record<string, unknown>)["@type"];
      if (typeof type === "string") return [type];
      if (Array.isArray(type)) return type.map(String);
      return [];
    });
  };

  const counts = new Map<string, number>();
  let carrying = 0;
  for (const row of [...pages.rows, ...entries.rows]) {
    const found = [...typesOf(row.schema_json), ...typesOf(row.structured_data)];
    if (found.length > 0) carrying += 1;
    for (const type of found) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const types = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const loading = pages.loading || entries.loading;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Records carrying schema" value={loading ? "…" : String(carrying)} icon={<FileCode2 className="h-4 w-4" />} />
        <StatCard label="Types found" value={loading ? "…" : String(types.length)} tone="success" />
        <StatCard label="Pages read" value={figure(pages.total, pages)} tone="default" />
        <StatCard label="Product entries read" value={figure(entries.total, entries)} tone="default" />
      </div>
      <Toolbar title="Schema Types" count={types.length} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {types.map(([type, count]) => (
          <Card key={type}>
            <div className="flex items-start justify-between">
              <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-accent"><FileCode2 className="h-4 w-4" /></div>
              <Chip tone="success">Parsed</Chip>
            </div>
            <div className="mt-3 text-sm font-bold">{type}</div>
            <div className="text-[11px] text-muted-foreground">
              On {count.toLocaleString()} {count === 1 ? "record" : "records"}
            </div>
          </Card>
        ))}
      </div>
      {loading && <div className="text-[11px] text-muted-foreground">Reading the structured data…</div>}
      {!loading && types.length === 0 && (
        <div className="rounded-xl border border-border bg-background/40 p-4 text-[12px] text-muted-foreground">
          No crawled page or product entry carries structured data. The site emits JSON-LD on its product
          pages; what is stored against a record is what this screen can count.
        </div>
      )}
      <div className="text-[10px] leading-relaxed text-muted-foreground">
        A type is counted where the stored JSON declares it. Nothing here validates the JSON against
        schema.org, so no "valid" or "error" count is shown: that would be a claim nothing has checked.
      </div>
    </div>
  );
}

/* =========================================================
   10) OG & TWITTER — visual pickers
   ========================================================= */
/**
 * The social cards a page would produce, from that page.
 *
 * Both screens drew one fixed card - a gradient, "Software Vala — Enterprise
 * Marketplace", "1,284 verified products" - and listed seven og: fields each
 * marked "Auto from page". Nothing was read from a page.
 *
 * A page's title, description and canonical are recorded, so the preview is
 * built from whichever page is chosen. Where a tag is genuinely not stored -
 * og:image is not held against a page - the row says so instead of showing a
 * filename that does not exist.
 */
function SocialCardPreview({ kind, page }: { kind: "og" | "twitter"; page: ResourceRow | undefined }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex h-40 items-end bg-gradient-to-br from-primary/60 via-surface to-accent/40 p-3">
        <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/80 backdrop-blur">
          {kind === "og" ? "1200 × 630 · no og:image is stored" : "1200 × 675 · no twitter:image is stored"}
        </span>
      </div>
      <div className="space-y-1 border-t border-border bg-background/60 p-3">
        <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          {page ? text(page, "url") : "—"}
        </div>
        <div className="text-[13px] font-bold">{page ? text(page, "meta_title") || text(page, "title") : "—"}</div>
        <div className="line-clamp-2 text-[11px] text-muted-foreground">{page ? text(page, "meta_description") : "—"}</div>
      </div>
    </div>
  );
}

function SocialModule({ kind, title }: { kind: "og" | "twitter"; title: string }) {
  const pages = useResource("seo_pages", { limit: 200 });
  const [chosen, setChosen] = useState(0);
  const page = pages.rows[Math.min(chosen, Math.max(pages.rows.length - 1, 0))];

  const fields: { label: string; value: string; absent?: boolean }[] = page
    ? kind === "og"
      ? [
          { label: "og:title", value: text(page, "meta_title") || text(page, "title") },
          { label: "og:description", value: text(page, "meta_description") },
          { label: "og:url", value: text(page, "canonical_url") || text(page, "url") },
          { label: "og:type", value: text(page, "page_type") },
          { label: "og:image", value: "not stored against a page", absent: true },
          { label: "og:locale", value: "not stored against a page", absent: true },
          { label: "og:site_name", value: "not stored against a page", absent: true },
        ]
      : [
          { label: "twitter:title", value: text(page, "meta_title") || text(page, "title") },
          { label: "twitter:description", value: text(page, "meta_description") },
          { label: "twitter:card", value: "not stored against a page", absent: true },
          { label: "twitter:site", value: "not stored against a page", absent: true },
          { label: "twitter:creator", value: "not stored against a page", absent: true },
          { label: "twitter:image", value: "not stored against a page", absent: true },
        ]
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
        <select
          value={chosen}
          onChange={(event) => setChosen(Number(event.target.value))}
          className="mt-3 w-full rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs"
        >
          {pages.rows.map((row, index) => (
            <option key={String(row.id)} value={index}>{text(row, "url")}</option>
          ))}
        </select>
        <div className="mt-3 space-y-2">
          {fields.map((f) => (
            <Row key={f.label} label={f.label} value={f.value} absent={f.absent} />
          ))}
          {!page && (
            <div className="text-[11px] text-muted-foreground">
              {pages.loading ? "Reading the page table…" : pages.failed ? "Pages could not be read." : "No page has been crawled."}
            </div>
          )}
        </div>
      </Card>
      <Card>
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {kind === "og" ? "Facebook preview" : "X preview"}
        </div>
        <SocialCardPreview kind={kind} page={page} />
      </Card>
    </div>
  );
}

function OgModule() {
  return <SocialModule kind="og" title="Open Graph, from the page" />;
}

function TwitterModule() {
  return <SocialModule kind="twitter" title="Twitter Card, from the page" />;
}

function Row({ label, value, absent }: { label: string; value: string; absent?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px]">
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className={`max-w-[220px] truncate ${absent ? "text-muted-foreground italic" : ""}`}>{value || "—"}</span>
    </div>
  );
}

/* =========================================================
   11) TAG MANAGER
   ========================================================= */
/**
 * The tags that are actually in use.
 *
 * Eleven tags were listed with use counts, SEO scores and a trend arrow, two
 * of them invented as examples of problems - a "duplicate-tag" and an
 * "unused-tag". This platform has no tag table. What it has is tags recorded
 * against its questions and target keywords recorded against its content, and
 * those are counted here by how often each one is used.
 */
function TagManagerModule() {
  const faqs = useResource("faqs", { limit: 200 });
  const content = useResource("blog", { limit: 200 });

  const counts = new Map<string, number>();
  for (const row of faqs.rows) {
    const tags = Array.isArray(row.tags) ? row.tags : [];
    for (const tag of tags) {
      const key = String(tag).trim();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  for (const row of content.rows) {
    const keyword = text(row, "target_keyword", "");
    if (keyword) counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
  }
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const once = tags.filter(([, n]) => n === 1).length;
  const loading = faqs.loading || content.loading;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tags in use" value={loading ? "…" : String(tags.length)} icon={<TagIcon className="h-4 w-4" />} />
        <StatCard label="Used more than once" value={loading ? "…" : String(tags.length - once)} tone="success" />
        <StatCard label="Used once" value={loading ? "…" : String(once)} tone="warning" />
        <StatCard label="Records read" value={loading ? "…" : String(faqs.rows.length + content.rows.length)} tone="default" />
      </div>
      <Toolbar title="Tags" count={tags.length} />
      <Table
        head={["Tag", "Uses"]}
        rows={tags.map(([tag, uses]) => [
          <span key="n" className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent">#{tag}</span>,
          <span key="u" className="font-mono tabular">{uses}</span>,
        ])}
      />
      {loading && <div className="text-[11px] text-muted-foreground">Counting the tags in use…</div>}
      {!loading && tags.length === 0 && (
        <div className="rounded-xl border border-border bg-background/40 p-4 text-[12px] text-muted-foreground">
          Nothing carries a tag yet. Tags are read from the tags on questions and the target keyword on
          content; there is no separate tag table to score or merge.
        </div>
      )}
      <div className="text-[10px] leading-relaxed text-muted-foreground">
        Counted over {faqs.rows.length} questions and {content.rows.length} content items. No SEO score or
        trend is held against a tag, so neither is shown.
      </div>
    </div>
  );
}

/* =========================================================
   12) KEYWORD CENTER
   ========================================================= */
/**
 * Every keyword the platform tracks.
 *
 * Seven keywords were written into this file with invented volumes and a
 * "suggestion" column that suggested nothing. The table holds three and a half
 * thousand real ones, each with a position, the position before it, a volume,
 * a difficulty, a cost per click, a country and an industry.
 *
 * The columns are the ones the table actually holds. "Comp" and "Suggestion"
 * are gone because nothing records them: country and status stand where they
 * were, which is a smaller claim and a true one.
 */
function KeywordCenterModule() {
  const keywords = useResource("keywords", { limit: 200 });
  // A keyword that has never been measured is held at position 0, and 3,665 of
  // the 3,689 are. Asking for "position at most 3" would count every one of
  // them as a first-place ranking, so every counter here asks for a position
  // of at least one as well.
  const researched = useResource("keywords", { limit: 1, filters: ["position.gte.1"] });
  const top3 = useResource("keywords", { limit: 1, filters: ["position.gte.1", "position.lte.3"] });
  const top10 = useResource("keywords", { limit: 1, filters: ["position.gte.1", "position.lte.10"] });
  const planned = useResource("keywords", { limit: 1, filters: ["position.eq.0"] });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Keywords" value={figure(keywords.total, keywords)} icon={<Hash className="h-4 w-4" />} />
        <StatCard label="Measured" value={figure(researched.total, researched)} tone="premium" delta="has a position" />
        <StatCard label="Top 3" value={figure(top3.total, top3)} tone="premium" />
        <StatCard label="Top 10" value={figure(top10.total, top10)} tone="success" />
        <StatCard label="Planned, unmeasured" value={figure(planned.total, planned)} tone="warning" delta="position 0" />
      </div>
      <Toolbar title="Keywords" count={keywords.total} />
      <Table
        head={["Keyword", "Intent", "Volume", "Difficulty", "Country", "CPC", "Pos", "Δ", "Status"]}
        rows={keywords.rows.map((k) => {
          const difficulty = num(k, "difficulty");
          return [
            <span key="k" className="font-semibold">{text(k, "keyword")}</span>,
            <Chip key="t" tone={text(k, "intent") === "commercial" ? "accent" : text(k, "intent") === "transactional" ? "premium" : "default"}>{text(k, "intent")}</Chip>,
            <span key="v" className="font-mono tabular">{num(k, "search_volume").toLocaleString()}</span>,
            <div key="d" className="flex items-center gap-1.5 font-mono tabular">
              <div className="h-1 w-10 overflow-hidden rounded-full bg-background/60">
                <div className={`h-full ${difficulty > 60 ? "bg-destructive" : difficulty > 40 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.max(0, Math.min(100, difficulty))}%` }} />
              </div>
              {difficulty}
            </div>,
            <span key="c" className="text-[11px] text-muted-foreground">{text(k, "country")}</span>,
            <span key="cp" className="font-mono tabular">{k.cpc === null || k.cpc === undefined ? "—" : `$${num(k, "cpc").toFixed(2)}`}</span>,
            <span key="p" className="font-mono tabular text-accent">{text(k, "position")}</span>,
            <Delta key="dl" v={num(k, "previous_position") - num(k, "position")} />,
            <Chip key="s" tone={text(k, "status") === "tracking" ? "success" : text(k, "status") === "paused" ? "warning" : "default"}>{text(k, "status")}</Chip>,
          ];
        })}
      />
      {keywords.loading && <div className="text-[11px] text-muted-foreground">Reading the keyword table…</div>}
      {!keywords.loading && keywords.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {keywords.failed ? "Keywords could not be read." : "No keyword is tracked yet."}
        </div>
      )}
      {keywords.rows.length > 0 && (
        <div className="text-[10px] leading-relaxed text-muted-foreground">
          Showing the {keywords.rows.length} highest-volume of {figure(keywords.total, keywords)} keywords. The counters
          above are of every keyword, counted by the database rather than by this page. Most of the list is
          planned work rather than measured: a keyword with no position, volume or difficulty has not been
          researched yet, and shows zero rather than a guess.
        </div>
      )}
    </div>
  );
}

/**
 * Keywords grouped by the industry they were researched for.
 *
 * Six clusters were hardcoded with a page count, and one of the figures beneath
 * them was Math.random() - a different "average position" on every render. The
 * real grouping is the industry column, which this reads.
 */
function KeywordClusterModule() {
  const keywords = useResource("keywords", { limit: 200 });
  const clusters = groupBy(keywords.rows, "industry")
    .map((group) => ({
      name: group.key,
      count: group.rows.length,
      pages: new Set(group.rows.map((row) => text(row, "target_url"))).size,
      volume: sum(group.rows, "search_volume"),
      position: mean(group.rows, "position"),
      topTen: countWhere(group.rows, (row) => num(row, "position") > 0 && num(row, "position") <= 10),
      intents: [...new Set(group.rows.map((row) => text(row, "intent")))],
    }))
    .sort((a, b) => b.volume - a.volume);

  if (keywords.loading) return <div className="text-[11px] text-muted-foreground">Reading the keyword table…</div>;
  if (keywords.failed) return <div className="text-[11px] text-muted-foreground">Keywords could not be read.</div>;
  if (clusters.length === 0) return <div className="text-[11px] text-muted-foreground">No keyword is tracked yet.</div>;

  return (
    <div className="space-y-3">
      <div className="text-[10px] leading-relaxed text-muted-foreground">
        Grouped by industry over the {keywords.rows.length} highest-volume of {figure(keywords.total, keywords)} keywords,
        of which {countWhere(keywords.rows, (row) => num(row, "position") > 0)} have been measured. A cluster of
        planned keywords shows a volume of zero because nothing has researched them yet.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clusters.map((c) => (
          <Card key={c.name}>
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-bold">{c.name}</div>
              <Chip tone="accent">{c.count} kws</Chip>
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              Mapped to {c.pages} {c.pages === 1 ? "page" : "pages"}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {c.intents.map((t) => (<Chip key={t}>{t}</Chip>))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[11px]">
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Volume</div><div className="font-mono tabular">{c.volume.toLocaleString()}</div></div>
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg pos</div><div className="font-mono tabular">{c.position === null ? "—" : c.position.toFixed(1)}</div></div>
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Top 10</div><div className="font-mono tabular text-success">{c.topTen}</div></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   13) RANKING
   ========================================================= */
/**
 * What each tracked keyword actually did.
 *
 * Six rows were typed in here, with a device column, an engine column and a
 * sparkline whose seven points were the same seven numbers every time. The
 * platform records a position, a click count and an impression count for every
 * tracked keyword every day: ninety days across twenty-four keywords, two
 * thousand one hundred and sixty measurements, none of them read.
 *
 * Each row below is one keyword, folded from its daily records: the newest
 * position, the one before it, the clicks and impressions over the days that
 * were read, and a sparkline of the real positions. Device and engine are gone
 * because nothing records them.
 */
function RankingModule() {
  const rankings = useResource("seo_rankings", { limit: 200 });

  type Series = {
    keyword: string; url: string; country: string;
    current: number; previous: number | null;
    clicks: number; impressions: number; positions: number[]; days: number;
  };

  const byKeyword = new Map<string, Series>();
  // The resource returns newest first, so the first row seen for a keyword is
  // its current position and the second is the one before it.
  for (const row of rankings.rows) {
    const id = text(row, "keyword_id");
    const joined = (row.seo_keywords ?? null) as Record<string, unknown> | null;
    const existing = byKeyword.get(id);
    const position = num(row, "position");
    if (!existing) {
      byKeyword.set(id, {
        keyword: joined ? String(joined.keyword ?? id) : id,
        url: joined ? String(joined.target_url ?? "—") : "—",
        country: joined ? String(joined.country ?? "—") : "—",
        current: position,
        previous: null,
        clicks: num(row, "clicks"),
        impressions: num(row, "impressions"),
        positions: [position],
        days: 1,
      });
      continue;
    }
    if (existing.previous === null) existing.previous = position;
    existing.clicks += num(row, "clicks");
    existing.impressions += num(row, "impressions");
    existing.positions.push(position);
    existing.days += 1;
  }

  const rows = [...byKeyword.values()].sort((a, b) => a.current - b.current);
  const rising = rows.filter((r) => r.previous !== null && r.current < r.previous).length;
  const falling = rows.filter((r) => r.previous !== null && r.current > r.previous).length;
  const stable = rows.filter((r) => r.previous !== null && r.current === r.previous).length;
  const average = rows.length ? rows.reduce((total, r) => total + r.current, 0) / rows.length : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Avg Position" value={average === null ? (rankings.loading ? "…" : "—") : average.toFixed(1)} tone="success" icon={<Award className="h-4 w-4" />} />
        <StatCard label="Rising" value={rankings.loading ? "…" : String(rising)} tone="success" />
        <StatCard label="Falling" value={rankings.loading ? "…" : String(falling)} tone="destructive" />
        <StatCard label="Stable" value={rankings.loading ? "…" : String(stable)} tone="default" />
      </div>
      <Toolbar title="Google Ranking" count={rows.length} />
      <Table
        head={["Keyword", "Cur", "Prev", "Δ", "URL", "Country", "Clicks", "Impr.", "CTR", "Days", "Trend"]}
        rows={rows.map((r) => {
          const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null;
          const change = r.previous === null ? 0 : r.previous - r.current;
          return [
            <span key="k" className="font-semibold">{r.keyword}</span>,
            <span key="c" className="font-mono tabular text-accent">{r.current}</span>,
            <span key="p" className="font-mono tabular text-muted-foreground">{r.previous === null ? "—" : r.previous}</span>,
            <Delta key="d" v={change} />,
            <span key="u" className="font-mono text-[11px] text-muted-foreground">{r.url}</span>,
            <span key="co" className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{r.country}</span>,
            <span key="cl" className="font-mono tabular">{r.clicks.toLocaleString()}</span>,
            <span key="im" className="font-mono tabular text-muted-foreground">{r.impressions.toLocaleString()}</span>,
            <span key="ct" className="font-mono tabular text-accent">{ctr === null ? "—" : `${ctr.toFixed(2)}%`}</span>,
            <span key="dy" className="font-mono tabular text-muted-foreground">{r.days}</span>,
            <MiniSpark key="tr" data={[...r.positions].reverse()} tone={change >= 0 ? "success" : "destructive"} />,
          ];
        })}
      />
      {rankings.loading && <div className="text-[11px] text-muted-foreground">Reading the ranking table…</div>}
      {!rankings.loading && rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {rankings.failed ? "Rankings could not be read." : "No ranking has been recorded yet."}
        </div>
      )}
      {rows.length > 0 && (
        <div className="text-[10px] leading-relaxed text-muted-foreground">
          Folded from the {rankings.rows.length} most recent of {figure(rankings.total, rankings)} daily measurements,
          which is why a keyword shows the number of days it was found in them.
        </div>
      )}
    </div>
  );
}

/* =========================================================
   14) COMPETITOR
   ========================================================= */
function CompetitorModule() {
  const rivals = useResource("seo_competitors", { limit: 50 });
  const gaps = useResource("seo_competitor_gaps", { limit: 100 });

  const gapsFor = (id: string) => gaps.rows.filter((row) => text(row, "competitor_id") === id);

  return (
    <div className="space-y-4">
      <Toolbar title="Competitors" count={rivals.total} />
      {rivals.loading && <div className="text-[11px] text-muted-foreground">Reading the competitor table…</div>}
      {!rivals.loading && rivals.rows.length === 0 && (
        <div className="rounded-xl border border-border bg-background/40 p-4 text-[12px] text-muted-foreground">
          {rivals.failed ? "Competitors could not be read." : "No competitor is being tracked yet."}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {rivals.rows.map((r) => {
          const authority = num(r, "domain_authority");
          const theirs = gapsFor(String(r.id));
          return (
            <Card key={String(r.id)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 text-[13px] font-bold"><Globe2 className="h-4 w-4 text-accent" />{text(r, "domain")}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{text(r, "name")} · {text(r, "region")}</div>
                </div>
                <Chip tone={authority >= 80 ? "premium" : authority >= 60 ? "accent" : "default"}>DA {authority}</Chip>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-[11px]">
                <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Keywords</div><div className="font-mono tabular">{num(r, "keywords_count").toLocaleString()}</div></div>
                <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Traffic</div><div className="font-mono tabular text-success">{num(r, "traffic_estimate").toLocaleString()}</div></div>
                <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Backlinks</div><div className="font-mono tabular">{num(r, "backlinks_count").toLocaleString()}</div></div>
                <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Visibility</div><div className="font-mono tabular text-accent">{num(r, "visibility_score")}</div></div>
              </div>
              {theirs.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-2 text-[9px] uppercase tracking-wider text-muted-foreground">Keyword gaps ({theirs.length})</div>
                  <div className="space-y-1">
                    {theirs.slice(0, 4).map((gap) => (
                      <div key={String(gap.id)} className="flex items-center justify-between text-[11px]">
                        <span className="truncate pr-2">{text(gap, "keyword")}</span>
                        <span className="shrink-0 font-mono tabular text-muted-foreground">
                          them {text(gap, "their_position")} · us {text(gap, "our_position")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <Toolbar title="Keyword gaps" count={gaps.total} />
      <Table
        head={["Keyword", "Their position", "Our position", "Search volume", "Opportunity"]}
        rows={gaps.rows.map((g) => [
          <span key="k" className="font-semibold">{text(g, "keyword")}</span>,
          <span key="t" className="font-mono tabular text-destructive">{text(g, "their_position")}</span>,
          <span key="o" className="font-mono tabular text-accent">{text(g, "our_position")}</span>,
          <span key="v" className="font-mono tabular">{num(g, "search_volume").toLocaleString()}</span>,
          <Chip key="op" tone="premium">{text(g, "opportunity")}</Chip>,
        ])}
      />
    </div>
  );
}

function BacklinkModule() {
  const links = useResource("seo_backlinks", { limit: 200 });
  const domains = new Set(links.rows.map((row) => text(row, "source_domain"))).size;
  const authority = mean(links.rows, "domain_authority");
  const spam = mean(links.rows, "spam_score");
  const active = countWhere(links.rows, (row) => text(row, "status") === "active");
  const toxic = countWhere(links.rows, (row) => text(row, "status") === "toxic");
  const lost = countWhere(links.rows, (row) => text(row, "status") === "lost");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="Total Backlinks" value={figure(links.total, links)} icon={<LinkIcon className="h-4 w-4" />} />
        <StatCard label="Ref. Domains" value={figure(domains, links)} tone="success" />
        <StatCard label="Avg Authority" value={authority === null ? "—" : authority.toFixed(0)} tone="premium" />
        <StatCard label="Avg Spam Score" value={spam === null ? "—" : spam.toFixed(1)} tone={(spam ?? 0) > 20 ? "destructive" : "success"} />
        <StatCard label="Active" value={figure(active, links)} tone="success" />
        <StatCard label="Toxic / Lost" value={links.loading ? "…" : `${toxic} / ${lost}`} tone="destructive" />
      </div>
      <Toolbar title="Backlinks" count={links.total} />
      <Table
        head={["Domain", "DA", "Anchor", "Target URL", "Type", "Spam", "Status", "First seen", "Last checked"]}
        rows={links.rows.map((r) => {
          const da = num(r, "domain_authority");
          const status = text(r, "status");
          return [
            <span key="d" className="inline-flex items-center gap-2"><Globe2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-semibold">{text(r, "source_domain")}</span></span>,
            <span key="dr" className={`font-mono tabular ${da > 70 ? "text-success" : da > 30 ? "text-warning" : "text-destructive"}`}>{da}</span>,
            <span key="a" className="text-[11px]">{text(r, "anchor_text")}</span>,
            <span key="u" className="font-mono text-[11px] text-muted-foreground">{text(r, "target_url")}</span>,
            <Chip key="t" tone={text(r, "link_type") === "dofollow" ? "success" : "default"}>{text(r, "link_type")}</Chip>,
            <span key="sp" className="font-mono tabular text-muted-foreground">{text(r, "spam_score")}</span>,
            <Chip key="s" tone={status === "active" ? "success" : status === "lost" ? "warning" : "destructive"}>{status}</Chip>,
            <span key="f" className="font-mono text-[11px] text-muted-foreground">{text(r, "first_seen_at").slice(0, 10)}</span>,
            <span key="l" className="font-mono text-[11px] text-muted-foreground">{text(r, "last_checked_at").slice(0, 10)}</span>,
          ];
        })}
      />
      {links.loading && <div className="text-[11px] text-muted-foreground">Reading the backlink table…</div>}
      {!links.loading && links.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {links.failed ? "Backlinks could not be read." : "No backlink has been recorded yet."}
        </div>
      )}
    </div>
  );
}

/**
 * A screen with no table behind it, saying so.
 *
 * Internal and external linking both listed hand-written rows under invented
 * counters - 48,214 internal links, 6,204 external ones. There is no link
 * table on this platform and no crawl that would fill one. An empty grid would
 * read as "no links found", which is a different and equally untrue claim, so
 * the screen names what is missing and what would have to exist instead.
 */
function AbsentModule({
  title, Icon, what, needs,
}: { title: string; Icon: typeof Compass; what: string; needs: string }) {
  return (
    <div className="space-y-4">
      <Toolbar title={title} />
      <Card>
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-background/60 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold">Nothing records this yet</div>
            <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{what}</div>
            <div className="mt-3 rounded-lg border border-border bg-background/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider">What it would take</span>
              <div className="mt-1">{needs}</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InternalLinkModule() {
  return (
    <AbsentModule
      title="Internal Linking"
      Icon={Compass}
      what="This screen showed 48,214 internal links, 42 orphan pages and five example rows. None of it came from anywhere: the database holds no table of links between pages, and nothing crawls the site to build one."
      needs="A crawl that walks every page, records each link it finds with its source, target and anchor, and stores the result. Until that exists, any number here would be a guess."
    />
  );
}

function ExternalLinkModule() {
  return (
    <AbsentModule
      title="External Links"
      Icon={ExternalLink}
      what="This screen showed 6,204 outbound links and three example rows, one of them deliberately broken. The platform records no outbound link and checks none of them."
      needs="The same crawl as internal linking, plus a checker that follows each outbound target and keeps its response code, so that 'Broken' means a request that actually failed."
    />
  );
}

/* =========================================================
   16) IMAGE / VIDEO / FAQ SEO
   ========================================================= */
/**
 * The assets, videos and questions the platform actually holds.
 *
 * All three screens were tables of four or five invented filenames, with an
 * ALT column, a compression percentage and a "score" that no table records.
 * The real ones are the brand asset library, the video library and the FAQ
 * table, and the columns below are the columns those tables have. Where a
 * column named something nothing records - alt text against an image, a
 * transcript against a video - it is gone, and the panel says so.
 */
function ImageSeoModule() {
  const assets = useResource("media_library", { limit: 200 });
  const images = assets.rows.filter((row) => text(row, "mime_type", "").startsWith("image/") || text(row, "asset_type", "") === "image");
  const notWebp = images.filter((row) => !text(row, "mime_type", "").includes("webp")).length;
  const heavy = images.filter((row) => num(row, "size_bytes") > 300 * 1024).length;
  const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Assets" value={figure(assets.total, assets)} icon={<ImageIcon className="h-4 w-4" />} />
        <StatCard label="Images" value={assets.loading ? "…" : String(images.length)} tone="success" />
        <StatCard label="Not WebP" value={assets.loading ? "…" : String(notWebp)} tone="warning" />
        <StatCard label="Over 300 KB" value={assets.loading ? "…" : String(heavy)} tone={heavy > 0 ? "warning" : "success"} />
      </div>
      <Toolbar title="Image SEO" count={images.length} />
      <Table
        head={["File", "Type", "Dimensions", "Size", "Format", "Approved", "Active"]}
        rows={images.map((r) => [
          <span key="f" className="inline-flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md border border-border bg-gradient-to-br from-primary/30 to-accent/30"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /></div>
            <span className="font-mono text-[11px]">{text(r, "name")}</span>
          </span>,
          <Chip key="t">{text(r, "asset_type")}</Chip>,
          <span key="d" className="font-mono tabular">{num(r, "width") && num(r, "height") ? `${num(r, "width")}×${num(r, "height")}` : "—"}</span>,
          <span key="s" className="font-mono tabular">{num(r, "size_bytes") ? kb(num(r, "size_bytes")) : "—"}</span>,
          <span key="m" className="font-mono text-[11px] text-muted-foreground">{text(r, "mime_type")}</span>,
          <Chip key="ap" tone={r.approved ? "success" : "warning"}>{r.approved ? "yes" : "no"}</Chip>,
          <Chip key="ac" tone={r.active ? "success" : "default"}>{r.active ? "yes" : "no"}</Chip>,
        ])}
      />
      {assets.loading && <div className="text-[11px] text-muted-foreground">Reading the asset library…</div>}
      {!assets.loading && images.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {assets.failed ? "The asset library could not be read." : "No image is held in the asset library."}
        </div>
      )}
      <div className="text-[10px] leading-relaxed text-muted-foreground">
        No alt text, compression ratio or lazy-loading flag is recorded against an asset, so those columns are
        gone rather than filled in. Dimensions, size and format are what the library holds.
      </div>
    </div>
  );
}

function VideoSeoModule() {
  const videos = useResource("vala_tv_videos", { limit: 200 });
  const withSeo = countWhere(videos.rows, (row) => text(row, "seo_title", "") !== "");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Videos" value={figure(videos.total, videos)} icon={<Video className="h-4 w-4" />} />
        <StatCard label="With SEO title" value={videos.loading ? "…" : String(withSeo)} tone="success" />
        <StatCard label="Published" value={videos.loading ? "…" : String(countWhere(videos.rows, (r) => text(r, "status") === "published"))} tone="success" />
        <StatCard label="Featured" value={videos.loading ? "…" : String(countWhere(videos.rows, (r) => Boolean(r.featured)))} tone="premium" />
      </div>
      <Toolbar title="Video SEO" count={videos.total} />
      <Table
        head={["Video", "Thumb", "Duration", "SEO title", "SEO description", "Language", "Status"]}
        rows={videos.rows.map((r) => [
          <span key="f" className="font-semibold">{text(r, "title")}</span>,
          <div key="t" className="grid h-8 w-14 place-items-center overflow-hidden rounded-md border border-border bg-gradient-to-br from-primary/40 to-accent/30">
            {text(r, "thumbnail_url", "") ? <img src={text(r, "thumbnail_url")} alt="" className="h-full w-full object-cover" /> : <Play className="h-3.5 w-3.5 text-white/80" />}
          </div>,
          <span key="d" className="font-mono tabular">{text(r, "duration")}</span>,
          <span key="st" className="text-[11px]">{text(r, "seo_title")}</span>,
          <span key="sd" className="max-w-[220px] truncate text-[11px] text-muted-foreground">{text(r, "seo_description")}</span>,
          <Chip key="l">{text(r, "language")}</Chip>,
          <Chip key="s" tone={text(r, "status") === "published" ? "success" : "warning"}>{text(r, "status")}</Chip>,
        ])}
      />
      {videos.loading && <div className="text-[11px] text-muted-foreground">Reading the video library…</div>}
      {!videos.loading && videos.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {videos.failed ? "The video library could not be read." : "No video is published yet."}
        </div>
      )}
    </div>
  );
}

function FaqSeoModule() {
  const faqs = useResource("faqs", { limit: 200 });
  const withSeo = countWhere(faqs.rows, (row) => text(row, "seo_title", "") !== "");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Questions" value={figure(faqs.total, faqs)} icon={<HelpCircle className="h-4 w-4" />} />
        <StatCard label="With SEO title" value={faqs.loading ? "…" : String(withSeo)} tone="success" />
        <StatCard label="Published" value={faqs.loading ? "…" : String(countWhere(faqs.rows, (r) => text(r, "status") === "published"))} tone="success" />
        <StatCard label="AI drafted" value={faqs.loading ? "…" : String(countWhere(faqs.rows, (r) => Boolean(r.ai_generated)))} tone="premium" />
      </div>
      <Toolbar title="FAQ" count={faqs.total} />
      <Table
        head={["Question", "SEO title", "SEO description", "Language", "Status", "AI", "Published"]}
        rows={faqs.rows.map((r) => [
          <span key="q" className="max-w-[260px] truncate font-semibold">{text(r, "question")}</span>,
          <span key="t" className="max-w-[200px] truncate text-[11px]">{text(r, "seo_title")}</span>,
          <span key="d" className="max-w-[240px] truncate text-[11px] text-muted-foreground">{text(r, "seo_description")}</span>,
          <Chip key="l">{text(r, "language")}</Chip>,
          <Chip key="s" tone={text(r, "status") === "published" ? "success" : "warning"}>{text(r, "status")}</Chip>,
          <Chip key="a" tone={r.ai_generated ? "premium" : "default"}>{r.ai_generated ? "yes" : "no"}</Chip>,
          <span key="p" className="font-mono text-[11px] text-muted-foreground">{text(r, "published_at").slice(0, 10)}</span>,
        ])}
      />
      {faqs.loading && <div className="text-[11px] text-muted-foreground">Reading the FAQ table…</div>}
      {!faqs.loading && faqs.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {faqs.failed ? "FAQs could not be read." : "No question is recorded."}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   17) REDIRECT / CANONICAL
   ========================================================= */
/**
 * The addresses products actually answer on.
 *
 * Redirects listed four made-up rules with hit counts; canonicals listed four
 * URLs over a counter reading 12,847. The platform keeps one table of product
 * addresses - the slug, the path it serves, whether that address is the
 * canonical one and where it redirects if it does - and neither screen read
 * it. Both now do.
 */
function RedirectModule() {
  const urls = useResource("product_urls", { limit: 200 });
  const redirecting = urls.rows.filter((row) => text(row, "redirect_to", "") !== "");

  return (
    <div className="space-y-4">
      <Toolbar title="Redirects" count={redirecting.length} />
      <Table
        head={["From", "To", "Language", "Status", "Canonical", "Updated"]}
        rows={redirecting.map((r) => [
          <span key="f" className="font-mono text-[11px]">{text(r, "path")}</span>,
          <span key="t" className="font-mono text-[11px] text-accent">{text(r, "redirect_to")}</span>,
          <Chip key="l">{text(r, "language")}</Chip>,
          <Chip key="s" tone={text(r, "status") === "active" ? "success" : "warning"}>{text(r, "status")}</Chip>,
          <Chip key="c" tone={r.is_canonical ? "accent" : "default"}>{r.is_canonical ? "yes" : "no"}</Chip>,
          <span key="u" className="font-mono text-[11px] text-muted-foreground">{text(r, "updated_at").slice(0, 10)}</span>,
        ])}
      />
      {urls.loading && <div className="text-[11px] text-muted-foreground">Reading the URL table…</div>}
      {!urls.loading && redirecting.length === 0 && (
        <div className="rounded-xl border border-border bg-background/40 p-4 text-[12px] text-muted-foreground">
          {urls.failed
            ? "Product URLs could not be read."
            : `No redirect is set. ${figure(urls.total, urls)} product ${urls.total === 1 ? "address" : "addresses"} are recorded and every one of them serves its own page.`}
        </div>
      )}
    </div>
  );
}

function CanonicalModule() {
  const pages = useResource("seo_pages", { limit: 200 });
  const urls = useResource("product_urls", { limit: 200 });

  const rows = pages.rows.map((page) => {
    const url = text(page, "url");
    const canonical = text(page, "canonical_url", "");
    const kind = canonical === "" ? "Missing" : canonical === url ? "Self" : "Cross";
    return { url, canonical, kind };
  });
  const missing = rows.filter((r) => r.kind === "Missing").length;
  const cross = rows.filter((r) => r.kind === "Cross").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pages" value={figure(pages.total, pages)} icon={<LinkIcon className="h-4 w-4" />} />
        <StatCard label="Self-canonical" value={pages.loading ? "…" : String(rows.length - missing - cross)} tone="success" />
        <StatCard label="Cross-canonical" value={pages.loading ? "…" : String(cross)} tone="warning" />
        <StatCard label="No canonical" value={pages.loading ? "…" : String(missing)} tone={missing > 0 ? "destructive" : "success"} />
      </div>
      <Toolbar title="Canonicals" count={pages.total} />
      <Table
        head={["URL", "Canonical", "Type"]}
        rows={rows.map((r) => [
          <span key="u" className="font-mono text-[11px]">{r.url}</span>,
          <span key="c" className="font-mono text-[11px] text-accent">{r.canonical || "—"}</span>,
          <Chip key="s" tone={r.kind === "Self" ? "success" : r.kind === "Cross" ? "warning" : "destructive"}>{r.kind}</Chip>,
        ])}
      />
      {pages.loading && <div className="text-[11px] text-muted-foreground">Reading the page table…</div>}
      {!pages.loading && rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {pages.failed ? "Pages could not be read." : "No page has been crawled yet."}
        </div>
      )}
      <div className="text-[10px] leading-relaxed text-muted-foreground">
        Product pages resolve from the product's own slug; {figure(urls.total, urls)} product{" "}
        {urls.total === 1 ? "address is" : "addresses are"} recorded separately in the URL manager.
      </div>
    </div>
  );
}

/* =========================================================
   18) SITEMAP / ROBOTS
   ========================================================= */
/**
 * What the site actually serves.
 *
 * Six sitemaps were listed here with URL counts and an "updated 2h ago", and
 * the robots editor held a textarea of invented rules over a Save button that
 * saved nothing. /api/seo/console already fetches the sitemap this site serves
 * and counts its entries, and reads the served robots.txt and counts its
 * rules. Both screens now show that, and the file each one names can be opened.
 *
 * Nothing here writes. The sitemap is generated by the site and robots.txt is
 * served as a file, so a Save button would have been a lie; the screens say
 * where each is produced instead.
 */
type SeoConsole = {
  base?: string;
  sitemap?: { urls: number | null; parts: { url: string; urls: number }[]; note?: string };
  robots?: {
    agents: number; allow: number; disallow: number; sitemap: number; rules: number;
    protects_control_panel: boolean; protects_api: boolean;
  } | null;
};

function useSeoConsole() {
  const [data, setData] = useState<SeoConsole | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const headers = await authHeaders();
        const response = await fetch("/api/seo/console", { headers });
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as SeoConsole;
        if (!alive) return;
        setData(payload);
        setState("ready");
      } catch {
        if (alive) setState("failed");
      }
    })();
    return () => { alive = false; };
  }, []);
  return { data, state };
}

function SitemapModule() {
  const { data, state } = useSeoConsole();
  const base = data?.base ?? "";
  const parts = data?.sitemap?.parts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`${base}/sitemap.xml`} target="_blank" rel="noreferrer">
          <PillButton variant="primary"><span className="inline-flex items-center gap-1"><MapIcon className="h-3 w-3" /> Open sitemap.xml</span></PillButton>
        </a>
        <a href={`${base}/robots.txt`} target="_blank" rel="noreferrer">
          <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Open robots.txt</span></PillButton>
        </a>
      </div>
      <div className="rounded-xl border border-border bg-background/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
        {state === "loading"
          ? "Fetching the sitemap this site serves…"
          : state === "failed"
            ? "The sitemap could not be fetched."
            : `${(data?.sitemap?.urls ?? 0).toLocaleString()} URLs across ${parts.length} ${parts.length === 1 ? "sitemap" : "sitemaps"}, counted by fetching each one. The site generates these; there is nothing to regenerate from here.`}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parts.map((m) => {
          const name = m.url.split("/").pop() || m.url;
          return (
            <Card key={m.url}>
              <div className="flex items-start justify-between">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-accent"><MapIcon className="h-4 w-4" /></div>
                <Chip tone={m.urls > 0 ? "success" : "warning"}>{m.urls > 0 ? "OK" : "Empty"}</Chip>
              </div>
              <div className="mt-3 font-mono text-[12px] font-bold">{name}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{m.urls.toLocaleString()} URLs</div>
              <div className="mt-3">
                <a href={m.url} target="_blank" rel="noreferrer" className="block w-full rounded-md border border-border bg-background/60 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">
                  Open
                </a>
              </div>
            </Card>
          );
        })}
      </div>
      {state === "ready" && parts.length === 0 && (
        <div className="text-[11px] text-muted-foreground">The sitemap index names no child sitemaps.</div>
      )}
    </div>
  );
}

function RobotsModule() {
  const { data, state } = useSeoConsole();
  const [served, setServed] = useState<string | null>(null);
  const base = data?.base ?? "";
  const rules = data?.robots ?? null;

  useEffect(() => {
    if (!base) return;
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`${base}/robots.txt`);
        const body = await response.text();
        if (alive) setServed(response.ok ? body : null);
      } catch {
        if (alive) setServed(null);
      }
    })();
    return () => { alive = false; };
  }, [base]);

  const checks = rules
    ? [
        { l: "Served and readable", ok: true },
        { l: "Sitemap declared", ok: rules.sitemap > 0 },
        { l: "Not disallowing the whole site", ok: rules.disallow === 0 || rules.rules > rules.disallow },
        { l: "Control panel kept out of the index", ok: rules.protects_control_panel },
        { l: "API kept out of the index", ok: rules.protects_api },
        { l: `${rules.agents} user-agent ${rules.agents === 1 ? "block" : "blocks"}`, ok: rules.agents > 0 },
      ]
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">robots.txt · as served</div>
          <a href={`${base}/robots.txt`} target="_blank" rel="noreferrer">
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Open</span></PillButton>
          </a>
        </div>
        <pre className="h-72 w-full overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[12px] leading-relaxed">
          {served ?? (state === "loading" ? "Fetching the served file…" : "The file could not be fetched.")}
        </pre>
        <div className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          This is the file a crawler receives, fetched from the site. It is served as a static file, so it is
          shown here rather than edited: an editor over it would save nothing.
        </div>
      </Card>
      <Card>
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Validation</div>
        <div className="space-y-2 text-[12px]">
          {checks.map((c) => (
            <div key={c.l} className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5">
              {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
              {c.l}
            </div>
          ))}
          {checks.length === 0 && (
            <div className="text-[11px] text-muted-foreground">
              {state === "loading" ? "Reading the served file…" : "robots.txt could not be read, so nothing can be checked."}
            </div>
          )}
        </div>
        {rules && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px]">
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Rules</div><div className="font-mono tabular">{rules.rules}</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Allow</div><div className="font-mono tabular text-success">{rules.allow}</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Disallow</div><div className="font-mono tabular text-warning">{rules.disallow}</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Sitemaps</div><div className="font-mono tabular text-accent">{rules.sitemap}</div></div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* =========================================================
   19) LOCAL / INTERNATIONAL
   ========================================================= */
function LocalSeoModule() {
  return (
    <AbsentModule
      title="Local SEO"
      Icon={Building2}
      what="This screen showed a Google Business Profile - a company name, an address, a phone number, opening hours and 1,284 reviews at 4.8 stars - and four verified office locations. None of it is held anywhere on this platform; every line was written into the file."
      needs="A record of the business locations, and a connection to the Google Business Profile API for the profile and its reviews. The Integrations screen shows which connections exist; this is not one of them."
    />
  );
}

/**
 * The regions the platform researches keywords for.
 *
 * Six locales were listed with page counts of 12,847 and 4,820 and a hreflang
 * status. This platform serves one set of pages and records no hreflang. What
 * it does hold is the regions its keyword research covers, with how many
 * keywords each one has and how they are growing, which is what this shows.
 */
function IntlSeoModule() {
  const regions = useResource("seo_regions", { limit: 100 });
  const keywords = useResource("keywords", { limit: 200 });
  const byCountry = groupBy(keywords.rows, "country").sort((a, b) => b.rows.length - a.rows.length);

  return (
    <div className="space-y-4">
      <Toolbar title="Regions" count={regions.total} />
      <Table
        head={["Region", "Code", "Group", "Keywords", "Traffic share", "Growth"]}
        rows={regions.rows.map((r) => [
          <span key="n" className="inline-flex items-center gap-2 font-semibold">{text(r, "flag", "")} {text(r, "name")}</span>,
          <Chip key="c" tone="accent">{text(r, "code")}</Chip>,
          <span key="g" className="text-[11px] text-muted-foreground">{text(r, "region_group")}</span>,
          <span key="k" className="font-mono tabular">{num(r, "keywords_count").toLocaleString()}</span>,
          <span key="t" className="font-mono tabular">{num(r, "traffic_share")}%</span>,
          <span key="p" className={`font-mono tabular ${num(r, "growth_pct") >= 0 ? "text-success" : "text-destructive"}`}>
            {num(r, "growth_pct") >= 0 ? "+" : ""}{num(r, "growth_pct")}%
          </span>,
        ])}
      />
      {regions.loading && <div className="text-[11px] text-muted-foreground">Reading the region table…</div>}
      {!regions.loading && regions.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {regions.failed ? "Regions could not be read." : "No region is recorded."}
        </div>
      )}

      <Toolbar title="Countries keywords are researched for" count={byCountry.length} />
      <div className="flex flex-wrap gap-1.5">
        {byCountry.map((group) => (
          <Chip key={group.key} tone="default">{group.key} · {group.rows.length}</Chip>
        ))}
      </div>
      {byCountry.length > 0 && (
        <div className="text-[10px] leading-relaxed text-muted-foreground">
          Counted over the {keywords.rows.length} highest-volume of {figure(keywords.total, keywords)} keywords.
          The platform records no hreflang and serves one set of pages, so there is no per-locale canonical to show.
        </div>
      )}
    </div>
  );
}

/* =========================================================
   20) BLOG CENTER + AI WRITER
   ========================================================= */
/**
 * The content the platform holds, under the tabs it was designed with.
 *
 * Five posts were written into this file with authors, view counts and read
 * times, above counters reading 284 blogs and 482K views. The content table
 * holds seven items with a type, a target keyword, a word count, an SEO score,
 * a status, the model that drafted it where one did, and when it went out.
 * Views and read time are not recorded, so those columns are gone.
 */
function BlogCenterModule() {
  const posts = useResource("blog", { limit: 200 });
  const [tab, setTab] = useState("All");
  const statuses = [...new Set(posts.rows.map((row) => text(row, "status")))];
  const blogTabs = ["All", ...statuses];
  const shown = tab === "All" ? posts.rows : posts.rows.filter((row) => text(row, "status") === tab);
  const score = mean(posts.rows, "seo_score");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Content items" value={figure(posts.total, posts)} icon={<Rss className="h-4 w-4" />} />
        <StatCard label="Published" value={posts.loading ? "…" : String(countWhere(posts.rows, (r) => text(r, "status") === "published"))} tone="success" />
        <StatCard label="Draft" value={posts.loading ? "…" : String(countWhere(posts.rows, (r) => text(r, "status") === "draft"))} tone="warning" />
        <StatCard label="Avg SEO Score" value={score === null ? (posts.loading ? "…" : "—") : score.toFixed(0)} tone="premium" />
      </div>
      <div data-skip-drawer><SubNav items={blogTabs} active={tab} onChange={setTab} /></div>
      <Toolbar title="Content" count={shown.length} />
      <Table
        head={["Title", "Type", "Target keyword", "Words", "SEO Score", "Model", "Status", "Published"]}
        rows={shown.map((b) => [
          <span key="t" className="max-w-[260px] truncate font-semibold">{text(b, "title")}</span>,
          <Chip key="c">{text(b, "content_type")}</Chip>,
          <span key="k" className="text-[11px]">{text(b, "target_keyword")}</span>,
          <span key="w" className="font-mono tabular">{num(b, "word_count").toLocaleString()}</span>,
          <ScoreRing key="s" value={num(b, "seo_score")} size={28} />,
          text(b, "model", "") !== ""
            ? <Chip key="m" tone="premium"><Sparkles className="h-3 w-3" />{text(b, "model")}</Chip>
            : <span key="m" className="text-muted-foreground">—</span>,
          <Chip key="st" tone={text(b, "status") === "published" ? "success" : text(b, "status") === "draft" ? "default" : "warning"}>{text(b, "status")}</Chip>,
          <span key="p" className="font-mono text-[11px] text-muted-foreground">{text(b, "published_at").slice(0, 10)}</span>,
        ])}
      />
      {posts.loading && <div className="text-[11px] text-muted-foreground">Reading the content table…</div>}
      {!posts.loading && shown.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {posts.failed ? "Content could not be read." : "No content item matches this tab."}
        </div>
      )}
    </div>
  );
}

/**
 * What the AI has actually produced, and what it is suggesting.
 *
 * The writer screen offered sixteen "Generate" cards and a prompt box over a
 * Generate button, none of which was wired to a model; the keyword screen
 * listed five researched keywords that no research produced. There is no
 * generation endpoint on this platform, so a Generate button here could only
 * ever have done nothing.
 *
 * What is recorded is the output that exists - content items and reels, each
 * naming the model that drafted it - and eight suggestions with an impact, a
 * confidence and whether they were accepted. Those are shown, and the screen
 * says plainly that generating from here is not built.
 */
function AiWriterModule() {
  const suggestions = useResource("seo_ai_suggestions", { limit: 100 });
  const content = useResource("blog", { limit: 200 });
  const reels = useResource("seo_reels", { limit: 50 });
  const drafted = content.rows.filter((row) => text(row, "model", "") !== "");

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[var(--shadow-glow)]"><Wand2 className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">AI Content</div>
            <div className="text-sm font-bold">What has been drafted, and what is being suggested.</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              There is no generation endpoint on this platform yet, so nothing is generated from this screen.
              The rows below are the output and the suggestions that are already recorded.
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Suggestions" value={figure(suggestions.total, suggestions)} icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Accepted" value={suggestions.loading ? "…" : String(countWhere(suggestions.rows, (r) => text(r, "status") === "accepted"))} tone="success" />
        <StatCard label="AI-drafted content" value={content.loading ? "…" : String(drafted.length)} tone="premium" />
        <StatCard label="Reels" value={figure(reels.total, reels)} tone="default" />
      </div>

      <Toolbar title="Suggestions" count={suggestions.total} />
      <Table
        head={["Suggestion", "Target", "Impact", "Confidence", "Model", "Status"]}
        rows={suggestions.rows.map((r) => [
          <div key="s" className="max-w-[320px]">
            <div className="truncate font-semibold">{text(r, "title")}</div>
            <div className="truncate text-[11px] text-muted-foreground">{text(r, "suggestion")}</div>
          </div>,
          <span key="t" className="text-[11px]">{text(r, "target_type")} · {text(r, "target_ref")}</span>,
          <Chip key="i" tone={text(r, "impact") === "high" ? "premium" : "default"}>{text(r, "impact")}</Chip>,
          <span key="c" className="font-mono tabular">{num(r, "confidence")}</span>,
          <Chip key="m" tone="accent">{text(r, "model")}</Chip>,
          <Chip key="st" tone={text(r, "status") === "accepted" ? "success" : text(r, "status") === "rejected" ? "destructive" : "warning"}>{text(r, "status")}</Chip>,
        ])}
      />
      {suggestions.loading && <div className="text-[11px] text-muted-foreground">Reading the suggestions…</div>}
      {!suggestions.loading && suggestions.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {suggestions.failed ? "Suggestions could not be read." : "No suggestion has been recorded."}
        </div>
      )}

      <Toolbar title="Reels" count={reels.total} />
      <Table
        head={["Title", "Platform", "Duration", "Views", "Model", "Status"]}
        rows={reels.rows.map((r) => [
          <span key="t" className="font-semibold">{text(r, "title")}</span>,
          <Chip key="p" tone="accent">{text(r, "platform")}</Chip>,
          <span key="d" className="font-mono tabular">{num(r, "duration_seconds")}s</span>,
          <span key="v" className="font-mono tabular">{num(r, "views").toLocaleString()}</span>,
          <Chip key="m">{text(r, "model")}</Chip>,
          <Chip key="s" tone={text(r, "status") === "published" ? "success" : "warning"}>{text(r, "status")}</Chip>,
        ])}
      />
      {!reels.loading && reels.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {reels.failed ? "Reels could not be read." : "No reel has been produced."}
        </div>
      )}
    </div>
  );
}

function AiKeywordModule() {
  const suggestions = useResource("seo_ai_suggestions", { limit: 100 });
  const planned = useResource("keywords", { limit: 200, filters: ["status.eq.planned"] });
  const forKeywords = suggestions.rows.filter((row) => /keyword/i.test(text(row, "target_type")));

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">AI Keyword</div>
        <div className="mt-1 text-[12px] text-muted-foreground">
          Research is not run from this screen: nothing here calls a keyword API, and a Research button that
          returned invented rows is what this replaced. Below are the keyword suggestions that have been
          recorded, and the keywords already planned but not yet tracked.
        </div>
      </Card>
      <Toolbar title="Keyword suggestions" count={forKeywords.length} />
      <Table
        head={["Suggestion", "Target", "Impact", "Confidence", "Status"]}
        rows={forKeywords.map((r) => [
          <span key="s" className="max-w-[320px] truncate font-semibold">{text(r, "title")}</span>,
          <span key="t" className="text-[11px]">{text(r, "target_ref")}</span>,
          <Chip key="i" tone={text(r, "impact") === "high" ? "premium" : "default"}>{text(r, "impact")}</Chip>,
          <span key="c" className="font-mono tabular">{num(r, "confidence")}</span>,
          <Chip key="st" tone={text(r, "status") === "accepted" ? "success" : "warning"}>{text(r, "status")}</Chip>,
        ])}
      />
      {!suggestions.loading && forKeywords.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {suggestions.failed ? "Suggestions could not be read." : "No keyword suggestion has been recorded."}
        </div>
      )}
      <Toolbar title="Planned, not yet tracked" count={planned.total} />
      <Table
        head={["Keyword", "Volume", "Difficulty", "Intent", "Country"]}
        rows={planned.rows.slice(0, 50).map((r) => [
          <span key="k" className="font-semibold">{text(r, "keyword")}</span>,
          <span key="v" className="font-mono tabular">{num(r, "search_volume").toLocaleString()}</span>,
          <span key="d" className="font-mono tabular">{num(r, "difficulty")}</span>,
          <Chip key="i" tone="accent">{text(r, "intent")}</Chip>,
          <span key="c" className="text-[11px] text-muted-foreground">{text(r, "country")}</span>,
        ])}
      />
      {planned.loading && <div className="text-[11px] text-muted-foreground">Reading the keyword table…</div>}
    </div>
  );
}

/* =========================================================
   21) GOOGLE / OTHER TOOLS
   ========================================================= */
/**
 * The integrations that exist, with the state they are really in.
 *
 * Twenty-one tool cards were listed across these two screens and nineteen of
 * them said "Connected". The integrations table holds eight rows and seven of
 * them are disconnected. Saying a tool is connected when it is not is the kind
 * of claim that gets believed until someone needs the data, so these read the
 * table.
 */
function ToolGrid({ items, state }: {
  items: ResourceRow[];
  state: { loading: boolean; failed: boolean };
}) {
  if (state.loading) return <div className="text-[11px] text-muted-foreground">Reading the integrations table…</div>;
  if (state.failed) return <div className="text-[11px] text-muted-foreground">Integrations could not be read.</div>;
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background/40 p-4 text-[12px] text-muted-foreground">
        No integration of this kind is recorded.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((t) => {
        const status = text(t, "status");
        return (
          <Card key={String(t.id)}>
            <div className="flex items-start justify-between">
              <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-accent"><Globe2 className="h-4 w-4" /></div>
              <Chip tone={status === "connected" ? "success" : status === "pending" ? "warning" : "destructive"}>{status}</Chip>
            </div>
            <div className="mt-3 text-sm font-bold">{text(t, "display_name")}</div>
            <div className="text-[11px] text-muted-foreground">{text(t, "category")} · {text(t, "provider")}</div>
            <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              {text(t, "last_sync_at", "") ? `Last sync ${text(t, "last_sync_at").slice(0, 10)}` : "Never synced"}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function GoogleToolsModule() {
  const integrations = useResource("seo_integrations", { limit: 100 });
  const google = integrations.rows.filter((row) =>
    /google|gsc|ga4|search console|analytics|tag manager|merchant|pagespeed/i.test(
      `${text(row, "provider")} ${text(row, "display_name")}`,
    ));
  return <ToolGrid items={google} state={integrations} />;
}

function OtherToolsModule() {
  const integrations = useResource("seo_integrations", { limit: 100 });
  const others = integrations.rows.filter((row) =>
    !/google|gsc|ga4|search console|analytics|tag manager|merchant|pagespeed/i.test(
      `${text(row, "provider")} ${text(row, "display_name")}`,
    ));
  return <ToolGrid items={others} state={integrations} />;
}

/* =========================================================
   22) BULK OPS
   ========================================================= */
/**
 * The jobs this platform really runs, and what they did.
 *
 * Eleven bulk operations were offered here - bulk delete, bulk redirect, bulk
 * import - over a "1,284 items selected" that nothing had selected, above
 * three recent jobs with progress bars set to fixed widths. None of the eleven
 * existed and none of the three had run.
 *
 * The platform does run scheduled work: seven automations, and fifty-six runs
 * of them with an item count, a status and a message each. That is what this
 * shows. Nothing here starts a job, because nothing here ever could.
 */
function BulkOpsModule() {
  const automations = useResource("seo_automations", { limit: 50 });
  const runs = useResource("seo_automation_runs", { limit: 100 });

  const runsFor = (id: string) => runs.rows.filter((row) => text(row, "automation_id") === id);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Automations" value={figure(automations.total, automations)} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Active" value={automations.loading ? "…" : String(countWhere(automations.rows, (r) => text(r, "status") === "active"))} tone="success" />
        <StatCard label="Paused" value={automations.loading ? "…" : String(countWhere(automations.rows, (r) => text(r, "status") === "paused"))} tone="warning" />
        <StatCard label="Runs recorded" value={figure(runs.total, runs)} tone="premium" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {automations.rows.map((o) => {
          const status = text(o, "status");
          const mine = runsFor(String(o.id));
          return (
            <Card key={String(o.id)}>
              <div className="flex items-start justify-between">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-accent"><Zap className="h-4 w-4" /></div>
                <Chip tone={status === "active" ? "success" : "warning"}>{status}</Chip>
              </div>
              <div className="mt-3 text-sm font-bold">{text(o, "name")}</div>
              <div className="text-[11px] text-muted-foreground">{text(o, "description")}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px]">
                <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Schedule</div><div className="font-mono">{text(o, "schedule")}</div></div>
                <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Runs</div><div className="font-mono tabular">{num(o, "runs_count")}</div></div>
                <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Last run</div><div className="font-mono">{text(o, "last_run_at").slice(0, 10)}</div></div>
                <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Next run</div><div className="font-mono">{text(o, "next_run_at").slice(0, 10)}</div></div>
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                {num(o, "success_rate")}% succeeded · {mine.length} {mine.length === 1 ? "run" : "runs"} in the log below
              </div>
            </Card>
          );
        })}
      </div>
      {automations.loading && <div className="text-[11px] text-muted-foreground">Reading the automation table…</div>}
      {!automations.loading && automations.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {automations.failed ? "Automations could not be read." : "No automation is configured."}
        </div>
      )}
      <Card>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Recent runs</div>
        <Table
          head={["Started", "Finished", "Status", "Items processed", "Message"]}
          rows={runs.rows.map((r) => [
            <span key="s" className="font-mono text-[11px]">{text(r, "started_at").slice(0, 16).replace("T", " ")}</span>,
            <span key="f" className="font-mono text-[11px] text-muted-foreground">{text(r, "finished_at").slice(0, 16).replace("T", " ")}</span>,
            <Chip key="st" tone={text(r, "status") === "success" ? "success" : text(r, "status") === "failed" ? "destructive" : "warning"}>{text(r, "status")}</Chip>,
            <span key="i" className="font-mono tabular">{num(r, "items_processed").toLocaleString()}</span>,
            <span key="m" className="max-w-[320px] truncate text-[11px] text-muted-foreground">{text(r, "message")}</span>,
          ])}
        />
        {runs.loading && <div className="mt-2 text-[11px] text-muted-foreground">Reading the run log…</div>}
        {!runs.loading && runs.rows.length === 0 && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            {runs.failed ? "The run log could not be read." : "No automation has run yet."}
          </div>
        )}
      </Card>
    </div>
  );
}

/* =========================================================
   23) SETTINGS
   ========================================================= */
/**
 * What is switched on, what has gone wrong, and what has been done.
 *
 * Twenty-five toggles stood here - crawl rate, auto ALT tags, GDPR, an OpenAI
 * key - every one of them switched on by default and wired to nothing. None
 * of the twenty-five is a setting this platform holds.
 *
 * What it does hold is the state of its integrations, the alerts it has
 * raised, and eight thousand rows of activity recording every change made to
 * an SEO table, by whom and when. Nothing had ever read that log. This does.
 */
function SettingsModule() {
  const integrations = useResource("seo_integrations", { limit: 100 });
  const alerts = useResource("seo_alerts", { limit: 50 });
  const activity = useResource("seo_activity", { limit: 100 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Integrations" value={figure(integrations.total, integrations)} icon={<Settings className="h-4 w-4" />} />
        <StatCard label="Connected" value={integrations.loading ? "…" : String(countWhere(integrations.rows, (r) => text(r, "status") === "connected"))} tone="success" />
        <StatCard label="Open alerts" value={alerts.loading ? "…" : String(countWhere(alerts.rows, (r) => !r.acknowledged))} tone="warning" />
        <StatCard label="Recorded changes" value={figure(activity.total, activity)} tone="premium" icon={<ClipboardList className="h-4 w-4" />} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Integrations</div>
          <div className="space-y-2">
            {integrations.rows.map((it) => {
              const status = text(it, "status");
              return (
                <div key={String(it.id)} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px]">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{text(it, "display_name")}</div>
                    <div className="text-[10px] text-muted-foreground">{text(it, "category")}</div>
                  </div>
                  <Chip tone={status === "connected" ? "success" : "destructive"}>{status}</Chip>
                </div>
              );
            })}
            {!integrations.loading && integrations.rows.length === 0 && (
              <div className="text-[11px] text-muted-foreground">
                {integrations.failed ? "Integrations could not be read." : "No integration is recorded."}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Alerts</div>
          <div className="space-y-2">
            {alerts.rows.map((a) => {
              const severity = text(a, "severity");
              return (
                <div key={String(a.id)} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[12px] font-semibold">{text(a, "title")}</div>
                    <Chip tone={severity === "critical" || severity === "high" ? "destructive" : severity === "medium" ? "warning" : "default"}>{severity}</Chip>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{text(a, "message")}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {text(a, "category")} · {a.acknowledged ? "acknowledged" : "open"} · {text(a, "created_at").slice(0, 10)}
                  </div>
                </div>
              );
            })}
            {!alerts.loading && alerts.rows.length === 0 && (
              <div className="text-[11px] text-muted-foreground">
                {alerts.failed ? "Alerts could not be read." : "No alert has been raised."}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Toolbar title="Activity" count={activity.total} />
      <Table
        head={["When", "Table", "Action", "Actor", "Record"]}
        rows={activity.rows.map((a) => [
          <span key="w" className="font-mono text-[11px]">{text(a, "occurred_at").slice(0, 16).replace("T", " ")}</span>,
          <Chip key="t" tone="accent">{text(a, "table_name")}</Chip>,
          <Chip key="a" tone={text(a, "action") === "DELETE" ? "destructive" : text(a, "action") === "INSERT" ? "success" : "warning"}>{text(a, "action")}</Chip>,
          <span key="ac" className="text-[11px]">{text(a, "actor")}</span>,
          <span key="r" className="font-mono text-[10px] text-muted-foreground">{text(a, "record_id").slice(0, 8)}</span>,
        ])}
      />
      {activity.loading && <div className="text-[11px] text-muted-foreground">Reading the activity log…</div>}
      {!activity.loading && activity.rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          {activity.failed ? "The activity log could not be read." : "Nothing has been recorded."}
        </div>
      )}
      {activity.rows.length > 0 && (
        <div className="text-[10px] leading-relaxed text-muted-foreground">
          The {activity.rows.length} most recent of {figure(activity.total, activity)} recorded changes. Every
          insert, update and delete against an SEO table is written here by the database itself.
        </div>
      )}
    </div>
  );
}

