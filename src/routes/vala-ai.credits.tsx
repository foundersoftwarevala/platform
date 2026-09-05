import { createFileRoute } from "@tanstack/react-router";
import { CreditsPanel } from "@/components/vala-ai/panels/CreditsPanel";

export const Route = createFileRoute("/vala-ai/credits")({
  component: CreditsPanel,
});
