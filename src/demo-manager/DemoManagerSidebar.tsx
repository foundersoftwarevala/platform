import { useState } from "react";
import softwareValaLogo from '@/assets/software-vala-logo-transparent.png';
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@/hooks/useNavigate";
import { 
  LayoutGrid, 
  Activity, 
  BarChart3, 
  Package,
  PlusCircle,
  Monitor,
  Globe,
  Users,
  Link2,
  LogOut,
  KeyRound,
  Settings,
  ArrowLeft,
  Lock,
  ChevronDown,
  ChevronRight,
  Heart,
  AlertTriangle,
  ArrowUpCircle,
  FolderOpen,
  Grid3X3,
  Building2,
  GraduationCap,
  Stethoscope,
  Briefcase,
  Landmark,
  Home,
  Truck,
  ShoppingCart,
  Code2,
  ExternalLink,
  Key,
  ToggleLeft,
  CheckSquare,
  FileEdit,
  ImageIcon,
  Database,
  FileText,
  Menu,
  Bug,
  ListChecks,
  Gauge,
  Clock,
  History,
  Bot,
  Wrench,
  Sparkles,
  Zap,
  ScanLine,
  CircleDot,
  CheckCircle,
  Loader2,
  Store,
  Eye,
  EyeOff,
  RefreshCw,
  DollarSign,
  FileStack,
  Brain,
  UserCog,
  Shield,
  BookLock,
  Copy,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface DemoManagerSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

interface SubMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  subItems?: SubMenuItem[];
}

