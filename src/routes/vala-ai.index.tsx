import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { ValaAICommandCenter } from "@/components/vala-ai/ValaAICommandCenter";

export const Route = createFileRoute("/vala-ai/")({
  head: pageHead("Vala AI", "The platform's own AI workspace — projects, models, prompts and execution logs."),
  component: ValaAICommandCenter,
});
