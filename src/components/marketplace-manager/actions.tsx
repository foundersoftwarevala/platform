import { useState, type ComponentType, type ReactNode } from "react";
import {
  Plus, Pencil, Eye, Check, X, Trash2, Upload, Download, FileDown, Copy,
  Archive, RotateCcw, Lock, Unlock, Star, Pin, Tag, DollarSign, KeyRound,
  Rocket, PauseCircle, Search, SlidersHorizontal, ArrowUpDown, Columns3,
  RefreshCw, Settings, MoreHorizontal, History, FileText, ImageIcon,
  PlayCircle, MessageSquare, ClipboardList, Receipt,
} from "lucide-react";

/* ============================================================
   ENTERPRISE ACTION CONTRACT
   - Every list/table section: <TableToolbar />
   - Every row / card:        <RowActions />
   - Multi-select state:      <BulkActionBar />
   - Detail / PDP screens:    <DetailActionRail />
   - Theming surfaces:        <ColorPicker /> / <ThemeFieldset />
   Permissions are filtered via the `can` predicate.
   ============================================================ */

export type ActionId =
  | "add" | "edit" | "view" | "approve" | "reject" | "delete"
  | "upload" | "import" | "export" | "duplicate" | "archive" | "restore"
  | "enable" | "disable" | "feature" | "pin" | "category" | "pricing"
  | "license" | "publish" | "unpublish";

export type BulkActionId =
  | "bulk-approve" | "bulk-reject" | "bulk-delete" | "bulk-export"
  | "bulk-import" | "bulk-publish" | "bulk-archive"
  | "bulk-category" | "bulk-price" | "bulk-license";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "premium";

const TONE: Record<Tone, string> = {
  neutral:
    "border border-border bg-white/[0.04] text-foreground hover:bg-white/[0.08] hover:border-[oklch(1_0_0/0.14)]",
  primary:
    "border border-[oklch(0.62_0.20_255/0.45)] bg-[oklch(0.62_0.20_255/0.14)] text-foreground hover:bg-[oklch(0.62_0.20_255/0.22)] shadow-[0_0_18px_-8px_oklch(0.62_0.20_255/0.7)]",
  success:
    "border border-success/40 bg-success/10 text-success hover:bg-success/15",
  warning:
    "border border-warning/40 bg-warning/10 text-warning hover:bg-warning/15",
  danger:
    "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15",
  premium:
    "border border-premium/40 bg-premium/10 text-premium hover:bg-premium/15",
};

type ActionDef = {
  id: ActionId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: Tone;
};

export const ACTIONS: Record<ActionId, ActionDef> = {
  add:        { id: "add",        label: "Add",        icon: Plus,         tone: "primary" },
  edit:       { id: "edit",       label: "Edit",       icon: Pencil,       tone: "neutral" },
  view:       { id: "view",       label: "View",       icon: Eye,          tone: "neutral" },
  approve:    { id: "approve",    label: "Approve",    icon: Check,        tone: "success" },
  reject:     { id: "reject",     label: "Reject",     icon: X,            tone: "danger" },
  delete:     { id: "delete",     label: "Delete",     icon: Trash2,       tone: "danger" },
  upload:     { id: "upload",     label: "Upload",     icon: Upload,       tone: "neutral" },
  import:     { id: "import",     label: "Import",     icon: Download,     tone: "neutral" },
  export:     { id: "export",     label: "Export",     icon: FileDown,     tone: "neutral" },
  duplicate:  { id: "duplicate",  label: "Duplicate",  icon: Copy,         tone: "neutral" },
  archive:    { id: "archive",    label: "Archive",    icon: Archive,      tone: "warning" },
  restore:    { id: "restore",    label: "Restore",    icon: RotateCcw,    tone: "neutral" },
  enable:     { id: "enable",     label: "Enable",     icon: Unlock,       tone: "success" },
  disable:    { id: "disable",    label: "Disable",    icon: Lock,         tone: "warning" },
  feature:    { id: "feature",    label: "Feature",    icon: Star,         tone: "premium" },
  pin:        { id: "pin",        label: "Pin",        icon: Pin,          tone: "neutral" },
  category:   { id: "category",   label: "Category",   icon: Tag,          tone: "neutral" },
  pricing:    { id: "pricing",    label: "Pricing",    icon: DollarSign,   tone: "neutral" },
  license:    { id: "license",    label: "License",    icon: KeyRound,     tone: "neutral" },
  publish:    { id: "publish",    label: "Publish",    icon: Rocket,       tone: "primary" },
  unpublish:  { id: "unpublish",  label: "Unpublish",  icon: PauseCircle,  tone: "warning" },
};