// Full 12-section sidebar structure as per specification
export const menuSections: MenuItem[] = [
  // 1️⃣ Demo Overview
  {
    id: "demo-overview",
    label: "Demo Overview",
    icon: LayoutGrid,
    badge: "LIVE",
    subItems: [
      { id: "live-demo-count", label: "Live Demo Count", icon: Monitor },
      { id: "demo-health-status", label: "Demo Health Status", icon: Heart },
      { id: "pending-demo-fix", label: "Pending Demo Fix", icon: AlertTriangle },
      { id: "demo-upgrade-requests", label: "Demo Upgrade Requests", icon: ArrowUpCircle },
    ],
  },
  // 2️⃣ Demo Library
  {
    id: "demo-library",
    label: "Demo Library",
    icon: FolderOpen,
    badge: "5K+",
    subItems: [
      { id: "all-demos", label: "All Demos", icon: Grid3X3 },
      { id: "category-wise-demo", label: "Category-wise Demo", icon: FolderOpen },
      { id: "industry-wise-demo", label: "Industry-wise Demo", icon: Building2 },
      { id: "role-wise-demo", label: "Role-wise Demo", icon: Users },
    ],
  },
  // 3️⃣ Demo Categories
  {
    id: "demo-categories",
    label: "Demo Categories",
    icon: Grid3X3,
    subItems: [
      { id: "cat-education", label: "Education", icon: GraduationCap },
      { id: "cat-healthcare", label: "Healthcare", icon: Stethoscope },
      { id: "cat-business", label: "Business", icon: Briefcase },
      { id: "cat-government", label: "Government", icon: Landmark },
      { id: "cat-society-property", label: "Society / Property", icon: Home },
      { id: "cat-transport-logistics", label: "Transport / Logistics", icon: Truck },
      { id: "cat-ecommerce", label: "E-Commerce", icon: ShoppingCart },
      { id: "cat-custom-software", label: "Custom Software", icon: Code2 },
    ],
  },
  // 4️⃣ Demo Details (Per Demo)
  {
    id: "demo-details",
    label: "Demo Details",
    icon: FileText,
    subItems: [
      { id: "demo-url", label: "Demo URL", icon: ExternalLink },
      { id: "login-credentials", label: "Login ID / Password", icon: Key },
      { id: "role-login-switch", label: "Role Login Switch", icon: ToggleLeft },
      { id: "feature-coverage", label: "Feature Coverage", icon: CheckSquare },
      { id: "active-inactive-status", label: "Active / Inactive Status", icon: Activity },
    ],
  },
  // 5️⃣ Demo Content Manager
  {
    id: "demo-content-manager",
    label: "Demo Content Manager",
    icon: FileEdit,
    subItems: [
      { id: "update-text-content", label: "Update Text Content", icon: FileText },
      { id: "update-images", label: "Update Images", icon: ImageIcon },
      { id: "update-dummy-data", label: "Update Dummy Data", icon: Database },
      { id: "update-pages", label: "Update Pages", icon: FileStack },
      { id: "update-menu-order", label: "Update Menu Order", icon: Menu },
    ],
  },
  // 6️⃣ Demo Issue Manager
  {
    id: "demo-issue-manager",
    label: "Demo Issue Manager",
    icon: Bug,
    badge: "3",
    subItems: [
      { id: "report-bug", label: "Report Bug", icon: Bug },
      { id: "view-bug-list", label: "View Bug List", icon: ListChecks },
      { id: "bug-severity", label: "Bug Severity", icon: Gauge },
      { id: "bug-status", label: "Bug Status", icon: Clock },
      { id: "fix-history", label: "Fix History", icon: History },
    ],
  },
  // 7️⃣ Vala AI (Demo Assistant)
  {
    id: "vala-ai",
    label: "Vala AI",
    icon: Bot,
    badge: "AI",
    subItems: [
      { id: "ai-fix-demo-issue", label: "Fix Demo Issue", icon: Wrench },
      { id: "ai-upgrade-demo-feature", label: "Upgrade Demo Feature", icon: Sparkles },
      { id: "ai-optimize-demo-flow", label: "Optimize Demo Flow", icon: Zap },
      { id: "ai-repair-broken-button", label: "Repair Broken Button", icon: PlusCircle },
      { id: "ai-health-scan-demo", label: "Health Scan Demo", icon: ScanLine },
    ],
  },
  // 8️⃣ Demo Upgrade Queue
  {
    id: "demo-upgrade-queue",
    label: "Demo Upgrade Queue",
    icon: ArrowUpCircle,
    subItems: [
      { id: "pending-upgrade", label: "Pending Upgrade", icon: CircleDot },
      { id: "approved-upgrade", label: "Approved Upgrade", icon: CheckCircle },
      { id: "in-progress-upgrade", label: "In-Progress Upgrade", icon: Loader2 },
      { id: "completed-upgrade", label: "Completed Upgrade", icon: CheckSquare },
    ],
  },
  // 9️⃣ Demo Validation
  {
    id: "demo-validation",
    label: "Demo Validation",
    icon: CheckSquare,
    subItems: [
      { id: "button-click-test", label: "Button Click Test", icon: PlusCircle },
      { id: "flow-test", label: "Flow Test", icon: Activity },
      { id: "role-access-test", label: "Role Access Test", icon: Users },
      { id: "ui-integrity-check", label: "UI Integrity Check", icon: Monitor },
    ],
  },
  // 🔟 Marketplace Sync
  {
    id: "marketplace-sync",
    label: "Marketplace Sync",
    icon: Store,
    subItems: [
      { id: "demo-visible-marketplace", label: "Visible on Marketplace", icon: Eye },
      { id: "hide-show-demo", label: "Hide / Show Demo", icon: EyeOff },
      { id: "sync-demo-data", label: "Sync Demo Data", icon: RefreshCw },
      { id: "pricing-preview", label: "Pricing Preview", icon: DollarSign },
    ],
  },
  // 1️⃣1️⃣ Activity Logs
  {
    id: "activity-logs",
    label: "Activity Logs",
    icon: FileStack,
    subItems: [
      { id: "demo-changes-log", label: "Demo Changes Log", icon: History },
      { id: "ai-actions-log", label: "AI Actions Log", icon: Brain },
      { id: "manager-actions-log", label: "Manager Actions Log", icon: UserCog },
    ],
  },
  // 1️⃣2️⃣ Security & Lock
  {
    id: "security-lock",
    label: "Security & Lock",
    icon: Shield,
    subItems: [
      { id: "demo-lock", label: "Demo Lock", icon: Lock },
      { id: "read-only-mode", label: "Read-Only Mode", icon: BookLock },
      { id: "copy-disable", label: "Copy Disable", icon: Copy },
      { id: "inspect-disable", label: "Inspect Disable", icon: Search },
    ],
  },
];

