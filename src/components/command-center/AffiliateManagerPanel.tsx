import { ModuleDashboard } from "@/components/creator/ModuleDashboard";
import { affiliateConfig } from "@/components/creator/moduleConfigs";

export function AffiliateManagerPanel() {
  return <ModuleDashboard config={affiliateConfig} />;
}
