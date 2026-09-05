import { createFileRoute } from "@tanstack/react-router";
import SalesCRMDemo from "@/components/salespages/crm/SalesCRMDemo";

export const Route = createFileRoute("/sales-crm")({
  // Dashboard UI is live/interactive; skip SSR so timers and live data hydrate cleanly.
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sales CRM | Software Vala" },
      {
        name: "description",
        content:
          "Sales CRM with lead management, customers, deal tracking, tasks & follow-ups, reports and configuration.",
      },
      { property: "og:title", content: "Sales CRM | Software Vala" },
      {
        property: "og:description",
        content: "Leads, customers, deals, tasks and reports in the Software Vala Sales CRM.",
      },
    ],
  }),
  component: SalesCRMDemo,
});
