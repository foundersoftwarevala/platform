import { createFileRoute } from "@tanstack/react-router";
import { PromptHistoryPanel } from "@/components/vala-ai/panels/PromptHistoryPanel";

export const Route = createFileRoute("/vala-ai/prompts")({
  component: PromptHistoryPanel,
});
