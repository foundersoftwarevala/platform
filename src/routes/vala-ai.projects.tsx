import { createFileRoute } from "@tanstack/react-router";
import { ActiveProjectPanel } from "@/components/vala-ai/panels/ActiveProjectPanel";

export const Route = createFileRoute("/vala-ai/projects")({
  component: ActiveProjectPanel,
});
