import { createFileRoute } from "@tanstack/react-router";
import { ModelsPanel } from "@/components/vala-ai/panels/ModelsPanel";

export const Route = createFileRoute("/vala-ai/models")({
  component: ModelsPanel,
});
