import { createFileRoute } from "@tanstack/react-router";
import InternalSupportAIPage from "@/components/salespages/InternalSupportAIPage";

export const Route = createFileRoute("/internal-support-ai")({
  // Dashboard UI is live/interactive; skip SSR so timers and live data hydrate cleanly.
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Internal Support AI | Software Vala" },
      {
        name: "description",
        content:
          "AI-first internal support: auto issue detection, auto-fix engine, escalation manager, AI transparency log and security controls.",
      },
      { property: "og:title", content: "Internal Support AI | Software Vala" },
      {
        property: "og:description",
        content: "Auto issue detection, auto-fix engine, escalations and AI transparency logs.",
      },
    ],
  }),
  component: InternalSupportAIPage,
});
