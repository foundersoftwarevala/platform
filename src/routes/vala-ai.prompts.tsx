import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { PromptHistoryPanel } from "@/components/vala-ai/panels/PromptHistoryPanel";

export const Route = createFileRoute("/vala-ai/prompts")({
  head: pageHead("Prompts · Vala AI", "Saved prompts used by the AI workspace."),
  component: PromptHistoryPanel,
});
