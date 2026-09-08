// Maps every Marketplace Manager sidebar label to its ported section component.
import type { ComponentType } from "react";

import { DashboardSection } from "./sections/DashboardSection";
// FaqManagerSection is the earlier editor over a browser-local store. It is
// kept imported and unused rather than removed; FAQ now resolves to the
// connected screen in sections/index.
import { FaqManagerSection, ValaTvSection } from "./sections/ContentStudio";
import { StoriesAwardsSection } from "./sections/StoriesAwards";
import { RoleMatrix } from "./sections/RoleMatrix";
import { AutomationConsole } from "./sections/AutomationConsole";
import { MicroInteractions } from "./sections/MicroInteractions";
import { MediaLibrary } from "./sections/MediaLibrary";
import { DeveloperApi } from "./sections/DeveloperApi";
import { IntegrationsHub } from "./sections/IntegrationsHub";
import { DeploymentCenter } from "./sections/DeploymentCenter";
import { IntegrityPolicy } from "./sections/IntegrityPolicy";
import { SecurityCenter } from "./sections/SecurityCenter";
import { SystemHealth } from "./sections/SystemHealth";
import * as S from "./sections";
import { LIVE_SECTIONS, withLive } from "./LiveSections";

type SectionComponent = ComponentType<{ onNavigate?: (id: string) => void }>;

