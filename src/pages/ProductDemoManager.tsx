import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DemoManagerSidebar from "@/components/demo-manager/DemoManagerSidebar";
import DemoManagerTopBar from "@/components/demo-manager/DemoManagerTopBar";
import DemoDashboard from "@/components/demo-manager/DemoDashboard";
import DemoAddEdit from "@/components/demo-manager/DemoAddEdit";
import DemoClickAnalytics from "@/components/demo-manager/DemoClickAnalytics";
import DemoUptimeAlerts from "@/components/demo-manager/DemoUptimeAlerts";
import DemoRentalAssignment from "@/components/demo-manager/DemoRentalAssignment";
import DemoNotifications from "@/components/demo-manager/DemoNotifications";
import BulkDemoCreator from "@/components/demo-manager/BulkDemoCreator";
import DemoLoginManager from "@/components/demo-manager/DemoLoginManager";
import DemoURLCollector from "@/components/demo-manager/DemoURLCollector";
import SoftwareCatalogManager from "@/components/demo-manager/SoftwareCatalogManager";

type DemoView = 
  | "dashboard"
  | "manage"
  | "analytics"
  | "uptime"
  | "rentals"
  | "bulk-create"
  | "logins"
  | "url-collect"
  | "software-catalog";

const ProductDemoManager = () => {
  const [activeView, setActiveView] = useState<DemoView>("dashboard");
  const [showNotifications, setShowNotifications] = useState(false);

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <DemoDashboard />;
      case "manage":
        return <DemoAddEdit />;
      case "analytics":
        return <DemoClickAnalytics />;
      case "uptime":
        return <DemoUptimeAlerts />;
      case "rentals":
        return <DemoRentalAssignment />;
      case "bulk-create":
        return <BulkDemoCreator />;
      case "logins":
        return <DemoLoginManager />;
      case "url-collect":
        return <DemoURLCollector />;
      case "software-catalog":
        return <SoftwareCatalogManager />;
      default:
        return <DemoDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background grid-lines flex">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-teal/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-neon-green/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      </div>

      <DemoManagerSidebar activeView={activeView} onViewChange={(view) => setActiveView(view as DemoView)} />
      
      <div className="flex-1 flex flex-col ml-64">
        <DemoManagerTopBar onNotificationsClick={() => setShowNotifications(true)} />
        
        <main className="flex-1 p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <DemoNotifications 
        open={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
    </div>
  );
};

export default ProductDemoManager;
