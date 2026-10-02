import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, Plus, MonitorPlay, Upload,
  BarChart3, FileText, Settings, ChevronRight, Lock,
  ShieldAlert, Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageBanner } from "@/components/layout/PageShell";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n/messages";
import ProductDashboard from "./ProductDashboard";
import AddProduct from "./AddProduct";
import ProductList from "./ProductList";
import DemoManager from "./DemoManager";
import AddDemo from "./AddDemo";
import BulkAdd from "./BulkAdd";
import ProductAnalytics from "./ProductAnalytics";
import ProductAuditLogs from "./ProductAuditLogs";
import HealthCheckPanel from "@/components/demo-manager/HealthCheckPanel";

type MenuItemType = {
  id: string;
  label: string;
  icon: React.ElementType;
  locked?: boolean;
  readOnly?: boolean;
};

const menuItems: MenuItemType[] = [
  { id: "dashboard", label: "Product Dashboard", icon: LayoutDashboard, readOnly: true },
  { id: "add-product", label: "Add Product", icon: Plus },
  { id: "products", label: "Product List", icon: Package, readOnly: true },
  { id: "demo-manager", label: "Demo Manager", icon: MonitorPlay, readOnly: true },
  { id: "add-demo", label: "Add Demo", icon: Plus },
  { id: "bulk-add", label: "Bulk Add", icon: Upload },
  { id: "health-check", label: "Health Check", icon: Activity },
  { id: "analytics", label: "Analytics", icon: BarChart3, readOnly: true },
  { id: "audit-logs", label: "Audit Logs", icon: FileText, readOnly: true },
  { id: "settings", label: "Settings", icon: Settings, locked: true },
];

const TAB_KEYS: Record<string, MessageKey> = {
  dashboard: "manager.products.tab_dashboard",
  "add-product": "manager.products.tab_add_product",
  products: "manager.products.tab_products",
  "demo-manager": "manager.products.tab_demo_manager",
  "add-demo": "manager.products.tab_add_demo",
  "bulk-add": "manager.products.tab_bulk_add",
  "health-check": "manager.products.tab_health_check",
  analytics: "manager.products.tab_analytics",
  "audit-logs": "manager.products.tab_audit_logs",
  settings: "manager.products.tab_settings",
};

const ProductDemoManagerLayout = () => {
  const { t } = useTranslation();
  // Tab labels through t(); the id picks the message, so the list itself stays data.
  const label = (item: MenuItemType) => (TAB_KEYS[item.id] ? t(TAB_KEYS[item.id]) : item.label);
  // The tab lives in the address (?tab=products), so a tab can be linked to and
  // a refresh or Back keeps it. It was component state only: every refresh
  // went back to the dashboard.
  const [activeSection, setActiveSection] = useState("dashboard");
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    const item = menuItems.find((m) => m.id === wanted);
    if (item && !item.locked) setActiveSection(item.id);
    const onPop = () => {
      const back = new URLSearchParams(window.location.search).get("tab");
      setActiveSection(menuItems.some((m) => m.id === back && !m.locked) ? String(back) : "dashboard");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const open = (id: string) => {
    setActiveSection(id);
    const url = new URL(window.location.href);
    if (id === "dashboard") url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    if (url.href !== window.location.href) window.history.pushState(null, "", url);
  };

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <ProductDashboard />;
      case "add-product":
        return <AddProduct onSuccess={() => open("products")} />;
      case "products":
        return <ProductList />;
      case "demo-manager":
        return <DemoManager />;
      case "add-demo":
        return <AddDemo onSuccess={() => open("demo-manager")} />;
      case "bulk-add":
        return <BulkAdd />;
      case "health-check":
        return <HealthCheckPanel />;
      case "analytics":
        return <ProductAnalytics />;
      case "audit-logs":
        return <ProductAuditLogs />;
      default:
        return <ProductDashboard />;
    }
  };

  const current = menuItems.find((m) => m.id === activeSection) ?? menuItems[0];

  return (
    <PageShell>
      <PageBanner
        icon={current.icon as never}
        eyebrow={t("manager.products.studio_eyebrow")}
        title={t("manager.products.studio_title")}
        subtitle={t("manager.products.studio_subtitle", { section: label(current) })}
      />

      <div className="pill-nav overflow-x-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const isDisabled = item.locked;
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && open(item.id)}
              disabled={isDisabled}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors",
                isActive
                  ? "bg-primary/20 text-foreground font-medium ring-1 ring-primary/40"
                  : isDisabled
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label(item)}
              {item.readOnly && (
                <Badge
                  variant="outline"
                  className="ml-0.5 px-1 py-0 text-[8px] border-border text-muted-foreground"
                >
                  {t("manager.products.read_badge")}
                </Badge>
              )}
              {item.locked && <Lock className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeSection}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="min-w-0"
      >
        {renderContent()}
      </motion.div>
    </PageShell>
  );
};

export default ProductDemoManagerLayout;
