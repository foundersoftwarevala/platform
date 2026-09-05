import { createFileRoute } from "@tanstack/react-router";
import { ValaAICommandCenter } from "@/components/vala-ai/ValaAICommandCenter";

export const Route = createFileRoute("/vala-ai/")({
  component: ValaAICommandCenter,
});
