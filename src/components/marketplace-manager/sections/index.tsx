import { useState, type ReactNode } from "react";
import {
  Plus,
  Calendar,
  Globe2,
  Smartphone,
  Eye,
  Edit3,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  Filter,
  CheckCircle2,
  Star,
  ShoppingCart,
  Heart,
  Share2,
  Bell,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Search as SearchIcon,
  Sparkles,
  ShieldCheck,
  Tag,
  TrendingUp,
  Users2,
} from "lucide-react";
import { Card, EmptyHint, PageHeader, PillButton, StatCard, SubNav, SectionRow } from "../ui";
import { TableToolbar, RowActions, BulkActionBar } from "../actions";

// ---------- HERO BANNER MANAGER ----------
// Real, DB-backed implementation lives in ./HeroSlidesManager.tsx
export { HeroBannerSection } from "./HeroSlidesManager";

// ---------- CATEGORY MANAGER (DB-backed) ----------
export { CategoriesAdmin as CategoriesSection } from "./MarketplaceCatalogAdmin";

// ---------- WALL MANAGER ----------
const WALL_LIST = [
  "Featured Products","Top Selling","Trending","New Launches","Recently Updated","AI Ready","Offline","SaaS",
  "Recommended","Best Rated","Most Downloaded","Most Viewed","Coming Soon","Staff Picks","Editor Choice",
  "Industry Collections","Product Collections","AI Recommendations"
];
export function WallsSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Wall Manager · 18 walls"
        title="Storefront Walls"
        description="Netflix-style content rows. Enable, reorder, assign products manually or via rules."
        actions={<PillButton variant="primary">Add Wall</PillButton>}
      />
      <TableToolbar title="Walls" count={WALL_LIST.length} extraActions={["publish"]} />
      <div className="space-y-3">
        {WALL_LIST.map((w, i) => (
          <div key={w} className="glass flex items-center justify-between rounded-xl p-4">
            <div className="flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-bold">{w}</div>
                <div className="text-[11px] text-muted-foreground">Slot #{i + 1} · Auto-fill rule · — products</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">Enabled</span>
              <RowActions ids={["view","edit","duplicate","feature","pin","archive","delete"]} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- PRODUCT PLACEMENT ----------
export function PlacementSection() {
  const cells = [
    "Homepage Featured", "Trending Placement", "Top Selling Placement",
    "Recommended Placement", "Collection Placement", "Category Placement",
    "Manual Placement", "Automatic Placement",
  ];
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Product Placement" title="Merchandising Console" description="Pin products into homepage slots. Mix manual and rules-based fill." />
      <div className="grid gap-4 md:grid-cols-2">
        {cells.map((c) => (
          <Card key={c}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">{c}</h3>
              <PillButton variant="ghost">Assign</PillButton>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg border border-dashed border-border bg-background/40" />
              ))}
            </div>
            <EmptyHint text="Empty slots auto-fill from the rule engine" />
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- PRODUCT CARD MANAGER ----------
export function CardsSection() {
  const fields = [
    "Premium Thumbnail","Thumbnail Gallery","Hover Preview","3D Thumbnail",
    "Software Name","Category","Industry","Version","Last Updated","Product Status",
    "Rating","Reviews","Downloads","Views","Price","License","Delivery Time","Support Status",
  ];
  const cardActions = [
    "View Details","Quick View","Buy Now","Add to Cart","Add to Collection",
    "Wishlist","Compare","Share","Live Demo","Demo Video","Notify Me",
  ];
  const badges = [
    "New","Trending","Featured","Best Seller","Editor Choice","Staff Pick",
    "AI Ready","Cloud","Offline","SaaS","Enterprise","Verified",
  ];
  const platforms = ["Windows","macOS","Linux","Android","iOS","Web"];
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Product Card Manager" title="Card composition" description="Toggle fields, badges, platforms and actions shown on every product card across the storefront." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <h3 className="mb-3 text-base font-bold">Visible Fields</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {fields.map((f) => <Toggle key={f} label={f} on />)}
          </div>
          <h3 className="mb-3 mt-6 text-base font-bold">Card Actions</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {cardActions.map((a) => <Toggle key={a} label={a} on />)}
          </div>
          <h3 className="mb-3 mt-6 text-base font-bold">Badges</h3>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b} className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{b}</span>
            ))}
          </div>
          <h3 className="mb-3 mt-6 text-base font-bold">Platform Badges</h3>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <span key={p} className="rounded-full border border-border bg-background/40 px-3 py-1 text-xs font-semibold text-foreground">{p}</span>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</div>
          <PreviewProductCard />
          <div className="mt-3 text-[10px] text-muted-foreground">Hover thumbnail to reveal media reel & quick actions.</div>
        </Card>
      </div>
    </div>
  );
}

