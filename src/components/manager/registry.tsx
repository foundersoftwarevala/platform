import { lazy, Suspense, type ComponentType } from "react";

import { Spinner } from "./primitives";

export interface ScreenProps {
  view?: string | undefined;
}

const SCREENS: Record<string, ComponentType<ScreenProps>> = {
  dashboard: lazy(() => import("./screens/DashboardScreen")),
  "ai-api": lazy(() => import("./screens/AiApiScreen")),
  "external-api": lazy(() => import("./screens/ExternalApiScreen")),
  "usage-monitor": lazy(() => import("./screens/UsageMonitorScreen")),
  "product-api": lazy(() => import("./screens/ProductApiScreen")),
  "role-api": lazy(() => import("./screens/RoleApiScreen")),
  wallet: lazy(() => import("./screens/WalletScreen")),
  billing: lazy(() => import("./screens/BillingScreen")),
  alerts: lazy(() => import("./screens/AlertsScreen")),
  optimizer: lazy(() => import("./screens/OptimizerScreen")),
  security: lazy(() => import("./screens/SecurityScreen")),
  audit: lazy(() => import("./screens/AuditScreen")),
  emergency: lazy(() => import("./screens/EmergencyScreen")),
  registry: lazy(() => import("./screens/RegistryScreen")),
  gateway: lazy(() => import("./screens/GatewayScreen")),
  governance: lazy(() => import("./screens/GovernanceScreen")),
  settings: lazy(() => import("./screens/SettingsScreen")),
  "seo-manager": lazy(() => import("./screens/SeoManagerScreen")),
  "lead-generator": lazy(() => import("./screens/LeadGeneratorScreen")),
  "traffic-automation": lazy(() => import("./screens/TrafficAutomationScreen")),
  "ai-content": lazy(() => import("./screens/AiContentScreen")),
  subscription: lazy(() => import("./screens/SubscriptionScreen")),
  "cloud-connectors": lazy(() => import("./screens/CloudConnectorsScreen")),
  monitoring: lazy(() => import("./screens/MonitoringScreen")),
  finance: lazy(() => import("@/components/finance/FinanceManager").then(({ FinanceManager }) => ({ default: FinanceManager }))),
};

export function ScreenRenderer({ section, view }: { section: string; view?: string | undefined }) {
  const Screen = SCREENS[section] ?? SCREENS["dashboard"]!;
  return (
    <Suspense fallback={<Spinner />}>
      <Screen view={view} />
    </Suspense>
  );
}
