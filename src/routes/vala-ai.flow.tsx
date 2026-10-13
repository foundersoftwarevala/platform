import { createFileRoute } from "@tanstack/react-router";
import { StudioFlow } from "@/components/vala-ai/studio/StudioFlow";
import { pageHead } from "@/lib/seo-head";

export const Route = createFileRoute("/vala-ai/flow")({
  head: pageHead("Project flow · Vala AI", "Requirement to delivery inside the Control Panel."),
  component: StudioFlow,
});
