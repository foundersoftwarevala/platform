import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { ModelsPanel } from "@/components/vala-ai/panels/ModelsPanel";

export const Route = createFileRoute("/vala-ai/models")({
  head: pageHead("Models · Vala AI", "Models available to the AI workspace and how they are configured."),
  component: ModelsPanel,
});
