import { useState } from "react";
import {
  GripVertical, Eye, EyeOff, PinIcon, ChevronUp, ChevronDown, Plus, Sparkles,
  Star, Briefcase, TrendingUp, Award, Activity, PlayCircle, GraduationCap,
  Users2, HelpCircle, Rocket, PanelBottom, FolderTree, Newspaper, Trophy,
  Search, Image as ImageIcon, MousePointerClick, Filter, ArrowUpDown,
  Tag as TagIcon, Languages, DollarSign, Type, Palette, Wand2,
  ArrowLeft, History, Layout, Layers, Settings as SettingsIcon, Copy,
  Archive, Trash2, MonitorPlay, Smartphone, Monitor, Tablet,
} from "lucide-react";
import { PageHeader, PillButton, SubNav, StatCard, Card, EmptyHint } from "../ui";
import { TableToolbar, RowActions, BulkActionBar, ActionButton, ColorPicker } from "../actions";

type Row = {
  n: string; title: string; icon: any; status: "live" | "draft" | "hidden";
  pinned?: boolean; sub: string[]; meta?: string;
};

const ROWS: Row[] = [
  { n: "01", title: "Featured Software", icon: Star, status: "live", pinned: true,
    sub: ["Row","Cards","Priority","Featured Products","Badges","CTA","Layout","Background","Visibility","Sorting","Display Rules"], meta: "8 cards · auto-rotate" },
  { n: "02", title: "Shop By Industry", icon: Briefcase, status: "live",
    sub: ["Industries","Icons","Industry Banner","Industry Cards","Industry Order","Industry Visibility"], meta: "14 industries" },
  { n: "03", title: "Trending Now", icon: TrendingUp, status: "live",
    sub: ["Trending Products","Trending Logic","Trending Badge","Trending Order","Trending Visibility"], meta: "live signal" },
  { n: "04", title: "Top Selling", icon: Award, status: "live",
    sub: ["Top Selling Products","Top Selling Badge","Ranking","Display Order"], meta: "30d window" },
  { n: "05", title: "New Releases", icon: Sparkles, status: "live",
    sub: ["New Products","Release Badge","Version","Release Order"], meta: "v-tag" },
  { n: "06", title: "Shop By Category", icon: FolderTree, status: "live",
    sub: ["Categories","Category Icons","Category Banner","Category Cards","Hierarchy"], meta: "20 categories" },
  { n: "07", title: "AI Zone", icon: Sparkles, status: "live",
    sub: ["AI Cards","AI Services","AI Recommendation","AI Compare","AI Search"], meta: "AI Gateway" },
  { n: "08", title: "Success Stories", icon: Trophy, status: "live",
    sub: ["Stories","Customer Images","Company Logo","Case Study","Metrics"] },
  { n: "09", title: "Awards & Champions", icon: Award, status: "draft",
    sub: ["Awards","Champions","Recognition","Winner Cards"] },
  { n: "10", title: "Live Marketplace Activity", icon: Activity, status: "live",
    sub: ["Recent Activity","Recent Purchases","Recent Downloads","Recent Reviews","Recent Updates"], meta: "real-time" },
  { n: "11", title: "Vala TV", icon: PlayCircle, status: "live",
    sub: ["Videos","Playlists","Categories","Featured Videos","Video Thumbnail"] },
  { n: "12", title: "Vala Academy", icon: GraduationCap, status: "live",
    sub: ["Courses","Training","Certificates","Videos","Learning Paths"] },
  { n: "13", title: "Partner Ecosystem", icon: Users2, status: "live",
    sub: ["Partners","Partner Cards","Partner Categories","Partner Banner"] },
  { n: "14", title: "FAQ", icon: HelpCircle, status: "live",
    sub: ["Questions","Answers","Categories","Popular Questions"] },
  { n: "15", title: "Enterprise CTA", icon: Rocket, status: "live",
    sub: ["Headline","Description","CTA Buttons","Background","Illustration"] },
  { n: "16", title: "Footer", icon: PanelBottom, status: "live",
    sub: ["Columns","Links","Social Links","Newsletter","Legal Links","Language","Currency","Country","Copyright"] },
];

const TONE: Record<string, string> = {
  live:   "text-success border-success/40 bg-success/10",
  draft:  "text-warning border-warning/40 bg-warning/10",
  hidden: "text-muted-foreground border-border bg-white/[0.04]",
};

