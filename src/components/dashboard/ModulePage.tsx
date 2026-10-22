import type { RoleConfig } from "@/lib/roles";
import { CrudWorkspace } from "@/components/dashboard/CrudWorkspace";
import { AMSEngine } from "@/components/dashboard/ams/AMSEngine";
import { AMSWorkspace } from "@/components/dashboard/AMSWorkspace";
import { AMSCenterWorkspace } from "@/components/dashboard/AMSCenterWorkspace";
import { AuthorProductsWorkspace } from "@/components/dashboard/AuthorProductsWorkspace";
import { DMWallet } from "@/components/developer-management/screens/DMWallet";
import { DMPromises } from "@/components/developer-management/screens/DMPromises";

export function ModulePage({
  role,
  moduleKey,
  onBack,
}: {
  role: RoleConfig;
  moduleKey: string;
  onBack: () => void;
}) {
  if (moduleKey === "achievements") return <AMSEngine role={role} onBack={onBack} />;
  if (moduleKey === "ams") return <AMSWorkspace role={role} onBack={onBack} />;
  if (moduleKey === "ams-center")
    return <AMSCenterWorkspace onBack={onBack} dashboardRole={role.key} />;
  if (role.key === "author" && moduleKey === "products") {
    return <AuthorProductsWorkspace role={role} onBack={onBack} />;
  }
  if (role.key === "developer" && moduleKey === "wallet") return <DMWallet />;
  if (role.key === "developer" && moduleKey === "promises") return <DMPromises />;
  return <CrudWorkspace role={role} moduleKey={moduleKey} onBack={onBack} />;
}
