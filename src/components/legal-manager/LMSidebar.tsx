import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Scale,
  LayoutDashboard,
  Sparkles,
  Users,
  Package,
  DoorOpen,
  Globe,
  Copyright,
  Award,
  Shield,
  FileText,
  Brain,
  CheckCircle,
  History,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  ArrowLeft,
  Lock,
  KeyRound,
  FolderLock,
  ShieldCheck,
  Radar,
  ScrollText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface LMSidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  onBack?: () => void;
  /** Called after any navigation — used to close the mobile drawer. */
  onNavigate?: () => void;
  className?: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { id: string; label: string }[];
}

export const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Legal Dashboard",
    icon: LayoutDashboard,
    children: [
      { id: "dashboard-overview", label: "Total Active Agreements" },
      { id: "dashboard-pending", label: "Pending User Acceptances" },
      { id: "dashboard-violations", label: "Policy Violations" },
      { id: "dashboard-copyright", label: "Copyright Alerts" },
      { id: "dashboard-trademark", label: "Trademark Status" },
      { id: "dashboard-compliance", label: "Country-wise Compliance" },
    ],
  },
  {
    id: "agreement-engine",
    label: "Agreement Engine (AI)",
    icon: Sparkles,
    children: [
      { id: "ai-generator", label: "Auto Agreement Generator" },
      { id: "product-agreement", label: "Product-Based Agreement" },
      { id: "role-agreement", label: "Role-Based Agreement" },
      { id: "country-agreement", label: "Country-Based Agreement" },
      { id: "language-detection", label: "Language Auto Detection" },
      { id: "version-control", label: "Legal Version Control" },
    ],
  },
  {
    id: "user-role-agreements",
    label: "User & Role Agreements",
    icon: Users,
    children: [
      { id: "user-agreement", label: "User Agreement (End User)" },
      { id: "admin-agreement", label: "Admin Agreement" },
      { id: "reseller-agreement", label: "Reseller Agreement" },
      { id: "franchise-agreement", label: "Franchise Agreement" },
      { id: "developer-agreement", label: "Developer Agreement" },
      { id: "employee-agreement", label: "Employee Agreement" },
      { id: "partner-agreement", label: "Partner Agreement" },
    ],
  },
  {
    id: "product-legal",
    label: "Product Legal Binding",
    icon: Package,
    children: [
      { id: "software-mapping", label: "Software-wise Agreement Mapping" },
      { id: "mandatory-agreement", label: "Mandatory Agreement Per Product" },
      { id: "agreement-lock", label: "Agreement Lock on Software" },
      { id: "agreement-trigger", label: "Agreement Update Trigger" },
      { id: "agreement-expiry", label: "Agreement Expiry Control" },
    ],
  },
  {
    id: "login-gate",
    label: "Login Gate Control",
    icon: DoorOpen,
    children: [
      { id: "agreement-review", label: "Agreement Review Screen" },
      { id: "scroll-enforcement", label: "Scroll-to-End Enforcement" },
      { id: "mandatory-checkbox", label: "Mandatory Accept Checkbox" },
      { id: "accept-continue", label: "Accept & Continue" },
      { id: "reject-logout", label: "Reject → Logout" },
      { id: "re-accept", label: "Re-Accept on Update" },
    ],
  },
  {
    id: "international-law",
    label: "International Law Compliance",
    icon: Globe,
    children: [
      { id: "gdpr", label: "GDPR" },
      { id: "ccpa", label: "CCPA" },
      { id: "it-act", label: "IT Act (India)" },
      { id: "dmca", label: "DMCA" },
      { id: "consumer-protection", label: "Consumer Protection Laws" },
      { id: "data-privacy", label: "Data Privacy Regulations" },
      { id: "country-overrides", label: "Country-Specific Overrides" },
    ],
  },
  {
    id: "copyright",
    label: "Copyright Management",
    icon: Copyright,
    children: [
      { id: "software-copyright", label: "Software Copyright Declaration" },
      { id: "code-ownership", label: "Code Ownership Declaration" },
      { id: "asset-ownership", label: "Asset Ownership" },
      { id: "auto-copyright", label: "Auto Copyright Notice" },
      { id: "violation-detection", label: "Violation Detection" },
      { id: "legal-action-log", label: "Legal Action Log" },
    ],
  },
  {
    id: "trademark",
    label: "Trademark Management",
    icon: Award,
    children: [
      { id: "brand-protection", label: "Brand Name Protection" },
      { id: "logo-policy", label: "Logo Usage Policy" },
      { id: "trademark-status", label: "Trademark Registration Status" },
      { id: "unauthorized-alerts", label: "Unauthorized Usage Alerts" },
      { id: "notice-generator", label: "Auto Legal Notice Generator" },
    ],
  },
  {
    id: "brand-ip",
    label: "Brand & IP Protection",
    icon: Shield,
    children: [
      { id: "brand-agreement", label: "Brand Agreement" },
      { id: "whitelabel-restrictions", label: "White-Label Restrictions" },
      { id: "reseller-brand", label: "Reseller Brand Rules" },
      { id: "franchise-brand", label: "Franchise Brand Usage" },
      { id: "ip-abuse", label: "IP Abuse Monitoring" },
    ],
  },
  {
    id: "policy",
    label: "Policy Management",
    icon: FileText,
    children: [
      { id: "privacy-policy", label: "Privacy Policy" },
      { id: "terms-conditions", label: "Terms & Conditions" },
      { id: "refund-policy", label: "Refund Policy" },
      { id: "usage-policy", label: "Usage Policy" },
      { id: "ai-usage-policy", label: "AI Usage Policy" },
      { id: "data-retention", label: "Data Retention Policy" },
    ],
  },
  {
    id: "ai-legal",
    label: "AI Legal Intelligence",
    icon: Brain,
    children: [
      { id: "auto-draft", label: "Auto Draft Agreements" },
      { id: "risk-detection", label: "Auto Risk Detection" },
      { id: "clause-conflict", label: "Clause Conflict Detection" },
      { id: "law-mismatch", label: "Country Law Mismatch Alerts" },
      { id: "update-suggestions", label: "Auto Update Suggestions" },
    ],
  },
  {
    id: "approval",
    label: "Approval & Control",
    icon: CheckCircle,
    children: [
      { id: "ai-review", label: "AI Draft → Human Review" },
      { id: "manager-approval", label: "Legal Manager Approval" },
      { id: "boss-override", label: "Boss Override (Only)" },
      { id: "lock-agreement", label: "Lock Agreement" },
      { id: "publish-agreement", label: "Publish Agreement" },
    ],
  },
  {
    id: "audit",
    label: "Audit & Logs",
    icon: History,
    children: [
      { id: "acceptance-logs", label: "User Acceptance Logs" },
      { id: "version-history", label: "Agreement Version History" },
      { id: "legal-changes", label: "Legal Changes Log" },
      { id: "compliance-logs", label: "Compliance Logs" },
      { id: "export-audit", label: "Export for Court / Audit" },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    children: [
      { id: "expiry-alerts", label: "Agreement Expiry Alerts" },
      { id: "violation-alerts", label: "Violation Alerts" },
      { id: "pending-acceptances", label: "Pending Acceptances" },
      { id: "policy-change", label: "Policy Change Alerts" },
    ],
  },
  {
    id: "documents",
    label: "Document Vault",
    icon: FolderLock,
  },
  {
    id: "compliance",
    label: "Policy Compliance",
    icon: ShieldCheck,
  },
  {
    id: "violations",
    label: "Violations & Cases",
    icon: AlertTriangle,
  },
  {
    id: "ai-alerts",
    label: "AI Legal Alerts",
    icon: KeyRound,
  },
  {
    id: "trademark-monitor",
    label: "Trademark Monitor",
    icon: Radar,
  },
  {
    id: "legal-logs",
    label: "Legal Logs",
    icon: ScrollText,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    children: [
      { id: "legal-profile", label: "Legal Profile" },
      { id: "notification-rules", label: "Notification Rules" },
      { id: "security", label: "Security" },
      { id: "logout", label: "Logout" },
    ],
  },
];