export function HomepageRowsSection() {
  const [tab, setTab] = useState("All");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const filtered = tab === "All" ? ROWS : ROWS.filter((r) => r.status === tab.toLowerCase());

  if (openRow) {
    const row = ROWS.find((r) => r.n === openRow)!;
    return <RowWorkspace row={row} onBack={() => setOpenRow(null)} />;
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Homepage Rows · 16 modules"
        title="Homepage Row Manager"
        description="Reorder, gate, and configure every row of the marketplace homepage. Open any row to access its full enterprise workspace."
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><ArrowUpDown className="h-3.5 w-3.5"/>Reorder Layout</span></PillButton>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><Palette className="h-3.5 w-3.5"/>Theme</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5"/>New Row</span></PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Rows" value={String(ROWS.length)} />
        <StatCard label="Live" value={String(ROWS.filter(r=>r.status==="live").length)} tone="success" />
        <StatCard label="Drafts" value={String(ROWS.filter(r=>r.status==="draft").length)} tone="warning" />
        <StatCard label="Pinned" value={String(ROWS.filter(r=>r.pinned).length)} tone="premium" />
      </div>

      <SubNav items={["All", "Live", "Draft", "Hidden"]} active={tab} onChange={setTab} />
      <TableToolbar title="Homepage Rows" count={filtered.length} extraActions={["publish", "feature"]} />

      <div className="space-y-2.5">
        {filtered.map((r) => {
          const Icon = r.icon;
          return (
            <div
              key={r.n}
              className="glass group rounded-2xl p-3.5 transition-all hover:-translate-y-0.5 hover:border-[oklch(0.80_0.13_192/0.45)]"
            >
              <div className="flex items-center gap-3">
                <button className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-background/40 text-muted-foreground hover:text-foreground">
                  <GripVertical className="h-3.5 w-3.5"/>
                </button>
                <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md border border-border bg-background/40 font-mono text-[11px] font-bold tabular text-accent">
                  {r.n}
                </span>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-[oklch(0.80_0.13_192/0.10)] text-accent">
                  <Icon className="h-4.5 w-4.5"/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-[13px] font-bold">{r.title}</div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE[r.status]}`}>{r.status}</span>
                    {r.pinned && <span className="inline-flex items-center gap-1 rounded-full border border-premium/40 bg-premium/10 px-2 py-0.5 text-[10px] font-bold uppercase text-premium"><PinIcon className="h-2.5 w-2.5"/>Pinned</span>}
                    <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{r.sub.length} sub-modules</span>
                  </div>
                  {r.meta && <div className="mt-0.5 text-[11px] text-muted-foreground">{r.meta}</div>}
                </div>
                <div className="hidden md:flex items-center gap-1">
                  <IconBtn icon={ChevronUp}/>
                  <IconBtn icon={ChevronDown}/>
                  <IconBtn icon={r.status==="hidden"?EyeOff:Eye}/>
                </div>
                <RowActions ids={["edit","view","duplicate","archive","delete"]}/>
                <button
                  onClick={() => setOpenRow(r.n)}
                  className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[oklch(0.80_0.13_192/0.45)] bg-[oklch(0.80_0.13_192/0.12)] px-3 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-[oklch(0.80_0.13_192/0.20)]"
                >
                  Manage
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <GlobalManagementBlock/>
    </div>
  );
}

function IconBtn({ icon: Icon }: { icon: any }) {
  return (
    <button className="grid h-7 w-7 place-items-center rounded-md border border-border bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]">
      <Icon className="h-3.5 w-3.5"/>
    </button>
  );
}

/* ============================================================
   ROW WORKSPACE — dedicated enterprise workspace per row
   ============================================================ */
function RowWorkspace({ row, onBack }: { row: Row; onBack: () => void }) {
  const [tab, setTab] = useState("Overview");
  const [selected, setSelected] = useState<number>(0);
  const Icon = row.icon;

  return (
    <div className="px-4 py-8 md:px-8">
      {/* breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.04] px-2.5 py-1.5 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5"/> Homepage Rows
        </button>
        <span>/</span>
        <span className="font-mono text-accent">Row {row.n}</span>
        <span>/</span>
        <span className="text-foreground">{row.title}</span>
      </div>

      <PageHeader
        eyebrow={`Row ${row.n} · ${row.sub.length} sub-modules`}
        title={`${row.title} Workspace`}
        description={`Dedicated enterprise workspace to manage every element of the “${row.title}” row — preview, cards, sub-modules, visibility, theme and history.`}
        actions={
          <>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5"/>Preview</span></PillButton>
            <PillButton variant="ghost"><span className="inline-flex items-center gap-1.5"><Copy className="h-3.5 w-3.5"/>Duplicate</span></PillButton>
            <PillButton variant="primary"><span className="inline-flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5"/>Publish</span></PillButton>
          </>
        }
      />

      {/* identity strip */}
      <div className="glass mb-6 flex flex-wrap items-center gap-3 rounded-2xl p-3.5">
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-[oklch(0.80_0.13_192/0.10)] text-accent">
          <Icon className="h-5 w-5"/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold">{row.title}</div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE[row.status]}`}>{row.status}</span>
            {row.pinned && <span className="inline-flex items-center gap-1 rounded-full border border-premium/40 bg-premium/10 px-2 py-0.5 text-[10px] font-bold uppercase text-premium"><PinIcon className="h-2.5 w-2.5"/>Pinned</span>}
            {row.meta && <span className="font-mono text-[10px] text-muted-foreground">· {row.meta}</span>}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Slot order, audience targeting and theme all configurable from this workspace.</div>
        </div>
        <div className="flex items-center gap-1.5">
          <ActionButton action="edit" size="sm"/>
          <ActionButton action="duplicate" size="sm"/>
          <ActionButton action="archive" size="sm"/>
          <ActionButton action="delete" size="sm"/>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Cards" value="12" />
        <StatCard label="Impressions 7d" value="48.2K" tone="success"/>
        <StatCard label="CTR" value="4.8%" tone="premium"/>
        <StatCard label="Last Edit" value="2h" tone="warning"/>
      </div>

      <SubNav
        items={["Overview", "Cards", "Sub-modules", "Layout & Theme", "Visibility", "History"]}
        active={tab}
        onChange={setTab}
      />

      {tab === "Overview" && <OverviewTab row={row} />}
      {tab === "Cards" && <CardsTab/>}
      {tab === "Sub-modules" && <SubmodulesTab row={row} selected={selected} setSelected={setSelected}/>}
      {tab === "Layout & Theme" && <ThemeTab/>}
      {tab === "Visibility" && <VisibilityTab/>}
      {tab === "History" && <HistoryTab/>}
    </div>
  );
}

function OverviewTab({ row }: { row: Row }) {
  const Icon = row.icon;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent">Live Preview</div>
          <div className="flex items-center gap-1">
            <IconBtn icon={Smartphone}/><IconBtn icon={Tablet}/><IconBtn icon={Monitor}/>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-[oklch(0.18_0.03_240)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-accent"/>
              <div className="text-sm font-bold">{row.title}</div>
            </div>
            <span className="text-[11px] text-muted-foreground">See all →</span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-lg border border-border bg-gradient-to-br from-primary/20 via-surface to-accent/15"/>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-accent">Quick Controls</div>
        <div className="space-y-2">
          {[
            { l: "Pin to top", i: PinIcon },
            { l: "Auto-rotate cards", i: ArrowUpDown },
            { l: "Show on mobile", i: Smartphone },
            { l: "Show on tablet", i: Tablet },
            { l: "Show on desktop", i: Monitor },
            { l: "AI Recommendations", i: Sparkles },
          ].map((q) => (
            <div key={q.l} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-[12px] font-medium"><q.i className="h-3.5 w-3.5 text-accent"/>{q.l}</span>
              <span className="inline-flex h-5 w-9 items-center rounded-full bg-success/40 p-0.5"><span className="ml-auto h-4 w-4 rounded-full bg-success"/></span>
            </div>
          ))}
        </div>
        <EmptyHint text="Changes here apply only to this row."/>
      </Card>
    </div>
  );
}

function CardsTab() {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const cards = Array.from({ length: 12 }).map((_, i) => ({
    id: i, title: `Card ${i + 1}`, badge: i % 3 === 0 ? "Featured" : i % 3 === 1 ? "New" : "Trending",
  }));
  const toggle = (id: number) => {
    const next = new Set(sel);
    next.has(id) ? next.delete(id) : next.add(id);
    setSel(next);
  };
  return (
    <>
      <TableToolbar title="Cards in this row" count={cards.length} extraActions={["publish", "feature"]}/>
      <BulkActionBar selectedCount={sel.size} onClear={() => setSel(new Set())}/>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => {
          const isSel = sel.has(c.id);
          return (
            <div key={c.id} className={`glass overflow-hidden rounded-2xl transition-all ${isSel ? "border-[oklch(0.80_0.13_192/0.55)] shadow-[0_0_0_1px_oklch(0.80_0.13_192/0.35)]" : "hover:-translate-y-0.5"}`}>
              <div className="relative h-32 bg-gradient-to-br from-primary/30 via-surface to-accent/20">
                <input
                  type="checkbox" checked={isSel} onChange={() => toggle(c.id)}
                  className="absolute left-2 top-2 h-4 w-4 cursor-pointer accent-[oklch(0.80_0.13_192)]"
                />
                <span className="absolute right-2 top-2 rounded bg-background/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-premium backdrop-blur">{c.badge}</span>
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-bold">{c.title}</div>
                  <span className="font-mono text-[10px] text-muted-foreground">#{c.id + 1}</span>
                </div>
                <RowActions ids={["edit","view","duplicate","pin","archive","delete"]}/>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SubmodulesTab({ row, selected, setSelected }: { row: Row; selected: number; setSelected: (n: number) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="!p-3">
        <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sub-modules</div>
        <div className="space-y-1">
          {row.sub.map((s, i) => {
            const active = i === selected;
            return (
              <button
                key={s} onClick={() => setSelected(i)}
                className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[12px] font-semibold transition-all ${active ? "border-[oklch(0.80_0.13_192/0.55)] bg-[oklch(0.80_0.13_192/0.12)] text-foreground" : "border-border bg-background/40 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"}`}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="font-mono text-[10px] tabular text-accent">{String(i + 1).padStart(2, "0")}</span>
                  {s}
                </span>
                <ChevronUp className="h-3.5 w-3.5 rotate-90 opacity-50"/>
              </button>
            );
          })}
        </div>
      </Card>

      <div>
        <TableToolbar title={row.sub[selected]} count={undefined} extraActions={["publish"]}/>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {["Add Item","Edit Item","View Item","Approve","Reject","Duplicate","Archive","Restore","Pin","Hide","Show","Move Up","Move Down","Sort","Filter","History"].map((a) => (
            <div key={a} className="glass flex items-center justify-between rounded-xl p-3">
              <div className="flex items-center gap-2 text-[12px] font-semibold">
                <Wand2 className="h-3.5 w-3.5 text-accent"/>{a}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Action</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemeTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-accent">Layout</div>
        <div className="grid grid-cols-3 gap-2">
          {["Carousel","Grid","Masonry","Stacked","Hero+Grid","Marquee"].map((l) => (
            <button key={l} className="rounded-lg border border-border bg-background/40 px-2 py-3 text-[12px] font-semibold hover:border-[oklch(0.80_0.13_192/0.45)]">{l}</button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {["Spacing","Card Size","Card Ratio","Animation"].map((l) => (
            <div key={l} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{l}</div>
              <div className="mt-1 font-mono text-[13px] tabular">Auto</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-accent">Background & Color</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorPicker label="Background" defaultValue="#0F172A"/>
          <ColorPicker label="Accent" defaultValue="#06B6D4"/>
          <ColorPicker label="Title Color" defaultValue="#FFFFFF"/>
          <ColorPicker label="Badge Color" defaultValue="#F5C518"/>
        </div>
      </Card>
    </div>
  );
}

function VisibilityTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-accent">Audience & Device</div>
        <div className="space-y-2">
          {[
            { l: "All visitors", on: true }, { l: "Logged-in only", on: false },
            { l: "Enterprise plan", on: false }, { l: "Mobile", on: true },
            { l: "Tablet", on: true }, { l: "Desktop", on: true },
            { l: "Geo-targeting", on: false }, { l: "Language-targeting", on: false },
          ].map((q) => (
            <div key={q.l} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
              <span className="text-[12px] font-medium">{q.l}</span>
              <span className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 ${q.on ? "bg-success/40" : "bg-white/[0.08]"}`}>
                <span className={`h-4 w-4 rounded-full ${q.on ? "ml-auto bg-success" : "bg-muted-foreground/60"}`}/>
              </span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-accent">Schedule</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {["Start Date","End Date","Timezone","Recurrence"].map((l) => (
            <div key={l} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{l}</div>
              <div className="mt-1 font-mono text-[13px] tabular">—</div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-border bg-background/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Display Rules</div>
          <div className="mt-2 space-y-1.5">
            {["After login","First-time visitor","Returning visitor","Cart abandoned"].map((r) => (
              <div key={r} className="flex items-center justify-between text-[12px]">
                <span>{r}</span>
                <span className="font-mono text-[10px] text-muted-foreground">off</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function HistoryTab() {
  const events = [
    { t: "2h ago", who: "Boss", what: "Updated cards order" },
    { t: "Yesterday", who: "System", what: "Auto-rotated featured cards" },
    { t: "3d ago", who: "Boss", what: "Changed background color" },
    { t: "1w ago", who: "Editor", what: "Published row" },
    { t: "2w ago", who: "Boss", what: "Created row" },
  ];
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-accent"/>
        <div className="text-[11px] font-bold uppercase tracking-wider text-accent">Activity</div>
      </div>
      <ol className="relative space-y-3 border-l border-border pl-4">
        {events.map((e, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[19px] top-1.5 h-2.5 w-2.5 rounded-full border border-border bg-accent shadow-[0_0_8px_currentColor]"/>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[12px] font-semibold">{e.what}</span>
              <span className="font-mono text-[10px] text-muted-foreground">by {e.who}</span>
              <span className="font-mono text-[10px] text-muted-foreground">· {e.t}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ============================================================
   GLOBAL MANAGEMENT BLOCK
   ============================================================ */
const GLOBAL_GROUPS: { title: string; items: { label: string; icon: any }[] }[] = [
  { title: "Discovery", items: [
    { label: "Homepage Search", icon: Search },
    { label: "Homepage Filters", icon: Filter },
    { label: "Homepage Sorting", icon: ArrowUpDown },
    { label: "Homepage Tags", icon: TagIcon },
    { label: "Homepage Badges", icon: Star },
    { label: "Homepage Labels", icon: TagIcon },
  ]},
  { title: "Media", items: [
    { label: "Homepage Icons", icon: Sparkles },
    { label: "Homepage Images", icon: ImageIcon },
    { label: "Homepage Videos", icon: PlayCircle },
  ]},
  { title: "Content", items: [
    { label: "Homepage SEO", icon: Search },
    { label: "Homepage Blog", icon: Newspaper },
    { label: "Homepage News", icon: Newspaper },
    { label: "Homepage Documentation", icon: HelpCircle },
    { label: "Homepage Support", icon: HelpCircle },
    { label: "Homepage Announcements", icon: Sparkles },
  ]},
  { title: "Commerce", items: [
    { label: "Homepage Popups", icon: MousePointerClick },
    { label: "Homepage Promotions", icon: TagIcon },
    { label: "Homepage Coupons", icon: TagIcon },
    { label: "Homepage Deals", icon: TagIcon },
    { label: "Homepage Collections", icon: FolderTree },
    { label: "Homepage Bundles", icon: FolderTree },
  ]},
  { title: "Design System", items: [
    { label: "Homepage Themes", icon: Palette },
    { label: "Homepage Colors", icon: Palette },
    { label: "Homepage Typography", icon: Type },
    { label: "Homepage Spacing", icon: ArrowUpDown },
    { label: "Homepage Components", icon: Wand2 },
    { label: "Homepage Widgets", icon: Wand2 },
    { label: "Homepage Cards", icon: Wand2 },
    { label: "Homepage Sections", icon: FolderTree },
    { label: "Homepage Layout", icon: Layout },
  ]},
  { title: "Structure", items: [
    { label: "Homepage Navigation", icon: MousePointerClick },
    { label: "Homepage Footer", icon: PanelBottom },
  ]},
  { title: "Locale", items: [
    { label: "Languages", icon: Languages },
    { label: "Currencies", icon: DollarSign },
  ]},
];

function GlobalManagementBlock() {
  return (
    <section className="mt-10">
      <div className="mb-5 flex items-baseline gap-3">
        <h2 className="text-xl font-bold">Homepage Global Management</h2>
        <span className="h-px w-24 bg-gradient-to-r from-border to-transparent"/>
        <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {GLOBAL_GROUPS.reduce((n,g)=>n+g.items.length,0)} controls
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GLOBAL_GROUPS.map((g) => (
          <div key={g.title} className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-accent">{g.title}</div>
              <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{g.items.length}</span>
            </div>
            <div className="space-y-1.5">
              {g.items.map((it) => {
                const I = it.icon;
                return (
                  <button key={it.label} className="flex w-full items-center justify-between rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-left transition-all hover:border-[oklch(0.80_0.13_192/0.40)] hover:bg-white/[0.05]">
                    <span className="flex items-center gap-2 text-[12px] font-medium">
                      <I className="h-3.5 w-3.5 text-accent"/>{it.label}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manage</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
