import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { CreditsPanel } from "@/components/vala-ai/panels/CreditsPanel";

export const Route = createFileRoute("/vala-ai/credits")({
  head: pageHead("Credits · Vala AI", "Credit balance and spend across the AI workspace."),
  component: CreditsPanel,
});