const DemoManagerSidebar = ({ activeView, onViewChange }: DemoManagerSidebarProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<string[]>(["demo-overview"]);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Demo Manager';
  const maskedId = `DM-${user?.id?.slice(0, 4).toUpperCase() || 'XXXX'}`;

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleItemClick = (itemId: string, hasSubItems: boolean) => {
    if (hasSubItems) {
      toggleSection(itemId);
    } else {
      onViewChange(itemId);
    }
  };

  const isActiveParent = (section: MenuItem) => {
    if (activeView === section.id) return true;
    return section.subItems?.some(sub => activeView === sub.id) || false;
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="h-screen w-64 bg-card border-r border-border/30 flex flex-col sticky top-0"
    >
      <div className="p-4 border-b border-border/30 flex justify-center">
        <img 
          src={softwareValaLogo} 
          alt="Software Vala Logo" 
          className="w-14 h-14 rounded-full object-contain border-2 border-cyan-500/30"
        />
      </div>

      {/* Quick Stats */}
      <div className="p-4 border-b border-border/30">
        <div className="glass-panel-glow p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-neon-teal" />
            <span className="text-xs font-mono text-neon-teal">GLOBAL STATUS</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-mono font-bold text-neon-green">5K+</div>
              <div className="text-[9px] text-muted-foreground">TOTAL</div>
            </div>
            <div>
              <div className="text-lg font-mono font-bold text-neon-teal">47</div>
              <div className="text-[9px] text-muted-foreground">ACTIVE</div>
            </div>
            <div>
              <div className="text-lg font-mono font-bold text-neon-orange">3</div>
              <div className="text-[9px] text-muted-foreground">FIX</div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items - Scrollable */}
      <ScrollArea className="flex-1">
        <div className="py-2 px-2 space-y-1">
          {menuSections.map((section, index) => {
            const Icon = section.icon;
            const isExpanded = expandedSections.includes(section.id);
            const hasSubItems = section.subItems && section.subItems.length > 0;
            const isActive = isActiveParent(section);

            return (
              <div key={section.id}>
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleItemClick(section.id, !!hasSubItems)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-left",
                    isActive
                      ? "bg-neon-teal/10 text-neon-teal border-l-2 border-neon-teal"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                  style={isActive ? { boxShadow: "inset 0 0 20px hsl(174 100% 45% / 0.1)" } : {}}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-medium truncate flex-1">{section.label}</span>
                  {section.badge && (
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full font-mono",
                      section.badge === "LIVE" || section.badge === "AI"
                        ? "bg-neon-green/20 text-neon-green animate-pulse"
                        : "bg-neon-teal/20 text-neon-teal"
                    )}>
                      {section.badge}
                    </span>
                  )}
                  {hasSubItems && (
                    isExpanded 
                      ? <ChevronDown className="w-3 h-3 flex-shrink-0" />
                      : <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  )}
                </motion.button>

                {/* Sub Items */}
                <AnimatePresence>
                  {hasSubItems && isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-6 py-1 space-y-0.5">
                        {section.subItems?.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isSubActive = activeView === subItem.id;

                          return (
                            <button
                              key={subItem.id}
                              onClick={() => onViewChange(subItem.id)}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200 text-left",
                                isSubActive
                                  ? "bg-neon-teal/15 text-neon-teal"
                                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                              )}
                            >
                              <SubIcon className="w-3 h-3 flex-shrink-0" />
                              <span className="text-[11px] truncate">{subItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* User Info & Actions */}
      <div className="p-3 border-t border-border/30 space-y-2">
        {/* User Info */}
        <div className="flex items-center gap-3 px-3 py-2 bg-secondary/30 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-teal to-neon-green flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{userName}</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[8px] px-1 py-0 bg-neon-teal/10 text-neon-teal border-neon-teal/30">
                DEMO MANAGER
              </Badge>
              <span className="text-[8px] text-muted-foreground font-mono">{maskedId}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex-1 text-[10px] gap-1 h-7 border-border/50"
          >
            <ArrowLeft className="w-3 h-3" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/settings')}
            className="text-[10px] gap-1 h-7 border-border/50 px-2"
          >
            <Settings className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-[10px] gap-1 h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
          >
            <LogOut className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </motion.aside>
  );
};

export default DemoManagerSidebar;
