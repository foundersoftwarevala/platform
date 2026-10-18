import type { RoleConfig } from "@/lib/roles";
import { CrudWorkspace } from "@/components/dashboard/CrudWorkspace";
import { ResellerClientsWorkspace } from "@/components/dashboard/reseller/ResellerClientsWorkspace";
import { ResellerLicensesWorkspace } from "@/components/dashboard/reseller/ResellerLicensesWorkspace";
import { ResellerLeadsWorkspace } from "@/components/dashboard/reseller/ResellerLeadsWorkspace";
import { ResellerLedgerWorkspace } from "@/components/dashboard/reseller/ResellerLedgerWorkspace";
import { AMSEngine } from "@/components/dashboard/ams/AMSEngine";
import { AMSWorkspace } from "@/components/dashboard/AMSWorkspace";
import { AMSCenterWorkspace } from "@/components/dashboard/AMSCenterWorkspace";

export function ResellerModulePage({ role, moduleKey, onBack }: { role: RoleConfig; moduleKey: string; onBack: () => void }) {
  if (moduleKey === "clients")      return <ResellerClientsWorkspace onBack={onBack} />;
  if (moduleKey === "licenses")     return <ResellerLicensesWorkspace onBack={onBack} />;
  if (moduleKey === "leads")        return <ResellerLeadsWorkspace onBack={onBack} />;
  if (moduleKey === "commissions")  return <ResellerLedgerWorkspace view="commissions" onBack={onBack} />;
  if (moduleKey === "revenue")      return <ResellerLedgerWorkspace view="revenue" onBack={onBack} />;
  if (moduleKey === "renewals")     return <ResellerLedgerWorkspace view="renewals" onBack={onBack} />;
  if (moduleKey === "achievements") return <AMSEngine role={role} onBack={onBack} />;
  if (moduleKey === "ams")          return <AMSWorkspace role={role} onBack={onBack} />;
  if (moduleKey === "ams-center")   return <AMSCenterWorkspace onBack={onBack} dashboardRole={role.key} />;
  return <CrudWorkspace role={role} moduleKey={moduleKey} onBack={onBack} />;
}

