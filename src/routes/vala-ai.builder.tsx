import { createFileRoute } from "@tanstack/react-router";
import { StudioBuilder } from "@/components/vala-ai/studio/StudioBuilder";
import { pageHead } from "@/lib/seo-head";

export const Route = createFileRoute("/vala-ai/builder")({
  head: pageHead(
    "Website builder · Vala AI",
    "Build and edit a website using the configured Vala model.",
  ),
  validateSearch: (
    s: Record<string, unknown>,
  ): { prompt?: string; theme?: string; layout?: string } => ({
    prompt: typeof s.prompt === "string" ? s.prompt : undefined,
    theme: typeof s.theme === "string" ? s.theme : undefined,
    layout: typeof s.layout === "string" ? s.layout : undefined,
  }),
  component: StudioBuilder,
});