const designedSections: Record<string, SectionComponent> = {
  // Overview
  Dashboard: DashboardSection as SectionComponent,
  Analytics: S.AnalyticsSection,
  Reports: S.ReportsSection,

  // Homepage
  "Top Bar": S.TopBarManagerSection,
  "Storefront Bar": S.StorefrontTopBarSection,
  "Hero Banner": S.HeroBannerSection,
  "Homepage Rows": S.HomepageRowsSection,
  "Layout Order": S.LayoutOrderSection,
  Walls: S.WallsSection,
  Placement: S.PlacementSection,
  Sticky: S.StickySection,
  Footer: S.FooterSection,

  // Catalog
  Categories: S.CategoriesSection,
  Products: S.ProductsSection,
  "Product Content": S.ProductContentSection,
  "Product Media": S.ProductMediaSection,
  "Card Manager": S.CardManagerSection,
  Cards: S.CardsSection,
  Filters: S.FiltersSection,
  "Demo System": S.DemoSection,

  // Commerce
  Pricing: S.PricingSection,
  Orders: S.OrdersSection,
  Payments: S.PaymentsSection,
  License: S.LicenseSection,
  Downloads: S.DownloadsSection,
  Releases: S.ReleasesSection,
  Customers: S.CustomersSection,
  Offers: S.OffersSection,
  Popups: S.PopupsSection,
  Upcoming: S.UpcomingSection,

  // Growth
  Marketing: S.MarketingSection,
  SEO: S.SeoSection,
  Search: S.SearchSection,
  "AI Recs": S.AiSection,
  Notifications: S.NotificationsSection,
  Blog: S.BlogSection,
  "Vala TV": ValaTvSection,
  Partners: S.PartnersSection,
  Affiliate: S.AffiliateSection,
  Influencer: S.InfluencerSection,
  Authors: S.AuthorsSection,
  Vendors: S.VendorsSection,
  Resellers: S.ResellersSection,
  Reviews: S.ReviewsSection,
  Trust: S.TrustSection,
  // The home page reads marketplace_stories and marketplace_awards and
  // no screen wrote them, so both of its proof sections were empty by
  // construction. This is the screen that fills them.
  "Stories & Awards": StoriesAwardsSection,
  FAQ: S.FaqSection,
  Contact: S.ContactSection,
  "QR System": S.QrSection,

  // Governance
  "Author Approval": S.AuthorApprovalSection,
  Moderation: S.ModerationSection,
  "Quality Gate": S.QualityCheckSection,
  "Upload Scanner": S.SecurityScanSection,
  "Brand Protect": S.FaviconProtectionSection,
  "Demo Domain": S.DemoDomainSection,
  "Demo Sandbox": S.DemoSandboxSection,
  "Product URLs": S.ProductUrlSection,
  "SEO Automation": S.SeoAutomationSection,
  "AI Content": S.AiContentSection,
  Leads: S.LeadsSection,
  "Product Analytics": S.ProductAnalyticsSection,
  "Audit & History": S.AuditLogSection,

  // Operations
  Actions: S.ActionsSection,
  "Action Toolkit": S.ToolkitSection,
  // S.AutomationSection is the designed shell and is still exported. The
  // console below keeps its four tabs and its ten features, and fills the
  // counters from real job rows instead of leaving them blank.
  Automation: AutomationConsole,
  // S.MicroFeaturesSection is the designed shell and is still exported. The
  // screen below keeps its eight cards, its labels and its surface chips, and
  // makes the switches and Save Configuration real.
  "Micro-Features": MicroInteractions,
  // S.MediaLibrarySection is the designed shell and is still exported. The
  // screen below keeps its five tabs and its four counters, and fills them
  // from real storage objects and the asset tables that exist.
  "Media Library": MediaLibrary,
  "AI Providers": S.AiProvidersSection,
  // S.ApiSection is the designed shell and is still exported. Developer API
  // stays a section of this manager - the screen below keeps its five tabs
  // and fills them from the endpoints this manager really serves.
  API: DeveloperApi,
  // S.IntegrationsSection is the designed shell and is still exported. The
  // hub below keeps its four tabs and its four counters, and checks each
  // connection instead of printing the status column.
  Integrations: IntegrationsHub,
  // S.DeploymentSection is the designed shell and is still exported. The
  // centre below keeps its eight tabs and both top actions, and reads the
  // deployment that actually happens instead of drawing providers that
  // cannot connect.
  Deployment: DeploymentCenter,
  // S.IntegritySection is the designed shell and is still exported. It
  // printed ENFORCED on all six cards; the screen below computes each
  // status from the records, which is the only way the badge can mean
  // anything.
  Integrity: IntegrityPolicy,
  // S.SecuritySection is the designed shell and is still exported - its
  // Sessions, 2FA and IP allowlist tabs have nothing behind them yet. The
  // Roles and Permissions half does, so Security opens on the connected
  // matrix the server actually enforces.
  // RoleMatrix is still the Roles tab and is rendered inside the centre
  // below rather than replaced - there is one permission matrix on this
  // platform, and a second copy would start disagreeing with the first.
  Security: SecurityCenter,
  // S.SystemSection is the designed shell and is still exported. The screen
  // below keeps its five tabs and its four counters, and computes them from
  // the telemetry this machine writes about itself every five minutes.
  System: SystemHealth,
  Support: S.SupportSection,
  Extra: S.ExtraSection,
  Settings: S.SettingsSection,
};

// Dashboard quick-action ids -> sidebar labels
export const navIdToLabel: Record<string, string> = {
  products: "Products",
  hero: "Hero Banner",
  walls: "Walls",
  categories: "Categories",
  offers: "Offers",
  marketing: "Marketing",
  analytics: "Analytics",
  approval: "Author Approval",
  payments: "Payments",
  ai: "AI Recs",
  seo: "SEO",
  "homepage-rows": "Homepage Rows",
  "layout-order": "Layout Order",
  authors: "Authors",
  vendors: "Vendors",
  orders: "Orders",
  downloads: "Downloads",
  reviews: "Reviews",
  notifications: "Notifications",
};

/**
 * The registry the console actually uses.
 *
 * Sections named in LIVE_SECTIONS are handed back wrapped, so they open with the
 * real marketplace rows above their designed content. Every other section is
 * passed through exactly as it was.
 */
export const sectionRegistry: Record<string, SectionComponent> = Object.fromEntries(
  Object.entries(designedSections).map(([label, Section]) => {
    const live = LIVE_SECTIONS[label];
    return [label, live ? withLive(live.resource, live.columns, Section) : Section];
  }),
);
