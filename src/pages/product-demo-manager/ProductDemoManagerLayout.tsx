import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, Plus, MonitorPlay, Upload,
  BarChart3, FileText, Settings, ChevronRight, Lock,
  ShieldAlert, Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageBanner } from "@/components/layout/PageShell";
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

const ProductDemoManagerLayout = () => {
  const [activeSection, setActiveSection] = useState("dashboard");

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <ProductDashboard />;
      case "add-product":
        return <AddProduct onSuccess={() => setActiveSection("products")} />;
      case "products":
        return <ProductList />;
      case "demo-manager":
        return <DemoManager />;
      case "add-demo":
        return <AddDemo onSuccess={() => setActiveSection("demo-manager")} />;
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
        eyebrow="live demo operations · full CRUD · full audit"
        title="Product & Demo Studio"
        subtitle={`${current.label} — catalog, demo URLs, product relationships, health checks and audit trail.`}
      />

      <div className="pill-nav overflow-x-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const isDisabled = item.locked;
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setActiveSection(item.id)}
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
              {item.label}
              {item.readOnly && (
                <Badge
                  variant="outline"
                  className="ml-0.5 px-1 py-0 text-[8px] border-border text-muted-foreground"
                >
                  READ
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