export const BULK_ACTIONS: { id: BulkActionId; label: string; icon: ComponentType<{ className?: string }>; tone: Tone }[] = [
  { id: "bulk-approve",  label: "Approve",         icon: Check,      tone: "success" },
  { id: "bulk-reject",   label: "Reject",          icon: X,          tone: "danger"  },
  { id: "bulk-publish",  label: "Publish",         icon: Rocket,     tone: "primary" },
  { id: "bulk-archive",  label: "Archive",         icon: Archive,    tone: "warning" },
  { id: "bulk-delete",   label: "Delete",          icon: Trash2,     tone: "danger"  },
  { id: "bulk-export",   label: "Export",          icon: FileDown,   tone: "neutral" },
  { id: "bulk-import",   label: "Import",          icon: Download,   tone: "neutral" },
  { id: "bulk-category", label: "Change Category", icon: Tag,        tone: "neutral" },
  { id: "bulk-price",    label: "Update Price",    icon: DollarSign, tone: "neutral" },
  { id: "bulk-license",  label: "Update License",  icon: KeyRound,   tone: "neutral" },
];

// ---------- single button ----------
export function ActionButton({
  action,
  size = "md",
  label,
  onClick,
}: {
  action: ActionId;
  size?: "sm" | "md";
  label?: boolean;
  onClick?: () => void;
}) {
  const a = ACTIONS[action];
  const Icon = a.icon;
  const pad = size === "sm" ? "h-7 px-2 text-[11px]" : "h-8 px-3 text-[12px]";
  return (
    <button
      onClick={onClick}
      title={a.label}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-all active:scale-[0.98] ${pad} ${TONE[a.tone]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label !== false && <span>{a.label}</span>}
    </button>
  );
}

// ---------- row / card action cluster ----------
export function RowActions({
  ids,
  can,
  compact = true,
}: {
  ids: ActionId[];
  can?: (id: ActionId) => boolean;
  compact?: boolean;
}) {
  const allowed = ids.filter((id) => (can ? can(id) : true));
  return (
    <div className="flex items-center gap-1">
      {allowed.map((id) => (
        <ActionButton key={id} action={id} size="sm" label={!compact} />
      ))}
    </div>
  );
}

// ---------- table toolbar (top of every list module) ----------
export function TableToolbar({
  title,
  count,
  extraActions,
  onAdd,
  searchPlaceholder = "Search…",
}: {
  title?: string;
  count?: number;
  extraActions?: ActionId[];
  onAdd?: () => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="glass mb-5 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
      {title && (
        <div className="mr-1 flex items-center gap-2 pl-2 pr-2">
          <span className="text-[12px] font-bold">{title}</span>
          {typeof count === "number" && (
            <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 font-mono text-[10px] tabular text-muted-foreground">
              {count}
            </span>
          )}
        </div>
      )}
      <div className="flex h-8 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          placeholder={searchPlaceholder}
          className="flex-1 bg-transparent text-[12px] placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <ToolBtn icon={SlidersHorizontal} label="Filter" />
      <ToolBtn icon={ArrowUpDown} label="Sort" />
      <ToolBtn icon={Columns3} label="Columns" />
      <ToolBtn icon={RefreshCw} />
      <ToolBtn icon={Download} label="Import" />
      <ToolBtn icon={FileDown} label="Export" />
      {extraActions?.map((id) => <ActionButton key={id} action={id} size="sm" />)}
      <ActionButton action="add" size="sm" onClick={onAdd} />
      <ToolBtn icon={Settings} />
    </div>
  );
}

function ToolBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white/[0.04] px-2.5 text-[11px] font-semibold text-muted-foreground transition-all hover:bg-white/[0.08] hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      {label && <span>{label}</span>}
    </button>
  );
}

