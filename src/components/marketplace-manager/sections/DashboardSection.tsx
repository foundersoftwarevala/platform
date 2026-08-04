import {
  TrendingUp,
  Package,
  CheckCircle2,
  Clock3,
  Users2,
  Store,
  ShoppingCart,
  Download,
  DollarSign,
  RotateCcw,
  Activity,
  Plus,
  Megaphone,
  Tag,
  FolderTree,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { Card, EmptyHint, PageHeader, PillButton, SectionRow, StatCard } from "../ui";

const WALLS = [
  "Featured Products",
  "Top Selling",
  "Trending",
  "New Launches",
  "Recently Updated",
  "Best Rated",
  "Most Downloaded",
  "AI Ready",
  "Offline Software",
  "SaaS Software",
];

type NavId =
  | "products" | "hero" | "walls" | "categories" | "offers" | "marketing"
  | "analytics" | "approval" | "payments" | "ai" | "seo" | "homepage-rows"
  | "layout-order" | "authors" | "vendors" | "orders" | "downloads"
  | "reviews" | "notifications";

export function DashboardSection({ onNavigate }: { onNavigate?: (id: NavId) => void } = {}) {
  const go = (id: NavId) => onNavigate?.(id);
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Marketplace Control Center"
        title="Welcome back to your marketplace"
        description="One control room for products, walls, banners, offers, partners and revenue across the Software Vala marketplace."
        actions={
          <>
            <PillButton variant="ghost" onClick={() => window.open("/marketplace", "_blank")}>
              <span className="inline-flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5" /> View Storefront
              </span>
            </PillButton>
            <PillButton variant="primary" onClick={() => go("products")}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Product
              </span>
            </PillButton>
          </>
        }
      />

      {/* Hero ribbon — frosted prism with aurora gradient + dot matrix overlay */}
      <div
        className="glow-primary relative mb-10 overflow-hidden rounded-[28px] border border-[oklch(1_0_0/0.10)] p-6 md:p-12"
        style={{ background: "var(--gradient-hero)" }}
      >
        {/* dot matrix */}
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-[0.18]" />
        {/* aurora drift highlights */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-premium/20 blur-[140px]" />
        {/* top inner rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <div className="relative grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[oklch(0.80_0.13_192/0.30)] bg-[oklch(0.80_0.13_192/0.10)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
              Slide 1 of 10 · Operator Console
            </div>
            <h2 className="text-[40px] font-bold leading-[1.05] tracking-tight md:text-[56px]">
              Run the <span className="text-gradient">entire marketplace</span>
              <br />
              from one operator console.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Manage 20 categories, 18 homepage walls, 20 banner slots, offers,
              partners and approvals. Every dial hooked to live Software Vala
              data — no mock numbers.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <PillButton variant="primary" onClick={() => go("homepage-rows")}>Open Homepage Manager</PillButton>
              <PillButton variant="ghost" onClick={() => go("marketing")}>Launch Campaign</PillButton>
              <PillButton variant="premium" onClick={() => go("analytics")}>Boost Revenue</PillButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { l: "Revenue Today", tone: "text-accent", bar: "bg-accent" },
              { l: "Active Listings", tone: "text-success", bar: "bg-success" },
              { l: "Pending Approvals", tone: "text-warning", bar: "bg-warning" },
              { l: "Marketplace Score", tone: "text-premium", bar: "bg-premium" },
            ].map((m) => (
              <div
                key={m.l}
                className="group relative overflow-hidden rounded-2xl border border-[oklch(1_0_0/0.08)] bg-white/[0.04] p-4 backdrop-blur-xl ring-rim transition-all hover:border-[oklch(0.80_0.13_192/0.30)] hover:bg-white/[0.06]"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {m.l}
                </div>
                <div className={`mt-3 font-mono text-2xl font-bold tabular ${m.tone}`}>—</div>
                <div className="mt-3 h-px w-full bg-border">
                  <div className={`h-full w-1/3 ${m.bar} opacity-70`} />
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">Awaiting live data</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Zone */}
      <SectionRow title="Marketplace KPIs" cta="Open Analytics" onCta={() => go("analytics")}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Products" value="—" delta="Live from catalog" icon={<Package className="h-4 w-4" />} />
          <StatCard label="Active" value="—" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
          <StatCard label="Pending" value="—" tone="warning" icon={<Clock3 className="h-4 w-4" />} />
          <StatCard label="Authors" value="—" icon={<Users2 className="h-4 w-4" />} />
          <StatCard label="Vendors" value="—" icon={<Store className="h-4 w-4" />} />
          <StatCard label="Orders" value="—" icon={<ShoppingCart className="h-4 w-4" />} />
          <StatCard label="Downloads" value="—" icon={<Download className="h-4 w-4" />} />
          <StatCard label="Revenue" value="—" tone="premium" icon={<DollarSign className="h-4 w-4" />} />
          <StatCard label="Refunds" value="—" tone="destructive" icon={<RotateCcw className="h-4 w-4" />} />
          <StatCard label="Conversion" value="—" icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Health" value="—" tone="success" icon={<Activity className="h-4 w-4" />} />
          <StatCard label="MP Score" value="—" tone="premium" icon={<Sparkles className="h-4 w-4" />} />
        </div>
      </SectionRow>

      {/* Quick actions */}
      <SectionRow title="Quick Actions" cta="Customize" onCta={() => go("homepage-rows")}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {([
            { l: "Add Product", i: Plus, id: "products" as NavId },
            { l: "Create Category", i: FolderTree, id: "categories" as NavId },
            { l: "Create Collection", i: LayoutGridIcon, id: "walls" as NavId },
            { l: "Launch Campaign", i: Megaphone, id: "marketing" as NavId },
            { l: "Create Offer", i: Tag, id: "offers" as NavId },
            { l: "Create Coupon", i: Tag, id: "offers" as NavId },
            { l: "Feature Product", i: Sparkles, id: "walls" as NavId },
            { l: "Approve Listing", i: CheckCircle2, id: "approval" as NavId },
            { l: "Send Announcement", i: Megaphone, id: "notifications" as NavId },
            { l: "Homepage Manager", i: ArrowUpRight, id: "homepage-rows" as NavId },
          ]).map((a) => {
            const Icon = a.i;
            return (
              <button
                key={a.l}
                onClick={() => go(a.id)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-surface/40 p-4 text-left transition-all hover:border-accent/40 hover:bg-surface-elevated"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 text-accent group-hover:from-primary group-hover:to-accent group-hover:text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold">{a.l}</div>
              </button>
            );
          })}
        </div>
      </SectionRow>

      {/* Product Walls (Netflix horizontal) */}
      <SectionRow title="Product Walls" count={WALLS.length} cta="Open Wall Manager" onCta={() => go("walls")}>
        <div className="space-y-6">
          {WALLS.slice(0, 4).map((w) => (
            <ProductWallRow key={w} title={w} onEdit={() => go("walls")} />
          ))}
        </div>
      </SectionRow>

      {/* Two-column ops */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">Approval Center</h3>
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
              Live queue
            </span>
          </div>
          <ul className="divide-y divide-border">
            {["Pending Products", "Pending Updates", "Pending Vendors", "Pending Authors", "Pending Collections", "Pending Campaigns"].map((t) => (
              <li key={t} className="flex items-center justify-between py-3">
                <span className="text-sm">{t}</span>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">—</span>
                  <button className="text-xs font-semibold text-accent hover:text-cyan-glow">Review</button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">Revenue Center</h3>
            <span className="text-xs text-muted-foreground">INR · live</span>
          </div>
          <div className="space-y-2">
            {[
              ["Today", "—"],
              ["This Week", "—"],
              ["This Month", "—"],
              ["This Year", "—"],
              ["Refunds", "—"],
              ["Net Revenue", "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg bg-surface/40 px-3 py-2">
                <span className="text-sm text-muted-foreground">{k}</span>
                <span className="text-sm font-bold">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 h-24 rounded-lg border border-dashed border-border/60 bg-background/40 p-3">
            <EmptyHint text="Revenue graph renders when transactions stream in" />
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">Activity Feed</h3>
            <span className="text-xs text-muted-foreground">Real time</span>
          </div>
          <ul className="space-y-3">
            {[
              "New Products",
              "New Vendors",
              "New Authors",
              "New Orders",
              "New Reviews",
              "New Downloads",
              "New Approvals",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t}</div>
                  <div className="text-xs text-muted-foreground">Connecting to live stream…</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* AI Insights */}
      <SectionRow title="AI Marketplace Insights" cta="Open AI Assistant">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { t: "Revenue Assistant", d: "Forecasts, opportunity gaps, vendor lift." },
            { t: "SEO Assistant", d: "Page-level meta, schema and ranking fixes." },
            { t: "Campaign Assistant", d: "Drafts banners, copy and targeting." },
          ].map((c) => (
            <Card key={c.t} className="border-accent/20">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 px-2.5 py-1 text-xs font-semibold text-accent">
                <Sparkles className="h-3 w-3" /> AI
              </div>
              <h4 className="text-base font-bold">{c.t}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
              <button className="mt-4 text-sm font-semibold text-accent hover:text-cyan-glow">Ask now →</button>
            </Card>
          ))}
        </div>
      </SectionRow>
    </div>
  );
}

function LayoutGridIcon(props: { className?: string }) {
  return <FolderTree {...props} />;
}

function ProductWallRow({ title, onEdit }: { title: string; onEdit?: () => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
        <button onClick={onEdit} className="text-xs font-semibold text-accent hover:text-cyan-glow">
          Edit wall →
        </button>
      </div>
      <div className="scroll-row flex gap-3 overflow-x-auto pb-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="group relative h-44 w-72 flex-none overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface to-surface-elevated"
          >
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(135deg,oklch(0.66_0.21_255/0.4),oklch(0.82_0.16_200/0.2))]" />
            <div className="relative flex h-full flex-col justify-between p-4">
              <div className="flex items-center justify-between">
                <span className="rounded bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent backdrop-blur">
                  Slot {i + 1}
                </span>
                <span className="rounded bg-premium/20 px-2 py-0.5 text-[10px] font-bold text-premium">
                  Empty
                </span>
              </div>
              <div>
                <div className="text-sm font-bold">Assign a product</div>
                <div className="text-xs text-muted-foreground">
                  Drag from catalog or auto-fill
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
