import { useState } from "react";
import { motion } from "framer-motion";
import { Menu, Scale } from "lucide-react";
import LMSidebar, { menuItems } from "./LMSidebar";
import { PageShell, ModuleHero } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import LMDashboard from "./screens/LMDashboard";
import LMAgreementEngine from "./screens/LMAgreementEngine";
import LMUserRoleAgreements from "./screens/LMUserRoleAgreements";
import LMProductLegalBinding from "./screens/LMProductLegalBinding";
import LMLoginGateControl from "./screens/LMLoginGateControl";
import LMInternationalLaw from "./screens/LMInternationalLaw";
import LMCopyrightManagement from "./screens/LMCopyrightManagement";
import LMTrademarkManagement from "./screens/LMTrademarkManagement";
import LMBrandIPProtection from "./screens/LMBrandIPProtection";
import LMPolicyManagement from "./screens/LMPolicyManagement";
import LMAILegalIntelligence from "./screens/LMAILegalIntelligence";
import LMApprovalControl from "./screens/LMApprovalControl";
import LMAuditLogs from "./screens/LMAuditLogs";
import LMNotifications from "./screens/LMNotifications";
import LMSettings from "./screens/LMSettings";
import LMDocumentVault from "./LMDocumentVault";
import LMPolicyCompliance from "./LMPolicyCompliance";
import LMViolations from "./LMViolations";
import LMLegalAlerts from "./LMLegalAlerts";
import LMTrademarkMonitor from "./LMTrademarkMonitor";
import LMLegalLogs from "./LMLegalLogs";

interface LMEnterpriseLayoutProps {
  onBack?: () => void;
}

const LMEnterpriseLayout = ({ onBack }: LMEnterpriseLayoutProps) => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderContent = () => {
    if (activeSection === "documents") return <LMDocumentVault />;
    if (activeSection === "compliance") return <LMPolicyCompliance />;
    if (activeSection === "violations") return <LMViolations />;
    if (activeSection === "ai-alerts") return <LMLegalAlerts />;
    if (activeSection === "trademark-monitor") return <LMTrademarkMonitor />;
    if (activeSection === "legal-logs") return <LMLegalLogs />;

    // Dashboard sections
    if (activeSection.startsWith("dashboard")) {
      return <LMDashboard activeSubSection={activeSection} />;
    }

    // Agreement Engine sections
    if (activeSection === "agreement-engine" ||
        ["ai-generator", "product-agreement", "role-agreement", "country-agreement", "language-detection", "version-control"].includes(activeSection)) {
      return <LMAgreementEngine activeSubSection={activeSection} />;
    }

    // User & Role Agreements
    if (activeSection === "user-role-agreements" ||
        ["user-agreement", "admin-agreement", "reseller-agreement", "franchise-agreement", "developer-agreement", "employee-agreement", "partner-agreement"].includes(activeSection)) {
      return <LMUserRoleAgreements activeSubSection={activeSection} />;
    }

    // Product Legal Binding
    if (activeSection === "product-legal" ||
        ["software-mapping", "mandatory-agreement", "agreement-lock", "agreement-trigger", "agreement-expiry"].includes(activeSection)) {
      return <LMProductLegalBinding activeSubSection={activeSection} />;
    }

    // Login Gate Control
    if (activeSection === "login-gate" ||
        ["agreement-review", "scroll-enforcement", "mandatory-checkbox", "accept-continue", "reject-logout", "re-accept"].includes(activeSection)) {
      return <LMLoginGateControl activeSubSection={activeSection} />;
    }

    // International Law Compliance
    if (activeSection === "international-law" ||
        ["gdpr", "ccpa", "it-act", "dmca", "consumer-protection", "data-privacy", "country-overrides"].includes(activeSection)) {
      return <LMInternationalLaw activeSubSection={activeSection} />;
    }

    // Copyright Management
    if (activeSection === "copyright" ||
        ["software-copyright", "code-ownership", "asset-ownership", "auto-copyright", "violation-detection", "legal-action-log"].includes(activeSection)) {
      return <LMCopyrightManagement activeSubSection={activeSection} />;
    }

    // Trademark Management
    if (activeSection === "trademark" ||
        ["brand-protection", "logo-policy", "trademark-status", "unauthorized-alerts", "notice-generator"].includes(activeSection)) {
      return <LMTrademarkManagement activeSubSection={activeSection} />;
    }

    // Brand & IP Protection
    if (activeSection === "brand-ip" ||
        ["brand-agreement", "whitelabel-restrictions", "reseller-brand", "franchise-brand", "ip-abuse"].includes(activeSection)) {
      return <LMBrandIPProtection activeSubSection={activeSection} />;
    }

    // Policy Management
    if (activeSection === "policy" ||
        ["privacy-policy", "terms-conditions", "refund-policy", "usage-policy", "ai-usage-policy", "data-retention"].includes(activeSection)) {
      return <LMPolicyManagement activeSubSection={activeSection} />;
    }

    // AI Legal Intelligence
    if (activeSection === "ai-legal" ||
        ["auto-draft", "risk-detection", "clause-conflict", "law-mismatch", "update-suggestions"].includes(activeSection)) {
      return <LMAILegalIntelligence activeSubSection={activeSection} />;
    }

    // Approval & Control
    if (activeSection === "approval" ||
        ["ai-review", "manager-approval", "boss-override", "lock-agreement", "publish-agreement"].includes(activeSection)) {
      return <LMApprovalControl activeSubSection={activeSection} />;
    }

    // Audit & Logs
    if (activeSection === "audit" ||
        ["acceptance-logs", "version-history", "legal-changes", "compliance-logs", "export-audit"].includes(activeSection)) {
      return <LMAuditLogs activeSubSection={activeSection} />;
    }

    // Notifications
    if (activeSection === "notifications" ||
        ["expiry-alerts", "violation-alerts", "pending-acceptances", "policy-change"].includes(activeSection)) {
      return <LMNotifications activeSubSection={activeSection} />;
    }

    // Settings
    if (activeSection === "settings" ||
        ["legal-profile", "notification-rules", "security", "logout"].includes(activeSection)) {
      return <LMSettings activeSubSection={activeSection} />;
    }

    return <LMDashboard activeSubSection={activeSection} />;
  };

  const parent = menuItems.find(
    (item) => item.id === activeSection || item.children?.some((c) => c.id === activeSection),
  );
  const child = parent?.children?.find((c) => c.id === activeSection);
  const HeroIcon = parent?.icon ?? Scale;
  const heroTitle = child?.label ?? parent?.label ?? "Legal Dashboard";
  const heroEyebrow = child ? parent?.label : "Legal & Compliance";

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <LMSidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onBack={onBack}
        className="hidden lg:flex"
      />

      <div className="min-w-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] border-sidebar-border p-0">
              <SheetTitle className="sr-only">Legal Manager navigation</SheetTitle>
              <LMSidebar
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                onBack={onBack}
                onNavigate={() => setMobileOpen(false)}
                className="flex w-full border-r-0"
              />
            </SheetContent>
          </Sheet>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{heroTitle}</p>
            <p className="truncate text-xs text-muted-foreground">Legal Manager</p>
          </div>
        </div>

        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <PageShell>
            <ModuleHero
              eyebrow={heroEyebrow}
              title={heroTitle}
              description="Live legal operations for Software Vala — agreements, compliance, IP and audit in one workspace."
              icon={HeroIcon}
            />
            <main>{renderContent()}</main>
          </PageShell>
        </motion.div>
      </div>
    </div>
  );
};

export default LMEnterpriseLayout;
