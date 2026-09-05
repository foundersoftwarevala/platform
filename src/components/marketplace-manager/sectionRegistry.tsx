// Maps every Marketplace Manager sidebar label to its ported section component.
import type { ComponentType } from "react";

import { DashboardSection } from "./sections/DashboardSection";
import { FaqManagerSection, ValaTvSection } from "./sections/ContentStudio";
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
  FAQ: FaqManagerSection,
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
  Automation: S.AutomationSection,
  "Micro-Features": S.MicroFeaturesSection,
  "Media Library": S.MediaLibrarySection,
  "AI Providers": S.AiProvidersSection,
  API: S.ApiSection,
  Integrations: S.IntegrationsSection,
  Deployment: S.DeploymentSection,
  Integrity: S.IntegritySection,
  Security: S.SecuritySection,
  System: S.SystemSection,
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
