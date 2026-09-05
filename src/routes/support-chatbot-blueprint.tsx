import { createFileRoute } from "@tanstack/react-router";
import SupportChatbotWireframe from "@/components/support-chatbot-wireframe/SupportChatbotWireframe";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createFileRoute("/support-chatbot-blueprint")({
  // Dashboard UI is live/interactive; skip SSR so timers and live data hydrate cleanly.
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Support Chatbot Blueprint | Software Vala" },
      {
        name: "description",
        content:
          "Structural blueprint view of the support chatbot suite: dashboard, bot list, live chats, training, automation, languages, analytics, logs and settings.",
      },
      { property: "og:title", content: "Support Chatbot Blueprint | Software Vala" },
      {
        property: "og:description",
        content: "Blueprint view of the chatbot suite screens and navigation structure.",
      },
    ],
  }),
  component: BlueprintPage,
});

function BlueprintPage() {
  return (
    <TooltipProvider>
      <SupportChatbotWireframe />
    </TooltipProvider>
  );
}
