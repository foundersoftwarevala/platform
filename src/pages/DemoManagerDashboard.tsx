import { useState } from "react";
import { useNavigate } from "@/hooks/useNavigate";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Activity,
  Link2,
  BarChart3,
  Package,
  PlusCircle,
  Monitor,
  Globe,
  Settings,
  LogOut,
  Lock,
  AlertTriangle,
  History,
  FileText,
  Clock,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PageShell, PageBanner } from "@/components/layout/PageShell";
import DemoDashboard from "@/components/demo-manager/DemoDashboard";
import DemoStatusGrid from "@/components/demo-manager/DemoStatusGrid";
import DemoUptimeMonitor from "@/components/demo-manager/DemoUptimeMonitor";
import DemoURLManager from "@/components/demo-manager/DemoURLManager";
import DemoAnalytics from "@/components/demo-manager/DemoAnalytics";
import DemoCatalog from "@/components/demo-manager/DemoCatalog";
import DemoCreator from "@/components/demo-manager/DemoCreator";
import DemoBrokenAlerts from "@/components/demo-manager/DemoBrokenAlerts";
import DemoActivityLogs from "@/components/demo-manager/DemoActivityLogs";
import DemoPendingRequests from "@/components/demo-manager/DemoPendingRequests";

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid, badge: "LIVE" },
  { id: "status", label: "Demo Status Grid", icon: Activity, badge: "47" },
  { id: "broken", label: "Broken Demos", icon: AlertTriangle, badge: "3" },
  { id: "uptime", label: "Uptime Monitor", icon: Clock, badge: "99.9%" },
  { id: "urls", label: "URL Manager", icon: Link2, badge: null },
  { id: "analytics", label: "Click Analytics", icon: BarChart3, badge: null },
  { id: "catalog", label: "Demo Catalog", icon: Package, badge: "40+" },
  { id: "create", label: "Add Demo", icon: PlusCircle, badge: null },
  { id: "requests", label: "Pending Requests", icon: FileText, badge: "5" },
  { id: "logs", label: "Activity Log", icon: History, badge: null },
];

const DemoManagerDashboard = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <DemoDashboard />;
      case "status":
        return <DemoStatusGrid />;
      case "broken":
        return <DemoBrokenAlerts />;
      case "uptime":
        return <DemoUptimeMonitor />;
      case "urls":
        return <DemoURLManager />;
      case "analytics":
        return <DemoAnalytics />;
      case "catalog":
        return <DemoCatalog />;
      case "create":
        return <DemoCreator />;
      case "requests":
        return <DemoPendingRequests />;
      case "logs":
        return <DemoActivityLogs />;
      default:
        return <DemoDashboard />;
    }
  };

  const current = menuItems.find((m) => m.id === activeSection) ?? menuItems[0];

  return (
    <PageShell>
      <PageBanner
        icon={current.icon}
        eyebrow="demo manager · live software control"
        title="Demo Dashboard"
        subtitle={`${current.label} — uptime, broken demos, URLs, click analytics, catalog and activity in one place.`}
        action={
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-1.5 rounded-xl bg-primary-foreground/15 px-3 py-2 text-xs font-medium ring-1 ring-primary-foreground/25 transition-colors hover:bg-primary-foreground/25"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        }
      />

      <div className="pill-nav overflow-x-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={
                isActive
                  ? "flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-primary/40"
                  : "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {item.label}
              {item.badge && (
                <span className="rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] text-primary">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25 }}
          className="min-w-0"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </PageShell>
  );
};

export default DemoManagerDashboard;
