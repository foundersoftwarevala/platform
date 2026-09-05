import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/language-catalog";
import { SVLogo } from "./SVLogo";
import { AiChatPanel } from "./AiChatPanel";
import {
  Bot,
  LayoutDashboard,
  Image as ImageIcon,
  FolderTree,
  LayoutGrid,
  Target,
  CreditCard,
  MousePointerClick,
  Tag,
  BellRing,
  Users2,
  ShieldCheck,
  Star,
  HelpCircle,
  Phone,
  Search,
  Sparkles,
  Globe2,
  PinIcon,
  BarChart3,
  Settings,
  Bell,
  ChevronDown,
  ChevronRight,
  Command as CommandIcon,
  MoreHorizontal,
  Menu,
  PanelBottom,
  Filter,
  Clock,
  Layout,
  Rocket,
  Zap,
  ShieldCheck as ShieldCheckIcon,
  Wrench,
  Package,
  FileText,
  MonitorPlay,
  Newspaper,
  DollarSign,
  KeyRound,
  Download,
  Users,
  ShoppingBag,
  PenTool,
  Store,
  Handshake,
  Link2,
  Megaphone,
  QrCode,
  LifeBuoy,
  FolderOpen,
  Cpu,
  Plug,
  Mail,
  Server,
  Bookmark,
  Plus,
  CircleDot,
  LogOut,
  User as UserIcon,
  KeySquare,
  CheckCheck,
  ClipboardCheck,
  ScanLine,
  Fingerprint,
  History,
} from "lucide-react";

/**
 * Section registry — grouped for the mega menu / breadcrumb, flattened for the tab strip.
 * Ordered by workflow (Overview → Homepage → Catalog → Commerce → Growth → Ops).
 */
