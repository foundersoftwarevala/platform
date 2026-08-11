import type { RoleConfig } from "@/lib/roles";
import { CrudWorkspace } from "@/components/dashboard/CrudWorkspace";
import { AMSEngine } from "@/components/dashboard/ams/AMSEngine";
import { AMSWorkspace } from "@/components/dashboard/AMSWorkspace";
import { AMSCenterWorkspace } from "@/components/dashboard/AMSCenterWorkspace";

export function ModulePage({ role, moduleKey, onBack }: { role: RoleConfig; moduleKey: string; onBack: () => void }) {
  if (moduleKey === "achievements") return <AMSEngine role={role} onBack={onBack} />;
  if (moduleKey === "ams")          return <AMSWorkspace role={role} onBack={onBack} />;
  if (moduleKey === "ams-center")   return <AMSCenterWorkspace onBack={onBack} />;
  return <CrudWorkspace role={role} moduleKey={moduleKey} onBack={onBack} />;
}

