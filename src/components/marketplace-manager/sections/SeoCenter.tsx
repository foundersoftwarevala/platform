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
            <button className="text-[10px] font-bold uppercase tracking-wider text-accent">Restore</button>
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
              <button className="rounded-full border border-border bg-background/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-accent">Save draft</button>
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
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/40 p-2">
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
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border transition-colors hover:bg-white/[0.03]">
                {row.map((c, j) => (
                  <td key={j} className="whitespace-nowrap px-3 py-2 align-middle">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
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
      <button className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:border-accent/40 hover:text-accent" title="View"><Eye className="h-3 w-3" /></button>
      <button className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:border-accent/40 hover:text-accent" title="Edit"><Edit3 className="h-3 w-3" /></button>
      <button className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:border-warning/40 hover:text-warning" title="More"><MoreHorizontal className="h-3 w-3" /></button>
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
const DASH_STATS = [
  { label: "SEO Score", value: "87", tone: "success" as const, delta: "+3", icon: <Gauge className="h-4 w-4" /> },
  { label: "Google Index", value: "Live", tone: "success" as const, delta: "Verified", icon: <ShieldCheck className="h-4 w-4" /> },
  { label: "Indexed Pages", value: "12,847", tone: "success" as const, delta: "+284", icon: <FileText className="h-4 w-4" /> },
  { label: "Non Indexed", value: "342", tone: "warning" as const, delta: "-18", icon: <EyeOff className="h-4 w-4" /> },
  { label: "Crawled", value: "13,189", tone: "default" as const, delta: "24h", icon: <ScanLine className="h-4 w-4" /> },
  { label: "Broken Pages", value: "12", tone: "destructive" as const, delta: "+2", icon: <AlertTriangle className="h-4 w-4" /> },
  { label: "Pending", value: "58", tone: "warning" as const, delta: "Queue", icon: <Clock className="h-4 w-4" /> },
  { label: "Meta Missing", value: "24", tone: "warning" as const, delta: "-6", icon: <FileText className="h-4 w-4" /> },
  { label: "Schema Missing", value: "41", tone: "warning" as const, delta: "-11", icon: <FileCode2 className="h-4 w-4" /> },
  { label: "Pages w/o H1", value: "9", tone: "warning" as const, delta: "-3", icon: <TagIcon className="h-4 w-4" /> },
  { label: "Pages w/o Desc", value: "17", tone: "warning" as const, delta: "-4", icon: <FileText className="h-4 w-4" /> },
  { label: "Duplicate Title", value: "6", tone: "destructive" as const, delta: "-1", icon: <Copy className="h-4 w-4" /> },
  { label: "Duplicate Meta", value: "11", tone: "destructive" as const, delta: "-2", icon: <Copy className="h-4 w-4" /> },
  { label: "Image w/o ALT", value: "218", tone: "warning" as const, delta: "-42", icon: <ImageIcon className="h-4 w-4" /> },
  { label: "Broken Images", value: "5", tone: "destructive" as const, delta: "0", icon: <ImageIcon className="h-4 w-4" /> },
  { label: "Broken Links", value: "23", tone: "destructive" as const, delta: "-4", icon: <LinkIcon className="h-4 w-4" /> },
  { label: "Internal Links", value: "48,214", tone: "default" as const, delta: "+912", icon: <Compass className="h-4 w-4" /> },
  { label: "External Links", value: "6,204", tone: "default" as const, delta: "+128", icon: <ExternalLink className="h-4 w-4" /> },
  { label: "Redirect Issues", value: "8", tone: "warning" as const, delta: "-2", icon: <ArrowRight className="h-4 w-4" /> },
  { label: "Canonical Issues", value: "4", tone: "warning" as const, delta: "-1", icon: <LinkIcon className="h-4 w-4" /> },
  { label: "Sitemap", value: "OK", tone: "success" as const, delta: "12,847 urls", icon: <MapIcon className="h-4 w-4" /> },
  { label: "Robots.txt", value: "OK", tone: "success" as const, delta: "Valid", icon: <ShieldCheck className="h-4 w-4" /> },
  { label: "Core Web Vitals", value: "92", tone: "success" as const, delta: "+4", icon: <Zap className="h-4 w-4" /> },
  { label: "Performance", value: "94", tone: "success" as const, delta: "+2", icon: <Gauge className="h-4 w-4" /> },
  { label: "Accessibility", value: "96", tone: "success" as const, delta: "+1", icon: <Users2 className="h-4 w-4" /> },
  { label: "Best Practices", value: "98", tone: "success" as const, delta: "0", icon: <Award className="h-4 w-4" /> },
  { label: "SEO Health", value: "91%", tone: "success" as const, delta: "+3%", icon: <Activity className="h-4 w-4" /> },
  { label: "AI SEO Score", value: "88", tone: "premium" as const, delta: "+5", icon: <Sparkles className="h-4 w-4" /> },
  { label: "Ranking Score", value: "82", tone: "success" as const, delta: "+6", icon: <TrendingUp className="h-4 w-4" /> },
  { label: "Traffic Score", value: "79", tone: "success" as const, delta: "+9", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "CTR", value: "4.8%", tone: "success" as const, delta: "+0.4%", icon: <Target className="h-4 w-4" /> },
  { label: "Avg Position", value: "12.4", tone: "success" as const, delta: "-1.2", icon: <Award className="h-4 w-4" /> },
  { label: "Organic Clicks", value: "184K", tone: "success" as const, delta: "+12%", icon: <ArrowUpRight className="h-4 w-4" /> },
  { label: "Impressions", value: "3.82M", tone: "premium" as const, delta: "+18%", icon: <Eye className="h-4 w-4" /> },
];

function DashboardModule() {
  return (
    <div className="space-y-6">
      {/* Mega stat wall */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {DASH_STATS.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} tone={s.tone} delta={s.delta} icon={s.icon} />
        ))}
      </div>

      {/* Health rings + chart */}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Organic performance · 30 days</div>
              <div className="mt-0.5 text-sm font-bold">Clicks vs Impressions</div>
            </div>
            <div className="flex gap-1">
              {["7d", "30d", "90d", "1y"].map((r, i) => (
                <button key={r} className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${i === 1 ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted-foreground"}`}>{r}</button>
              ))}
            </div>
          </div>
          <FakeAreaChart />
          <div className="mt-3 grid grid-cols-4 gap-3 border-t border-border pt-3 text-[11px]">
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Clicks</div><div className="font-mono text-lg font-bold tabular text-accent">184,204</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Impressions</div><div className="font-mono text-lg font-bold tabular text-premium">3.82M</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">CTR</div><div className="font-mono text-lg font-bold tabular text-success">4.8%</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Position</div><div className="font-mono text-lg font-bold tabular">12.4</div></div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Site health · Lighthouse</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: "Performance", v: 94 }, { l: "Accessibility", v: 96 },
              { l: "Best Practices", v: 98 }, { l: "SEO", v: 87 },
            ].map((r) => (
              <div key={r.l} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
                <ScoreRing value={r.v} />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.l}</div>
                  <div className="text-xs font-semibold text-foreground">{r.v >= 90 ? "Excellent" : r.v >= 60 ? "Good" : "Needs work"}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[11px]">
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">LCP</div><div className="font-mono tabular text-success">1.8s</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">CLS</div><div className="font-mono tabular text-success">0.03</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">INP</div><div className="font-mono tabular text-warning">210ms</div></div>
          </div>
        </Card>
      </div>

      {/* Top pages + Top keywords */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Top ranking pages</div>
            <button className="text-[10px] font-bold uppercase tracking-wider text-accent">View all</button>
          </div>
          <Table
            head={["URL", "Clicks", "Impr.", "CTR", "Pos", "Trend"]}
            rows={[
              ["/products/vala-erp", "18,214", "342K", "5.3%", "3.1", <MiniSpark key="1" data={[3,5,4,7,8,10,12]} tone="success" />],
              ["/blog/best-crm-2026", "12,048", "189K", "6.4%", "2.5", <MiniSpark key="2" data={[4,6,5,8,9,11,13]} tone="success" />],
              ["/category/erp", "9,821", "204K", "4.8%", "4.2", <MiniSpark key="3" data={[5,4,6,5,7,6,8]} tone="accent" />],
              ["/products/vala-hrms", "8,442", "168K", "5.0%", "3.9", <MiniSpark key="4" data={[6,5,7,6,8,7,9]} tone="success" />],
              ["/pricing", "7,912", "142K", "5.6%", "2.8", <MiniSpark key="5" data={[8,7,9,8,7,6,5]} tone="destructive" />],
            ]}
          />
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Top ranking keywords</div>
            <button className="text-[10px] font-bold uppercase tracking-wider text-accent">Keyword center</button>
          </div>
          <Table
            head={["Keyword", "Pos", "Δ", "Vol", "CPC", "URL"]}
            rows={[
              [<span className="font-semibold" key="k1">crm software india</span>, "3", <Delta v={2} key="d1" />, "22,400", "$4.20", "/products/vala-crm"],
              [<span className="font-semibold" key="k2">best erp for smb</span>, "5", <Delta v={-1} key="d2" />, "8,900", "$6.10", "/products/vala-erp"],
              [<span className="font-semibold" key="k3">hospital management system</span>, "2", <Delta v={4} key="d3" />, "14,800", "$5.40", "/products/vala-hms"],
              [<span className="font-semibold" key="k4">school erp software</span>, "6", <Delta v={0} key="d4" />, "6,700", "$3.80", "/products/vala-school"],
              [<span className="font-semibold" key="k5">gst billing software</span>, "4", <Delta v={3} key="d5" />, "18,200", "$4.90", "/products/vala-gst"],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function FakeAreaChart() {
  const points1 = "0,80 40,60 80,70 120,45 160,55 200,35 240,40 280,20 320,30 360,15 400,18";
  const points2 = "0,90 40,85 80,88 120,70 160,78 200,60 240,68 280,45 320,55 360,35 400,40";
  return (
    <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border bg-background/40">
      <svg viewBox="0 0 400 120" className="h-full w-full" preserveAspectRatio="none">
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
        <polyline points={points2} fill="none" stroke="oklch(0.85 0.16 92)" strokeWidth="1.5" />
        <polygon points={`${points2} 400,120 0,120`} fill="url(#gb)" />
        <polyline points={points1} fill="none" stroke="oklch(0.80 0.13 192)" strokeWidth="1.8" />
        <polygon points={`${points1} 400,120 0,120`} fill="url(#ga)" />
      </svg>
      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
        <span>Nov 1</span><span>Nov 15</span><span>Nov 30</span>
      </div>
    </div>
  );
}

/* =========================================================
   2) HEALTH
   ========================================================= */
const HEALTH_ISSUES = [
  { sev: "critical", title: "12 broken pages returning 5xx", desc: "Server errors on /api/products variants — recheck caching layer.", count: 12 },
  { sev: "critical", title: "6 duplicate title tags", desc: "Multiple pages share the same <title>. Rewrite to unique focus.", count: 6 },
  { sev: "warning", title: "218 images missing ALT", desc: "Add descriptive ALT for accessibility + image search.", count: 218 },
  { sev: "warning", title: "24 pages missing meta description", desc: "Google auto-generates — quality unpredictable.", count: 24 },
  { sev: "warning", title: "41 pages missing structured data", desc: "Add Product / Article / FAQ schema where relevant.", count: 41 },
  { sev: "info", title: "Sitemap last submitted 8 days ago", desc: "Consider re-submitting after latest publish batch.", count: 1 },
];

function HealthModule() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.5fr]">
      <Card>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Overall health</div>
        <div className="mt-3 flex items-center gap-4">
          <ScoreRing value={91} size={96} />
          <div>
            <div className="text-3xl font-bold text-success">Excellent</div>
            <div className="text-xs text-muted-foreground">91% of pages pass all core SEO checks.</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[
            { l: "On-page SEO", v: 88 }, { l: "Technical", v: 93 },
            { l: "Content", v: 84 }, { l: "Performance", v: 94 },
            { l: "Mobile", v: 96 }, { l: "Security", v: 100 },
          ].map((r) => (
            <div key={r.l}>
              <div className="mb-1 flex items-center justify-between text-[11px]"><span className="text-muted-foreground">{r.l}</span><span className="font-mono tabular">{r.v}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-background/60">
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-glow" style={{ width: `${r.v}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Issues to fix</div>
          <div className="flex gap-1">
            <Chip tone="destructive">18 critical</Chip>
            <Chip tone="warning">283 warnings</Chip>
            <Chip>1 info</Chip>
          </div>
        </div>
        <div className="space-y-2">
          {HEALTH_ISSUES.map((i) => {
            const tone = i.sev === "critical" ? "destructive" : i.sev === "warning" ? "warning" : "default";
            const Icon = i.sev === "critical" ? AlertTriangle : i.sev === "warning" ? AlertTriangle : CheckCircle2;
            return (
              <div key={i.title} className="group flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-accent/40">
                <Icon className={`mt-0.5 h-4 w-4 ${tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-accent"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-[13px] font-bold">{i.title}</div>
                    <Chip tone={tone as any}>{i.count}</Chip>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{i.desc}</div>
                </div>
                <button className="opacity-0 transition-opacity group-hover:opacity-100">
                  <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Wand2 className="h-3 w-3" /> Fix</span></PillButton>
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* =========================================================
   3) REPORTS
   ========================================================= */
function ReportsModule() {
  const reports = [
    { l: "Daily SEO Digest", d: "Delivered daily 9:00 IST", icon: Calendar, tone: "default" },
    { l: "Weekly Ranking Report", d: "Every Monday · CSV + PDF", icon: BarChart3, tone: "accent" },
    { l: "Monthly SEO Deep-Dive", d: "1st of month · 42-page PDF", icon: FileText, tone: "premium" },
    { l: "Yearly SEO Retrospective", d: "31 Dec · Executive summary", icon: Award, tone: "premium" },
    { l: "Product Report", d: "Per-product SEO breakdown", icon: Boxes, tone: "default" },
    { l: "Category Report", d: "Category-level ranking", icon: LayoutGrid, tone: "default" },
    { l: "Blog Report", d: "Content ROI & engagement", icon: Rss, tone: "default" },
    { l: "Keyword Report", d: "Position tracking + gaps", icon: Hash, tone: "default" },
    { l: "Traffic Report", d: "GA4 + Search Console blend", icon: BarChart3, tone: "success" },
    { l: "Technical SEO Audit", d: "Crawl, index & schema", icon: ScanLine, tone: "warning" },
    { l: "Broken Links Report", d: "4xx / 5xx & orphan pages", icon: AlertTriangle, tone: "destructive" },
    { l: "Meta Coverage Report", d: "Title / desc / OG / Twitter", icon: FileText, tone: "default" },
    { l: "Schema Coverage Report", d: "JSON-LD validity", icon: FileCode2, tone: "default" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar title="Report Library" count={reports.length} right={<PillButton variant="primary"><span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Custom Report</span></PillButton>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.l}>
              <div className="flex items-start justify-between">
                <div className={`grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-${r.tone}`}><Icon className="h-4 w-4" /></div>
                <Chip tone={r.tone as any}>Scheduled</Chip>
              </div>
              <div className="mt-3 text-sm font-bold">{r.l}</div>
              <div className="text-[11px] text-muted-foreground">{r.d}</div>
              <div className="mt-3 flex gap-1">
                <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Preview</button>
                <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Download</button>
              </div>
            </Card>
          );
        })}
      </div>
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
const PRODUCT_ROWS = [
  { name: "Vala CRM Pro", cat: "CRM", slug: "vala-crm-pro", score: 92, idx: "Indexed", pos: 3, clicks: 18214, imp: 342000, ctr: "5.3%" },
  { name: "Vala ERP Cloud", cat: "ERP", slug: "vala-erp-cloud", score: 88, idx: "Indexed", pos: 5, clicks: 12048, imp: 289000, ctr: "4.2%" },
  { name: "Vala HRMS", cat: "HR", slug: "vala-hrms", score: 84, idx: "Indexed", pos: 4, clicks: 8442, imp: 168000, ctr: "5.0%" },
  { name: "Vala Hospital Suite", cat: "Healthcare", slug: "vala-hms", score: 90, idx: "Indexed", pos: 2, clicks: 14822, imp: 296000, ctr: "5.0%" },
  { name: "Vala School ERP", cat: "Education", slug: "vala-school", score: 78, idx: "Pending", pos: 12, clicks: 2214, imp: 88000, ctr: "2.5%" },
  { name: "Vala GST Billing", cat: "Finance", slug: "vala-gst", score: 86, idx: "Indexed", pos: 4, clicks: 11202, imp: 214000, ctr: "5.2%" },
  { name: "Vala Restaurant POS", cat: "Retail", slug: "vala-pos", score: 74, idx: "Non-indexed", pos: 24, clicks: 812, imp: 42000, ctr: "1.9%" },
  { name: "Vala Real Estate CRM", cat: "Real Estate", slug: "vala-re-crm", score: 81, idx: "Indexed", pos: 7, clicks: 4218, imp: 118000, ctr: "3.6%" },
];

function ProductSeoModule() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Products" value="1,284" icon={<Boxes className="h-4 w-4" />} />
        <StatCard label="Avg SEO Score" value="83" tone="success" delta="+4" />
        <StatCard label="Ranking Top 10" value="412" tone="premium" delta="+38" />
        <StatCard label="Needs Attention" value="94" tone="warning" delta="-12" />
      </div>
      <Toolbar title="Product SEO" count={1284} />
      <Table
        head={["", "Product", "Category", "Slug", "Score", "Index", "Pos", "Clicks", "Impr.", "CTR", "Trend", "Actions"]}
        rows={PRODUCT_ROWS.map((r) => [
          <input key="c" type="checkbox" className="h-3.5 w-3.5 rounded border-border" />,
          <div key="p" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md border border-border bg-gradient-to-br from-primary/40 to-accent/30 text-[10px] font-bold">{r.name.split(" ").map(s => s[0]).join("").slice(0,2)}</div>
            <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-muted-foreground">/products/{r.slug}</div></div>
          </div>,
          <Chip key="cat">{r.cat}</Chip>,
          <span key="sl" className="font-mono text-[11px] text-muted-foreground">{r.slug}</span>,
          <div key="sc" className="flex items-center gap-1.5"><ScoreRing value={r.score} size={28} /></div>,
          <Chip key="i" tone={r.idx === "Indexed" ? "success" : r.idx === "Pending" ? "warning" : "destructive"}>{r.idx}</Chip>,
          <span key="ps" className="font-mono tabular">{r.pos}</span>,
          <span key="cl" className="font-mono tabular">{r.clicks.toLocaleString()}</span>,
          <span key="im" className="font-mono tabular text-muted-foreground">{r.imp.toLocaleString()}</span>,
          <span key="ct" className="font-mono tabular text-accent">{r.ctr}</span>,
          <MiniSpark key="tr" data={[3,4,3,5,6,7,8]} tone="success" />,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

/* =========================================================
   6) CATEGORY SEO
   ========================================================= */
const CATEGORY_ROWS = [
  { c: "ERP", slug: "erp", title: "ERP Software for SMB & Enterprise | Vala", desc: "Cloud ERP · India ready · GST", schema: "Yes", faq: 12, blogs: 24, products: 148, rank: 4, traffic: "42K/mo" },
  { c: "CRM", slug: "crm", title: "CRM Software for Sales Teams | Vala", desc: "Pipeline · Automation · WhatsApp", schema: "Yes", faq: 18, blogs: 42, products: 96, rank: 3, traffic: "58K/mo" },
  { c: "HRMS", slug: "hrms", title: "HRMS & Payroll Software | Vala", desc: "Attendance · Payroll · Compliance", schema: "Yes", faq: 9, blogs: 18, products: 64, rank: 6, traffic: "22K/mo" },
  { c: "Healthcare", slug: "healthcare", title: "Hospital Management Software | Vala", desc: "OPD · IPD · Pharmacy · Billing", schema: "Yes", faq: 14, blogs: 22, products: 48, rank: 2, traffic: "38K/mo" },
  { c: "Education", slug: "education", title: "School & College ERP | Vala", desc: "Admission · Fees · Result", schema: "Missing", faq: 6, blogs: 12, products: 32, rank: 9, traffic: "12K/mo" },
  { c: "Retail", slug: "retail", title: "Retail POS & Billing | Vala", desc: "POS · Inventory · Loyalty", schema: "Yes", faq: 10, blogs: 16, products: 58, rank: 7, traffic: "18K/mo" },
];

function CategorySeoModule() {
  return (
    <div className="space-y-4">
      <Toolbar title="Categories" count={CATEGORY_ROWS.length} />
      <Table
        head={["Category", "Slug", "Meta Title", "Meta Desc", "Schema", "FAQ", "Blogs", "Products", "Rank", "Traffic", "Actions"]}
        rows={CATEGORY_ROWS.map((r) => [
          <span key="c" className="font-semibold">{r.c}</span>,
          <span key="s" className="font-mono text-[11px] text-muted-foreground">/{r.slug}</span>,
          <span key="t" className="max-w-[220px] truncate">{r.title}</span>,
          <span key="d" className="max-w-[220px] truncate text-muted-foreground">{r.desc}</span>,
          <Chip key="sc" tone={r.schema === "Yes" ? "success" : "warning"}>{r.schema}</Chip>,
          <span key="f" className="font-mono tabular">{r.faq}</span>,
          <span key="b" className="font-mono tabular">{r.blogs}</span>,
          <span key="p" className="font-mono tabular">{r.products}</span>,
          <span key="rk" className="font-mono tabular">{r.rank}</span>,
          <span key="tr" className="font-mono tabular text-success">{r.traffic}</span>,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

/* =========================================================
   7) BLOG SEO / LANDING SEO — thin wrappers
   ========================================================= */
function BlogSeoModule() {
  const rows = [
    { t: "Top 10 CRM Software 2026", slug: "top-crm-2026", score: 94, pos: 2, clicks: 12048, ctr: "6.4%", status: "Published" },
    { t: "ERP vs CRM: A Complete Guide", slug: "erp-vs-crm", score: 88, pos: 4, clicks: 6421, ctr: "4.9%", status: "Published" },
    { t: "GST Billing Explained", slug: "gst-billing", score: 82, pos: 6, clicks: 3812, ctr: "3.8%", status: "Draft" },
    { t: "Hospital Management Trends", slug: "hms-trends", score: 90, pos: 3, clicks: 8214, ctr: "5.6%", status: "Published" },
    { t: "AI in HRMS 2026", slug: "ai-hrms-2026", score: 86, pos: 5, clicks: 4108, ctr: "4.2%", status: "Scheduled" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Blogs" value="284" icon={<Rss className="h-4 w-4" />} />
        <StatCard label="Avg Score" value="87" tone="success" />
        <StatCard label="Views 30d" value="482K" tone="premium" />
        <StatCard label="Avg Reading Time" value="6m 20s" />
      </div>
      <Toolbar title="Blog SEO" count={284} />
      <Table
        head={["Title", "Slug", "SEO Score", "Position", "Clicks", "CTR", "Status", "Actions"]}
        rows={rows.map((r) => [
          <span key="t" className="font-semibold">{r.t}</span>,
          <span key="s" className="font-mono text-[11px] text-muted-foreground">/blog/{r.slug}</span>,
          <ScoreRing key="sc" value={r.score} size={28} />,
          <span key="p" className="font-mono tabular">{r.pos}</span>,
          <span key="c" className="font-mono tabular">{r.clicks.toLocaleString()}</span>,
          <span key="cr" className="font-mono tabular text-accent">{r.ctr}</span>,
          <Chip key="st" tone={r.status === "Published" ? "success" : r.status === "Draft" ? "default" : "warning"}>{r.status}</Chip>,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

function LandingSeoModule() {
  const rows = [
    { t: "Free Trial · CRM", slug: "trial/crm", conv: "4.8%", score: 92, exp: "Live" },
    { t: "Demo Request · ERP", slug: "demo/erp", conv: "3.2%", score: 88, exp: "Live" },
    { t: "Enterprise Pricing", slug: "enterprise", conv: "2.1%", score: 84, exp: "A/B Test" },
    { t: "Partner Signup", slug: "partners", conv: "1.9%", score: 79, exp: "Live" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar title="Landing Pages" count={rows.length} />
      <Table
        head={["Landing Page", "URL", "Conversion", "SEO Score", "Experiment", "Actions"]}
        rows={rows.map((r) => [
          <span key="t" className="font-semibold">{r.t}</span>,
          <span key="s" className="font-mono text-[11px] text-muted-foreground">/{r.slug}</span>,
          <span key="c" className="font-mono tabular text-success">{r.conv}</span>,
          <ScoreRing key="sc" value={r.score} size={28} />,
          <Chip key="e" tone={r.exp === "Live" ? "success" : "warning"}>{r.exp}</Chip>,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

/* =========================================================
   8) META MANAGER
   ========================================================= */
const META_FIELDS = [
  { g: "Core", items: ["Meta Title", "Meta Description", "Meta Keyword", "Canonical URL", "Robots"] },
  { g: "Attribution", items: ["Author", "Publisher", "Copyright", "Language"] },
  { g: "Geo & App", items: ["Geo Tag", "Theme Color", "Favicon", "App Name", "Manifest"] },
  { g: "Open Graph", items: ["OG Title", "OG Description", "OG Image", "OG Type", "OG Locale"] },
  { g: "Twitter Card", items: ["Twitter Title", "Twitter Description", "Twitter Image", "Twitter Card Type", "Twitter Site"] },
  { g: "Verification", items: ["Google", "Bing", "Yandex", "Pinterest", "Facebook"] },
  { g: "Sitemap", items: ["Priority", "Change Frequency", "Last Modified", "Alternate Hreflang"] },
];

function MetaManagerModule() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Meta Tag Manager</div>
            <div className="mt-0.5 text-sm font-bold">Global default + per-page overrides</div>
          </div>
          <PillButton variant="primary"><span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" /> New Template</span></PillButton>
        </div>
        <div className="space-y-4">
          {META_FIELDS.map((g) => (
            <div key={g.g}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{g.g}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.items.map((f) => (
                  <div key={f} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px]">
                    <div><span className="font-semibold">{f}</span></div>
                    <div className="flex items-center gap-2">
                      <Chip tone="success">Set</Chip>
                      <button className="text-muted-foreground hover:text-accent"><Edit3 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Live preview</div>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">softwarevala.com</div>
            <div className="mt-1 text-[16px] font-bold text-[hsl(210_100%_75%)]">Software Vala — Enterprise CRM & ERP Marketplace</div>
            <div className="text-[11px] text-muted-foreground">Buy, deploy and manage 1,200+ enterprise software with one-click demos.</div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex h-24 items-end bg-gradient-to-br from-primary/50 via-surface to-accent/40 p-2 text-[10px] uppercase tracking-wider text-white/70">og:image 1200×630</div>
            <div className="space-y-0.5 border-t border-border bg-background/60 p-2 text-[11px]">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">softwarevala.com</div>
              <div className="font-bold">Software Vala — Enterprise Software Marketplace</div>
              <div className="line-clamp-2 text-muted-foreground">1,284 verified products · GST invoicing · Live demos</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* =========================================================
   9) SCHEMA MANAGER
   ========================================================= */
const SCHEMAS = [
  { t: "Organization", c: 1, s: "Global" }, { t: "Website", c: 1, s: "Global" },
  { t: "WebPage", c: 12847, s: "Auto" }, { t: "SoftwareApplication", c: 1284, s: "Product" },
  { t: "Product", c: 1284, s: "Product" }, { t: "FAQPage", c: 342, s: "FAQ" },
  { t: "HowTo", c: 89, s: "Tutorial" }, { t: "Article", c: 284, s: "Blog" },
  { t: "BreadcrumbList", c: 12847, s: "Auto" }, { t: "Review", c: 8214, s: "Aggregate" },
  { t: "VideoObject", c: 214, s: "Media" }, { t: "LocalBusiness", c: 4, s: "Local" },
  { t: "Event", c: 18, s: "Marketing" }, { t: "Person", c: 62, s: "Authors" },
];
function SchemaModule() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Schemas Deployed" value="26,882" icon={<FileCode2 className="h-4 w-4" />} />
        <StatCard label="Types Enabled" value={String(SCHEMAS.length)} tone="success" />
        <StatCard label="Validation Errors" value="3" tone="destructive" />
        <StatCard label="Rich Results Live" value="18,214" tone="premium" />
      </div>
      <Toolbar title="Schema Types" count={SCHEMAS.length} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SCHEMAS.map((s) => (
          <Card key={s.t}>
            <div className="flex items-start justify-between">
              <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-accent"><FileCode2 className="h-4 w-4" /></div>
              <Chip tone="success">Valid</Chip>
            </div>
            <div className="mt-3 text-sm font-bold">{s.t}</div>
            <div className="text-[11px] text-muted-foreground">Applied to {s.c.toLocaleString()} pages · {s.s}</div>
            <div className="mt-3 flex gap-1">
              <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Edit</button>
              <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Preview</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   10) OG & TWITTER — visual pickers
   ========================================================= */
function SocialCardPreview({ kind }: { kind: "og" | "twitter" }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex h-40 items-end bg-gradient-to-br from-primary/60 via-surface to-accent/40 p-3">
        <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/80 backdrop-blur">
          {kind === "og" ? "1200 × 630 · og:image" : "1200 × 675 · twitter:image"}
        </span>
      </div>
      <div className="space-y-1 border-t border-border bg-background/60 p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">softwarevala.com</div>
        <div className="text-[13px] font-bold">Software Vala — Enterprise Marketplace</div>
        <div className="line-clamp-2 text-[11px] text-muted-foreground">1,284 verified products · GST invoicing · Live demos</div>
      </div>
    </div>
  );
}

function OgModule() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Open Graph defaults</div>
        <div className="mt-3 space-y-2">
          {["og:title", "og:description", "og:image", "og:type", "og:locale", "og:site_name", "og:url"].map((f) => (
            <Row key={f} label={f} value={f === "og:image" ? "hero-1200x630.jpg" : "Auto from page"} />
          ))}
        </div>
      </Card>
      <Card><div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Facebook preview</div><SocialCardPreview kind="og" /></Card>
    </div>
  );
}

function TwitterModule() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Twitter Card defaults</div>
        <div className="mt-3 space-y-2">
          {["twitter:card = summary_large_image", "twitter:site = @softwarevala", "twitter:creator", "twitter:title", "twitter:description", "twitter:image"].map((f) => (
            <Row key={f} label={f} value="Auto" />
          ))}
        </div>
      </Card>
      <Card><div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">X preview</div><SocialCardPreview kind="twitter" /></Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px]">
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="max-w-[180px] truncate">{value}</span>
        <button className="text-muted-foreground hover:text-accent"><Edit3 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

/* =========================================================
   11) TAG MANAGER
   ========================================================= */
const TAGS = [
  { name: "erp-software", uses: 148, score: 92, trend: "up" },
  { name: "crm-india", uses: 96, score: 88, trend: "up" },
  { name: "gst-billing", uses: 74, score: 84, trend: "up" },
  { name: "hospital-management", uses: 48, score: 86, trend: "flat" },
  { name: "school-erp", uses: 32, score: 79, trend: "down" },
  { name: "pos-system", uses: 58, score: 81, trend: "up" },
  { name: "hrms", uses: 64, score: 83, trend: "up" },
  { name: "cloud-erp", uses: 42, score: 80, trend: "up" },
  { name: "saas-india", uses: 38, score: 76, trend: "flat" },
  { name: "duplicate-tag", uses: 2, score: 42, trend: "down" },
  { name: "unused-tag", uses: 0, score: 0, trend: "flat" },
];

function TagManagerModule() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="Total Tags" value="284" icon={<TagIcon className="h-4 w-4" />} />
        <StatCard label="Popular" value="42" tone="success" />
        <StatCard label="Trending" value="18" tone="premium" />
        <StatCard label="AI Suggested" value="36" tone="premium" />
        <StatCard label="Duplicates" value="4" tone="warning" />
        <StatCard label="Unused" value="12" tone="destructive" />
      </div>
      <Toolbar title="Tags" count={284} right={
        <>
          <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI Suggest</span></PillButton>
          <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" /> Merge</span></PillButton>
          <PillButton variant="primary"><span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" /> New Tag</span></PillButton>
        </>
      } />
      <Table
        head={["Tag", "Uses", "SEO Score", "Trend", "Actions"]}
        rows={TAGS.map((t) => [
          <span key="n" className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent">#{t.name}</span>,
          <span key="u" className="font-mono tabular">{t.uses}</span>,
          <ScoreRing key="s" value={t.score} size={28} />,
          <span key="t" className={`inline-flex items-center gap-1 text-[11px] ${t.trend === "up" ? "text-success" : t.trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
            {t.trend === "up" ? <TrendingUp className="h-3 w-3" /> : t.trend === "down" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}{t.trend}
          </span>,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

/* =========================================================
   12) KEYWORD CENTER
   ========================================================= */
const KEYWORDS = [
  { k: "crm software india", type: "Focus", vol: 22400, diff: 62, comp: "High", cpc: "$4.20", pos: 3, sug: "Add case study" },
  { k: "best crm for small business", type: "Long tail", vol: 8900, diff: 48, comp: "Med", cpc: "$3.80", pos: 5, sug: "Add pricing table" },
  { k: "erp software", type: "Focus", vol: 34500, diff: 74, comp: "Very High", cpc: "$5.90", pos: 6, sug: "Build comparison page" },
  { k: "cloud erp for smb", type: "Secondary", vol: 4200, diff: 42, comp: "Med", cpc: "$4.10", pos: 4, sug: "Rank OK" },
  { k: "gst billing software free", type: "Long tail", vol: 12800, diff: 38, comp: "Low", cpc: "$1.90", pos: 2, sug: "Rank OK" },
  { k: "hospital management system india", type: "Focus", vol: 14800, diff: 58, comp: "High", cpc: "$5.40", pos: 2, sug: "Add local schema" },
  { k: "school erp software", type: "Trending", vol: 6700, diff: 44, comp: "Med", cpc: "$3.80", pos: 6, sug: "Add video" },
];

function KeywordCenterModule() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Tracked Keywords" value="2,412" icon={<Hash className="h-4 w-4" />} />
        <StatCard label="Top 3" value="184" tone="premium" />
        <StatCard label="Top 10" value="612" tone="success" />
        <StatCard label="Rising" value="94" tone="success" />
        <StatCard label="Falling" value="42" tone="destructive" />
      </div>
      <Toolbar title="Keywords" count={2412} right={
        <>
          <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI Research</span></PillButton>
          <PillButton variant="primary"><span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Track Keyword</span></PillButton>
        </>
      } />
      <Table
        head={["Keyword", "Type", "Volume", "Diff", "Comp", "CPC", "Pos", "Suggestion", "Actions"]}
        rows={KEYWORDS.map((k) => [
          <span key="k" className="font-semibold">{k.k}</span>,
          <Chip key="t" tone={k.type === "Focus" ? "accent" : k.type === "Trending" ? "premium" : "default"}>{k.type}</Chip>,
          <span key="v" className="font-mono tabular">{k.vol.toLocaleString()}</span>,
          <div key="d" className="flex items-center gap-1.5 font-mono tabular">
            <div className="h-1 w-10 overflow-hidden rounded-full bg-background/60"><div className={`h-full ${k.diff > 60 ? "bg-destructive" : k.diff > 40 ? "bg-warning" : "bg-success"}`} style={{ width: `${k.diff}%` }} /></div>
            {k.diff}
          </div>,
          <span key="c" className="text-[11px] text-muted-foreground">{k.comp}</span>,
          <span key="cp" className="font-mono tabular">{k.cpc}</span>,
          <span key="p" className="font-mono tabular text-accent">{k.pos}</span>,
          <span key="s" className="text-[11px] text-muted-foreground">{k.sug}</span>,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

function KeywordClusterModule() {
  const clusters = [
    { name: "CRM Software", kws: 42, pages: 8, tone: "accent" },
    { name: "ERP Cloud", kws: 68, pages: 12, tone: "premium" },
    { name: "HRMS & Payroll", kws: 34, pages: 6, tone: "success" },
    { name: "Hospital Management", kws: 48, pages: 10, tone: "accent" },
    { name: "School / College ERP", kws: 28, pages: 5, tone: "default" },
    { name: "GST & Billing", kws: 52, pages: 9, tone: "warning" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clusters.map((c) => (
        <Card key={c.name}>
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-bold">{c.name}</div>
            <Chip tone={c.tone as any}>{c.kws} kws</Chip>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">Mapped to {c.pages} pages · pillar + supporting content</div>
          <div className="mt-3 flex flex-wrap gap-1">
            {["primary", "secondary", "long-tail", "question", "trending"].map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[11px]">
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Volume</div><div className="font-mono tabular">{(c.kws * 380).toLocaleString()}</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg pos</div><div className="font-mono tabular">{(4 + Math.random() * 6).toFixed(1)}</div></div>
            <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Traffic</div><div className="font-mono tabular text-success">+{Math.floor(c.kws * 42)}</div></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* =========================================================
   13) RANKING
   ========================================================= */
const RANKING_ROWS = [
  { k: "crm software india", cur: 3, prev: 5, change: 2, url: "/products/vala-crm", country: "IN", device: "Desktop", eng: "Google", traffic: 18214, ctr: "5.3%", clicks: 18214, imp: 342000 },
  { k: "erp software", cur: 6, prev: 8, change: 2, url: "/products/vala-erp", country: "IN", device: "Desktop", eng: "Google", traffic: 12048, ctr: "4.2%", clicks: 12048, imp: 289000 },
  { k: "hospital management system", cur: 2, prev: 6, change: 4, url: "/products/vala-hms", country: "IN", device: "Mobile", eng: "Google", traffic: 14822, ctr: "5.0%", clicks: 14822, imp: 296000 },
  { k: "school erp software", cur: 6, prev: 6, change: 0, url: "/products/vala-school", country: "IN", device: "Desktop", eng: "Google", traffic: 4108, ctr: "3.2%", clicks: 4108, imp: 128000 },
  { k: "gst billing software", cur: 4, prev: 7, change: 3, url: "/products/vala-gst", country: "IN", device: "Desktop", eng: "Google", traffic: 11202, ctr: "5.2%", clicks: 11202, imp: 214000 },
  { k: "restaurant pos", cur: 24, prev: 18, change: -6, url: "/products/vala-pos", country: "IN", device: "Mobile", eng: "Google", traffic: 812, ctr: "1.9%", clicks: 812, imp: 42000 },
];

function RankingModule() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Avg Position" value="12.4" tone="success" delta="-1.2" icon={<Award className="h-4 w-4" />} />
        <StatCard label="Rising" value="94" tone="success" delta="+18" />
        <StatCard label="Falling" value="42" tone="destructive" delta="+6" />
        <StatCard label="Stable" value="284" tone="default" />
      </div>
      <Toolbar title="Google Ranking" count={2412} />
      <Table
        head={["Keyword", "Cur", "Prev", "Δ", "URL", "Country", "Device", "Engine", "Clicks", "Impr.", "CTR", "Trend", "Actions"]}
        rows={RANKING_ROWS.map((r) => [
          <span key="k" className="font-semibold">{r.k}</span>,
          <span key="c" className="font-mono tabular text-accent">{r.cur}</span>,
          <span key="p" className="font-mono tabular text-muted-foreground">{r.prev}</span>,
          <Delta key="d" v={r.change} />,
          <span key="u" className="font-mono text-[11px] text-muted-foreground">{r.url}</span>,
          <span key="co" className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{r.country}</span>,
          <Chip key="de">{r.device}</Chip>,
          <Chip key="e" tone="accent">{r.eng}</Chip>,
          <span key="cl" className="font-mono tabular">{r.clicks.toLocaleString()}</span>,
          <span key="im" className="font-mono tabular text-muted-foreground">{r.imp.toLocaleString()}</span>,
          <span key="ct" className="font-mono tabular text-accent">{r.ctr}</span>,
          <MiniSpark key="tr" data={[8,7,6,5,4,3,r.cur]} tone={r.change >= 0 ? "success" : "destructive"} />,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

/* =========================================================
   14) COMPETITOR
   ========================================================= */
function CompetitorModule() {
  const rivals = [
    { d: "zoho.com", auth: 94, kws: "1.2M", traffic: "18.4M", overlap: "12%", tone: "premium" },
    { d: "freshworks.com", auth: 88, kws: "480K", traffic: "6.2M", overlap: "18%", tone: "accent" },
    { d: "salesforce.com", auth: 96, kws: "2.4M", traffic: "42M", overlap: "8%", tone: "premium" },
    { d: "tallysolutions.com", auth: 82, kws: "180K", traffic: "3.1M", overlap: "24%", tone: "success" },
    { d: "vyaparapp.in", auth: 74, kws: "84K", traffic: "1.4M", overlap: "32%", tone: "warning" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar title="Competitors" count={rivals.length} right={<PillButton variant="primary"><span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add Competitor</span></PillButton>} />
      <div className="grid gap-3 lg:grid-cols-2">
        {rivals.map((r) => (
          <Card key={r.d}>
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-[13px] font-bold"><Globe2 className="h-4 w-4 text-accent" />{r.d}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Domain authority · keywords · overlap analysis</div>
              </div>
              <Chip tone={r.tone as any}>DA {r.auth}</Chip>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-[11px]">
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Keywords</div><div className="font-mono tabular">{r.kws}</div></div>
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Traffic</div><div className="font-mono tabular text-success">{r.traffic}</div></div>
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Overlap</div><div className="font-mono tabular text-accent">{r.overlap}</div></div>
              <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Gap</div><div className="font-mono tabular text-warning">+{Math.floor(Math.random() * 400)}</div></div>
            </div>
            <div className="mt-3 flex gap-1">
              <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Keyword gap</button>
              <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Backlink gap</button>
              <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Content gap</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   15) BACKLINK / INTERNAL / EXTERNAL
   ========================================================= */
function BacklinkModule() {
  const rows = [
    { d: "techcrunch.com", dr: 94, anchor: "Software Vala CRM", url: "/products/vala-crm", type: "Dofollow", status: "Active" },
    { d: "producthunt.com", dr: 91, anchor: "vala erp cloud", url: "/products/vala-erp", type: "Dofollow", status: "Active" },
    { d: "yourstory.com", dr: 82, anchor: "best hrms india", url: "/products/vala-hrms", type: "Dofollow", status: "Active" },
    { d: "medium.com", dr: 78, anchor: "read more", url: "/blog/best-crm-2026", type: "Nofollow", status: "Active" },
    { d: "spam-site.xyz", dr: 12, anchor: "click here", url: "/", type: "Dofollow", status: "Toxic" },
    { d: "reddit.com", dr: 91, anchor: "software vala", url: "/", type: "Nofollow", status: "Active" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="Total Backlinks" value="24,812" icon={<LinkIcon className="h-4 w-4" />} />
        <StatCard label="Ref. Domains" value="1,842" tone="success" />
        <StatCard label="Domain Rating" value="74" tone="premium" />
        <StatCard label="Spam Score" value="3%" tone="success" />
        <StatCard label="New (30d)" value="+284" tone="success" />
        <StatCard label="Lost (30d)" value="-42" tone="destructive" />
      </div>
      <Toolbar title="Backlinks" count={24812} right={<PillButton variant="ghost"><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Disavow</span></PillButton>} />
      <Table
        head={["Domain", "DR", "Anchor", "Target URL", "Type", "Status", "Actions"]}
        rows={rows.map((r) => [
          <span key="d" className="inline-flex items-center gap-2"><Globe2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-semibold">{r.d}</span></span>,
          <span key="dr" className={`font-mono tabular ${r.dr > 70 ? "text-success" : r.dr > 30 ? "text-warning" : "text-destructive"}`}>{r.dr}</span>,
          <span key="a" className="text-[11px]">"{r.anchor}"</span>,
          <span key="u" className="font-mono text-[11px] text-muted-foreground">{r.url}</span>,
          <Chip key="t" tone={r.type === "Dofollow" ? "success" : "default"}>{r.type}</Chip>,
          <Chip key="s" tone={r.status === "Active" ? "success" : "destructive"}>{r.status}</Chip>,
          <RowActs key="ac" />,
        ])}
      />
    </div>
  );
}

function InternalLinkModule() {
  const rows = [
    { s: "/blog/best-crm-2026", t: "/products/vala-crm", a: "Vala CRM", st: "OK", sug: "—" },
    { s: "/blog/erp-vs-crm", t: "/products/vala-erp", a: "Vala ERP Cloud", st: "OK", sug: "—" },
    { s: "/category/erp", t: "/products/vala-erp", a: "Vala ERP", st: "OK", sug: "—" },
    { s: "/blog/gst-billing", t: "/products/vala-gst", a: "GST Billing", st: "Missing", sug: "Add anchor" },
    { s: "/products/vala-hms", t: "/blog/hms-trends", a: "trends", st: "Weak", sug: "Improve anchor" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Internal Links" value="48,214" icon={<Compass className="h-4 w-4" />} />
        <StatCard label="Orphan Pages" value="42" tone="warning" />
        <StatCard label="Weak Anchors" value="184" tone="warning" />
        <StatCard label="Suggestions" value="212" tone="premium" />
      </div>
      <Toolbar title="Internal Linking" count={48214} />
      <Table
        head={["Source", "Target", "Anchor", "Status", "Suggestion", "Actions"]}
        rows={rows.map((r) => [
          <span key="s" className="font-mono text-[11px]">{r.s}</span>,
          <span key="t" className="font-mono text-[11px] text-accent">{r.t}</span>,
          <span key="a" className="text-[11px]">"{r.a}"</span>,
          <Chip key="st" tone={r.st === "OK" ? "success" : r.st === "Missing" ? "destructive" : "warning"}>{r.st}</Chip>,
          <span key="sg" className="text-[11px] text-muted-foreground">{r.sug}</span>,
          <RowActs key="ac" />,
        ])}
      />
    </div>
  );
}

function ExternalLinkModule() {
  const rows = [
    { s: "/blog/erp-vs-crm", t: "https://en.wikipedia.org/wiki/ERP", a: "ERP", rel: "noopener", st: "OK" },
    { s: "/blog/gst-billing", t: "https://gst.gov.in", a: "GST Portal", rel: "noopener nofollow", st: "OK" },
    { s: "/blog/best-crm-2026", t: "https://broken.example.com", a: "case study", rel: "noopener", st: "Broken" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar title="External Links" count={6204} />
      <Table
        head={["Source", "Target", "Anchor", "Rel", "Status", "Actions"]}
        rows={rows.map((r) => [
          <span key="s" className="font-mono text-[11px]">{r.s}</span>,
          <span key="t" className="font-mono text-[11px] text-accent">{r.t}</span>,
          <span key="a" className="text-[11px]">"{r.a}"</span>,
          <Chip key="r">{r.rel}</Chip>,
          <Chip key="st" tone={r.st === "OK" ? "success" : "destructive"}>{r.st}</Chip>,
          <RowActs key="ac" />,
        ])}
      />
    </div>
  );
}

/* =========================================================
   16) IMAGE / VIDEO / FAQ SEO
   ========================================================= */
function ImageSeoModule() {
  const rows = [
    { f: "hero-crm.webp", alt: "Vala CRM dashboard", size: "182 KB", comp: "84%", lazy: "Yes", webp: "Yes", score: 94 },
    { f: "erp-modules.png", alt: "—", size: "1.2 MB", comp: "0%", lazy: "No", webp: "No", score: 42 },
    { f: "hms-pharmacy.jpg", alt: "Hospital pharmacy module", size: "412 KB", comp: "62%", lazy: "Yes", webp: "No", score: 74 },
    { f: "school-fees.webp", alt: "Fees dashboard", size: "128 KB", comp: "88%", lazy: "Yes", webp: "Yes", score: 92 },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Images" value="12,412" icon={<ImageIcon className="h-4 w-4" />} />
        <StatCard label="Missing ALT" value="218" tone="warning" />
        <StatCard label="Not WebP" value="4,204" tone="warning" />
        <StatCard label="Broken" value="5" tone="destructive" />
      </div>
      <Toolbar title="Image SEO" count={12412} />
      <Table
        head={["File", "ALT", "Size", "Compression", "Lazy", "WebP", "Score", "Actions"]}
        rows={rows.map((r) => [
          <span key="f" className="inline-flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-md border border-border bg-gradient-to-br from-primary/30 to-accent/30"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /></div><span className="font-mono text-[11px]">{r.f}</span></span>,
          r.alt === "—" ? <Chip key="a" tone="destructive">Missing</Chip> : <span key="a" className="text-[11px]">{r.alt}</span>,
          <span key="s" className="font-mono tabular">{r.size}</span>,
          <span key="c" className="font-mono tabular">{r.comp}</span>,
          <Chip key="l" tone={r.lazy === "Yes" ? "success" : "warning"}>{r.lazy}</Chip>,
          <Chip key="w" tone={r.webp === "Yes" ? "success" : "warning"}>{r.webp}</Chip>,
          <ScoreRing key="sc" value={r.score} size={28} />,
          <RowActs key="ac" />,
        ])}
      />
    </div>
  );
}

function VideoSeoModule() {
  const rows = [
    { f: "vala-crm-demo.mp4", dur: "3:24", thumb: true, tr: "Yes", schema: "Yes", score: 92 },
    { f: "vala-erp-tour.mp4", dur: "5:12", thumb: true, tr: "No", schema: "Yes", score: 78 },
    { f: "vala-hms-walkthrough.mp4", dur: "6:48", thumb: true, tr: "Yes", schema: "No", score: 72 },
  ];
  return (
    <div className="space-y-4">
      <Toolbar title="Video SEO" count={214} />
      <Table
        head={["Video", "Thumb", "Duration", "Transcript", "Schema", "Score", "Actions"]}
        rows={rows.map((r) => [
          <span key="f" className="font-mono text-[11px]">{r.f}</span>,
          <div key="t" className="grid h-8 w-14 place-items-center rounded-md border border-border bg-gradient-to-br from-primary/40 to-accent/30"><Play className="h-3.5 w-3.5 text-white/80" /></div>,
          <span key="d" className="font-mono tabular">{r.dur}</span>,
          <Chip key="tr" tone={r.tr === "Yes" ? "success" : "warning"}>{r.tr}</Chip>,
          <Chip key="sc" tone={r.schema === "Yes" ? "success" : "warning"}>{r.schema}</Chip>,
          <ScoreRing key="s" value={r.score} size={28} />,
          <RowActs key="ac" />,
        ])}
      />
    </div>
  );
}

function FaqSeoModule() {
  const rows = [
    { q: "What is Vala CRM?", schema: "Yes", prod: "Vala CRM", blog: "—", rank: 3 },
    { q: "How much does Vala ERP cost?", schema: "Yes", prod: "Vala ERP", blog: "erp-pricing", rank: 5 },
    { q: "Is my data secure?", schema: "Yes", prod: "—", blog: "security", rank: 8 },
    { q: "Do you support GST?", schema: "No", prod: "Vala GST", blog: "—", rank: 12 },
  ];
  return (
    <div className="space-y-4">
      <Toolbar title="FAQ" count={342} />
      <Table
        head={["Question", "Schema", "Product", "Blog", "Ranking", "Actions"]}
        rows={rows.map((r) => [
          <span key="q" className="font-semibold">{r.q}</span>,
          <Chip key="s" tone={r.schema === "Yes" ? "success" : "warning"}>{r.schema}</Chip>,
          <span key="p" className="text-[11px]">{r.prod}</span>,
          <span key="b" className="text-[11px]">{r.blog}</span>,
          <span key="rk" className="font-mono tabular">{r.rank}</span>,
          <RowActs key="ac" />,
        ])}
      />
    </div>
  );
}

/* =========================================================
   17) REDIRECT / CANONICAL
   ========================================================= */
function RedirectModule() {
  const rows = [
    { from: "/old/crm", to: "/products/vala-crm", code: 301, hits: 4218, st: "Active" },
    { from: "/products/erp", to: "/products/vala-erp", code: 301, hits: 2814, st: "Active" },
    { from: "/blog/hms-old", to: "/blog/hms-trends", code: 302, hits: 448, st: "Active" },
    { from: "/broken/link", to: "/not-found", code: 404, hits: 128, st: "Chain" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar title="Redirects" count={rows.length} right={<PillButton variant="primary"><span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" /> New Redirect</span></PillButton>} />
      <Table
        head={["From", "To", "Code", "Hits (30d)", "Status", "Actions"]}
        rows={rows.map((r) => [
          <span key="f" className="font-mono text-[11px]">{r.from}</span>,
          <span key="t" className="font-mono text-[11px] text-accent">{r.to}</span>,
          <Chip key="c" tone={r.code === 301 ? "success" : r.code === 302 ? "warning" : "destructive"}>{r.code}</Chip>,
          <span key="h" className="font-mono tabular">{r.hits.toLocaleString()}</span>,
          <Chip key="s" tone={r.st === "Active" ? "success" : "warning"}>{r.st}</Chip>,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

function CanonicalModule() {
  const rows = [
    { url: "/products/vala-crm", canonical: "https://softwarevala.com/products/vala-crm", st: "Self" },
    { url: "/products/vala-crm?ref=fb", canonical: "https://softwarevala.com/products/vala-crm", st: "Cross" },
    { url: "/blog/hms-trends", canonical: "https://softwarevala.com/blog/hms-trends", st: "Self" },
    { url: "/category/erp/page/2", canonical: "https://softwarevala.com/category/erp", st: "Conflict" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar title="Canonicals" count={12847} />
      <Table
        head={["URL", "Canonical", "Type", "Actions"]}
        rows={rows.map((r) => [
          <span key="u" className="font-mono text-[11px]">{r.url}</span>,
          <span key="c" className="font-mono text-[11px] text-accent">{r.canonical}</span>,
          <Chip key="s" tone={r.st === "Self" ? "success" : r.st === "Cross" ? "warning" : "destructive"}>{r.st}</Chip>,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

/* =========================================================
   18) SITEMAP / ROBOTS
   ========================================================= */
function SitemapModule() {
  const maps = [
    { n: "sitemap-products.xml", urls: 1284, mod: "2h ago", st: "OK" },
    { n: "sitemap-categories.xml", urls: 48, mod: "2h ago", st: "OK" },
    { n: "sitemap-blog.xml", urls: 284, mod: "1h ago", st: "OK" },
    { n: "sitemap-images.xml", urls: 12412, mod: "6h ago", st: "OK" },
    { n: "sitemap-video.xml", urls: 214, mod: "6h ago", st: "OK" },
    { n: "sitemap-news.xml", urls: 42, mod: "1d ago", st: "OK" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PillButton variant="primary"><span className="inline-flex items-center gap-1"><Wand2 className="h-3 w-3" /> Generate</span></PillButton>
        <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Download</span></PillButton>
        <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Send className="h-3 w-3" /> Ping Google</span></PillButton>
        <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Send className="h-3 w-3" /> Ping Bing</span></PillButton>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {maps.map((m) => (
          <Card key={m.n}>
            <div className="flex items-start justify-between">
              <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-accent"><MapIcon className="h-4 w-4" /></div>
              <Chip tone="success">{m.st}</Chip>
            </div>
            <div className="mt-3 font-mono text-[12px] font-bold">{m.n}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{m.urls.toLocaleString()} URLs · updated {m.mod}</div>
            <div className="mt-3 flex gap-1">
              <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Preview</button>
              <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Regen</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RobotsModule() {
  const sample = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /*?ref=

Sitemap: https://softwarevala.com/sitemap.xml
Sitemap: https://softwarevala.com/sitemap-products.xml
Sitemap: https://softwarevala.com/sitemap-blog.xml`;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">robots.txt · editor</div>
          <div className="flex gap-1">
            <PillButton variant="ghost">History</PillButton>
            <PillButton variant="ghost">Restore</PillButton>
            <PillButton variant="primary">Save</PillButton>
          </div>
        </div>
        <textarea defaultValue={sample} className="h-72 w-full rounded-lg border border-border bg-background/60 p-3 font-mono text-[12px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent" />
      </Card>
      <Card>
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Validation</div>
        <div className="space-y-2 text-[12px]">
          {[
            { l: "Syntax valid", ok: true }, { l: "Sitemap declared", ok: true },
            { l: "No * disallow /", ok: true }, { l: "Crawl-delay reasonable", ok: true },
            { l: "No conflicting rules", ok: true }, { l: "UTF-8 encoded", ok: true },
          ].map((c) => (
            <div key={c.l} className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5">
              {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
              {c.l}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* =========================================================
   19) LOCAL / INTERNATIONAL
   ========================================================= */
function LocalSeoModule() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Google Business Profile</div>
        <div className="mt-2 space-y-2 text-[12px]">
          <Row label="Business" value="Software Vala Pvt Ltd" />
          <Row label="Category" value="Software Company" />
          <Row label="Address" value="Mumbai, MH, India" />
          <Row label="Phone" value="+91 22 4000 0000" />
          <Row label="Hours" value="Mon–Sat · 10:00–19:00 IST" />
          <Row label="Reviews" value="4.8 ★ · 1,284 reviews" />
        </div>
      </Card>
      <Card>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Locations · NAP</div>
        <div className="mt-2 space-y-2">
          {["Mumbai · HQ", "Bengaluru · Sales", "Delhi NCR · Support", "Ahmedabad · Partner"].map((c) => (
            <div key={c} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px]">
              <span className="inline-flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-accent" />{c}</span>
              <Chip tone="success">Verified</Chip>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function IntlSeoModule() {
  const rows = [
    { lang: "en-US", url: "https://softwarevala.com/en", pages: 12847, index: "OK" },
    { lang: "en-IN", url: "https://softwarevala.com/in", pages: 12847, index: "OK" },
    { lang: "hi-IN", url: "https://softwarevala.com/hi", pages: 4820, index: "Partial" },
    { lang: "ar-AE", url: "https://softwarevala.com/ar", pages: 2400, index: "RTL" },
    { lang: "es-ES", url: "https://softwarevala.com/es", pages: 3200, index: "OK" },
    { lang: "fr-FR", url: "https://softwarevala.com/fr", pages: 2800, index: "OK" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar title="Hreflang" count={rows.length} />
      <Table
        head={["Locale", "Canonical", "Pages", "Status", "Actions"]}
        rows={rows.map((r) => [
          <Chip key="l" tone="accent">{r.lang}</Chip>,
          <span key="u" className="font-mono text-[11px]">{r.url}</span>,
          <span key="p" className="font-mono tabular">{r.pages.toLocaleString()}</span>,
          <Chip key="s" tone={r.index === "OK" ? "success" : r.index === "RTL" ? "accent" : "warning"}>{r.index}</Chip>,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

/* =========================================================
   20) BLOG CENTER + AI WRITER
   ========================================================= */
function BlogCenterModule() {
  const blogTabs = ["All", "Draft", "Published", "Scheduled", "Pending", "Rejected", "Featured", "Pinned"];
  const [t, setT] = useState("All");
  const blogs = [
    { title: "Top 10 CRM Software 2026", author: "Rhea Kapoor", cat: "CRM", tags: ["crm", "2026"], views: 12048, rt: "8m", st: "Published", ai: true, feat: true },
    { title: "ERP vs CRM: Complete Guide", author: "Aarav Sharma", cat: "ERP", tags: ["erp", "crm"], views: 6421, rt: "12m", st: "Published", ai: false, feat: false },
    { title: "GST Billing Explained", author: "Priya Nair", cat: "Finance", tags: ["gst"], views: 3812, rt: "6m", st: "Draft", ai: true, feat: false },
    { title: "AI in HRMS 2026", author: "Vikram Rao", cat: "HR", tags: ["ai", "hrms"], views: 0, rt: "9m", st: "Scheduled", ai: true, feat: false },
    { title: "Hospital Trends 2026", author: "Meera Iyer", cat: "Health", tags: ["hms"], views: 8214, rt: "10m", st: "Published", ai: false, feat: true },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Blogs" value="284" icon={<Rss className="h-4 w-4" />} />
        <StatCard label="Published" value="248" tone="success" />
        <StatCard label="Draft" value="24" tone="warning" />
        <StatCard label="Views 30d" value="482K" tone="premium" />
      </div>
      <div data-skip-drawer><SubNav items={blogTabs} active={t} onChange={setT} /></div>
      <Toolbar title="Blogs" count={284} right={
        <>
          <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Bot className="h-3 w-3" /> Auto Blog</span></PillButton>
          <PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI Blog</span></PillButton>
          <PillButton variant="primary"><span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" /> New Post</span></PillButton>
        </>
      } />
      <Table
        head={["Title", "Author", "Category", "Tags", "Views", "Read", "AI", "Featured", "Status", "Actions"]}
        rows={blogs.map((b) => [
          <span key="t" className="font-semibold">{b.title}</span>,
          <span key="a" className="text-[11px]">{b.author}</span>,
          <Chip key="c">{b.cat}</Chip>,
          <div key="tg" className="flex flex-wrap gap-0.5">{b.tags.map((t) => <span key={t} className="rounded-full border border-border bg-background/60 px-1.5 text-[9px] font-mono">#{t}</span>)}</div>,
          <span key="v" className="font-mono tabular">{b.views.toLocaleString()}</span>,
          <span key="r" className="font-mono tabular">{b.rt}</span>,
          b.ai ? <Chip key="ai" tone="premium"><Sparkles className="h-3 w-3" />AI</Chip> : <span key="ai" className="text-muted-foreground">—</span>,
          b.feat ? <Chip key="ft" tone="premium"><Flame className="h-3 w-3" />Featured</Chip> : <span key="ft" className="text-muted-foreground">—</span>,
          <Chip key="s" tone={b.st === "Published" ? "success" : b.st === "Draft" ? "default" : "warning"}>{b.st}</Chip>,
          <RowActs key="ac" />,
        ])}
      />
    </div>
  );
}

const AI_TOOLS = [
  { l: "Generate Blog", i: Rss, d: "Full-length SEO blog with H1–H4, images, FAQ." },
  { l: "Generate FAQ", i: HelpCircle, d: "Schema-ready Q&A tuned to focus keyword." },
  { l: "Generate Meta", i: FileText, d: "Title, description, OG, Twitter — batch." },
  { l: "Generate Tags", i: TagIcon, d: "Semantic + trending tag suggestions." },
  { l: "Generate Slug", i: LinkIcon, d: "Clean, keyword-rich URL slug." },
  { l: "Generate Keywords", i: Hash, d: "Focus, secondary, long-tail, question." },
  { l: "Generate Summary", i: ClipboardList, d: "TL;DR paragraph + bullet key-takeaways." },
  { l: "Generate CTA", i: Rocket, d: "Contextual, high-converting CTA blocks." },
  { l: "Social Caption", i: Share2, d: "LI + X + IG + WA variants with hashtags." },
  { l: "Email Content", i: MessageSquare, d: "Nurture email — subject + preview + body." },
  { l: "Product Description", i: Boxes, d: "Features / benefits / use-cases / specs." },
  { l: "Comparison", i: GitBranch, d: "Head-to-head comparison table." },
  { l: "Review", i: Star, d: "Long-form review skeleton + verdict." },
  { l: "How-To Guide", i: ClipboardList, d: "Step-by-step tutorial + HowTo schema." },
  { l: "Troubleshooting", i: AlertTriangle, d: "Common issues + fixes." },
  { l: "Documentation", i: FileText, d: "Structured docs with code samples." },
];

function AiWriterModule() {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[var(--shadow-glow)]"><Wand2 className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">AI Blog & Content Writer</div>
            <div className="text-sm font-bold">One prompt → SEO-ready blog, meta, schema, tags, social captions.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs"><option>Tone · Professional</option><option>Playful</option><option>Technical</option></select>
            <select className="rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs"><option>en-IN</option><option>en-US</option><option>hi-IN</option><option>ar-AE</option></select>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Generate</span></PillButton>
          </div>
        </div>
        <textarea rows={3} defaultValue="Write a blog: Top 10 CRM software for Indian SMBs in 2026, with pros/cons, pricing and comparison." className="mt-4 w-full rounded-lg border border-border bg-background/60 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {AI_TOOLS.map((t) => {
          const Icon = t.i;
          return (
            <Card key={t.l}>
              <div className="flex items-start justify-between">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-accent/40 bg-accent/10 text-accent"><Icon className="h-4 w-4" /></div>
                <Chip tone="premium"><Sparkles className="h-3 w-3" />AI</Chip>
              </div>
              <div className="mt-3 text-sm font-bold">{t.l}</div>
              <div className="text-[11px] text-muted-foreground">{t.d}</div>
              <div className="mt-3"><PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Play className="h-3 w-3" /> Run</span></PillButton></div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AiKeywordModule() {
  const rows = [
    { k: "vala crm alternatives", vol: 1200, diff: 32, intent: "Comparison" },
    { k: "erp for manufacturing india", vol: 3400, diff: 48, intent: "Commercial" },
    { k: "how to choose crm", vol: 2100, diff: 24, intent: "Informational" },
    { k: "hospital management pricing", vol: 1800, diff: 36, intent: "Transactional" },
    { k: "free gst billing software download", vol: 8400, diff: 42, intent: "Transactional" },
  ];
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <input placeholder="Seed keyword e.g. crm software" className="min-w-[240px] flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
          <select className="rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs"><option>India</option><option>United States</option><option>Global</option></select>
          <PillButton variant="primary"><span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Research</span></PillButton>
        </div>
      </Card>
      <Table
        head={["Keyword", "Volume", "Difficulty", "Intent", "Actions"]}
        rows={rows.map((r) => [
          <span key="k" className="font-semibold">{r.k}</span>,
          <span key="v" className="font-mono tabular">{r.vol.toLocaleString()}</span>,
          <span key="d" className="font-mono tabular">{r.diff}</span>,
          <Chip key="i" tone="accent">{r.intent}</Chip>,
          <RowActs key="a" />,
        ])}
      />
    </div>
  );
}

/* =========================================================
   21) GOOGLE / OTHER TOOLS
   ========================================================= */
function ToolGrid({ items }: { items: { l: string; d: string; st: "Connected" | "Disconnected" | "Pending" }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((t) => (
        <Card key={t.l}>
          <div className="flex items-start justify-between">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-accent"><Globe2 className="h-4 w-4" /></div>
            <Chip tone={t.st === "Connected" ? "success" : t.st === "Pending" ? "warning" : "destructive"}>{t.st}</Chip>
          </div>
          <div className="mt-3 text-sm font-bold">{t.l}</div>
          <div className="text-[11px] text-muted-foreground">{t.d}</div>
          <div className="mt-3 flex gap-1">
            <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Configure</button>
            <button className="flex-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent">Open</button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function GoogleToolsModule() {
  return <ToolGrid items={[
    { l: "Google Search Console", d: "Indexing, queries, performance", st: "Connected" },
    { l: "Google Analytics 4", d: "Traffic, engagement, revenue", st: "Connected" },
    { l: "Google Tag Manager", d: "Tag deployment", st: "Connected" },
    { l: "Google Business Profile", d: "Local SEO listings", st: "Connected" },
    { l: "Google Merchant Center", d: "Product feeds & Shopping", st: "Pending" },
    { l: "Google Ads", d: "Paid search + audiences", st: "Connected" },
    { l: "PageSpeed Insights", d: "Core Web Vitals audit", st: "Connected" },
    { l: "Google Indexing API", d: "Instant indexing", st: "Connected" },
    { l: "Google Trends", d: "Topic trend research", st: "Connected" },
    { l: "Rich Results Test", d: "Schema validator", st: "Connected" },
    { l: "Google Safe Browsing", d: "Malware / phishing check", st: "Connected" },
  ]} />;
}

function OtherToolsModule() {
  return <ToolGrid items={[
    { l: "Bing Webmaster", d: "Bing indexing & queries", st: "Connected" },
    { l: "Yandex Webmaster", d: "RU / CIS indexing", st: "Disconnected" },
    { l: "Pinterest Verification", d: "Pinterest rich pins", st: "Connected" },
    { l: "Facebook Domain", d: "Meta domain verification", st: "Connected" },
    { l: "Twitter Card Validator", d: "X card preview", st: "Connected" },
    { l: "LinkedIn Post Inspector", d: "LI card preview", st: "Connected" },
    { l: "Open Graph Checker", d: "OG debug", st: "Connected" },
    { l: "Schema Validator", d: "schema.org JSON-LD", st: "Connected" },
    { l: "Robots Tester", d: "Crawler simulation", st: "Connected" },
    { l: "Sitemap Validator", d: "XML sitemap check", st: "Connected" },
  ]} />;
}

/* =========================================================
   22) BULK OPS
   ========================================================= */
function BulkOpsModule() {
  const ops = [
    { l: "Bulk Meta Update", i: FileText }, { l: "Bulk Keyword Update", i: Hash },
    { l: "Bulk Tag Update", i: TagIcon }, { l: "Bulk Schema Update", i: FileCode2 },
    { l: "Bulk Canonical", i: LinkIcon }, { l: "Bulk Index", i: CheckCircle2 },
    { l: "Bulk NoIndex", i: EyeOff }, { l: "Bulk Redirect", i: ArrowRight },
    { l: "Bulk Delete", i: Trash2 }, { l: "Bulk Export", i: Download },
    { l: "Bulk Import", i: Upload },
  ];
  return (
    <div className="space-y-4">
      <Card>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Selection scope</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {["All Products", "All Categories", "All Blogs", "Filtered results", "Uploaded CSV"].map((s, i) => (
            <button key={s} className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${i === 0 ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-accent"}`}>{s}</button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">1,284 items selected</span>
        </div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ops.map((o) => {
          const Icon = o.i;
          return (
            <Card key={o.l}>
              <div className="flex items-start justify-between">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/60 text-accent"><Icon className="h-4 w-4" /></div>
                <Chip>Async</Chip>
              </div>
              <div className="mt-3 text-sm font-bold">{o.l}</div>
              <div className="text-[11px] text-muted-foreground">Runs in background — you'll get a job report.</div>
              <div className="mt-3"><PillButton variant="ghost"><span className="inline-flex items-center gap-1"><Play className="h-3 w-3" /> Run</span></PillButton></div>
            </Card>
          );
        })}
      </div>
      <Card>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Recent jobs</div>
        <Table
          head={["Job", "Scope", "Started", "Progress", "Status", "Actions"]}
          rows={[
            ["Bulk Meta Update", "1,284 products", "2m ago", <div key="p" className="h-1.5 w-32 overflow-hidden rounded-full bg-background/60"><div className="h-full w-3/4 bg-gradient-to-r from-accent to-cyan-glow" /></div>, <Chip key="s" tone="warning">Running</Chip>, <RowActs key="a" />],
            ["Bulk Schema Update", "342 blogs", "1h ago", <div key="p" className="h-1.5 w-32 overflow-hidden rounded-full bg-background/60"><div className="h-full w-full bg-success" /></div>, <Chip key="s" tone="success">Complete</Chip>, <RowActs key="a" />],
            ["Bulk Redirect", "24 URLs", "4h ago", <div key="p" className="h-1.5 w-32 overflow-hidden rounded-full bg-background/60"><div className="h-full w-full bg-success" /></div>, <Chip key="s" tone="success">Complete</Chip>, <RowActs key="a" />],
          ]}
        />
      </Card>
    </div>
  );
}

/* =========================================================
   23) SETTINGS
   ========================================================= */
function SettingsModule() {
  const groups = [
    { g: "Crawler", items: ["Crawl rate", "Crawl depth", "Respect robots", "JS render", "Mobile UA"] },
    { g: "Auto-fix", items: ["Auto ALT tags", "Auto schema", "Auto canonical", "Auto sitemap", "Auto ping"] },
    { g: "Notifications", items: ["Ranking drops", "Broken pages", "New backlinks", "Weekly digest", "Slack webhook"] },
    { g: "API Keys", items: ["Search Console", "GA4 property", "GSC OAuth", "OpenAI SEO", "SEMrush"] },
    { g: "Compliance", items: ["Consent mode v2", "CCPA", "GDPR", "IP anonymization", "Data retention"] },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <Card key={g.g}>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{g.g}</div>
          <div className="space-y-2">
            {g.items.map((it) => (
              <div key={it} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px]">
                <span>{it}</span>
                <label className="relative inline-flex h-4 w-8 cursor-pointer items-center">
                  <input type="checkbox" defaultChecked className="peer sr-only" />
                  <span className="h-4 w-8 rounded-full bg-background/80 transition-colors peer-checked:bg-accent" />
                  <span className="absolute left-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </label>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