// ---------- PRODUCT ACTION MANAGER ----------
export function ActionsSection() {
  const actions = [
    ["View Details", Eye],["Buy Now", ShoppingCart],["Add to Cart", ShoppingCart],
    ["Wishlist", Heart],["Compare", TrendingUp],["Share", Share2],["Notify Me", Bell],
    ["Request Demo", Sparkles],["Live Demo", Sparkles],["Reviews", Star],
  ] as const;
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Product Action Manager" title="Action layer" description="Enable, disable, reorder and theme every action available on product cards and detail pages." />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {actions.map(([l, I]) => (
          <div key={l} className="glass flex items-center justify-between rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-accent"><I className="h-4 w-4" /></div>
              <div className="text-sm font-semibold">{l}</div>
            </div>
            <Switch on />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- OFFERS ----------
export function OffersSection() {
  const types = ["Deal Of The Day","Weekly Offer","Bundle Offer","Festival Offer","New Launch Offer","Limited Time Offer"];
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Offer Manager"
        title="Deals & Promotions"
        description="AppSumo-style campaign rails: countdowns, bundles and seasonal promotions."
        actions={<PillButton variant="premium">+ New Offer</PillButton>}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {types.map((t, i) => (
          <Card key={t} className="relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-premium/20 blur-2xl" />
            <div className="relative">
              <div className="mb-2 inline-flex items-center gap-1 rounded bg-premium/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-premium">
                <Tag className="h-3 w-3" /> {t}
              </div>
              <h3 className="text-lg font-bold">Up to 70% off bundles</h3>
              <p className="mt-1 text-xs text-muted-foreground">Schedule, target and track each campaign individually.</p>
              <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Slot {i + 1}</span>
                <span>Ends —</span>
              </div>
              <div className="mt-3 flex gap-2">
                <PillButton variant="ghost">Edit</PillButton>
                <PillButton variant="primary">Publish</PillButton>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- POPUPS ----------
export function PopupsSection() {
  const types = ["Entry Popup","Exit Popup","Scroll Popup","Product Popup","Cart Popup","Apply Popup","Announcement"];
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Popup Manager" title="Popups & Modals" description="Targeted overlays with rule-based triggers." actions={<PillButton variant="primary">+ Popup</PillButton>} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <Card key={t}>
            <div className="mb-2 inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">{t}</div>
            <h3 className="text-base font-bold">Unconfigured</h3>
            <p className="mt-1 text-xs text-muted-foreground">Set trigger (entry, scroll %, exit intent), audience and creative.</p>
            <div className="mt-4 flex items-center justify-between">
              <Switch />
              <PillButton variant="ghost">Configure</PillButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- PARTNERS ----------
export function PartnersSection() {
  const types = ["Reseller","Vendor","Author","Affiliate","Influencer","Franchise"];
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Partner Manager" title="Partner Programs" description="HubSpot + PartnerStack style program management." />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <Card key={t}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 text-accent"><Users2 className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-bold">{t}</div>
                  <div className="text-[11px] text-muted-foreground">— active partners</div>
                </div>
              </div>
              <Switch on />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {["Apps", "Live", "GMV"].map((k) => (
                <div key={k} className="rounded-lg bg-background/40 py-2">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="text-sm font-bold">—</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- TRUST ----------
export function TrustSection() {
  const items = ["Verified Product","Verified Vendor","Verified Author","Verified Reviews","Instant Delivery","Secure Purchase"];
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Trust Manager" title="Trust Layer" description="Badges, counters and verification ribbons that appear sitewide." />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <Card key={t}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success"><ShieldCheck className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="text-sm font-bold">{t}</div>
                <div className="text-[11px] text-muted-foreground">Shown on cards, PDP and footer</div>
              </div>
              <Switch on />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- REVIEWS ----------
export function ReviewsSection() {
  const [tab, setTab] = useState("Queue");
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Review Manager" title="Reviews & Ratings" description="G2-style moderation, replies and analytics." />
      <SubNav items={["Queue","Latest","Top","Video","Reported","Replies"]} active={tab} onChange={setTab} />
      <TableToolbar title="Reviews" />
      <BulkActionBar selectedCount={0} />
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/40 to-accent/40" />
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold">Author Name</div>
                    <div className="flex text-premium">{Array.from({ length: 5 }).map((_, s) => <Star key={s} className="h-3 w-3 fill-current" />)}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">on Product Name · awaiting moderation</div>
                  <p className="mt-2 text-sm text-muted-foreground">Review content appears here when live data is connected.</p>
                </div>
              </div>
              <RowActions ids={["view","approve","reject","archive","delete"]} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- FAQ ----------
export function FaqSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="FAQ Manager" title="Help Center" description="Notion-style FAQ blocks with categories and ordering." actions={<PillButton variant="primary">+ Question</PillButton>} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</div>
          {["General","Pricing","Licensing","Delivery","Refunds","Support"].map((c, i) => (
            <button key={c} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${i === 0 ? "bg-surface text-foreground" : "text-muted-foreground hover:bg-surface/50"}`}>
              <span>{c}</span><span className="text-xs">—</span>
            </button>
          ))}
        </Card>
        <Card>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">General</div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-background/40 p-4">
                <div className="text-sm font-bold">Question title {i + 1}</div>
                <p className="mt-1 text-xs text-muted-foreground">Answer body — connect to FAQ data source.</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- CONTACT ----------
export function ContactSection() {
  const items = [
    ["Email", Mail, "hello@softwarevala.com"],
    ["Phone", Phone, "+91 —"],
    ["WhatsApp", MessageCircle, "+91 —"],
    ["Address", MapPin, "—"],
  ] as const;
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Contact Manager" title="Storefront contact" description="Channels surfaced in the footer and contact page." />
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(([l, I, v]) => (
          <Card key={l}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent"><I className="h-5 w-5" /></div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{l}</div>
                  <div className="text-sm font-bold">{v}</div>
                </div>
              </div>
              <PillButton variant="ghost">Edit</PillButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- SEARCH ----------
export function SearchSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Search Manager" title="Storefront Search" description="Algolia-style search with synonyms, ranking and trending queries." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <input placeholder="Test a query…" className="flex-1 bg-transparent text-sm focus:outline-none" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top results</div>
          <div className="mt-2 divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="text-sm">Result {i + 1}</div>
                <div className="text-[11px] text-muted-foreground">— clicks</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trending</div>
          <div className="mt-2 space-y-2">
            {["erp","crm","ai","pos","hospital"].map((q) => (
              <div key={q} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-sm"><span>{q}</span><TrendingUp className="h-4 w-4 text-success" /></div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- AI RECOMMENDATION ----------
export function AiSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="AI Recommendation Manager" title="Recommendation Engines" description="Netflix-style personalization across storefront surfaces." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {["Recommended For You","AI Recommended","Recently Viewed","Continue Browsing","Save For Later","Personalized Collections"].map((t) => (
          <Card key={t}>
            <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
              <Sparkles className="h-3 w-3" /> AI
            </div>
            <h3 className="text-base font-bold">{t}</h3>
            <p className="mt-1 text-xs text-muted-foreground">Toggle on PDP, cart and homepage. Tune signals: views, downloads, ratings.</p>
            <div className="mt-3 flex items-center justify-between">
              <Switch on /><PillButton variant="ghost">Tune</PillButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- SEO (SeoCenter — comprehensive Enterprise SEO Manager) ----------
export { SeoCenter as SeoSection } from "./SeoCenter";
export { DeploymentSection } from "./DeploymentSection";
export { IntegritySection, MicroFeaturesSection } from "./IntegrityMicroSections";
export { ToolkitSection } from "./ToolkitSection";
export { TopBarManagerSection } from "./TopBarManagerSection";
export { HomepageRowsSection } from "./HomepageRowsSection";
export { CardManagerSection } from "./CardManagerSection";
export {
  ProductsSection, ProductContentSection, ProductMediaSection,
  BlogSection,
  CustomersSection, AuthorsSection, VendorsSection,
  ResellersSection, AffiliateSection, InfluencerSection, QrSection,
  SupportSection, MediaLibrarySection, AiProvidersSection, ApiSection,
  ReportsSection, MarketingSection, AutomationSection, SecuritySection,
  SystemSection, IntegrationsSection, ExtraSection,
} from "./CatalogSections";
export { DemoUrlManagerSection as DemoSection } from "./DemoUrlManager";

// Enterprise-grade commerce (License / Downloads / Pricing / Orders / Payments / Releases)
export {
  LicenseSection, DownloadsSection, PricingSection,
  OrdersSection, PaymentsSection, ReleasesSection,
} from "./EnterpriseCommerce";

// Enterprise governance (Approval / Moderation / Demo domain / Sandbox / URLs /
// Favicon protection / SEO automation / Leads / AI content / Security scan /
// Quality gate / Product analytics / Audit log)
export {
  AuthorApprovalSection, ModerationSection, DemoDomainSection, DemoSandboxSection,
  ProductUrlSection, FaviconProtectionSection, SeoAutomationSection, LeadsSection,
  AiContentSection, SecurityScanSection, QualityCheckSection, ProductAnalyticsSection,
  AuditLogSection,
} from "./EnterpriseGovernance";

export {
  StorefrontTopBarSection,
  FooterSection,
  FiltersSection,
  UpcomingSection,
  NotificationsSection,
  LayoutOrderSection,
} from "./ExtraSections";

// ---------- STICKY ----------
export function StickySection() {
  const items = ["AI Chat","Support Button","Request Demo","Floating Actions"];
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Sticky Element Manager" title="Floating Elements" description="Intercom/Crisp-style floating widgets." />
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((t) => (
          <Card key={t}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">{t}</div>
              <Switch on />
            </div>
            <EmptyHint text="Position, color and trigger configurable per device" />
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- ANALYTICS ----------
export function AnalyticsSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Analytics" title="Marketplace Analytics" description="GA4 + Mixpanel + Power BI style cross-channel reporting." />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Homepage Traffic" value="—" />
        <StatCard label="Banner CTR" value="—" tone="success" />
        <StatCard label="Wall CTR" value="—" tone="premium" />
        <StatCard label="Revenue Today" value="—" tone="premium" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h3 className="mb-3 text-base font-bold">Traffic by source</h3><FakeChart /></Card>
        <Card><h3 className="mb-3 text-base font-bold">Revenue trend</h3><FakeChart /></Card>
        <Card><h3 className="mb-3 text-base font-bold">Top categories</h3><FakeChart /></Card>
        <Card><h3 className="mb-3 text-base font-bold">Conversion funnel</h3><FakeChart /></Card>
      </div>
    </div>
  );
}

// ---------- SETTINGS ----------
export function SettingsSection() {
  const groups = [
    ["Homepage Settings", ["Layout density","Header style","Footer columns","Wall defaults"]],
    ["Display Settings", ["Dark mode","Glass cards","Banner autoplay","Animations"]],
    ["Localization", ["Default language","Supported languages","Currency","RTL support"]],
    ["Caching Rules", ["Edge cache TTL","Wall cache","Banner cache","Search cache"]],
  ] as const;
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow="Settings" title="Module Settings" description="Shopify/Stripe-style settings for the Marketplace module." />
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(([title, rows]) => (
          <Card key={title}>
            <h3 className="mb-3 text-base font-bold">{title}</h3>
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r} className="flex items-center justify-between py-3">
                  <div className="text-sm">{r}</div>
                  <Switch on />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- shared atoms ----------
function IconBtn({ icon }: { icon: ReactNode }) {
  return (
    <button className="rounded-lg border border-border bg-background/40 p-1.5 text-muted-foreground hover:text-foreground">
      {icon}
    </button>
  );
}
function Switch({ on = false }: { on?: boolean }) {
  const [v, setV] = useState(on);
  return (
    <button
      onClick={() => setV(!v)}
      className={`relative h-5 w-9 rounded-full transition-colors ${v ? "bg-gradient-to-r from-primary to-accent" : "bg-secondary"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${v ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}
function Toggle({ label, on = false }: { label: string; on?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
      <span className="text-xs font-medium">{label}</span>
      <Switch on={on} />
    </div>
  );
}
function FakeChart() {
  return (
    <div className="flex h-40 items-end gap-1.5">
      {Array.from({ length: 24 }).map((_, i) => {
        const h = 20 + ((i * 37) % 70);
        return (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-accent/70"
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}
function PreviewProductCard() {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-[oklch(0.22_0.04_235/0.55)] shadow-[0_18px_40px_-20px_oklch(0_0_0/0.7)] transition-all duration-500 hover:-translate-y-0.5 hover:border-[oklch(0.80_0.13_192/0.45)]">
      {/* Media */}
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary/40 via-surface to-accent/30">
        <div className="absolute inset-0 dot-matrix opacity-30" />
        {/* Top-left badges stack */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <span className="rounded bg-premium px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-md">FEATURED</span>
          <span className="rounded bg-destructive/90 px-2 py-0.5 text-[10px] font-bold text-white">-40%</span>
        </div>
        {/* Top-right badges */}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">AI READY</span>
          <span className="rounded bg-success/90 px-2 py-0.5 text-[10px] font-bold text-white">VERIFIED</span>
        </div>
        {/* Hover quick actions */}
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button title="Quick View" className="flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur hover:bg-accent hover:text-accent-foreground"><Eye className="h-4 w-4" /></button>
          <button title="Live Demo" className="flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur hover:bg-accent hover:text-accent-foreground"><Sparkles className="h-4 w-4" /></button>
          <button title="Compare" className="flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur hover:bg-accent hover:text-accent-foreground"><TrendingUp className="h-4 w-4" /></button>
        </div>
        {/* Gallery dots */}
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
          {[0,1,2,3,4].map((i) => (
            <span key={i} className={`h-1 rounded-full transition-all ${i === 0 ? "w-4 bg-accent" : "w-1.5 bg-white/40"}`} />
          ))}
        </div>
        {/* Platform strip */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground backdrop-blur">
          <span>Win</span><span className="opacity-40">·</span><span>Mac</span><span className="opacity-40">·</span><span>Linux</span><span className="opacity-40">·</span><span>Cloud</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">Vala ERP Pro</div>
            <div className="truncate text-[11px] text-muted-foreground">by Software Vala · ERP · v4.2 · Updated 2d ago</div>
          </div>
          <span className="shrink-0 rounded bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">Live</span>
        </div>

        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-premium">
            <Star className="h-3 w-3 fill-current" />
            <span className="font-bold text-foreground">4.8</span>
            <span>(1.2k)</span>
          </span>
          <span className="opacity-40">·</span>
          <span>18.4k downloads</span>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-[10px] text-muted-foreground line-through">₹24,999</div>
            <div className="text-lg font-bold leading-none">₹14,999<span className="ml-1 text-[10px] font-normal text-muted-foreground">lifetime</span></div>
          </div>
          <div className="flex items-center gap-1">
            <button title="Wishlist" className="rounded-md border border-border bg-background/60 p-1.5 hover:border-accent/50 hover:text-accent"><Heart className="h-3.5 w-3.5" /></button>
            <button title="Share" className="rounded-md border border-border bg-background/60 p-1.5 hover:border-accent/50 hover:text-accent"><Share2 className="h-3.5 w-3.5" /></button>
            <button title="Add to Cart" className="rounded-md border border-border bg-background/60 p-1.5 hover:border-accent/50 hover:text-accent"><ShoppingCart className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5">
          <button className="flex-1 rounded-md bg-gradient-to-r from-primary to-accent px-2 py-2 text-[11px] font-bold text-primary-foreground shadow-[0_8px_20px_-8px_oklch(0.62_0.20_255/0.6)] hover:brightness-110">Buy Now</button>
          <button className="rounded-md border border-border bg-background/60 px-2.5 py-2 text-[11px] font-bold hover:border-accent/50 hover:text-accent">Details</button>
        </div>
      </div>
    </div>
  );
}