const LMSidebar = ({ activeSection, setActiveSection, onBack, onNavigate, className }: LMSidebarProps) => {
  const [expandedItems, setExpandedItems] = useState<string[]>(["dashboard"]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleItemClick = (id: string, hasChildren: boolean) => {
    if (hasChildren) toggleExpand(id);
    setActiveSection(id);
    onNavigate?.();
  };

  const handleChildClick = (childId: string) => {
    setActiveSection(childId);
    onNavigate?.();
  };

  return (
    <motion.aside
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      aria-label="Legal Manager navigation"
      className={cn(
        "w-[264px] shrink-0 h-full flex flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl",
        className,
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10 rounded-xl icon3d">
            <AvatarFallback className="rounded-xl bg-primary/15 text-primary font-semibold text-sm">
              LM
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">Legal Manager</h2>
            <p className="text-xs text-muted-foreground truncate">Software Vala workspace</p>
          </div>
        </div>

        <Badge className="w-full justify-center bg-primary/12 text-primary border border-primary/25 py-1.5 mb-3 rounded-lg font-medium tracking-wide">
          <Scale className="w-3 h-3 mr-1.5" />
          LEGAL MANAGER
        </Badge>

        {onBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="w-full mb-2 rounded-lg border-border bg-surface/60 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Control Panel
          </Button>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
          <span className="text-[11px] leading-tight text-muted-foreground">
            AI assistance active · Human approval required
          </span>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isExpanded = expandedItems.includes(item.id);
            const hasChildren = Boolean(item.children && item.children.length > 0);
            const isActive = activeSection === item.id || item.children?.some((c) => c.id === activeSection);

            return (
              <div key={item.id}>
                <button
                  type="button"
                  aria-expanded={hasChildren ? isExpanded : undefined}
                  aria-current={activeSection === item.id ? "page" : undefined}
                  onClick={() => handleItemClick(item.id, hasChildren)}
                  className={cn(
                    "group relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-200",
                    isActive
                      ? "bg-primary/12 text-foreground"
                      : "text-muted-foreground hover:bg-surface/70 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                  )}
                  <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className="font-medium text-xs flex-1 truncate">{item.label}</span>
                  {hasChildren && (
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </motion.div>
                  )}
                </button>

                <AnimatePresence>
                  {hasChildren && isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="ml-5 mt-0.5 mb-1 space-y-0.5 border-l border-sidebar-border pl-2 overflow-hidden"
                    >
                      {item.children?.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          aria-current={activeSection === child.id ? "page" : undefined}
                          onClick={() => handleChildClick(child.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all duration-200",
                            activeSection === child.id
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground/80 hover:text-foreground hover:bg-surface/60"
                          )}
                        >
                          <ChevronRight className="w-3 h-3 opacity-60" />
                          <span className="text-xs truncate">{child.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.warning("Logout clicked")}
          className="w-full rounded-lg border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          Logout
        </Button>
      </div>
    </motion.aside>
  );
};


export default LMSidebar;
