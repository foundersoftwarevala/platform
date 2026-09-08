import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { ActiveProjectPanel } from "@/components/vala-ai/panels/ActiveProjectPanel";

export const Route = createFileRoute("/vala-ai/projects")({
  head: pageHead("Projects · Vala AI", "Projects held in the AI workspace."),
  component: ActiveProjectPanel,
});
