import { createFileRoute } from "@tanstack/react-router";
import { SupportChatbotDashboard } from "@/components/support-chatbot/SupportChatbotDashboard";

export const Route = createFileRoute("/support-chatbot")({
  // Dashboard UI is live/interactive; skip SSR so timers and live data hydrate cleanly.
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Support Chatbot Console | Software Vala" },
      {
        name: "description",
        content:
          "Manage support chatbots: bot training, live chat inbox, automation rules, multi-language, Android integration and analytics.",
      },
      { property: "og:title", content: "Support Chatbot Console | Software Vala" },
      {
        property: "og:description",
        content: "Bot training, live chat inbox, automation rules and chatbot analytics.",
      },
    ],
  }),
  component: SupportChatbotDashboard,
});
