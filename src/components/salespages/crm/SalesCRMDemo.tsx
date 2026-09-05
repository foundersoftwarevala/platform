import { useSearch } from "@tanstack/react-router";
import { CRMAuthProvider, useCRMAuth } from "@/hooks/useCRMAuth";
import SalesCRMLayout from "@/components/sales-crm/SalesCRMLayout";
import SalesCRMDashboard from "./SalesCRMDashboard";
import LeadManagement from "./LeadManagement";
import CustomerManagement from "./CustomerManagement";
import DealTracking from "./DealTracking";
import TasksFollowups from "./TasksFollowups";
import SalesCRMReports from "./SalesCRMReports";
import SalesCRMSettings from "./SalesCRMSettings";
import { Loader2 } from "lucide-react";

const SalesCRMContent = () => {
  const { section } = useSearch({ from: "/sales-crm" });
  const activeSection = section ?? "dashboard";
  const { isLoading } = useCRMAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <SalesCRMDashboard />;
      case "leads":
        return <LeadManagement />;
      case "customers":
        return <CustomerManagement />;
      case "deals":
        return <DealTracking />;
      case "tasks":
        return <TasksFollowups />;
      case "reports":
        return <SalesCRMReports />;
      case "settings":
        return <SalesCRMSettings />;
      default:
        return <SalesCRMDashboard />;
    }
  };

  return (
    <SalesCRMLayout>
      {renderContent()}
    </SalesCRMLayout>
  );
};

const SalesCRMDemo = () => {
  return (
    <CRMAuthProvider>
      <SalesCRMContent />
    </CRMAuthProvider>
  );
};

export default SalesCRMDemo;