export const SECTION_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    id: "homepage",
    label: "Homepage",
    items: [
      { id: "topbar-manager", label: "Top Bar", icon: Menu },
      { id: "storefront-topbar", label: "Storefront Bar", icon: Menu },
      { id: "hero", label: "Hero Banner", icon: ImageIcon },
      { id: "homepage-rows", label: "Homepage Rows", icon: Layout },
      { id: "layout-order", label: "Layout Order", icon: Layout },
      { id: "walls", label: "Walls", icon: LayoutGrid },
      { id: "placement", label: "Placement", icon: Target },
      { id: "sticky", label: "Sticky", icon: PinIcon },
      { id: "footer", label: "Footer", icon: PanelBottom },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    items: [
      { id: "categories", label: "Categories", icon: FolderTree },
      { id: "products", label: "Products", icon: Package },
      { id: "product-content", label: "Product Content", icon: FileText },
      { id: "product-media", label: "Product Media", icon: ImageIcon },
      { id: "card-manager", label: "Card Manager", icon: CreditCard },
      { id: "cards", label: "Cards", icon: CreditCard },
      { id: "filters", label: "Filters", icon: Filter },
      { id: "demo", label: "Demo System", icon: MonitorPlay },
    ],
  },
  {
    id: "commerce",
    label: "Commerce",
    items: [
      { id: "pricing", label: "Pricing", icon: DollarSign },
      { id: "orders", label: "Orders", icon: ShoppingBag },
      { id: "payments", label: "Payments", icon: CreditCard },
      { id: "license", label: "License", icon: KeyRound },
      { id: "downloads", label: "Downloads", icon: Download },
      { id: "releases", label: "Releases", icon: Rocket },
      { id: "customers", label: "Customers", icon: Users },
      { id: "offers", label: "Offers", icon: Tag },
      { id: "popups", label: "Popups", icon: BellRing },
      { id: "upcoming", label: "Upcoming", icon: Clock },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    items: [
      { id: "marketing", label: "Marketing", icon: Mail },
      { id: "seo", label: "SEO", icon: Globe2 },
      { id: "search", label: "Search", icon: Search },
      { id: "ai", label: "AI Recs", icon: Sparkles },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "blog", label: "Blog", icon: Newspaper },
      { id: "partners", label: "Partners", icon: Users2 },
      { id: "affiliate", label: "Affiliate", icon: Link2 },
      { id: "influencer", label: "Influencer", icon: Megaphone },
      { id: "authors", label: "Authors", icon: PenTool },
      { id: "vendors", label: "Vendors", icon: Store },
      { id: "resellers", label: "Resellers", icon: Handshake },
      { id: "reviews", label: "Reviews", icon: Star },
      { id: "trust", label: "Trust", icon: ShieldCheck },
      { id: "faq", label: "FAQ", icon: HelpCircle },
      { id: "contact", label: "Contact", icon: Phone },
      { id: "qr", label: "QR System", icon: QrCode },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      { id: "approval", label: "Author Approval", icon: ClipboardCheck },
      { id: "moderation", label: "Moderation", icon: ShieldCheck },
      { id: "quality", label: "Quality Gate", icon: CheckCheck },
      { id: "security-scan", label: "Upload Scanner", icon: ScanLine },
      { id: "favicon", label: "Brand Protect", icon: Fingerprint },
      { id: "demo-domain", label: "Demo Domain", icon: Globe2 },
      { id: "demo-sandbox", label: "Demo Sandbox", icon: MonitorPlay },
      { id: "product-url", label: "Product URLs", icon: Link2 },
      { id: "seo-auto", label: "SEO Automation", icon: Sparkles },
      { id: "ai-content", label: "AI Content", icon: Bot },
      { id: "leads", label: "Leads", icon: Phone },
      { id: "product-analytics", label: "Product Analytics", icon: BarChart3 },
      { id: "audit", label: "Audit & History", icon: History },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    items: [
      { id: "actions", label: "Actions", icon: MousePointerClick },
      { id: "toolkit", label: "Action Toolkit", icon: Wrench },
      { id: "automation", label: "Automation", icon: Zap },
      { id: "micro", label: "Micro-Features", icon: Zap },
      { id: "media", label: "Media Library", icon: FolderOpen },
      { id: "ai-providers", label: "AI Providers", icon: Cpu },
      { id: "api", label: "API", icon: Plug },
      { id: "integrations", label: "Integrations", icon: Plug },
      { id: "deployment", label: "Deployment", icon: Rocket },
      { id: "integrity", label: "Integrity", icon: ShieldCheckIcon },
      { id: "security", label: "Security", icon: ShieldCheck },
      { id: "system", label: "System", icon: Server },
      { id: "support", label: "Support", icon: LifeBuoy },
      { id: "extra", label: "Extra", icon: Bookmark },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

export const SECTIONS = SECTION_GROUPS.flatMap((g) =>
  g.items.map((it) => ({ ...it, group: g.id, groupLabel: g.label })),
);

export type SectionId = (typeof SECTIONS)[number]["id"];

type NotifItem = { id: string; title: string; time: string; tone: "info" | "success" | "warning" };
const INITIAL_NOTIFS: NotifItem[] = [
  { id: "n1", title: "Homepage build deployed successfully", time: "just now", tone: "success" },
  { id: "n2", title: "3 products missing SEO description", time: "12m", tone: "warning" },
  { id: "n3", title: "New partner request from ByteForge", time: "1h", tone: "info" },
];

export function MarketplaceTopBar({
  active,
  onChange,
}: {
  active: SectionId;
  onChange: (id: SectionId) => void;
}) {
  const { translate: t } = useLanguage();
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<null | "more" | "notif" | "profile" | "quick">(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>(INITIAL_NOTIFS);

  const activeSection = useMemo(() => SECTIONS.find((s) => s.id === active), [active]);

  useEffect(() => {
    function measure() {
      const nav = navRef.current;
      if (!nav) return;
      const navWidth = nav.clientWidth;
      const reserveForMore = 104;
      let used = 0;
      const overflow = new Set<string>();
      let overflowing = false;
      for (const s of SECTIONS) {
        const el = itemRefs.current[s.id];
        if (!el) continue;
        const w = el.offsetWidth + 4;
        if (!overflowing && used + w <= navWidth - reserveForMore) {
          used += w;
        } else {
          overflowing = true;
          overflow.add(s.id);
        }
      }
      setOverflowIds(overflow);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (navRef.current) ro.observe(navRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest?.("[data-menu-root]")) setOpenMenu(null);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  // Cmd/Ctrl+K → command palette
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const overflowSections = SECTIONS.filter((s) => overflowIds.has(s.id));
  const activeOverflowed = overflowIds.has(active);
  const unread = notifs.length;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[oklch(0.16_0.03_240/0.78)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

      {/* Row 1 — brand, workspace, search, actions */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <SVLogo />
          <div className="hidden min-w-0 leading-tight md:block">
            <div className="truncate text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
              {t("Marketplace CMS")}
            </div>
            <div className="truncate text-sm font-bold text-foreground">
              {t("Software Vala · Boss Console")}
            </div>
          </div>

          {/* Workspace switcher (indicator) */}
          <button
            type="button"
            className="ml-1 hidden items-center gap-2 rounded-full border border-border bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground xl:flex"
            title={t("Current workspace")}
          >
            <span className="h-4 w-4 rounded-md bg-gradient-to-br from-primary to-accent ring-1 ring-white/10" />
            {t("Production")}
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Global search / cmd hint */}
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="hidden max-w-xl flex-1 items-center gap-2 rounded-full border border-border bg-white/[0.04] px-4 py-1.5 text-left ring-rim transition-colors hover:border-[oklch(0.80_0.13_192/0.35)] hover:bg-white/[0.06] lg:flex"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-xs text-muted-foreground">
            {t("Search products, banners, walls, offers, partners…")}
          </span>
          <kbd className="flex items-center gap-1 rounded-md border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] tabular text-muted-foreground">
            <CommandIcon className="h-3 w-3" /> K
          </kbd>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {/* AI Chat */}
          <button
            onClick={() => setChatOpen(true)}
            title={t("Ask Vala AI")}
            className="group relative flex items-center gap-1.5 rounded-full border border-[oklch(0.80_0.13_192/0.30)] bg-[oklch(0.80_0.13_192/0.10)] px-3 py-1.5 text-[12px] font-semibold text-foreground transition-all hover:bg-[oklch(0.80_0.13_192/0.18)] hover:shadow-[0_0_18px_-6px_oklch(0.80_0.13_192/0.55)]"
          >
            <Bot className="h-3.5 w-3.5 text-accent" />
            <span className="hidden md:inline">{t("AI Chat")}</span>
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_currentColor]" />
          </button>

          {/* Quick actions */}
          <div data-menu-root className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu((v) => (v === "quick" ? null : "quick"));
              }}
              title={t("Quick actions")}
              className="flex items-center gap-1 rounded-full border border-border bg-white/[0.04] p-1.5 pl-2 pr-2 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              <ChevronDown className="h-3 w-3" />
            </button>
            {openMenu === "quick" && (
              <MenuCard className="right-0 w-56">
                <MenuHeader label={t("Create")} />
                <MenuItem icon={Package} label={t("New product")} onClick={() => { onChange("products"); setOpenMenu(null); }} />
                <MenuItem icon={ImageIcon} label={t("New hero banner")} onClick={() => { onChange("hero"); setOpenMenu(null); }} />
                <MenuItem icon={LayoutGrid} label={t("New wall")} onClick={() => { onChange("walls"); setOpenMenu(null); }} />
                <MenuItem icon={Tag} label={t("New offer")} onClick={() => { onChange("offers"); setOpenMenu(null); }} />
                <div className="my-1 h-px bg-border" />
                <MenuItem icon={Rocket} label={t("Deploy homepage")} onClick={() => { onChange("deployment"); setOpenMenu(null); }} />
              </MenuCard>
            )}
          </div>

          {/* Notifications */}
          <div data-menu-root className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu((v) => (v === "notif" ? null : "notif"));
              }}
              title={t("Notifications")}
              className="relative rounded-full border border-border bg-white/[0.04] p-2 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold tabular text-accent-foreground shadow-[0_0_8px_oklch(0.80_0.13_192/0.7)]">
                  {unread}
                </span>
              )}
            </button>
            {openMenu === "notif" && (
              <MenuCard className="right-0 w-80">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {t("Notifications")}
                  </div>
                  <button
                    onClick={() => setNotifs([])}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                  >
                    <CheckCheck className="h-3 w-3" /> {t("Mark all read")}
                  </button>
                </div>
                {notifs.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {t("You're all caught up.")}
                  </div>
                ) : (
                  <div className="max-h-80 space-y-0.5 overflow-y-auto pr-0.5">
                    {notifs.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.05]"
                      >
                        <span
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_currentColor] ${
                            n.tone === "success"
                              ? "bg-emerald-400 text-emerald-400"
                              : n.tone === "warning"
                                ? "bg-amber-400 text-amber-400"
                                : "bg-accent text-accent"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-foreground">
                            {n.title}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {n.time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-1 border-t border-border pt-1">
                  <MenuItem
                    icon={Bell}
                    label={t("Open notifications center")}
                    onClick={() => { onChange("notifications"); setOpenMenu(null); }}
                  />
                </div>
              </MenuCard>
            )}
          </div>

          {/* Profile */}
          <div data-menu-root className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu((v) => (v === "profile" ? null : "profile"));
              }}
              className="flex items-center gap-2 rounded-full border border-border bg-white/[0.04] p-1 pr-3 transition-colors hover:bg-white/[0.08]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-black text-primary-foreground ring-1 ring-white/10">
                B
              </span>
              <span className="hidden text-xs font-semibold md:inline">{t("Boss")}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            {openMenu === "profile" && (
              <MenuCard className="right-0 w-60">
                <div className="flex items-center gap-2.5 px-2 pb-2 pt-1">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-black text-primary-foreground ring-1 ring-white/10">
                    B
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-foreground">{t("Boss Operator")}</div>
                    <div className="truncate text-[10px] text-muted-foreground">boss@softwarevala.com</div>
                  </div>
                </div>
                <div className="my-1 h-px bg-border" />
                <MenuItem icon={UserIcon} label={t("Profile")} onClick={() => setOpenMenu(null)} />
                <MenuItem icon={Settings} label={t("Settings")} onClick={() => { onChange("settings"); setOpenMenu(null); }} />
                <MenuItem icon={KeySquare} label={t("API keys")} onClick={() => { onChange("api"); setOpenMenu(null); }} />
                <MenuItem icon={ShieldCheck} label={t("Security")} onClick={() => { onChange("security"); setOpenMenu(null); }} />
                <div className="my-1 h-px bg-border" />
                <MenuItem icon={LogOut} label={t("Sign out")} onClick={() => setOpenMenu(null)} tone="danger" />
              </MenuCard>
            )}
          </div>
        </div>
      </div>

      {/* Section tab strip */}
      <div ref={navRef} className="relative flex items-center px-4 pb-2 md:px-8">
        <nav className="flex flex-1 items-center gap-1 overflow-hidden">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === active;
            const hidden = overflowIds.has(s.id);
            return (
              <button
                key={s.id}
                ref={(el) => {
                  itemRefs.current[s.id] = el;
                }}
                onClick={() => onChange(s.id)}
                style={hidden ? { visibility: "hidden", position: "absolute", pointerEvents: "none" } : undefined}
                className={`group relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                  isActive
                    ? "border border-[oklch(0.80_0.13_192/0.35)] bg-[oklch(0.80_0.13_192/0.12)] text-foreground shadow-[0_0_18px_-6px_oklch(0.80_0.13_192/0.55),inset_0_1px_0_oklch(1_0_0/0.06)]"
                    : "border border-transparent text-muted-foreground hover:border-border hover:bg-white/[0.04] hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
                )}
                <Icon className="h-3.5 w-3.5" />
                {t(s.label)}
              </button>
            );
          })}
        </nav>

        {overflowSections.length > 0 && (
          <div data-menu-root className="relative ml-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu((v) => (v === "more" ? null : "more"));
              }}
              className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                activeOverflowed
                  ? "border border-[oklch(0.80_0.13_192/0.35)] bg-[oklch(0.80_0.13_192/0.12)] text-foreground"
                  : "border border-border bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
              }`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              {t("More")}
              <span className="rounded-full bg-accent/15 px-1.5 font-mono text-[10px] font-bold tabular text-accent">
                {overflowSections.length}
              </span>
            </button>
            {openMenu === "more" && (
              <div className="glass-strong absolute right-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-2xl">
                <div className="max-h-[65vh] overflow-y-auto p-2">
                  {SECTION_GROUPS.map((g) => {
                    const items = g.items.filter((it) => overflowIds.has(it.id));
                    if (items.length === 0) return null;
                    return (
                      <div key={g.id} className="mb-2 last:mb-0">
                        <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          {t(g.label)}
                        </div>
                        <div className="grid grid-cols-2 gap-0.5">
                          {items.map((s) => {
                            const Icon = s.icon;
                            const isActive = s.id === active;
                            return (
                              <button
                                key={s.id}
                                onClick={() => {
                                  onChange(s.id as SectionId);
                                  setOpenMenu(null);
                                }}
                                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] font-semibold transition-colors ${
                                  isActive
                                    ? "bg-[oklch(0.80_0.13_192/0.12)] text-foreground"
                                    : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                                }`}
                              >
                                <Icon className="h-3.5 w-3.5 text-accent" />
                                <span className="truncate">{t(s.label)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Breadcrumb / current module indicator */}
      {activeSection && (
        <div className="flex items-center gap-2 border-t border-border/70 bg-[oklch(0.14_0.03_240/0.55)] px-4 py-1.5 text-[11px] md:px-8">
          <CircleDot className="h-3 w-3 text-accent" />
          <span className="font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("Marketplace")}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="font-semibold text-muted-foreground">{t(activeSection.groupLabel)}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="font-bold text-foreground">{t(activeSection.label)}</span>
          <span className="ml-auto hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_currentColor]" />
            {t("Live")}
          </span>
        </div>
      )}

      <AiChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />

      {cmdOpen && (
        <CommandPalette
          onClose={() => setCmdOpen(false)}
          onPick={(id) => {
            onChange(id);
            setCmdOpen(false);
          }}
        />
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */

function MenuCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`glass-strong absolute top-full z-50 mt-2 overflow-hidden rounded-2xl p-1.5 ${className}`}
    >
      {children}
    </div>
  );
}

function MenuHeader({ label }: { label: string }) {
  return (
    <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  tone?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${
        tone === "danger"
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${tone === "danger" ? "" : "text-accent"}`} />
      {label}
    </button>
  );
}

function CommandPalette({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (id: SectionId) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return SECTIONS.slice(0, 12);
    return SECTIONS.filter(
      (it) => it.label.toLowerCase().includes(s) || it.groupLabel.toLowerCase().includes(s),
    ).slice(0, 20);
  }, [q]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-24 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-xl overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Jump to a section, page, or setting…")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="rounded-md border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] tabular text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              {t("No matching sections.")}
            </div>
          ) : (
            filtered.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.id}
                  onClick={() => onPick(it.id as SectionId)}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-md border border-border bg-white/[0.04] text-accent">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 text-[13px] font-semibold text-foreground">{it.label}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {t(it.groupLabel)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