// ---------- bulk action bar (shows when selectedCount > 0) ----------
export function BulkActionBar({
  selectedCount,
  onClear,
  can,
}: {
  selectedCount: number;
  onClear?: () => void;
  can?: (id: BulkActionId) => boolean;
}) {
  if (selectedCount <= 0) return null;
  const items = BULK_ACTIONS.filter((b) => (can ? can(b.id) : true));
  return (
    <div className="glass-strong sticky top-[136px] z-30 mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
      <div className="flex items-center gap-2 pl-2 pr-1">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/20 px-2 font-mono text-[11px] font-bold tabular text-foreground ring-1 ring-primary/40">
          {selectedCount}
        </span>
        <span className="text-[12px] font-semibold text-muted-foreground">selected</span>
      </div>
      <span className="mx-1 h-5 w-px bg-border" />
      {items.map((b) => {
        const Icon = b.icon;
        return (
          <button
            key={b.id}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-all active:scale-[0.98] ${TONE[b.tone]}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {b.label}
          </button>
        );
      })}
      <button
        onClick={onClear}
        className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white/[0.04] px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" /> Clear
      </button>
    </div>
  );
}

// ---------- detail-page action rail ----------
export function DetailActionRail({ can }: { can?: (id: ActionId) => boolean }) {
  const primary: ActionId[] = ["edit", "approve", "reject", "publish", "unpublish", "duplicate", "archive", "delete"];
  const extras: { label: string; icon: ComponentType<{ className?: string }> }[] = [
    { label: "Preview",         icon: Eye },
    { label: "Live Demo",       icon: PlayCircle },
    { label: "Video",           icon: PlayCircle },
    { label: "Gallery",         icon: ImageIcon },
    { label: "Documentation",   icon: FileText },
    { label: "Version History", icon: History },
    { label: "Reviews",         icon: MessageSquare },
    { label: "Ratings",         icon: Star },
    { label: "License",         icon: KeyRound },
    { label: "Purchase History",icon: Receipt },
    { label: "Audit Logs",      icon: ClipboardList },
  ];
  const allowed = primary.filter((id) => (can ? can(id) : true));
  return (
    <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
      {allowed.map((id) => <ActionButton key={id} action={id} size="sm" />)}
      <span className="mx-1 h-5 w-px bg-border" />
      {extras.map((e) => (
        <button
          key={e.label}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-white/[0.04] px-2.5 text-[11px] font-semibold text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
        >
          <e.icon className="h-3.5 w-3.5" />
          {e.label}
        </button>
      ))}
      <button className="ml-auto inline-flex h-7 items-center justify-center rounded-lg border border-border bg-white/[0.04] px-2 text-muted-foreground hover:text-foreground">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------- color picker ----------
const PRESETS = [
  "#0F172A","#1E293B","#0EA5E9","#06B6D4","#22C55E","#F59E0B","#F5C518","#EF4444",
  "#0C6478","#15919B","#09D1C7","#46DFB1","#80EE98","#213A58","#FFFFFF","#000000",
];

export function ColorPicker({
  label,
  defaultValue = "#0EA5E9",
}: { label: string; defaultValue?: string }) {
  const [v, setV] = useState(defaultValue);
  const [mode, setMode] = useState<"HEX" | "RGB" | "HSL">("HEX");
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="flex overflow-hidden rounded-md border border-border text-[10px] font-bold">
          {(["HEX","RGB","HSL"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 ${mode === m ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:bg-white/[0.05]"}`}
            >{m}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-lg ring-1 ring-border" style={{ background: v }}>
          <input
            type="color"
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background/60 px-2 py-1.5 font-mono text-[12px] tabular focus:border-accent/50 focus:outline-none"
        />
        <button
          onClick={() => setV(defaultValue)}
          className="rounded-lg border border-border bg-white/[0.04] px-2 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
          title="Reset to default"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setV(p)}
            title={p}
            className="h-5 w-5 rounded-md ring-1 ring-border transition-transform hover:scale-110"
            style={{ background: p }}
          />
        ))}
      </div>
    </div>
  );
}

export function ThemeFieldset({ children, title }: { title: string; children: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 text-sm font-bold">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}
