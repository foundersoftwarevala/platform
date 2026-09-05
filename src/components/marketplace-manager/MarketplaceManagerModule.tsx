import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { type SectionId } from "./TopBar";
import { AppSidebar, useSidebarState } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { PageShell, SectionBanner } from "./PageShell";
import { DashboardSection } from "./sections/DashboardSection";
import {
  HeroBannerSection, CategoriesSection, WallsSection, PlacementSection, CardsSection,
  ActionsSection, OffersSection, PopupsSection, PartnersSection, TrustSection,
  ReviewsSection, FaqSection, ContactSection, SearchSection, AiSection, SeoSection,
  StickySection, AnalyticsSection, SettingsSection, StorefrontTopBarSection, FooterSection,
  FiltersSection, UpcomingSection, NotificationsSection, LayoutOrderSection, DeploymentSection,
  IntegritySection, MicroFeaturesSection, ToolkitSection, TopBarManagerSection, HomepageRowsSection,
  CardManagerSection, ProductsSection, ProductContentSection, ProductMediaSection, DemoSection,
  BlogSection, PricingSection, LicenseSection, DownloadsSection, CustomersSection, OrdersSection,
  PaymentsSection, ReleasesSection, AuthorsSection, VendorsSection, ResellersSection, AffiliateSection,
  InfluencerSection, QrSection, SupportSection, MediaLibrarySection, AiProvidersSection, ApiSection,
  ReportsSection, MarketingSection, AutomationSection, SecuritySection, SystemSection,
  IntegrationsSection, ExtraSection, AuthorApprovalSection, ModerationSection, DemoDomainSection,
  DemoSandboxSection, ProductUrlSection, FaviconProtectionSection, SeoAutomationSection, LeadsSection,
  AiContentSection, SecurityScanSection, QualityCheckSection, ProductAnalyticsSection, AuditLogSection,
} from "./sections";

export function MarketplaceManagerModule() {
  const [section, setSection] = useState<SectionId>("dashboard");
  const navigate = (id: SectionId) => setSection(id);
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar
        active={section}
        onChange={setSection}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader active={section} onOpenMenu={() => setMobileOpen(true)} onNavigate={navigate} />
        <main className="flex-1">
          <PageShell>
            <SectionBanner active={section} onNavigate={navigate} />
            <SectionBoundary sectionKey={section}>
              {renderSection(section, navigate)}
            </SectionBoundary>
          </PageShell>
        </main>
      </div>
    </div>
  );
}

/* -------- loading + error boundary wrapper -------- */

function SectionBoundary({
  sectionKey,
  children,
}: {
  sectionKey: string;
  children: ReactNode;
}) {
  return (
    <ErrorBoundary resetKey={sectionKey}>
      <Suspense fallback={<SectionLoading />}>
        <SectionFadeIn keyId={sectionKey}>{children}</SectionFadeIn>
      </Suspense>
    </ErrorBoundary>
  );
}

function SectionFadeIn({ keyId, children }: { keyId: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, [keyId]);
  return (
    <div
      className="transition-opacity duration-200"
      style={{ opacity: ready ? 1 : 0.35 }}
    >
      {children}
    </div>
  );
}

function SectionLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-24">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface shadow-inner">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <div className="text-sm font-semibold text-foreground">Loading module…</div>
        <div className="text-xs text-muted-foreground">
          Preparing your marketplace workspace
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-6 py-24">
          <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-surface p-6 text-center shadow-lg">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-destructive/15 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              This module hit an error
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {this.state.error.message ||
                "An unexpected error occurred while rendering this section."}
            </p>
            <button
              onClick={this.reset}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-white/4 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-white/8"
            >
              <RotateCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function renderSection(id: SectionId, nav: (n: SectionId) => void) {
  switch (id) {
    case "dashboard": return <DashboardSection onNavigate={(n) => nav(n as SectionId)} />;
    case "topbar-manager": return <TopBarManagerSection />;
    case "homepage-rows": return <HomepageRowsSection />;
    case "card-manager": return <CardManagerSection />;
    case "toolkit": return <ToolkitSection />;
    case "storefront-topbar": return <StorefrontTopBarSection />;
    case "hero": return <HeroBannerSection />;
    case "categories": return <CategoriesSection />;
    case "walls": return <WallsSection />;
    case "layout-order": return <LayoutOrderSection />;
    case "placement": return <PlacementSection />;
    case "cards": return <CardsSection />;
    case "actions": return <ActionsSection />;
    case "filters": return <FiltersSection />;
    case "offers": return <OffersSection />;
    case "popups": return <PopupsSection />;
    case "upcoming": return <UpcomingSection />;
    case "partners": return <PartnersSection />;
    case "trust": return <TrustSection />;
    case "reviews": return <ReviewsSection />;
    case "faq": return <FaqSection />;
    case "contact": return <ContactSection />;
    case "footer": return <FooterSection />;
    case "search": return <SearchSection />;
    case "ai": return <AiSection />;
    case "seo": return <SeoSection />;
    case "sticky": return <StickySection />;
    case "notifications": return <NotificationsSection />;
    case "analytics": return <AnalyticsSection />;
    case "deployment": return <DeploymentSection />;
    case "micro": return <MicroFeaturesSection />;
    case "integrity": return <IntegritySection />;
    case "products": return <ProductsSection />;
    case "product-content": return <ProductContentSection />;
    case "product-media": return <ProductMediaSection />;
    case "demo": return <DemoSection />;
    case "blog": return <BlogSection />;
    case "pricing": return <PricingSection />;
    case "license": return <LicenseSection />;
    case "downloads": return <DownloadsSection />;
    case "customers": return <CustomersSection />;
    case "orders": return <OrdersSection />;
    case "payments": return <PaymentsSection />;
    case "releases": return <ReleasesSection />;
    case "authors": return <AuthorsSection />;
    case "vendors": return <VendorsSection />;
    case "resellers": return <ResellersSection />;
    case "affiliate": return <AffiliateSection />;
    case "influencer": return <InfluencerSection />;
    case "qr": return <QrSection />;
    case "support": return <SupportSection />;
    case "media": return <MediaLibrarySection />;
    case "ai-providers": return <AiProvidersSection />;
    case "api": return <ApiSection />;
    case "reports": return <ReportsSection />;
    case "marketing": return <MarketingSection />;
    case "automation": return <AutomationSection />;
    case "security": return <SecuritySection />;
    case "system": return <SystemSection />;
    case "integrations": return <IntegrationsSection />;
    case "extra": return <ExtraSection />;
    case "approval": return <AuthorApprovalSection />;
    case "moderation": return <ModerationSection />;
    case "quality": return <QualityCheckSection />;
    case "security-scan": return <SecurityScanSection />;
    case "favicon": return <FaviconProtectionSection />;
    case "demo-domain": return <DemoDomainSection />;
    case "demo-sandbox": return <DemoSandboxSection />;
    case "product-url": return <ProductUrlSection />;
    case "seo-auto": return <SeoAutomationSection />;
    case "ai-content": return <AiContentSection />;
    case "leads": return <LeadsSection />;
    case "product-analytics": return <ProductAnalyticsSection />;
    case "audit": return <AuditLogSection />;
    case "settings": return <SettingsSection />;
  }
}
