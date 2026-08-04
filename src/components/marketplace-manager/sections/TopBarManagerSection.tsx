import { useState } from "react";
import {
  Image as ImageIcon, Type, Menu as MenuIcon, ListOrdered, EyeOff, LayoutGrid,
  Package, FolderTree, Lightbulb, Tag, UserPlus, Globe2, DollarSign, Sparkles,
  Search, LogIn, UserCircle, Bell, Megaphone, ImagePlus, Zap, PinIcon,
  Smartphone, Tablet, Monitor, GripVertical, Eye, Pencil, Plus, ChevronRight,
} from "lucide-react";
import { PageHeader, PillButton, SubNav, StatCard } from "../ui";
import { TableToolbar, RowActions } from "../actions";

type ModuleDef = {
  id: string; label: string; icon: any; group: string; status: "live" | "draft" | "hidden";
  meta?: string;
};

const MODULES: ModuleDef[] = [
  { id: "logo", label: "Logo", icon: ImageIcon, group: "Brand", status: "live", meta: "SV mark · 32px" },
  { id: "name", label: "Marketplace Name", icon: Type, group: "Brand", status: "live", meta: "Software Vala" },
  { id: "nav", label: "Navigation", icon: MenuIcon, group: "Navigation", status: "live", meta: "12 items" },
  { id: "nav-order", label: "Navigation Order", icon: ListOrdered, group: "Navigation", status: "live", meta: "drag · drop" },
  { id: "nav-visibility", label: "Navigation Visibility", icon: EyeOff, group: "Navigation", status: "live", meta: "role-gated" },
  { id: "mega", label: "Mega Menu", icon: LayoutGrid, group: "Menus", status: "live", meta: "4 columns" },
  { id: "products-menu", label: "Products Menu", icon: Package, group: "Menus", status: "live", meta: "8 groups" },
  { id: "categories-menu", label: "Categories Menu", icon: FolderTree, group: "Menus", status: "live", meta: "20 cats" },
  { id: "solutions-menu", label: "Solutions Menu", icon: Lightbulb, group: "Menus", status: "draft", meta: "6 personas" },
  { id: "pricing-menu", label: "Pricing Menu", icon: Tag, group: "Menus", status: "live", meta: "4 tiers" },
  { id: "apply-dropdown", label: "Apply Dropdown", icon: UserPlus, group: "Menus", status: "live", meta: "Vendor · Reseller · Affiliate" },
  { id: "language", label: "Language", icon: Globe2, group: "Locale", status: "live", meta: "14 langs" },
  { id: "currency", label: "Currency", icon: DollarSign, group: "Locale", status: "live", meta: "USD · EUR · INR …" },
  { id: "ai-chat", label: "AI Chat", icon: Sparkles, group: "Tools", status: "live", meta: "assistant pill" },
  { id: "search", label: "Search", icon: Search, group: "Tools", status: "live", meta: "⌘K global" },
  { id: "login", label: "Login", icon: LogIn, group: "Identity", status: "live" },
  { id: "register", label: "Register", icon: UserCircle, group: "Identity", status: "live" },
  { id: "notification", label: "Notification", icon: Bell, group: "Identity", status: "live", meta: "live dot" },
  { id: "announcement", label: "Announcement Bar", icon: Megaphone, group: "Bars", status: "live" },
  { id: "header-banner", label: "Header Banner", icon: ImagePlus, group: "Bars", status: "draft" },
  { id: "top-promotion", label: "Top Promotion", icon: Zap, group: "Bars", status: "hidden" },
  { id: "sticky", label: "Sticky Header", icon: PinIcon, group: "Behavior", status: "live", meta: "blur · saturate" },
  { id: "mobile", label: "Mobile Header", icon: Smartphone, group: "Responsive", status: "live" },
  { id: "tablet", label: "Tablet Header", icon: Tablet, group: "Responsive", status: "live" },
  { id: "desktop", label: "Desktop Header", icon: Monitor, group: "Responsive", status: "live" },
];

const STATUS_TONE: Record<string, string> = {
  live:   "text-success border-success/40 bg-success/10",
  draft:  "text-warning border-warning/40 bg-warning/10",
  hidden: "text-muted-foreground border-border bg-white/[0.04]",
};

export function TopBarManagerSection() {
  const [tab, setTab] = useState("All");
  const groups = ["All", ...Array.from(new Set(MODULES.map((m) => m.group)))];
  const list = tab === "All" ? MODULES : MODULES.filter((m) => m.group === tab);

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Top Bar Manager · 25 modules"
        title="Storefront Top Bar Manager"
        description="Control every visible piece of the marketplace header — brand, navigation, mega menus, locale, identity, bars, sticky behavior and responsive variants."
        actions={
          <>
            <PillButton variant="ghost">Reorder Nav</PillButton>
            <PillButton variant="primary">
              <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New Module</span>
            </PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Modules" value={String(MODULES.length)} />
        <StatCard label="Live" value={String(MODULES.filter(m=>m.status==="live").length)} tone="success" />
        <StatCard label="Drafts" value={String(MODULES.filter(m=>m.status==="draft").length)} tone="warning" />
        <StatCard label="Hidden" value={String(MODULES.filter(m=>m.status==="hidden").length)} />
      </div>

      <SubNav items={groups} active={tab} onChange={setTab} />
      <TableToolbar title="Top Bar Modules" count={list.length} extraActions={["publish", "feature"]} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.id} className="glass rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:border-[oklch(0.80_0.13_192/0.45)]">
              <div className="flex items-start gap-3">
                <button className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border bg-background/40 text-muted-foreground hover:text-foreground">
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-[oklch(0.80_0.13_192/0.10)] text-accent">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[13px] font-bold">{m.label}</div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[m.status]}`}>
                      {m.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">{m.group}</span>
                    {m.meta && <span> · {m.meta}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <RowActions ids={["edit", "view", "duplicate", "archive"]} />
                <button className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-accent hover:text-cyan-glow">
                  Configure <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
