import { ModuleDashboard } from "@/components/creator/ModuleDashboard";
import { resellerConfig } from "@/components/creator/moduleConfigs";

export function ResellerManagerPanel() {
  return <ModuleDashboard config={resellerConfig} />;
}
