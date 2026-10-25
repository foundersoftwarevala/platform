import { useState } from "react";
import {
  GripVertical,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search as SearchIcon,
  Users2,
} from "lucide-react";
import { Card, EmptyHint, PageHeader, PillButton, StatCard } from "../ui";
import { TableToolbar } from "../actions";

import { useQuery } from "@tanstack/react-query";
import { authHeaders } from "@/lib/auth/operator-fetch";
import { useResource } from "@/lib/manager/use-resource";
import { marketplaceRevenueSeries } from "@/lib/marketplace-manager/homepage-rows.functions";
import { marketplaceTrendingSearches } from "@/lib/marketplace-manager/trending.functions";
// ---------- HERO BANNER MANAGER ----------
// Real, DB-backed implementation lives in ./HeroSlidesManager.tsx
export { HeroBannerSection } from "./HeroSlidesManager";
export { OffersSection } from "./OffersCampaigns";

// ---------- CATEGORY MANAGER (DB-backed) ----------
export { CategoriesAdmin as CategoriesSection } from "./MarketplaceCatalogAdmin";

// ---------- WALL MANAGER ----------
/** The walls, from marketplace_row_config. */
export function WallsSection() {
  const walls = useResource("walls", { limit: 100 });
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={`Wall Manager · ${walls.loading ? "…" : walls.failed ? "—" : walls.total} walls`}
        title="Storefront Walls"
        description="Create a curated collection in the live Walls table above; every new wall starts as a draft."
      />
      <TableToolbar title="Walls" count={walls.total} extraActions={["publish"]} />
      {walls.loading && <EmptyHint text="Reading the walls…" />}
      {walls.failed && <EmptyHint text="The walls could not be read." />}
      {!walls.loading && !walls.failed && walls.rows.length === 0 && (
        <EmptyHint text="No wall exists yet." />
      )}
      <div className="space-y-3">
        {walls.rows.map((w, i) => {
          const status = String(w.status ?? "") || "no status";
          const live = status === "published" || status === "active";
          const rule = String(w.auto_rule ?? "").trim();
          return (
            <div
              key={String(w.id ?? i)}
              className="glass flex items-center justify-between rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-bold">
                    {String(w.title ?? w.key ?? "Untitled wall")}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Slot #{w.sort_order == null ? i + 1 : String(w.sort_order)} ·{" "}
                    {String(w.source_mode ?? "") || "no source mode"}
                    {rule ? ` · ${rule}` : ""} ·{" "}
                    {w.max_products == null
                      ? "no product limit"
                      : `up to ${String(w.max_products)} products`}
                  </div>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${live ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- PRODUCT PLACEMENT ----------
export { MerchandisingConsole as PlacementSection } from "./MerchandisingConsole";

// ---------- PRODUCT CARD MANAGER ----------
export { CardComposition as CardsSection } from "./CardComposition";

// ---------- PRODUCT ACTION MANAGER ----------
// Actions resolve to the persisted registry in ActionLayer.tsx.

// ---------- PARTNERS ----------
type PartnerProgramme = { kind: string; live: number | null; openApplications: number | null };

/**
 * The six partner programmes, counted where each already lives: live partners
 * from the programme's own table, open applications from the application
 * registry (GET /api/control-panel/partners). Every figure here was a dash
 * before. GMV is not attributed to a programme anywhere, so it stays a dash,
 * and a programme cannot be switched off, so its switch says so.
 */
export function PartnersSection() {
  const types = ["Reseller", "Vendor", "Author", "Affiliate", "Influencer", "Franchise"];
  const query = useQuery({
    queryKey: ["control-panel", "partners"],
    queryFn: async () => {
      const response = await fetch("/api/control-panel/partners", { headers: await authHeaders() });
      const body = (await response.json().catch(() => ({}))) as {
        programmes?: PartnerProgramme[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error ?? `The partner figures could not be read (${response.status})`);
      return body.programmes ?? [];
    },
    staleTime: 30_000,
  });
  const figure = (t: string) => query.data?.find((p) => p.kind === t.toLowerCase());
  const show = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Partner Manager"
        title="Partner Programs"
        description="HubSpot + PartnerStack style program management."
      />
      {query.isError && (
        <p className="mb-3 text-sm text-destructive">{(query.error as Error).message}</p>
      )}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <Card key={t}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 text-accent">
                  <Users2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{t}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {query.isLoading ? "…" : show(figure(t)?.live)} active partners
                  </div>
                </div>
              </div>
              <Switch
                on
                label={`${t} programme`}
                reason="A partner programme is always on; it cannot be switched off."
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "Apps", v: show(figure(t)?.openApplications), hint: "Open applications" },
                { k: "Live", v: show(figure(t)?.live), hint: "Live partners" },
                { k: "GMV", v: "—", hint: "Sales are not attributed to a programme yet" },
              ].map(({ k, v, hint }) => (
                <div key={k} className="rounded-lg bg-background/40 py-2" title={hint}>
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="text-sm font-bold">{query.isLoading ? "…" : v}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- CONTACT ----------
export function ContactSection() {
  // "hello@softwarevala.com" was printed here and appears nowhere the
  // storefront shows. These are the channels the storefront footer actually
  // prints (SiteFooter); a phone line and an address are not published there.
  const items = [
    ["Email", Mail, "hellosoftwarevala@gmail.com"],
    ["Phone", Phone, "—"],
    ["WhatsApp", MessageCircle, "+91 83488 38383"],
    ["Address", MapPin, "—"],
  ] as const;
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Contact Manager"
        title="Storefront contact"
        description="Channels surfaced in the footer and contact page."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(([l, I, v]) => (
          <Card key={l}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <I className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{l}</div>
                  <div className="text-sm font-bold">{v}</div>
                </div>
              </div>
              <PillButton
                variant="ghost"
                disabled
                title="No table stores the storefront contact channels; they are written in the storefront footer itself."
              >
                Edit
              </PillButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- SEARCH ----------
export function SearchSection() {
  const [query, setQuery] = useState("");
  const results = useResource("products", { limit: 6, search: query.trim() || undefined });
  const trending = useQuery({
    queryKey: ["marketplace", "trending-searches"],
    queryFn: () => marketplaceTrendingSearches(),
    staleTime: 30_000,
  });
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Search Manager"
        title="Storefront Search"
        description="Algolia-style search with synonyms, ranking and trending queries."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Test a query…"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Top results
          </div>
          {!query.trim() ? (
            <EmptyHint text="Type a query to see what the catalogue returns." />
          ) : results.loading ? (
            <EmptyHint text="Searching…" />
          ) : results.failed ? (
            <EmptyHint text="The catalogue could not be searched." />
          ) : results.rows.length === 0 ? (
            <EmptyHint text="No product matches this query." />
          ) : (
            <div className="mt-2 divide-y divide-border">
              {results.rows.map((r, i) => (
                <div key={String(r.id ?? i)} className="flex items-center justify-between py-2">
                  <div className="text-sm">{String(r.name ?? "Untitled")}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {String(r.industry_label ?? "")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Trending
          </div>
          {trending.isLoading ? (
            <EmptyHint text="Loading search trends…" />
          ) : trending.isError ? (
            <div className="space-y-2">
              <EmptyHint text="Search trends could not be loaded." />
              <button
                type="button"
                onClick={() => void trending.refetch()}
                className="text-xs font-semibold text-accent hover:text-cyan-glow"
              >
                Retry
              </button>
            </div>
          ) : (trending.data ?? []).length === 0 ? (
            <EmptyHint text="No searches were recorded in the last 30 days." />
          ) : (
            <ol className="mt-2 divide-y divide-border">
              {(trending.data ?? []).map((item, index) => (
                <li key={item.query} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate pr-3">
                    <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                    {item.query}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.searches.toLocaleString()} searches
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------- AI RECOMMENDATION ----------
export function AiSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="AI Recommendation Manager"
        title="Recommendation Engines"
        description="Recommendation controls are unavailable because no persisted manager configuration is connected."
      />
      <EmptyHint text="No recommendation settings are stored for this manager yet." />
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
  ProductsSection,
  ProductContentSection,
  ProductMediaSection,
  BlogSection,
  CustomersSection,
  AffiliateSection,
  QrSection,
  SupportSection,
  MediaLibrarySection,
  AiProvidersSection,
  ApiSection,
  ReportsSection,
  MarketingSection,
  AutomationSection,
  SecuritySection,
  SystemSection,
  IntegrationsSection,
  ExtraSection,
} from "./CatalogSections";
export { DemoUrlManagerSection as DemoSection } from "./DemoUrlManager";

// Influencer manager, backed by the referral engine and influencer tables.
export { InfluencerManager as InfluencerSection } from "./InfluencerManager";

// Authors and Vendors, backed by marketplace_sellers and the commission,
// ledger and payout engine.
export {
  AuthorsManager as AuthorsSection,
  VendorsManager as VendorsSection,
} from "./SellerManager";

// Resellers, backed by reseller plans and the canonical referral engine.
export { ResellerManager as ResellersSection } from "./ResellerManager";

// Reviews, Trust and FAQ are backed by their manager tables.
export {
  ReviewsManager as ReviewsSection,
  TrustManager as TrustSection,
  FaqManager as FaqSection,
} from "./ReviewTrustFaq";

// The approval workflow, on author_submissions and the publishing gate.
export { ApprovalWorkflow as AuthorApprovalSection } from "./ApprovalWorkflow";

// The upload scanner, on security_scan_jobs, security_findings,
// security_quarantine and security_scanner_settings.
export { SecurityScanner as SecurityScanSection } from "./SecurityScanner";

// The SEO auto-generator, counting from the catalogue and reading the live
// product page.
export { SeoAutoGenerator as SeoAutomationSection } from "./SeoAutoGenerator";

// Lead operations, read from the tables Lead Manager writes - not a second CRM.
export { LeadOps as LeadsSection } from "./LeadOps";

// Per-product analytics, counted from marketplace_events, paid orders and
// their line items.
export { ProductAnalytics as ProductAnalyticsSection } from "./ProductAnalytics";

// Activity, audit and version history, read from marketplace_audit_logs.
export { AuditHistory as AuditLogSection } from "./AuditHistory";

// The action layer, stored in system_settings and resolved by one function.
export { ActionLayer as ActionsSection } from "./ActionLayer";

// The moderation centre, on the canonical catalogue with a real duplicate
// scan and a purge that never destroys an order, licence, review or merge
// record.
export { ModerationCenter as ModerationSection } from "./ModerationCenter";

// Brand protection, on the one canonical asset that actually exists and a
// registry that says which rules can enforce.
export { BrandProtection as FaviconProtectionSection } from "./BrandProtection";

// Demo domains, on the real slug and hostname engine, the eligibility gates
// other modules own, and provider status that cannot claim what does not
// authenticate.
export { DemoDomainManager as DemoDomainSection } from "./DemoDomainManager";

// Sandbox controls, extending the demo domain module. Isolation, database
// reset and infrastructure cleanup are reported as unavailable rather than
// claimed.
export { SandboxControls as DemoSandboxSection } from "./SandboxControls";

// Product URLs, short links and QR. The canonical pattern is validated
// against the routes this application actually serves, and short links
// resolve at /s/{code}.
export { ProductUrlManager as ProductUrlSection } from "./ProductUrlManager";

// Enterprise-grade commerce (License / Downloads / Pricing / Orders / Payments / Releases)
export {
  LicenseSection,
  DownloadsSection,
  PricingSection,
  OrdersSection,
  PaymentsSection,
  ReleasesSection,
} from "./EnterpriseCommerce";

export { QualityCheckSection } from "./EnterpriseGovernance";

// ---------- AI CONTENT GENERATOR ----------
// This screen reads the product record and reports missing provider
// configuration rather than claiming to have generated content.
export { AiContentGenerator as AiContentSection } from "./AiContentGenerator";

export {
  StorefrontTopBarSection,
  FiltersSection,
  UpcomingSection,
  NotificationsSection,
  LayoutOrderSection,
} from "./ExtraSections";

// ---------- STICKY ----------
export {
  StickySection,
  FooterSection as StorefrontFooterSection,
} from "./StorefrontChrome";

// ---------- ANALYTICS ----------
export function AnalyticsSection() {
  const [range, setRange] = useState<"today" | "week" | "month" | "year">("month");
  const series = useQuery({
    queryKey: ["marketplace", "revenue-series", range],
    queryFn: () => marketplaceRevenueSeries({ data: range }),
    staleTime: 30_000,
  });
  const points = series.data?.points ?? [];
  const peak = points.reduce((highest, point) => Math.max(highest, point.gross), 0);
  const net = points.reduce((total, point) => total + point.net, 0);
  const currency = series.data?.currency ?? "";
  const amount =
    `${net.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`.trim();

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Analytics"
        title="Marketplace Analytics"
        description="GA4 + Mixpanel + Power BI style cross-channel reporting."
      />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label={`Net revenue · ${range}`}
          value={series.isLoading || series.isError ? "—" : amount}
          tone="premium"
        />
        <StatCard label="Homepage traffic" value="Not tracked" />
        <StatCard label="Banner CTR" value="Not tracked" tone="success" />
        <StatCard label="Wall CTR" value="Not tracked" tone="premium" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold">Revenue trend</h3>
            <div className="flex gap-1">
              {(["today", "week", "month", "year"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={range === option}
                  onClick={() => setRange(option)}
                  className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${
                    range === option ? "bg-accent/20 text-accent" : "text-muted-foreground"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          {series.isLoading ? (
            <EmptyHint text="Loading paid orders and refunds…" />
          ) : series.isError ? (
            <div className="space-y-2">
              <EmptyHint text="Revenue could not be loaded." />
              <button
                type="button"
                onClick={() => void series.refetch()}
                className="text-xs font-semibold text-accent hover:text-cyan-glow"
              >
                Retry
              </button>
            </div>
          ) : peak === 0 ? (
            <EmptyHint text="No paid order revenue in this range." />
          ) : (
            <div
              className="flex h-40 items-end gap-1 rounded-lg border border-border/60 bg-background/40 p-3"
              aria-label={`Gross revenue per ${series.data?.unit ?? "day"} for ${range}`}
            >
              {points.map((point) => {
                const height = Math.max(2, Math.round((point.gross / peak) * 100));
                return (
                  <div
                    key={point.at}
                    className="group relative flex-1 rounded-t bg-accent/70 transition hover:bg-accent"
                    style={{ height: `${height}%` }}
                    title={`${new Date(point.at).toLocaleDateString()} · gross ${point.gross} · refunds ${point.refunds} · net ${point.net} · ${point.orders} orders`}
                  />
                );
              })}
            </div>
          )}
        </Card>
        <Card>
          <h3 className="mb-3 text-base font-bold">Traffic by source</h3>
          <EmptyHint text="Source-attributed traffic is not currently aggregated." />
        </Card>
        <Card>
          <h3 className="mb-3 text-base font-bold">Conversion funnel</h3>
          <EmptyHint text="A complete conversion funnel is not currently aggregated." />
        </Card>
        <Card>
          <h3 className="mb-3 text-base font-bold">Top categories</h3>
          <EmptyHint text="Category analytics are available in Homepage Rows; this screen does not aggregate them." />
        </Card>
      </div>
    </div>
  );
}

// ---------- SETTINGS ----------
export function SettingsSection() {
  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Settings"
        title="Module Settings"
        description="Values are read from the persisted settings table above."
      />
      <EmptyHint text="Only values backed by the settings table can be managed here." />
    </div>
  );
}

// ---------- shared atoms ----------
function Switch({
  on = false,
  label = "This switch",
  onChange,
}: {
  on?: boolean;
  label?: string;
  onChange?: (next: boolean) => void;
  reason?: string;
}) {
  if (!onChange) return null;
  const v = on;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={v}
      aria-label={label}
      onClick={() => onChange(!v)}
      className={`relative h-5 w-9 rounded-full transition-colors ${v ? "bg-gradient-to-r from-primary to-accent" : "bg-secondary"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${v ? "translate-x-4" : "translate-x-0.5"}`}
      />
    </button>
  );
}
