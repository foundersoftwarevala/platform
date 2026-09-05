import { createFileRoute } from "@tanstack/react-router";
import SecureSalesSupportManagerDashboard from "@/components/salespages/SecureSalesSupportManagerDashboard";
import { SalesSupportManagerShell } from "@/components/salespages/SalesSupportManagerShell";
import { RequireRole } from "@/components/auth/RequireRole";

export const Route = createFileRoute("/sales-support-manager")({
  // Dashboard UI is live/interactive; skip SSR so timers and live data hydrate cleanly.
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sales & Support Manager Console | Software Vala" },
      {
        name: "description",
        content:
          "Manager console for assigned leads, sales pipeline, support tickets, SLA alerts, escalations, team performance and audit reports.",
      },
      { property: "og:title", content: "Sales & Support Manager Console | Software Vala" },
      {
        property: "og:description",
        content:
          "Assigned leads, pipeline, tickets, SLA alerts, escalations and team performance for managers.",
      },
    ],
  }),
  component: SalesSupportManagerRoute,
});

function SalesSupportManagerRoute() {
  return (
    <RequireRole role="sales">
      <SalesSupportManagerShell>
        <SecureSalesSupportManagerDashboard />
      </SalesSupportManagerShell>
    </RequireRole>
  );
}
